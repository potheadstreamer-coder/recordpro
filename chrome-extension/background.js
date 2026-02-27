let recordingState = false;

// Ensure the offscreen document exists
async function setupOffscreenDocument(path) {
    if (await chrome.offscreen.hasDocument()) {
        console.log("Offscreen document already exists via hasDocument.");
        return;
    }

    // Check if offscreen document already exists using contexts (backup)
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) {
        console.log("Offscreen document already exists via getContexts.");
        return;
    }

    try {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'Recording screen audio and video in the background'
        });

        console.log("Offscreen document created successfully.");
        // Give it a moment to initialize its listeners
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("Offscreen document initialization delay complete.");
    } catch (err) {
        if (err.message.includes('Only a single offscreen document may be created.')) {
            console.warn("Attempted to create a second offscreen document, which is not allowed. This might indicate a race condition or logic error.", err);
            return;
        } else {
            console.error("Failed to create offscreen document:", err);
            throw err;
        }
    }
}

let recordingStartTime = 0;
let totalPausedTime = 0;
let pauseStartTime = 0;
let isPaused = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'start') {
        const streamId = message.streamId;

        setupOffscreenDocument('offscreen.html').then(() => {
            // Give it an extra moment just in case
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'start',
                    target: 'offscreen',
                    data: {
                        streamId: streamId,
                        micEnabled: message.micEnabled
                    }
                }, (response) => {
                    // Check for runtime error to clear it
                    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
                });

                recordingState = true;
                isPaused = false;
                recordingStartTime = Date.now();
                totalPausedTime = 0;
                pauseStartTime = 0;

                chrome.action.setBadgeText({ text: 'REC' });
                chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
                sendResponse({ success: true });
            }, 200);
        }).catch(err => {
            console.error("Setup failed:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open

    } else if (message.type === 'stop') {
        chrome.runtime.sendMessage({
            type: 'stop',
            target: 'offscreen'
        }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
        });

        recordingState = false;
        isPaused = false;
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#000000' });

        // Wait a slight bit for offscreen to process stop before returning
        setTimeout(() => sendResponse({ success: true }), 100);
        return true;

    } else if (message.type === 'pause') {
        chrome.runtime.sendMessage({
            type: 'pause',
            target: 'offscreen'
        }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
        });
        isPaused = true;
        pauseStartTime = Date.now();
        chrome.action.setBadgeText({ text: 'PAUS' });
        chrome.action.setBadgeBackgroundColor({ color: '#f2c94c' });
        sendResponse({ success: true });
        return true;

    } else if (message.type === 'resume') {
        chrome.runtime.sendMessage({
            type: 'resume',
            target: 'offscreen'
        }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
        });
        isPaused = false;
        if (pauseStartTime > 0) {
            totalPausedTime += (Date.now() - pauseStartTime);
            pauseStartTime = 0;
        }
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        sendResponse({ success: true });
        return true;

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
        return true;
    }
});
