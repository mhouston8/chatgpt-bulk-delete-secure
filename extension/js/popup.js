document.addEventListener('DOMContentLoaded', function() {
    const deleteButton = document.getElementById('deleteButton');
    const addCheckboxesButton = document.getElementById('addCheckboxesButton');
    const statusDiv = document.getElementById('status');
    const exportCheckbox = document.getElementById('exportBeforeDelete');
    const signInButton = document.getElementById('signInButton');
    const upgradeButton = document.getElementById('upgradeButton');

    // Function to check if any checkboxes are checked
    async function checkCheckboxStates() {
        try {
            console.log('Checking checkbox states');
            // Get all tabs and find the ChatGPT tab
            const tabs = await chrome.tabs.query({});
            console.log('All tabs:', tabs);
            
            const chatgptTab = tabs.find(tab => tab.url && tab.url.includes('chatgpt.com'));
            console.log('Found ChatGPT tab:', chatgptTab);
            
            if (!chatgptTab) {
                console.error('No ChatGPT tab found during checkbox check');
                deleteButton.disabled = true;
                return;
            }

            console.log('Executing script to check checkbox states');
            const result = await chrome.scripting.executeScript({
                target: { tabId: chatgptTab.id },
                function: () => {
                    const hasChecked = document.querySelector('.conversation-checkbox:checked') !== null;
                    console.log('Found checked checkboxes:', hasChecked);
                    return hasChecked;
                }
            });

            // Enable delete button if any checkboxes are checked
            console.log('Checkbox check result:', result[0].result);
            deleteButton.disabled = !result[0].result;
            
            // Update status message
            if (result[0].result) {
                statusDiv.textContent = 'Ready to delete selected conversations';
                statusDiv.style.color = '#28a745';
            } else {
                statusDiv.textContent = 'Select conversations to delete';
                statusDiv.style.color = 'white';
            }
        } catch (error) {
            console.error('Error checking checkbox states:', error);
            deleteButton.disabled = true;
        }
    }

    // Check checkbox states when popup opens
    checkCheckboxStates();

    // Set up periodic checking of checkbox states
    setInterval(checkCheckboxStates, 1000);

    addCheckboxesButton.addEventListener('click', async () => {
        try {
            console.log('Add checkboxes button clicked');
            // Get all tabs and find the ChatGPT tab
            const tabs = await chrome.tabs.query({});
            console.log('All tabs:', tabs);
            
            const chatgptTab = tabs.find(tab => tab.url && tab.url.includes('chatgpt.com'));
            console.log('Found ChatGPT tab:', chatgptTab);
            
            if (!chatgptTab) {
                console.error('No ChatGPT tab found');
                statusDiv.textContent = 'Please open chatgpt.com in a tab';
                return;
            }

            console.log('Selected tab:', {
                id: chatgptTab.id,
                url: chatgptTab.url,
                title: chatgptTab.title,
                active: chatgptTab.active
            });

            console.log('Executing script to add checkboxes');
            await chrome.scripting.executeScript({
                target: { tabId: chatgptTab.id },
                function: addCheckboxesToConversations
            });

            // Add click listeners to checkboxes
            console.log('Adding click listeners to checkboxes');
            await chrome.scripting.executeScript({
                target: { tabId: chatgptTab.id },
                function: () => {
                    const checkboxes = document.querySelectorAll('.conversation-checkbox');
                    console.log('Found checkboxes:', checkboxes.length);
                    checkboxes.forEach(checkbox => {
                        checkbox.addEventListener('change', () => {
                            // Store the state in localStorage
                            const anyChecked = document.querySelector('.conversation-checkbox:checked') !== null;
                            console.log('Checkbox state changed. Any checked:', anyChecked);
                            localStorage.setItem('hasCheckedBoxes', anyChecked);
                        });
                    });
                }
            });

            // Check initial state
            console.log('Checking initial checkbox state');
            await checkCheckboxStates(chatgptTab.id);
            
            statusDiv.textContent = 'Checkboxes added. Select conversations to delete.';
            statusDiv.style.color = 'white';
        } catch (error) {
            console.error('Error in addCheckboxesButton click handler:', error);
            statusDiv.textContent = 'Error: ' + error.message;
        }
    });

    // Check if user is signed in
    async function checkAuthStatus() {
        try {
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;
            
            if (session) {
                // Set up real-time subscription for premium status changes
                setupPremiumStatusSubscription();
                
                // Check if user has paid
                const { data: userData, error: userError } = await window.supabaseClient
                    .from('User')
                    .select('is_premium_subscriber')
                    .eq('id', session.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.is_premium_subscriber) {
                    // Hide sign in button and show premium status
                    signInButton.style.display = 'none';
                    exportCheckbox.disabled = false;
                    exportCheckbox.checked = true;
                    
                    // Remove buy premium button if it exists
                    const buyPremiumButton = document.getElementById('buyPremiumButton');
                    if (buyPremiumButton) {
                        buyPremiumButton.remove();
                    }
                    
                    // Remove any email verification messages
                    const signInSection = document.querySelector('.sign-in-section');
                    if (signInSection) {
                        const verificationDivs = signInSection.querySelectorAll('div[style*="background: #f8f9fa"]');
                        verificationDivs.forEach(div => div.remove());
                    }
                    
                    // Create premium status indicator if it doesn't exist
                    let premiumStatus = document.getElementById('premiumStatus');
                    if (!premiumStatus) {
                        premiumStatus = document.createElement('div');
                        premiumStatus.id = 'premiumStatus';
                        premiumStatus.style.cssText = `
                            background-color: #28a745;
                            color: white;
                            padding: 8px 16px;
                            border-radius: 4px;
                            margin: 10px 0;
                            font-weight: 500;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        `;
                        const signInSection = document.querySelector('.sign-in-section');
                        signInSection.insertBefore(premiumStatus, signInSection.firstChild);
                    }
                    
                    // Add premium icon and text
                    premiumStatus.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                        </svg>
                        Premium User - All Features Enabled
                    `;
                    
                    statusDiv.textContent = 'You have access to all premium features';
                    statusDiv.style.color = '#28a745';
                } else {
                    // Hide sign in button and show buy premium button
                    signInButton.style.display = 'none';
                    exportCheckbox.disabled = true;
                    exportCheckbox.checked = false;
                    statusDiv.textContent = 'Upgrade to premium to enable export functionality';
                    statusDiv.style.color = '#666';
                    
                    // Remove any email verification messages
                    const signInSection = document.querySelector('.sign-in-section');
                    if (signInSection) {
                        const verificationDivs = signInSection.querySelectorAll('div[style*="background: #f8f9fa"]');
                        verificationDivs.forEach(div => div.remove());
                    }
                    
                    // Create or get button container
                    let buttonContainer = document.querySelector('.button-container');
                    if (!buttonContainer) {
                        buttonContainer = document.createElement('div');
                        buttonContainer.className = 'button-container';
                        const signInSection = document.querySelector('.sign-in-section');
                        signInSection.appendChild(buttonContainer);
                    }
                    
                    // Add Buy Premium button if it doesn't exist
                    if (!document.getElementById('buyPremiumButton')) {
                        const buyPremiumButton = document.createElement('button');
                        buyPremiumButton.id = 'buyPremiumButton';
                        buyPremiumButton.textContent = 'Buy Premium';
                        buttonContainer.appendChild(buyPremiumButton);
                        
                        buyPremiumButton.addEventListener('click', async () => {
                            try {
                                await window.stripeFunctions.createCheckoutSession();
                            } catch (error) {
                                console.error('Error creating checkout session:', error);
                                statusDiv.textContent = 'Error: ' + error.message;
                            }
                        });
                    }
                }

                // Add sign out button if it doesn't exist
                if (!document.getElementById('signOutButton')) {
                    const signOutButton = document.createElement('button');
                    signOutButton.id = 'signOutButton';
                    signOutButton.textContent = 'Sign Out';
                    
                    // Get or create button container
                    let buttonContainer = document.querySelector('.button-container');
                    if (!buttonContainer) {
                        buttonContainer = document.createElement('div');
                        buttonContainer.className = 'button-container';
                        const signInSection = document.querySelector('.sign-in-section');
                        signInSection.appendChild(buttonContainer);
                    }
                    
                    buttonContainer.appendChild(signOutButton);
                    
                    signOutButton.addEventListener('click', async () => {
                        try {
                            const { error } = await window.supabaseClient.auth.signOut();
                            if (error) throw error;
                            
                            // Remove button container
                            const buttonContainer = document.querySelector('.button-container');
                            if (buttonContainer) {
                                buttonContainer.remove();
                            }
                            
                            // Remove premium status indicator
                            const premiumStatus = document.getElementById('premiumStatus');
                            if (premiumStatus) {
                                premiumStatus.remove();
                            }
                            
                            // Reset sign in button
                            signInButton.style.display = 'block';
                            signInButton.textContent = 'Sign In';
                            signInButton.style.backgroundColor = '#007bff';
                            signInButton.disabled = false;
                            
                            // Reset export checkbox
                            exportCheckbox.disabled = true;
                            exportCheckbox.checked = false;
                            
                            // Show success message
                            statusDiv.textContent = 'Signed out successfully';
                            
                            // Clear status message after 3 seconds
                            setTimeout(() => {
                                statusDiv.textContent = '';
                            }, 3000);
                        } catch (error) {
                            console.error('Error signing out:', error);
                            statusDiv.textContent = 'Error signing out: ' + error.message;
                        }
                    });
                }
                
                return true;
            } else {
                // Clean up subscription when user is not authenticated
                cleanupPremiumStatusSubscription();
                
                // Show sign in button and hide any other buttons
                signInButton.style.display = 'block';
                signInButton.textContent = 'Sign In';
                signInButton.style.backgroundColor = '#007bff';
                signInButton.disabled = false;
                exportCheckbox.disabled = true;
                exportCheckbox.checked = false;
                statusDiv.textContent = '';
                
                // Remove buy premium button if it exists
                const buyPremiumButton = document.getElementById('buyPremiumButton');
                if (buyPremiumButton) {
                    buyPremiumButton.remove();
                }
                
                // Remove sign out button if it exists
                const signOutButton = document.getElementById('signOutButton');
                if (signOutButton) {
                    signOutButton.remove();
                }
                
                // Remove premium status indicator if it exists
                const premiumStatus = document.getElementById('premiumStatus');
                if (premiumStatus) {
                    premiumStatus.remove();
                }
                
                return false;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    // Handle sign in
    signInButton.addEventListener('click', async () => {
        try {
            // Create a simple modal for email/password
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;

            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: #2d2d2d;
                padding: 20px;
                border-radius: 8px;
                width: 80%;
                max-width: 300px;
            `;

            const emailInput = document.createElement('input');
            emailInput.type = 'email';
            emailInput.placeholder = 'Email';
            emailInput.style.cssText = `
                width: 100%;
                padding: 8px;
                margin-bottom: 10px;
                border: 1px solid #404040;
                border-radius: 4px;
                background: #1a1a1a;
                color: white;
            `;

            const passwordInput = document.createElement('input');
            passwordInput.type = 'password';
            passwordInput.placeholder = 'Password';
            passwordInput.style.cssText = emailInput.style.cssText;

            const submitButton = document.createElement('button');
            submitButton.textContent = 'Sign In';
            submitButton.style.cssText = `
                width: 100%;
                padding: 8px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            `;

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.style.cssText = `
                width: 100%;
                padding: 8px;
                background: #404040;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            `;

            const signUpText = document.createElement('div');
            signUpText.style.cssText = `
                text-align: center;
                margin-top: 15px;
                color: #ffffff;
                font-size: 14px;
            `;
            signUpText.innerHTML = 'Don\'t have an account? <a href="#" style="color: #007bff; text-decoration: none;">Sign Up</a>';

            const errorMessage = document.createElement('div');
            errorMessage.style.cssText = `
                text-align: center;
                margin-top: 10px;
                color: #dc3545;
                font-size: 14px;
                display: none;
            `;

            let isSignUp = false;

            // Handle sign up/sign in link clicks
            signUpText.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    e.preventDefault();
                    isSignUp = !isSignUp;
                    submitButton.textContent = isSignUp ? 'Sign Up' : 'Sign In';
                    signUpText.innerHTML = isSignUp ? 
                        'Already have an account? <a href="#" style="color: #007bff; text-decoration: none;">Sign In</a>' :
                        'Don\'t have an account? <a href="#" style="color: #007bff; text-decoration: none;">Sign Up</a>';
                    errorMessage.style.display = 'none';
                }
            });

            modalContent.appendChild(emailInput);
            modalContent.appendChild(passwordInput);
            modalContent.appendChild(submitButton);
            modalContent.appendChild(closeButton);
            modalContent.appendChild(signUpText);
            modalContent.appendChild(errorMessage);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Handle sign in/sign up
            submitButton.addEventListener('click', async () => {
                try {
                    errorMessage.style.display = 'none';
                    
                    if (isSignUp) {
                        // Validate email and password
                        if (!emailInput.value || !passwordInput.value) {
                            errorMessage.textContent = 'Please enter both email and password';
                            errorMessage.style.display = 'block';
                            return;
                        }

                        if (passwordInput.value.length < 6) {
                            errorMessage.textContent = 'Password must be at least 6 characters';
                            errorMessage.style.display = 'block';
                            return;
                        }

                        submitButton.disabled = true;
                        submitButton.textContent = 'Creating Account...';

                        const { data, error } = await window.supabaseClient.auth.signUp({
                            email: emailInput.value,
                            password: passwordInput.value,
                            options: {
                                emailRedirectTo: chrome.runtime.getURL('html/popup.html')
                            }
                        });

                        if (error) throw error;

                        if (data?.user?.identities?.length === 0) {
                            errorMessage.textContent = 'This email is already registered. Please sign in instead.';
                            errorMessage.style.display = 'block';
                            isSignUp = false;
                            submitButton.textContent = 'Sign In';
                            signUpText.innerHTML = 'Don\'t have an account? <a href="#" style="color: #007bff; text-decoration: none;">Sign Up</a>';
                        } else {
                            // Save user data to the database
                            const { error: dbError } = await window.supabaseClient
                                .from('User')
                                .insert([
                                    {
                                        id: data.user.id,
                                        email: data.user.email,
                                        is_premium_subscriber: false,
                                        created_at: new Date().toISOString()
                                    }
                                ]);

                            if (dbError) {
                                console.error('Error saving user data:', dbError);
                                errorMessage.textContent = 'Account created but there was an error saving your data. Please try signing in.';
                                errorMessage.style.display = 'block';
                            } else {
                                // Close the modal
                                modal.remove();
                                
                                // Update the sign-in section to show email verification message
                                const signInSection = document.querySelector('.sign-in-section');
                                signInSection.innerHTML = `
                                    <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
                                        <p style="color: #2c3e50; margin-bottom: 10px; font-weight: 500;">
                                            Please verify your email address
                                        </p>
                                        <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                                            We've sent a verification email to <strong>${data.user.email}</strong>
                                        </p>
                                        <p style="color: #666; font-size: 13px;">
                                            Click the link in the email to complete your registration and start using the extension.
                                        </p>
                                    </div>
                                `;
                                
                                // Keep the original sign-in button visible but update its reference
                                signInButton.style.display = 'block';
                                signInButton.textContent = 'Sign In';
                                signInButton.style.backgroundColor = '#007bff';
                                signInButton.disabled = false;
                                
                                // Re-append the original sign-in button to the section
                                signInSection.appendChild(signInButton);
                            }
                        }
                    } else {
                        submitButton.disabled = true;
                        submitButton.textContent = 'Signing In...';

                        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                            email: emailInput.value,
                            password: passwordInput.value
                        });

                        if (error) throw error;

                        modal.remove();
                        await checkAuthStatus();
                        
                        // Clear any email verification messages after successful sign-in
                        const signInSection = document.querySelector('.sign-in-section');
                        if (signInSection) {
                            // Remove any email verification divs
                            const verificationDivs = signInSection.querySelectorAll('div[style*="background: #f8f9fa"]');
                            verificationDivs.forEach(div => div.remove());
                        }
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                    errorMessage.textContent = error.message;
                    errorMessage.style.display = 'block';
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = isSignUp ? 'Sign Up' : 'Sign In';
                    errorMessage.style.color = '#dc3545'; // Reset error message color
                }
            });

            // Handle close
            closeButton.addEventListener('click', () => {
                modal.remove();
            });
        } catch (error) {
            console.error('Error showing sign in modal:', error);
            statusDiv.textContent = 'Error: ' + error.message;
        }
    });

    // Check auth status when popup opens
    checkAuthStatus();

    // Set up real-time subscription for premium status changes
    let premiumStatusSubscription = null;

    async function setupPremiumStatusSubscription() {
        try {
            // Clean up any existing subscription first
            cleanupPremiumStatusSubscription();
            
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;
            
            if (session) {
                console.log('Setting up real-time subscription for user:', session.user.id);
                
                // Subscribe to changes in the User table for the current user
                premiumStatusSubscription = window.supabaseClient
                    .channel('premium-status-changes')
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'User',
                            filter: `id=eq.${session.user.id}`
                        },
                        (payload) => {
                            console.log('Premium status change detected:', payload);
                            
                            // Check if is_premium_subscriber changed
                            if (payload.new.is_premium_subscriber !== payload.old.is_premium_subscriber) {
                                console.log('Premium status updated:', {
                                    old: payload.old.is_premium_subscriber,
                                    new: payload.new.is_premium_subscriber
                                });
                                
                                // Update the UI immediately
                                checkAuthStatus().then(() => {
                                    const statusDiv = document.getElementById('status');
                                    if (statusDiv) {
                                        if (payload.new.is_premium_subscriber) {
                                            statusDiv.textContent = 'Premium features activated!';
                                            statusDiv.style.color = '#28a745';
                                        } else {
                                            statusDiv.textContent = 'Premium status removed';
                                            statusDiv.style.color = '#dc3545';
                                        }
                                        
                                        // Clear status message after 3 seconds
                                        setTimeout(() => {
                                            statusDiv.textContent = '';
                                        }, 3000);
                                    }
                                }).catch(error => {
                                    console.error('Error updating UI after premium status change:', error);
                                });
                            }
                        }
                    )
                    .subscribe((status) => {
                        console.log('Real-time subscription status:', status);
                    });
            }
        } catch (error) {
            console.error('Error setting up premium status subscription:', error);
        }
    }

    // Clean up subscription when popup closes
    function cleanupPremiumStatusSubscription() {
        if (premiumStatusSubscription) {
            console.log('Cleaning up premium status subscription');
            try {
                window.supabaseClient.removeChannel(premiumStatusSubscription);
            } catch (error) {
                console.log('Error removing channel (may already be removed):', error);
            }
            premiumStatusSubscription = null;
        }
    }

    // Clean up when the popup is about to unload
    window.addEventListener('beforeunload', cleanupPremiumStatusSubscription);

    // Also clean up when the extension context is invalidated
    chrome.runtime.onSuspend.addListener(cleanupPremiumStatusSubscription);

    // Modify delete button click handler to check for export permission
    deleteButton.addEventListener('click', async () => {
        console.log('Delete button clicked');
        try {
            // Get all tabs and find the ChatGPT tab
            const tabs = await chrome.tabs.query({});
            const chatgptTab = tabs.find(tab => tab.url && tab.url.includes('chatgpt.com'));
            
            if (!chatgptTab) {
                statusDiv.textContent = 'Please open chatgpt.com in a tab';
                return;
            }

            deleteButton.disabled = true;
            statusDiv.textContent = 'Processing...';

            // If export is enabled, check if user is signed in
            if (exportCheckbox.checked) {
                const isSignedIn = await checkAuthStatus();
                if (!isSignedIn) {
                    statusDiv.textContent = 'Please sign in to use the export feature';
                    deleteButton.disabled = false;
                    return;
                }
                
                statusDiv.textContent = 'Exporting conversations...';
                await chrome.scripting.executeScript({
                    target: { tabId: chatgptTab.id },
                    function: exportSelectedConversations
                });
            }

            statusDiv.textContent = 'Deleting selected conversations...';
            console.log('Executing delete script');
            await chrome.scripting.executeScript({
                target: { tabId: chatgptTab.id },
                function: deleteSelectedConversations
            });

            statusDiv.textContent = 'Selected conversations deleted successfully!';
        } catch (error) {
            console.error('Error in delete button click handler:', error);
            statusDiv.textContent = 'Error: ' + error.message;
        } finally {
            deleteButton.disabled = false;
        }
    });
});

// Function to add checkboxes to conversations
function addCheckboxesToConversations() {
    console.log('Starting to add checkboxes...');
    
    // Wait for conversations to load
    const waitForConversations = () => {
        return new Promise((resolve) => {
            const checkForConversations = () => {
                // Only select actual conversation links
                const conversations = document.querySelectorAll('a[href^="/c/"].__menu-item');
                console.log('Found conversations:', conversations.length);
                
                if (conversations.length > 0) {
                    resolve(conversations);
                } else {
                    console.log('No conversations found, retrying in 1 second...');
                    setTimeout(checkForConversations, 1000);
                }
            };
            
            checkForConversations();
        });
    };

    // Main function to add checkboxes
    const addCheckboxes = async () => {
        try {
            const conversations = await waitForConversations();
            console.log('Conversations loaded:', conversations.length);

            // Function to add checkbox to a single conversation
            function addCheckboxToConversation(conversation) {
                console.log('Adding checkbox to conversation:', conversation);
                
                // Check if checkbox already exists
                if (conversation.querySelector('.conversation-checkbox')) {
                    console.log('Checkbox already exists for this conversation');
                    return;
                }

                // Create checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'conversation-checkbox';
                checkbox.style.marginRight = '8px';
                checkbox.style.cursor = 'pointer';
                checkbox.style.position = 'absolute';
                checkbox.style.left = '8px';
                checkbox.style.top = '50%';
                checkbox.style.transform = 'translateY(-50%)';
                checkbox.style.zIndex = '1';
                
                // Add debug logging for checkbox state changes
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    console.log('Checkbox state changed:', checkbox.checked);
                    const anyChecked = document.querySelector('.conversation-checkbox:checked') !== null;
                    console.log('Any checkboxes checked:', anyChecked);
                    localStorage.setItem('hasCheckedBoxes', anyChecked);
                });

                // Prevent link navigation when clicking the checkbox
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('Checkbox clicked, new state:', checkbox.checked);
                });

                // Prevent link navigation when clicking the checkbox container
                const checkboxContainer = document.createElement('div');
                checkboxContainer.style.position = 'absolute';
                checkboxContainer.style.left = '0';
                checkboxContainer.style.top = '0';
                checkboxContainer.style.bottom = '0';
                checkboxContainer.style.width = '28px';
                checkboxContainer.style.zIndex = '2';
                checkboxContainer.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Checkbox container clicked');
                    checkbox.click();
                });
                
                // Add checkbox to the conversation
                conversation.style.position = 'relative';
                conversation.style.paddingLeft = '28px'; // Make room for the checkbox
                conversation.insertBefore(checkbox, conversation.firstChild);
                conversation.insertBefore(checkboxContainer, conversation.firstChild);
                
                console.log('Checkbox added successfully to conversation');
            }

            // Add checkboxes to existing conversations
            conversations.forEach((conversation, index) => {
                console.log('Processing conversation', index + 1);
                addCheckboxToConversation(conversation);
            });

            // Set up MutationObserver to watch for new conversations
            const observer = new MutationObserver((mutations) => {
                console.log('Mutation observed:', mutations);
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            console.log('New node added:', node);
                            // Check if the added node is a conversation
                            if (node.matches('a[href^="/c/"].__menu-item')) {
                                console.log('Found new conversation node');
                                addCheckboxToConversation(node);
                            }
                            // Check children of added node for conversations
                            const newConversations = node.querySelectorAll('a[href^="/c/"].__menu-item');
                            newConversations.forEach(conversation => {
                                console.log('Found new conversation in children');
                                addCheckboxToConversation(conversation);
                            });
                        }
                    });
                });
            });

            // Start observing the document body for changes
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Store the observer in a global variable so it can be cleaned up later if needed
            window.conversationObserver = observer;
            
            console.log('Finished setting up checkboxes and observer');
        } catch (error) {
            console.error('Error adding checkboxes:', error);
        }
    };

    // Start the process
    addCheckboxes();
}

// Function to delete selected conversations
function deleteSelectedConversations() {
    return new Promise((resolve, reject) => {
        try {
            const deleteSelected = async () => {
                // Add a small delay to ensure checkbox states are updated
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Get all selected conversations initially
                console.log('Checking for selected conversations...');
                const allCheckboxes = document.querySelectorAll('.conversation-checkbox');
                console.log('Total checkboxes found:', allCheckboxes.length);
                
                // Log each checkbox's state and its associated conversation
                allCheckboxes.forEach((checkbox, index) => {
                    const conversationItem = checkbox.closest('a[href^="/c/"]');
                    console.log(`Checkbox ${index + 1}:`, {
                        checked: checkbox.checked,
                        conversationHref: conversationItem?.href,
                        conversationText: conversationItem?.textContent?.trim()
                    });
                });
                
                let selectedConversations = Array.from(document.querySelectorAll('.conversation-checkbox:checked'));
                console.log('Found', selectedConversations.length, 'selected conversations');
                
                // Log details of each selected conversation
                selectedConversations.forEach((checkbox, index) => {
                    const conversationItem = checkbox.closest('a[href^="/c/"]');
                    console.log(`Selected conversation ${index + 1}:`, {
                        href: conversationItem?.href,
                        text: conversationItem?.textContent?.trim()
                    });
                });
                
                if (selectedConversations.length === 0) {
                    console.log('No conversations selected');
                    return;
                }

                // Process each selected conversation
                for (const checkbox of selectedConversations) {
                    try {
                        const conversationItem = checkbox.closest('a[href^="/c/"]');
                        console.log('Processing conversation:', {
                            href: conversationItem?.href,
                            text: conversationItem?.textContent?.trim(),
                            checked: checkbox.checked
                        });
                        
                        if (!conversationItem) {
                            console.log('Could not find conversation item for checkbox');
                            continue;
                        }

                        // Store the conversation ID for verification after deletion
                        const conversationId = conversationItem.href.split('/c/')[1];
                        console.log('Conversation ID:', conversationId);

                        // Find the ellipsis button using multiple selector strategies
                        let ellipsisButton = null;
                        
                        // Strategy 1: Look for button with aria-label
                        ellipsisButton = conversationItem.querySelector('button[aria-label="Open conversation options"]');
                        
                        // Strategy 2: Look for button with specific class
                        if (!ellipsisButton) {
                            ellipsisButton = conversationItem.querySelector('button.__menu-item-trailing-btn');
                        }
                        
                        // Strategy 3: Look for button with data-testid
                        if (!ellipsisButton) {
                            ellipsisButton = conversationItem.querySelector('button[data-testid^="history-item-"]');
                        }
                        
                        // Strategy 4: Look for any button within the conversation item
                        if (!ellipsisButton) {
                            ellipsisButton = conversationItem.querySelector('button');
                        }

                        console.log('Found ellipsis button:', {
                            found: !!ellipsisButton,
                            ariaLabel: ellipsisButton?.getAttribute('aria-label'),
                            class: ellipsisButton?.className,
                            visible: ellipsisButton?.offsetParent !== null
                        });

                        if (ellipsisButton) {
                            console.log('Found ellipsis button, attempting to click');
                            
                            // First, ensure the button is visible and not disabled
                            if (ellipsisButton.offsetParent === null) {
                                console.log('Button is not visible, scrolling into view');
                                ellipsisButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }

                            // Focus the button first
                            ellipsisButton.focus();
                            console.log('Button focused');

                            // Create and dispatch a keyboard event to simulate Enter key
                            const keyEvent = new KeyboardEvent('keydown', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                which: 13,
                                bubbles: true,
                                cancelable: true
                            });
                            ellipsisButton.dispatchEvent(keyEvent);
                            console.log('Enter key event dispatched');

                            // Wait a moment
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // Now try the click
                            const rect = ellipsisButton.getBoundingClientRect();
                            const mouseEvent = new MouseEvent('click', {
                                view: window,
                                bubbles: true,
                                cancelable: true,
                                buttons: 1,
                                clientX: rect.left + rect.width / 2,
                                clientY: rect.top + rect.height / 2
                            });
                            ellipsisButton.dispatchEvent(mouseEvent);
                            console.log('MouseEvent dispatched with coordinates:', {
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2
                            });

                            // Wait for menu to appear
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // Check if the menu appeared
                            const menu = document.querySelector('[role="menu"][data-state="open"]');
                            if (menu) {
                                console.log('Menu appeared successfully');
                                
                                // Find the delete button in the menu using multiple strategies
                                let deleteButton = menu.querySelector('[data-testid="delete-chat-menu-item"]');
                                
                                if (!deleteButton) {
                                    // Try finding by text content
                                    deleteButton = Array.from(menu.querySelectorAll('button')).find(btn => 
                                        btn.textContent.trim().toLowerCase().includes('delete')
                                    );
                                }
                                
                                if (deleteButton) {
                                    console.log('Found delete button in menu:', deleteButton.outerHTML);
                                    
                                    // Focus and click the delete button
                                    deleteButton.focus();
                                    
                                    // Send Enter key event
                                    const keyEvent = new KeyboardEvent('keydown', {
                                        key: 'Enter',
                                        code: 'Enter',
                                        keyCode: 13,
                                        which: 13,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    deleteButton.dispatchEvent(keyEvent);
                                    console.log('Enter key event dispatched to delete button');
                                    
                                    // Wait a moment
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    
                                    // Now try the click
                                    const rect = deleteButton.getBoundingClientRect();
                                    const mouseEvent = new MouseEvent('click', {
                                        view: window,
                                        bubbles: true,
                                        cancelable: true,
                                        buttons: 1,
                                        clientX: rect.left + rect.width / 2,
                                        clientY: rect.top + rect.height / 2
                                    });
                                    deleteButton.dispatchEvent(mouseEvent);
                                    console.log('MouseEvent dispatched to delete button');
                                    
                                    // Wait for confirmation dialog
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    
                                    // Find and click the confirm button in the confirmation dialog
                                    const confirmDialog = document.querySelector('[data-testid="modal-delete-conversation-confirmation"]');
                                    if (confirmDialog) {
                                        console.log('Found confirmation dialog');
                                        
                                        // Find the delete button - it's usually the button with "Delete" text
                                        const confirmButton = confirmDialog.querySelector('[data-testid="delete-conversation-confirm-button"]');
                                        
                                        if (confirmButton) {
                                            console.log('Found confirm button:', confirmButton.outerHTML);
                                            
                                            // Focus and click the confirm button
                                            confirmButton.focus();
                                            
                                            // Send Enter key event
                                            const keyEvent = new KeyboardEvent('keydown', {
                                                key: 'Enter',
                                                code: 'Enter',
                                                keyCode: 13,
                                                which: 13,
                                                bubbles: true,
                                                cancelable: true
                                            });
                                            confirmButton.dispatchEvent(keyEvent);
                                            console.log('Enter key event dispatched to confirm button');
                                            
                                            // Wait a moment
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                            
                                            // Now try the click
                                            const rect = confirmButton.getBoundingClientRect();
                                            const mouseEvent = new MouseEvent('click', {
                                                view: window,
                                                bubbles: true,
                                                cancelable: true,
                                                buttons: 1,
                                                clientX: rect.left + rect.width / 2,
                                                clientY: rect.top + rect.height / 2
                                            });
                                            confirmButton.dispatchEvent(mouseEvent);
                                            console.log('MouseEvent dispatched to confirm button');
                                            
                                            // Wait for the deletion to complete
                                            await new Promise(resolve => setTimeout(resolve, 1000));

                                            // Verify the conversation was deleted
                                            const verifyDeletion = async () => {
                                                const maxAttempts = 5;
                                                let attempts = 0;
                                                
                                                while (attempts < maxAttempts) {
                                                    const deletedConversation = document.querySelector(`a[href="/c/${conversationId}"]`);
                                                    if (!deletedConversation) {
                                                        console.log('Conversation successfully deleted');
                                                        break;
                                                    }
                                                    console.log('Conversation still exists, waiting...');
                                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                                    attempts++;
                                                }
                                                
                                                if (attempts === maxAttempts) {
                                                    console.log('Failed to verify conversation deletion');
                                                }
                                            };
                                            
                                            await verifyDeletion();
                                        } else {
                                            console.log('Delete button not found in dialog');
                                        }
                                    } else {
                                        console.log('Confirmation dialog not found');
                                    }
                                } else {
                                    console.log('Delete button not found in menu');
                                }
                            } else {
                                console.log('Menu did not appear after click');
                            }
                        } else {
                            console.log('Ellipsis button not found for conversation');
                        }

                        // Add a delay between deletions to allow the DOM to stabilize
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (error) {
                        console.error('Error deleting conversation:', error);
                        // Continue with next conversation even if this one failed
                        continue;
                    }
                }
            };

            deleteSelected().then(resolve).catch(reject);
        } catch (error) {
            console.error('Error in deleteSelectedConversations:', error);
            reject(error);
        }
    });
}

// Function to export selected conversations
function exportSelectedConversations() {
    return new Promise((resolve, reject) => {
        try {
            const exportSelected = async () => {
                const selectedCheckboxes = document.querySelectorAll('.conversation-checkbox:checked');
                console.log('Exporting', selectedCheckboxes.length, 'conversations');

                for (const checkbox of selectedCheckboxes) {
                    const conversationItem = checkbox.closest('a[href^="/c/"]');
                    if (!conversationItem) continue;

                    // Get conversation title for filename
                    const conversationTitle = conversationItem.textContent.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    console.log('Processing conversation:', conversationTitle);
                    
                    // Click the conversation to open it
                    conversationItem.click();
                    
                    // Wait for the conversation to load
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Get all messages in the conversation
                    const messages = [];
                    
                    // Wait for messages to be visible
                    const waitForMessages = () => {
                        return new Promise((resolve) => {
                            const checkForMessages = () => {
                                const messageGroups = document.querySelectorAll('[data-message-author-role]');
                                console.log('Checking for messages, found groups:', messageGroups.length);
                                if (messageGroups.length > 0) {
                                    resolve(messageGroups);
                                } else {
                                    console.log('No messages found, retrying in 1 second...');
                                    setTimeout(checkForMessages, 1000);
                                }
                            };
                            checkForMessages();
                        });
                    };

                    const messageGroups = await waitForMessages();
                    console.log('Found message groups:', messageGroups.length);

                    // Process each message group
                    for (const group of messageGroups) {
                        const role = group.getAttribute('data-message-author-role');
                        console.log('Processing message with role:', role);

                        // Try different selectors for message content
                        let content = '';
                        
                        // Try getting content from markdown-content
                        const markdownContent = group.querySelector('.markdown-content');
                        if (markdownContent) {
                            content = markdownContent.innerHTML;
                            console.log('Found markdown content:', content.length);
                        }
                        
                        // If no markdown content, try getting from the message div
                        if (!content) {
                            const messageDiv = group.querySelector('[data-message-author-role]');
                            if (messageDiv) {
                                content = messageDiv.innerHTML;
                                console.log('Found message div content:', content.length);
                            }
                        }
                        
                        // If still no content, try getting from the entire group
                        if (!content) {
                            content = group.innerHTML;
                            console.log('Using group content:', content.length);
                        }

                        if (content) {
                            console.log('Adding message with content length:', content.length);
                            messages.push({
                                role: role,
                                content: content
                            });
                        } else {
                            console.log('No content found for message');
                        }
                    }

                    console.log('Total messages processed:', messages.length);

                    if (messages.length === 0) {
                        console.log('No messages found in conversation');
                        continue;
                    }

                    // Create HTML document with improved styling
                    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ChatGPT Conversation - ${conversationTitle}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            color: #333;
        }
        .conversation-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e5e5;
        }
        .conversation-header h1 {
            font-size: 24px;
            color: #202123;
            margin: 0;
            padding: 0;
        }
        .conversation-header .timestamp {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }
        .message {
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .user {
            background-color: #f7f7f8;
            border-left: 4px solid #10a37f;
        }
        .assistant {
            background-color: #f0f0f0;
            border-left: 4px solid #6b7280;
        }
        .message-header {
            font-weight: 600;
            margin-bottom: 10px;
            color: #202123;
        }
        .message-content {
            color: #374151;
        }
        .message pre {
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
        }
        .message code {
            background-color: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
        }
        .message p {
            margin: 0 0 15px 0;
        }
        .message p:last-child {
            margin-bottom: 0;
        }
        .message img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 10px 0;
        }
        .message ul, .message ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .message li {
            margin: 5px 0;
        }
        .message blockquote {
            border-left: 4px solid #e5e5e5;
            margin: 10px 0;
            padding: 10px 20px;
            background-color: #f9f9f9;
            color: #666;
        }
        .message table {
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
        }
        .message th, .message td {
            border: 1px solid #e5e5e5;
            padding: 8px 12px;
            text-align: left;
        }
        .message th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="conversation-header">
        <h1>ChatGPT Conversation</h1>
        <div class="timestamp">Exported on ${new Date().toLocaleString()}</div>
    </div>
    <div class="conversation">
        ${messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-header">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
                <div class="message-content">${msg.content}</div>
            </div>
        `).join('\n')}
    </div>
</body>
</html>`;

                    console.log('HTML content length:', htmlContent.length);

                    // Create a blob with the HTML content
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    
                    // Use Chrome's downloads API to save the file
                    const filename = `chatgpt_conversation_${conversationTitle}_${new Date().toISOString().split('T')[0]}.html`;
                    
                    // Send message to background script to handle download
                    chrome.runtime.sendMessage({
                        action: 'downloadConversation',
                        url: url,
                        filename: filename
                    });

                    // Wait for download to start
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Go back to the conversation list
                    const backButton = document.querySelector('a[href="/"]');
                    if (backButton) {
                        backButton.click();
                        // Wait for the list to load
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                resolve();
            };

            exportSelected();
        } catch (error) {
            console.error('Error exporting conversations:', error);
            reject(error);
        }
    });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateDeleteButton') {
        const deleteButton = document.getElementById('deleteButton');
        if (deleteButton) {
            deleteButton.disabled = !request.enabled;
        }
    }
});

// Listen for payment success message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PAYMENT_SUCCESS') {
        console.log('Payment success message received, updating UI...');
        // First check auth status to get fresh user data
        checkAuthStatus().then(() => {
            // Then update UI for premium user
            updateUIForPremiumUser();
            // Show success message
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
                statusDiv.textContent = 'Premium features activated successfully!';
                statusDiv.style.color = '#28a745';
                // Clear status message after 3 seconds
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            }
        }).catch(error => {
            console.error('Error updating UI after payment:', error);
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
                statusDiv.textContent = 'Error updating premium status. Please try refreshing the extension.';
                statusDiv.style.color = '#dc3545';
            }
        });
    }
});

// Function to update UI for premium users
async function updateUIForPremiumUser() {
    try {
        console.log('Updating UI for premium user...');
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;

        if (session) {
            console.log('User session found, updating premium status...');
            // Update user's payment status in the database
            const { error: updateError } = await window.supabaseClient
                .from('User')
                .update({ is_premium_subscriber: true })
                .eq('id', session.user.id);

            if (updateError) throw updateError;

            // Remove any existing buttons and status indicators
            const signInButton = document.getElementById('signInButton');
            const buyPremiumButton = document.getElementById('buyPremiumButton');
            const premiumStatus = document.getElementById('premiumStatus');
            const signOutButton = document.getElementById('signOutButton');
            
            if (signInButton) signInButton.style.display = 'none';
            if (buyPremiumButton) buyPremiumButton.remove();
            
            // Add premium status message
            const signInSection = document.querySelector('.sign-in-section');
            if (signInSection) {
                const newPremiumStatus = document.createElement('div');
                newPremiumStatus.id = 'premiumStatus';
                newPremiumStatus.style.cssText = `
                    background-color: #28a745;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    margin: 10px 0;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                `;
                newPremiumStatus.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                    </svg>
                    Premium User - All Features Enabled
                `;
                signInSection.insertBefore(newPremiumStatus, signInSection.firstChild);
            }

            // Enable export checkbox
            const exportCheckbox = document.getElementById('exportBeforeDelete');
            if (exportCheckbox) {
                exportCheckbox.disabled = false;
                exportCheckbox.checked = true;
            }

            // Keep sign out button
            if (signOutButton) {
                signOutButton.style.display = 'block';
            }

            console.log('UI updated successfully for premium user');
        }
    } catch (error) {
        console.error('Error updating premium status:', error);
        throw error; // Re-throw to be caught by the caller
    }
}