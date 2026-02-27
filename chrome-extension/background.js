let recordingState = false;

// Ensure the offscreen document exists
let creating; // Promise keeper
async function setupOffscreenDocument(path) {
    if (creating) {
        await creating;
        return;
    }

    creating = (async () => {
        // Check if offscreen document already exists
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [path]
        });

        if (existingContexts.length > 0) {
            return;
        }

        // Create offscreen document
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'Recording screen audio and video in the background'
        });
    })();

    await creating;
    creating = null;
}

let recordingStartTime = 0;
let totalPausedTime = 0;
let pauseStartTime = 0;
let isPaused = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.type === 'start') {
            const streamId = message.streamId;

            // 1. Setup offscreen
            await setupOffscreenDocument('offscreen.html');

            // Wait a moment for offscreen.js to load
            await new Promise(resolve => setTimeout(resolve, 500));

            // 2. Send streamId and config to offscreen
            chrome.runtime.sendMessage({
                type: 'start',
                target: 'offscreen',
                data: {
                    streamId: streamId,
                    micEnabled: message.micEnabled
                }
            });

            recordingState = true;
            isPaused = false;
            recordingStartTime = Date.now();
            totalPausedTime = 0;
            pauseStartTime = 0;

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
            isPaused = false;
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setBadgeBackgroundColor({ color: '#000000' });
            sendResponse({ success: true });

        } else if (message.type === 'pause') {
            chrome.runtime.sendMessage({
                type: 'pause',
                target: 'offscreen'
            });
            isPaused = true;
            pauseStartTime = Date.now();
            chrome.action.setBadgeText({ text: 'PAUS' });
            chrome.action.setBadgeBackgroundColor({ color: '#f2c94c' });
            sendResponse({ success: true });

        } else if (message.type === 'resume') {
            chrome.runtime.sendMessage({
                type: 'resume',
                target: 'offscreen'
            });
            isPaused = false;
            if (pauseStartTime > 0) {
                totalPausedTime += (Date.now() - pauseStartTime);
                pauseStartTime = 0;
            }
            chrome.action.setBadgeText({ text: 'REC' });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
            sendResponse({ success: true });

        } else if (message.type === 'checkState') {
            let timeInSeconds = 0;
            if (recordingState && recordingStartTime > 0) {
                let now = isPaused ? pauseStartTime : Date.now();
                timeInSeconds = Math.floor((now - recordingStartTime - totalPausedTime) / 1000);
            }
            sendResponse({
                isRecording: recordingState,
                isPaused: isPaused,
                timeInSeconds: timeInSeconds
            });
        }
    })();
    return true; // MUST be synchronous return to keep channel open
});
