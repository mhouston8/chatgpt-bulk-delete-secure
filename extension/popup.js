document.addEventListener('DOMContentLoaded', function() {
    const deleteButton = document.getElementById('deleteButton');
    const addCheckboxesButton = document.getElementById('addCheckboxesButton');
    const statusDiv = document.getElementById('status');
    const exportCheckbox = document.getElementById('exportBeforeDelete');

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
            statusDiv.textContent = 'Processing...';

            // If export is enabled, export first
            if (exportCheckbox.checked) {
                statusDiv.textContent = 'Exporting conversations...';
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: exportSelectedConversations
                });
            }

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