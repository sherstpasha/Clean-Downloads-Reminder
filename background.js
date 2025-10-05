// Background script for Clean Downloads Reminder
console.log('Clean Downloads Reminder background script loaded');

let cachedScanResults = null;
let lastScanTime = null;

chrome.runtime.onInstalled.addListener(() => {
    console.log('Clean Downloads Reminder extension installed/updated');
    setupAutoScan();
});

chrome.runtime.onStartup.addListener(() => {
    setupAutoScan();
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'old-files-found') {
        chrome.action.openPopup();
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId === 'old-files-found') {
        if (buttonIndex === 0) { // "Open Extension" button
            chrome.action.openPopup();
        }
        // Button 1 is "Dismiss" - just clear the notification
        chrome.notifications.clear(notificationId);
    }
});

function setupAutoScan() {
    chrome.storage.local.get(['scanFrequency', 'scanUnit'], (result) => {
        const frequency = parseInt(result.scanFrequency) || 1;
        const unit = result.scanUnit || 'days';
        
        // Convert to minutes for chrome.alarms
        let intervalInMinutes;
        switch(unit) {
            case 'hours':
                intervalInMinutes = frequency * 60;
                break;
            case 'days':
            default:
                intervalInMinutes = frequency * 24 * 60;
                break;
        }
        
        // Clear existing alarm and create new one
        chrome.alarms.clear('auto-scan');
        chrome.alarms.create('auto-scan', {
            delayInMinutes: intervalInMinutes,
            periodInMinutes: intervalInMinutes
        });
        
        console.log(`Auto-scan scheduled every ${frequency} ${unit} (${intervalInMinutes} minutes)`);
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'auto-scan') {
        performBackgroundScan();
    }
});

function performBackgroundScan() {
    chrome.storage.local.get(['timeValue', 'timeUnit', 'excludedExtensions'], (settings) => {
        const threshold = getThresholdInMs(settings.timeValue || 7, settings.timeUnit || 'days');
        const excludedExtensions = settings.excludedExtensions || [];
        
        chrome.downloads.search({}, (downloads) => {
            if (chrome.runtime.lastError) {
                console.error('Error in background scan:', chrome.runtime.lastError);
                return;
            }
            
            const oldFiles = downloads.filter(file => {
                if (file.state !== 'complete') return false;
                
                const currentTime = Date.now();
                const fileTime = new Date(file.startTime).getTime();
                const age = Math.abs(currentTime - fileTime);
                
                if (age <= threshold) return false;
                
                // Check if file extension is excluded
                const filename = file.filename || '';
                const parts = filename.split('.');
                const extension = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
                const isExcluded = excludedExtensions.includes(extension);
                
                return !isExcluded;
            });
            
            // Cache results for popup
            cachedScanResults = oldFiles;
            lastScanTime = Date.now();
            
            // Show notification if files found
            if (oldFiles.length > 0) {
                showNotification(oldFiles.length);
            }
        });
    });
}

function getThresholdInMs(value, unit) {
    const numValue = parseInt(value) || 7;
    switch(unit) {
        case 'minutes':
            return numValue * 60 * 1000;
        case 'hours':
            return numValue * 60 * 60 * 1000;
        case 'days':
        default:
            return numValue * 24 * 60 * 60 * 1000;
    }
}

function showNotification(fileCount) {
    const message = fileCount === 1 
        ? 'Found 1 old file in your downloads' 
        : `Found ${fileCount} old files in your downloads`;
    
    chrome.notifications.create('old-files-found', {
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Clean Downloads Reminder',
        message: message,
        buttons: [{ title: 'Open Extension' }, { title: 'Dismiss' }]
    });
}

// Listen for settings changes to update scan schedule
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.scanFrequency || changes.scanUnit)) {
        setupAutoScan();
    }
});

// Expose cached results to popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCachedResults') {
        sendResponse({
            results: cachedScanResults,
            timestamp: lastScanTime
        });
    } else if (request.action === 'clearCache') {
        cachedScanResults = null;
        lastScanTime = null;
        sendResponse({ success: true });
    }
});