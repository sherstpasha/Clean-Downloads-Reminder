// Background script for Clean Downloads Reminder

let cachedScanResults = null;
let lastScanTime = null;

chrome.runtime.onInstalled.addListener(() => {
    setupAutoScan();
    
    // Perform initial scan after short delay
    setTimeout(() => {
        performBackgroundScan();
    }, 5000); // 5 seconds delay
});

chrome.runtime.onStartup.addListener(() => {
    setupAutoScan();
});

// Badge is visible on extension icon - no need for click handlers

function setupAutoScan() {
    chrome.storage.local.get(['scanFrequency', 'scanUnit', 'autoScanEnabled'], (result) => {
        // If auto-scan is disabled, clear existing alarm and return
        if (result.autoScanEnabled === false) {
            chrome.alarms.clear('auto-scan');
            return;
        }
        
        const frequency = parseInt(result.scanFrequency) || 1;
        const unit = result.scanUnit || 'days';
        
        // Convert to minutes for chrome.alarms
        let intervalInMinutes;
        switch(unit) {
            case 'minutes':
                intervalInMinutes = frequency;
                break;
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
            
            // Show badge if files found
            if (oldFiles.length > 0) {
                showBadge(oldFiles.length);
            } else {
                clearBadge();
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

function showBadge(fileCount) {
    // Set badge text
    chrome.action.setBadgeText({
        text: fileCount.toString()
    });
    
    // Set badge background color (yellow/orange)
    chrome.action.setBadgeBackgroundColor({
        color: '#FF6B35' // Orange color
    });
    
    // Set title (tooltip) text
    const message = fileCount === 1 
        ? 'Found 1 old file in downloads' 
        : `Found ${fileCount} old files in downloads`;
    
    chrome.action.setTitle({
        title: message
    });
}

function clearBadge() {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Clean Downloads Reminder' });
}

// Listen for settings changes to update scan schedule
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.scanFrequency || changes.scanUnit || changes.autoScanEnabled)) {
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