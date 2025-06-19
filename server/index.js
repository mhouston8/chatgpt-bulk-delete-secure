// Load environment variables from the server directory
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Debug logging for environment setup
console.log('Environment Setup:', {
    nodeEnv: process.env.NODE_ENV || 'not set',
    currentWorkingDir: process.cwd(),
    serverDir: __dirname,
    envFileLocation: require('path').join(__dirname, '.env'),
    stripeKeyPresent: process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No',
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 7) + '...' : 'Not found',
    port: process.env.PORT || '3000 (default)'
});

// Verify Stripe key before creating the Stripe instance
if (!process.env.STRIPE_SECRET_KEY) {
    console.error('CRITICAL: STRIPE_SECRET_KEY is missing from environment variables');
    console.error('Please ensure:');
    console.error('1. .env file exists in the server directory');
    console.error('2. .env file contains STRIPE_SECRET_KEY=sk_test_...');
    console.error('3. Server is started from the correct directory');
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Log Stripe instance creation
console.log('Stripe instance created with key prefix:', process.env.STRIPE_SECRET_KEY.substring(0, 7) + '...');

// Add webhook secret to environment variables
if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is missing from environment variables');
    console.error('Please add STRIPE_WEBHOOK_SECRET to your .env file');
    process.exit(1);
}

const app = express();

// Enable CORS for the extension
app.use(cors({
    origin: [
        'chrome-extension://okcgpbcckagppdnehchokdankmcbidig',
        'http://localhost:3000',
        'https://chatgptbulkdelete.com'
    ],
    credentials: true
}));

// Serve static files from the landing directory
app.use(express.static(path.join(__dirname, '..', 'landing')));

// IMPORTANT: This must be BEFORE any other middleware that parses the body
// This ensures we get the raw body for webhook signature verification
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log('Webhook received:');
    console.log('- Headers:', JSON.stringify(req.headers, null, 2));
    console.log('- Signature:', sig);
    console.log('- Webhook Secret (first 7 chars):', webhookSecret ? webhookSecret.substring(0, 7) + '...' : 'undefined');

    if (!sig) {
        console.error('No Stripe signature found in headers');
        return res.status(400).json({ error: 'No signature found' });
    }

    if (!webhookSecret) {
        console.error('No webhook secret configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
        // req.body is already a Buffer because we used express.raw()
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log('Webhook event constructed successfully:', event.type);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).json({ error: err.message });
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log('Ccheckout.session.completed called: ', {
                    sessionId: session.id,
                    customerId: session.customer,
                    subscriptionId: session.subscription,
                    paymentStatus: session.payment_status,
                    metadata: session.metadata
                });

                // Get the user ID from the session metadata
                const userId = session.metadata.userId;
                if (!userId) {
                    console.error('No userId found in session metadata');
                    return res.status(400).json({ error: 'No userId in session metadata' });
                }

                // Update the user's premium status in the database
                const { error: updateError } = await supabase
                    .from('User')
                    .update({ is_premium_subscriber: true })
                    .eq('id', userId);

                if (updateError) {
                    console.error('Error updating user premium status:', updateError);
                    return res.status(500).json({ error: 'Failed to update user status' });
                }

                console.log('Successfully updated user premium status for user:', userId);
                break;

            case 'payment_intent.succeeded':
                console.log('payment_intent.succeeded called');
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                console.log('Payment failed:', {
                    paymentIntentId: failedPayment.id,
                    customerId: failedPayment.customer,
                    amount: failedPayment.amount,
                    status: failedPayment.status,
                    lastPaymentError: failedPayment.last_payment_error,
                    metadata: failedPayment.metadata
                });

                // Get the user ID from the payment intent metadata
                const failedUserId = failedPayment.metadata.userId;
                if (failedUserId) {
                    // Update the user's premium status to false
                    const { error: updateError } = await supabase
                        .from('User')
                        .update({ is_premium_subscriber: false })
                        .eq('id', failedUserId);

                    if (updateError) {
                        console.error('Error updating user premium status after failed payment:', updateError);
                    } else {
                        console.log('Successfully updated user premium status to false for user:', failedUserId);
                    }
                }

                break;

            case 'customer.subscription.created':
                const subscription = event.data.object;
                console.log('Subscription created:', {
                    subscriptionId: subscription.id,
                    customerId: subscription.customer,
                    status: subscription.status,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    metadata: subscription.metadata
                });

                // TODO: Update your database with subscription details
                // Example:
                // await createUserSubscription(subscription);

                break;

            case 'customer.subscription.deleted':
                const deletedSubscription = event.data.object;
                console.log('Subscription deleted:', {
                    subscriptionId: deletedSubscription.id,
                    customerId: deletedSubscription.customer,
                    status: deletedSubscription.status,
                    metadata: deletedSubscription.metadata
                });

                // TODO: Update your database to mark subscription as cancelled
                // Example:
                // await cancelUserSubscription(deletedSubscription.id);

                break;

            default:
                console.log('Unhandled event type:', event.type);
        }

        res.json({received: true});
    } catch (error) {
        console.error('Error processing webhook:', {
            error: error.message,
            eventType: event.type,
            eventId: event.id
        });
        res.status(500).json({error: 'Error processing webhook'});
    }
});

// IMPORTANT: This must be AFTER the webhook endpoint
// All other routes that need parsed JSON bodies go after this
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        console.log('Received checkout session request:', {
            body: req.body,
            headers: req.headers,
            origin: req.headers.origin,
            stripeKey: process.env.STRIPE_SECRET_KEY
        });

        const { priceId, successUrl, cancelUrl, userId } = req.body;

        // Validate required fields
        if (!priceId) {
            console.error('Missing priceId in request');
            return res.status(400).json({ error: 'priceId is required' });
        }
        if (!successUrl) {
            console.error('Missing successUrl in request');
            return res.status(400).json({ error: 'successUrl is required' });
        }
        if (!cancelUrl) {
            console.error('Missing cancelUrl in request');
            return res.status(400).json({ error: 'cancelUrl is required' });
        }
        if (!userId) {
            console.error('Missing userId in request');
            return res.status(400).json({ error: 'userId is required' });
        }

        console.log('Creating Stripe checkout session with:', {
            priceId,
            successUrl,
            cancelUrl,
            userId,
            mode: 'subscription'
        });

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            billing_address_collection: 'auto',
            allow_promotion_codes: true,
            metadata: {
                userId: userId
            }
        });

        console.log('Stripe session created successfully:', {
            sessionId: session.id,
            url: session.url,
            status: session.status,
            paymentStatus: session.payment_status,
            subscriptionId: session.subscription,
            customerId: session.customer
        });

        if (!session.url) {
            console.error('No URL in session response:', session);
            return res.status(500).json({ 
                error: 'Invalid session response from Stripe',
                details: 'No checkout URL provided'
            });
        }

        // Return both the session ID and URL
        res.json({ 
            id: session.id,
            url: session.url,
            status: session.status
        });
    } catch (error) {
        console.error('Detailed error in create-checkout-session:', {
            message: error.message,
            type: error.type,
            code: error.code,
            stack: error.stack,
            requestBody: req.body,
            stripeError: error.raw ? {
                type: error.raw.type,
                code: error.raw.code,
                message: error.raw.message,
                decline_code: error.raw.decline_code,
                param: error.raw.param
            } : null
        });
        
        // Send appropriate error response
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({ 
                error: 'Invalid request to Stripe',
                details: error.message,
                stripeError: error.raw
            });
        }
        
        res.status(500).json({ 
            error: 'Error creating checkout session',
            details: error.message,
            stripeError: error.raw
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Add routes for payment pages
app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'landing', 'success.html'));
});

app.get('/payment-failed', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'landing', 'payment-failed.html'));
});

const PORT = process.env.PORT || 3000;

// Add error handling for server startup
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (error) => {
    console.error('Server startup error:', {
        code: error.code,
        message: error.message,
        stack: error.stack
    });
    
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port.`);
    }
    process.exit(1);
});