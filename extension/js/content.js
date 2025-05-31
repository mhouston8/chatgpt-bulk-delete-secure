// This file is kept for future use if needed
// Currently, all functionality is handled through direct script injection
// from popup.js using chrome.scripting.executeScript

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'deleteAll') {
        deleteAllConversations()
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Required for async sendResponse
    }
});

// Function to delete all conversations
async function deleteAllConversations() {
    const deleteButtons = document.querySelectorAll('button[data-testid="delete-conversation-button"]');
    
    for (const button of deleteButtons) {
        try {
            // Click delete button
            button.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Click confirm button
            const confirmButton = document.querySelector('button[data-testid="confirm-delete-button"]');
            if (confirmButton) {
                confirmButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
        }
    }
} 