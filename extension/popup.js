document.addEventListener('DOMContentLoaded', function() {
    const deleteButton = document.getElementById('deleteButton');
    const addCheckboxesButton = document.getElementById('addCheckboxesButton');
    const statusDiv = document.getElementById('status');

    // Function to check if any checkboxes are checked
    async function checkCheckboxStates() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('chatgpt.com')) return;

            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    return document.querySelector('.conversation-checkbox:checked') !== null;
                }
            });

            // Enable delete button if any checkboxes are checked
            deleteButton.disabled = !result[0].result;
        } catch (error) {
            console.error('Error checking checkbox states:', error);
        }
    }

    // Check checkbox states when popup opens
    checkCheckboxStates();

    addCheckboxesButton.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('chatgpt.com')) {
                statusDiv.textContent = 'Please navigate to chatgpt.com first';
                return;
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: addCheckboxesToConversations
            });

            // Add click listeners to checkboxes
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const checkboxes = document.querySelectorAll('.conversation-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.addEventListener('change', () => {
                            // Store the state in localStorage
                            const anyChecked = document.querySelector('.conversation-checkbox:checked') !== null;
                            localStorage.setItem('hasCheckedBoxes', anyChecked);
                        });
                    });
                }
            });

            // Check initial state
            await checkCheckboxStates();
            
            statusDiv.textContent = 'Checkboxes added. Select conversations to delete.';
        } catch (error) {
            statusDiv.textContent = 'Error: ' + error.message;
        }
    });

    deleteButton.addEventListener('click', async () => {
        console.log('Delete button clicked');
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('chatgpt.com')) {
                statusDiv.textContent = 'Please navigate to chatgpt.com first';
                return;
            }

            deleteButton.disabled = true;
            statusDiv.textContent = 'Deleting selected conversations...';

            console.log('Executing delete script');
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
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

                        // Find the ellipsis button using multiple selector strategies
                        let ellipsisButton = null;
                        
                        // Strategy 1: Look for button with aria-label
                        ellipsisButton = conversationItem.querySelector('button[aria-label="Open conversation menu"]');
                        
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
                                        const confirmButton = Array.from(confirmDialog.querySelectorAll('button')).find(btn => 
                                            btn.textContent.trim().toLowerCase().includes('delete')
                                        );
                                        
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

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateDeleteButton') {
        const deleteButton = document.getElementById('deleteButton');
        if (deleteButton) {
            deleteButton.disabled = !request.enabled;
        }
    }
}); 