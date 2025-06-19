// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadConversation') {
        // Download the file using Chrome's downloads API
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Download failed:', chrome.runtime.lastError);
            } else {
                console.log('Download started:', downloadId);
            }
        });
    }
});

chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: 'html/popup.html',
    type: 'popup',
    width: 400,
    height: 600,
    focused: true
  });
}); 