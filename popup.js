document.addEventListener('DOMContentLoaded', function() {
    const scanButton = document.getElementById('scan-button');
    const fileList = document.getElementById('file-list');
    const scanResult = document.getElementById('scan-result');
    const timeValue = document.getElementById('time-value');
    const timeUnit = document.getElementById('time-unit');
    const scanFrequency = document.getElementById('scan-frequency');
    const scanUnit = document.getElementById('scan-unit');
    const extensionInput = document.getElementById('extension-input');
    const addExtensionBtn = document.getElementById('add-extension');
    const extensionsList = document.getElementById('extensions-list');
    const autoScanEnabled = document.getElementById('auto-scan-enabled');

    if (!scanButton || !fileList || !scanResult || !timeValue || !timeUnit) {
        console.error('Required elements not found');
        return;
    }

    const btnText = scanButton.querySelector('.btn-text');
    const spinner = scanButton.querySelector('.spinner');

    // Load saved settings
    loadSettings();

    // Save settings when changed with validation
    timeValue.addEventListener('change', function() {
        validateAndSaveSettings(this, 1, 999);
    });
    timeUnit.addEventListener('change', saveSettings);
    
    if (scanFrequency) {
        scanFrequency.addEventListener('change', function() {
            validateAndSaveSettings(this, 1, 999);
        });
    }
    if (scanUnit) scanUnit.addEventListener('change', saveSettings);

    // Auto-scan toggle
    if (autoScanEnabled) {
        autoScanEnabled.addEventListener('change', saveSettings);
    }

    // Extensions management
    if (addExtensionBtn) {
        addExtensionBtn.addEventListener('click', addExtension);
    }
    if (extensionInput) {
        extensionInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addExtension();
            }
        });
        
        // Update placeholder on load
        updateExtensionsPlaceholder();
    }

    scanButton.addEventListener('click', () => scanOldDownloads(true)); // Force fresh scan

    function loadSettings() {
        chrome.storage.local.get(['timeValue', 'timeUnit', 'scanFrequency', 'scanUnit', 'excludedExtensions', 'autoScanEnabled'], function(result) {
            if (result.timeValue) timeValue.value = result.timeValue;
            if (result.timeUnit) timeUnit.value = result.timeUnit;
            if (scanFrequency && result.scanFrequency) scanFrequency.value = result.scanFrequency;
            if (scanUnit && result.scanUnit) scanUnit.value = result.scanUnit;
            if (autoScanEnabled) autoScanEnabled.checked = result.autoScanEnabled !== false; // Default to true
            if (result.excludedExtensions && extensionsList) {
                result.excludedExtensions.forEach(ext => {
                    addExtensionTag(ext);
                });
            }
        });
    }

    function saveSettings() {
        const settings = {
            timeValue: timeValue.value,
            timeUnit: timeUnit.value
        };

        if (scanFrequency) settings.scanFrequency = scanFrequency.value;
        if (scanUnit) settings.scanUnit = scanUnit.value;
        if (autoScanEnabled) settings.autoScanEnabled = autoScanEnabled.checked;
        
        if (extensionsList) {
            const excludedExtensions = Array.from(extensionsList.querySelectorAll('.extension-tag'))
                .map(tag => tag.querySelector('.tag-text').textContent.trim());
            settings.excludedExtensions = excludedExtensions;
        }

        chrome.storage.local.set(settings);
    }

    function addExtension() {
        if (!extensionInput || !extensionsList) return;
        
        let extension = extensionInput.value.trim().toLowerCase().replace(/^\./, ''); // убираем точку если есть
        
        // Добавляем популярные расширения для быстрого ввода
        const commonExtensions = {
            'pdf': 'pdf', 'doc': 'doc', 'docx': 'docx', 'txt': 'txt',
            'jpg': 'jpg', 'jpeg': 'jpeg', 'png': 'png', 'gif': 'gif',
            'mp4': 'mp4', 'avi': 'avi', 'mov': 'mov', 'mkv': 'mkv',
            'zip': 'zip', 'rar': 'rar', '7z': '7z', 'tar': 'tar',
            'exe': 'exe', 'dmg': 'dmg', 'pkg': 'pkg', 'deb': 'deb'
        };
        
        if (commonExtensions[extension]) {
            extension = commonExtensions[extension];
        }
        
        if (extension && !isExtensionExists(extension)) {
            addExtensionTag(extension);
            extensionInput.value = '';
            extensionInput.focus(); // Возвращаем фокус для удобства
            saveSettings();
        }
    }

    function isExtensionExists(extension) {
        if (!extensionsList) return false;
        const existing = Array.from(extensionsList.querySelectorAll('.extension-tag .tag-text'))
            .map(span => span.textContent.trim());
        return existing.includes(extension);
    }

    function addExtensionTag(extension) {
        if (!extensionsList) return;
        
        const tag = document.createElement('div');
        tag.className = 'extension-tag';
        tag.innerHTML = `
            <span class="tag-text">${extension}</span>
            <button class="tag-remove" type="button">×</button>
        `;
        
        tag.querySelector('.tag-remove').addEventListener('click', () => {
            tag.remove();
            saveSettings();
        });

        extensionsList.appendChild(tag);
        
        // Update placeholder visibility
        updateExtensionsPlaceholder();
    }
    
    function updateExtensionsPlaceholder() {
        if (!extensionInput) return;
        
        const hasTags = extensionsList && extensionsList.children.length > 0;
        if (hasTags) {
            extensionInput.placeholder = "Add another extension...";
        } else {
            extensionInput.placeholder = "Type extension and press Enter (e.g. pdf, jpg)";
        }
    }

    function getExcludedExtensions() {
        if (!extensionsList) return [];
        return Array.from(extensionsList.querySelectorAll('.extension-tag .tag-text'))
            .map(span => span.textContent.trim());
    }

    function getThresholdInMs() {
        const value = parseInt(timeValue.value) || 7;
        const unit = timeUnit.value;
        
        switch(unit) {
            case 'minutes':
                return value * 60 * 1000;
            case 'hours':
                return value * 60 * 60 * 1000;
            case 'days':
            default:
                return value * 24 * 60 * 60 * 1000;
        }
    }

    function formatAge(ageMs) {
        const absAge = Math.abs(ageMs);
        const minutes = Math.floor(absAge / (1000 * 60));
        const hours = Math.floor(absAge / (1000 * 60 * 60));
        const days = Math.floor(absAge / (1000 * 60 * 60 * 24));

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
    }

    function scanOldDownloads(forceFresh = false) {
        if (!btnText || !spinner) return;
        
        // Check for cached results first (unless forcing fresh scan)
        if (!forceFresh) {
            chrome.runtime.sendMessage({ action: 'getCachedResults' }, (response) => {
                if (response && response.results && response.timestamp) {
                    const cacheAge = Date.now() - response.timestamp;
                    const maxCacheAge = 5 * 60 * 1000; // 5 minutes
                    
                    if (cacheAge < maxCacheAge) {
                        // Use cached results
                        displayScanResult(response.results.length);
                        displayOldFiles(response.results);
                        
                        // Show cache indicator
                        const cacheAgeMinutes = Math.floor(cacheAge / (60 * 1000));
                        if (response.results.length > 0) {
                            const resultElement = document.getElementById('scan-result');
                            if (resultElement) {
                                resultElement.innerHTML += ` <span style="font-size: 11px; opacity: 0.7;">(scanned ${cacheAgeMinutes}m ago)</span>`;
                            }
                        }
                        return;
                    }
                }
                
                // No valid cache, perform fresh scan
                performFreshScan();
            });
        } else {
            // Force fresh scan
            performFreshScan();
        }
    }

    function performFreshScan() {
        if (!btnText || !spinner) return;
        
        scanButton.classList.add('scanning');
        btnText.textContent = 'Scanning...';
        spinner.classList.remove('hidden');
        scanResult.classList.add('hidden');
        fileList.innerHTML = '';

        chrome.downloads.search({}, function(downloads) {
            if (chrome.runtime.lastError) {
                console.error('Error searching downloads:', chrome.runtime.lastError);
                scanButton.classList.remove('scanning');
                btnText.textContent = 'Refresh Scan';
                spinner.classList.add('hidden');
                return;
            }

            setTimeout(() => {
                const threshold = getThresholdInMs();
                const excludedExtensions = getExcludedExtensions();
                
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

                scanButton.classList.remove('scanning');
                btnText.textContent = 'Refresh Scan';
                spinner.classList.add('hidden');

                // Clear cache in background
                chrome.runtime.sendMessage({ action: 'clearCache' });

                displayScanResult(oldFiles.length);
                displayOldFiles(oldFiles);
            }, 1000);
        });
    }

    function displayScanResult(count) {
        if (count === 0) {
            // Don't show the banner when no files found, the empty state below already shows this
            scanResult.classList.add('hidden');
            return;
        }

        scanResult.classList.remove('hidden', 'success', 'info', 'warning');
        scanResult.classList.add('fade-in');

        if (count === 1) {
            scanResult.classList.add('warning');
            scanResult.textContent = `Found 1 old file`;
        } else {
            scanResult.classList.add('warning');
            scanResult.textContent = `Found ${count} old files`;
        }
    }

    function displayOldFiles(files) {
        if (files.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <div class="empty-state-text">All clean!</div>
                    <div class="empty-state-subtext">No old downloads found</div>
                </div>
            `;
            return;
        }

        let tableHtml = `
            <div class="files-table-container">
                <table class="files-table">
                    <thead>
                        <tr>
                            <th>File Name</th>
                            <th>Size</th>
                            <th>Age</th>
                            <th>Select</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        files.forEach(file => {
            const age = Math.abs(Date.now() - new Date(file.startTime).getTime());
            const ageText = formatAge(age);
            const fileSizeText = formatFileSize(file.fileSize || 0);
            
            // Extract only filename from path
            const fullPath = file.filename || 'Unknown file';
            const fileNameOnly = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath;
            const fileName = truncateFileName(fileNameOnly, 40);

            tableHtml += `
                <tr>
                    <td class="file-name-cell" title="${fileNameOnly}">${fileName}</td>
                    <td class="file-size-cell">${fileSizeText}</td>
                    <td class="file-age-cell">${ageText}</td>
                    <td class="file-checkbox-cell">
                        <input type="checkbox" class="file-select" data-file-id="${file.id}" data-file-size="${file.fileSize || 0}">
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        // Add action buttons
        tableHtml += `
            <div class="files-actions">
                <div class="selection-controls">
                    <button class="select-all-btn">Select All</button>
                    <button class="deselect-all-btn">Deselect All</button>
                </div>
                <div class="delete-controls">
                    <span class="selected-count">0 files selected</span>
                    <button class="delete-selected-btn" disabled>Delete Selected</button>
                </div>
            </div>
        `;

        fileList.innerHTML = tableHtml;
        setupFileListEventHandlers(files);
    }

    function setupFileListEventHandlers(files) {
        const checkboxes = fileList.querySelectorAll('.file-select');
        const selectAllBtn = fileList.querySelector('.select-all-btn');
        const deselectAllBtn = fileList.querySelector('.deselect-all-btn');
        const deleteSelectedBtn = fileList.querySelector('.delete-selected-btn');
        const selectedCount = fileList.querySelector('.selected-count');
        
        // Re-enable buttons when new scan is performed
        if (selectAllBtn) selectAllBtn.disabled = false;
        if (deselectAllBtn) deselectAllBtn.disabled = false;
        if (deleteSelectedBtn) deleteSelectedBtn.disabled = true; // Will be enabled when files are selected

        function updateSelectedCount() {
            const selected = fileList.querySelectorAll('.file-select:checked');
            const count = selected.length;
            
            // Calculate total size
            let totalSize = 0;
            selected.forEach(checkbox => {
                const fileSize = parseInt(checkbox.dataset.fileSize) || 0;
                totalSize += fileSize;
            });
            
            const sizeText = formatFileSize(totalSize);
            
            if (count === 0) {
                selectedCount.textContent = '0 files selected';
            } else if (count === 1) {
                selectedCount.textContent = `1 file selected (${sizeText})`;
            } else {
                selectedCount.textContent = `${count} files selected (${sizeText})`;
            }
            
            deleteSelectedBtn.disabled = count === 0;
        }

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedCount);
        });

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(checkbox => checkbox.checked = true);
                updateSelectedCount();
            });
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(checkbox => checkbox.checked = false);
                updateSelectedCount();
            });
        }

        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                const selectedCheckboxes = fileList.querySelectorAll('.file-select:checked');
                
                if (selectedCheckboxes.length === 0) return;

                const confirmMessage = `Are you sure you want to delete ${selectedCheckboxes.length} file${selectedCheckboxes.length !== 1 ? 's' : ''}?`;
                
                if (confirm(confirmMessage)) {
                    deleteSelectedFiles(selectedCheckboxes, files);
                }
            });
        }
    }

    function deleteSelectedFiles(selectedCheckboxes, allFiles) {
        let deletedCount = 0;
        const totalToDelete = selectedCheckboxes.length;
        
        // Calculate total size of files being deleted
        let totalDeletedSize = 0;
        selectedCheckboxes.forEach(checkbox => {
            const fileSize = parseInt(checkbox.dataset.fileSize) || 0;
            totalDeletedSize += fileSize;
        });

        selectedCheckboxes.forEach((checkbox, index) => {
            const fileId = parseInt(checkbox.dataset.fileId);
            const row = checkbox.closest('tr');
            
            row.style.opacity = '0.5';
            
            setTimeout(() => {
                chrome.downloads.removeFile(fileId, function() {
                    if (chrome.runtime.lastError) {
                        console.error('Error removing file:', chrome.runtime.lastError);
                        row.style.opacity = '1';
                        return;
                    }

                    chrome.downloads.erase({id: fileId}, function() {
                        row.remove();
                        deletedCount++;
                        
                        if (deletedCount === totalToDelete) {
                            // Reset selected counter and disable buttons before replacing content
                            const selectedCountEl = fileList.querySelector('.selected-count');
                            const deleteBtn = fileList.querySelector('.delete-selected-btn');
                            const selectAllBtn = fileList.querySelector('.select-all-btn');
                            const deselectAllBtn = fileList.querySelector('.deselect-all-btn');
                            
                            if (selectedCountEl) selectedCountEl.textContent = '0 files selected';
                            if (deleteBtn) deleteBtn.disabled = true;
                            if (selectAllBtn) selectAllBtn.disabled = true;
                            if (deselectAllBtn) deselectAllBtn.disabled = true;
                            
                            // Hide the scan result banner when showing congratulations
                            scanResult.classList.add('hidden');
                            
                            // Show congratulations message after cleanup
                            displayDeletionSuccess(totalToDelete, totalDeletedSize);
                        }
                    });
                });
            }, index * 200);
        });
    }
    
    function displayDeletionSuccess(filesCount, freedSpace) {
        const freedSpaceText = formatFileSize(freedSpace);
        
        fileList.innerHTML = `
            <div class="empty-state success-state">
                <div class="empty-state-icon">🎉</div>
                <div class="empty-state-text">Successfully deleted!</div>
                <div class="empty-state-subtext">
                    Deleted ${filesCount} file${filesCount !== 1 ? 's' : ''} and freed ${freedSpaceText} of space
                </div>
            </div>
        `;
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        const size = bytes / Math.pow(k, i);
        
        return parseFloat(size.toFixed(1)) + ' ' + sizes[i];
    }

    function truncateFileName(filename, maxLength) {
        if (!filename || filename.length <= maxLength) return filename;
        
        const lastDot = filename.lastIndexOf('.');
        if (lastDot === -1) {
            // No extension, just truncate
            return filename.substring(0, Math.max(0, maxLength - 3)) + '...';
        }
        
        const extension = filename.substring(lastDot);
        const nameWithoutExt = filename.substring(0, lastDot);
        
        // Ensure we have space for at least some characters before extension
        const minNameLength = 3;
        const availableLength = maxLength - extension.length - 3; // -3 for "..."
        
        if (availableLength < minNameLength) {
            // Extension is too long, just truncate the whole filename
            return filename.substring(0, Math.max(0, maxLength - 3)) + '...';
        }
        
        const truncatedName = nameWithoutExt.substring(0, availableLength) + '...';
        return truncatedName + extension;
    }

    function validateAndSaveSettings(input, min, max) {
        let value = parseInt(input.value);
        
        // Проверяем на корректность и границы
        if (isNaN(value) || value < min) {
            value = min;
            input.value = value;
        } else if (value > max) {
            value = max;
            input.value = value;
        }
        
        // Сохраняем настройки после валидации
        saveSettings();
    }

    // Clear badge when popup opens (user is now aware of files)
    chrome.runtime.sendMessage({ action: 'clearBadge' });
});
