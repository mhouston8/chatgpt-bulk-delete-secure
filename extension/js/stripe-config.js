// Configuration for different environments
const config = {
    development: {
        apiUrl: 'http://localhost:3000/api',
        stripeKey: 'pk_test_51RVYo9HKgjgsC02PI2NgCXH975SHBiM4juEvG9hRg0UpKZTCvJ5mwAbRjq0yWm1wuzlP2BixGintBQcJeAmtgwhL006kZKh38K'
    },
    production: {
        apiUrl: 'https://chat-gpt-bulk-delete-server.onrender.com/api',
        stripeKey: 'pk_live_A9OzrWKPC81KhAVDlaCsauqe'
    }
};

// Determine which environment we're in based on the extension's URL
const isDevelopment = chrome.runtime.getURL('').includes('localhost') || 
                     chrome.runtime.getURL('').includes('127.0.0.1') ||
                     chrome.runtime.getURL('').startsWith('chrome-extension://') 
                     // && 
                     //chrome.runtime.getURL('').includes('localhost');

console.log('Extension URL:', chrome.runtime.getURL(''));
console.log('Is Development:', isDevelopment);

const currentConfig = isDevelopment ? config.development : config.production;

// Function to create a checkout session
async function createCheckoutSession() {
    try {
        console.log('Starting checkout session creation:', {
            config: currentConfig,
            apiUrl: currentConfig.apiUrl,
            extensionUrl: chrome.runtime.getURL('')
        });
        
        // Get the current user's session
        const { data: { session: authSession }, error: sessionError } = await window.supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;
        if (!authSession) throw new Error('No active session found');

        const requestBody = {
            priceId: 'price_1RXbFaHKgjgsC02Piu4E34Ma',
            successUrl: isDevelopment ? 'http://localhost:3000/success' : 'https://chatgptbulkdelete.com/success.html',
            cancelUrl: isDevelopment ? 'http://localhost:3000/payment-failed' : 'https://chatgptbulkdelete.com/payment-failed.html',
            userId: authSession.user.id
        };
        
        console.log('Checkout URLs:', {
            successUrl: requestBody.successUrl,
            cancelUrl: requestBody.cancelUrl,
            isDevelopment,
            userId: requestBody.userId
        });
        
        console.log('Preparing checkout request:', {
            url: `${currentConfig.apiUrl}/create-checkout-session`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody,
            credentials: 'include'
        });
        
        const response = await fetch(`${currentConfig.apiUrl}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(requestBody),
        });

        console.log('Received response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('Server response error:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
                headers: Object.fromEntries(response.headers.entries())
            });
            throw new Error(`HTTP error! status: ${response.status}${errorData ? `, details: ${JSON.stringify(errorData)}` : ''}`);
        }

        const session = await response.json();
        console.log('Checkout session response:', {
            id: session.id,
            url: session.url,
            status: session.status,
            hasUrl: !!session.url
        });

        if (!session.url) {
            console.error('Invalid session response:', session);
            throw new Error('No checkout URL received from server');
        }

        // Open Stripe Checkout in a new window using the session URL
        console.log('Opening checkout URL:', session.url);
        const checkoutWindow = window.open(session.url, '_blank');
        
        if (!checkoutWindow) {
            console.error('Failed to open checkout window - popup blocked?');
            throw new Error('Failed to open checkout window. Please allow popups for this extension.');
        }

    } catch (error) {
        console.error('Error in checkout process:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw error;
    }
}

// Function to handle successful payment
async function handleSuccessfulPayment() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;

        if (session) {
            // Update user's payment status in the database
            const { error: updateError } = await window.supabaseClient
                .from('User')
                .update({ has_paid: true })
                .eq('id', session.user.id);

            if (updateError) throw updateError;

            // Refresh the UI
            await checkAuthStatus();
        }
    } catch (error) {
        console.error('Error handling successful payment:', error);
        throw error;
    }
}

// Export the functions and config
window.stripeFunctions = {
    createCheckoutSession,
    handleSuccessfulPayment,
    config: currentConfig
}; 