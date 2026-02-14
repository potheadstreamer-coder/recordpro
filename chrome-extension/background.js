let recordingState = false;

// Ensure the offscreen document exists
async function setupOffscreenDocument(path) {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [path]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // Create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'Recording screen audio and video in the background'
        });
        await creating;
        creating = null;
    }
}

let creating; // Promise keeper

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'start') {
        const streamId = message.streamId;

        // 1. Setup offscreen
        await setupOffscreenDocument('offscreen.html');

        // Wait a moment for offscreen.js to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Send streamId to offscreen
        chrome.runtime.sendMessage({
            type: 'start',
            target: 'offscreen',
            data: streamId
        });

        recordingState = true;
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        sendResponse({ success: true });

    } else if (message.type === 'stop') {
        // Send stop to offscreen
        chrome.runtime.sendMessage({
            type: 'stop',
            target: 'offscreen'
        });

        recordingState = false;
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#000000' }); // Reset color (though empty text hides it)
        sendResponse({ success: true });

    } else if (message.type === 'checkState') {
        sendResponse({ isRecording: recordingState });
    }

    return true; // Keep channel open for async response
});
