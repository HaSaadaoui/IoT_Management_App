// ======================================================
// ===============  GLOBAL VARIABLES  ===================
// ======================================================

// Gateway Configuration Management
let gatewayThresholds = {
    cpu: { warning: 70.0, critical: 85.0 },
    ram: { warning: 70.0, critical: 85.0 },
    disk: { warning: 80.0, critical: 90.0 },
    temperature: { warning: 70.0, critical: 80.0 }
};
let gatewayRebootSchedules = {};

// Ace editor pour le payload
let editor;
let defaultSVGFile;
let blobUrl = "";

// ======================================================
// ===============  TEMPLATE PAYLOAD ELSYS  =============
// ======================================================

const defaultPayloadCode = `
var TYPE_TEMP         = 0x01;
var TYPE_RH           = 0x02;
var TYPE_CO2          = 0x06;
var TYPE_VDD          = 0x07;
var TYPE_OCCUPANCY    = 0x11;

function bin16dec(bin) {
    var num = bin & 0xFFFF;
    if (0x8000 & num) num = - (0x010000 - num);
    return num;
}

function decodePayload(bytes){
    var obj = {};
    for (let i = 0; i < bytes.length; i++) {
        switch (bytes[i]) {
            case TYPE_TEMP:
                var temp = (bytes[i+1] << 8) | (bytes[i+2]);
                temp = bin16dec(temp);
                obj.temperature = temp / 10;
                i += 2;
                break;
            case TYPE_RH:
                obj.humidity = bytes[i+1];
                i += 1;
                break;
            case TYPE_VDD:
                obj.vdd = (bytes[i+1] << 8) | (bytes[i+2]);
                i += 2;
                break;
            case TYPE_OCCUPANCY:
                obj.occupancy = bytes[i+1];
                i += 1;
                break;
            default:
                i = bytes.length;
                break;
        }
    }
    return obj;
}
`;

// ======================================================
// ===============  GATEWAY CONFIGURATION  =============
// ======================================================

function getCsrfHeaders(contentType = null) {
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    const headers = {};
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    if (csrfMeta && csrfHeaderMeta) {
        headers[csrfHeaderMeta.getAttribute('content')] = csrfMeta.getAttribute('content');
    }
    return headers;
}

function minutesFromGatewayRebootInput() {
    const value = Number(document.getElementById('gateway-reboot-interval')?.value || 0);
    const unit = document.getElementById('gateway-reboot-unit')?.value || 'hours';
    if (!Number.isFinite(value) || value < 1) {
        return null;
    }
    if (unit === 'days') return Math.round(value * 1440);
    if (unit === 'hours') return Math.round(value * 60);
    return Math.round(value);
}

function setGatewayRebootInterval(minutes) {
    const intervalInput = document.getElementById('gateway-reboot-interval');
    const unitSelect = document.getElementById('gateway-reboot-unit');
    if (!intervalInput || !unitSelect) return;

    if (minutes >= 1440 && minutes % 1440 === 0) {
        intervalInput.value = minutes / 1440;
        unitSelect.value = 'days';
    } else if (minutes >= 60 && minutes % 60 === 0) {
        intervalInput.value = minutes / 60;
        unitSelect.value = 'hours';
    } else {
        intervalInput.value = minutes || 1440;
        unitSelect.value = 'minutes';
    }
}

async function loadGatewayRebootSchedules() {
    try {
        const response = await fetch('/api/configuration/gateway-reboots');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const schedules = await response.json();
        gatewayRebootSchedules = {};
        schedules.forEach(schedule => {
            gatewayRebootSchedules[schedule.gatewayId] = schedule;
        });
        updateGatewayRebootForm();
    } catch (error) {
        console.error('Error loading gateway reboot schedules:', error);
    }
}

function updateGatewayRebootForm() {
    const select = document.getElementById('gateway-reboot-select');
    const enabled = document.getElementById('gateway-reboot-enabled');
    const nowStatus = document.getElementById('gateway-reboot-now-status');
    const scheduleStatus = document.getElementById('gateway-reboot-schedule-status');
    const gatewayId = select?.value;
    const hasGateway = Boolean(gatewayId);

    document.getElementById('gateway-reboot-now-btn')?.toggleAttribute('disabled', !hasGateway);
    document.getElementById('gateway-reboot-save-btn')?.toggleAttribute('disabled', !hasGateway);
    document.getElementById('gateway-reboot-interval')?.toggleAttribute('disabled', !hasGateway);
    document.getElementById('gateway-reboot-unit')?.toggleAttribute('disabled', !hasGateway);
    if (enabled) enabled.disabled = !hasGateway;

    if (nowStatus) nowStatus.textContent = '';
    if (scheduleStatus) scheduleStatus.textContent = '';

    const schedule = gatewayRebootSchedules[gatewayId] || { enabled: false, intervalMinutes: 1440 };
    if (enabled) enabled.checked = Boolean(schedule.enabled);
    setGatewayRebootInterval(Number(schedule.intervalMinutes || 1440));

    if (schedule.restarting && nowStatus) {
        nowStatus.textContent = `Restarting (${Math.ceil(Number(schedule.remainingSeconds || 0) / 60)} min left)`;
        nowStatus.className = 'gateway-reboot-status is-pending';
    }
}

async function restartGatewayFromConfig() {
    const gatewayId = document.getElementById('gateway-reboot-select')?.value;
    if (!gatewayId) {
        showNotification('Please select a gateway.', 'warning');
        return;
    }

    const nameEl = document.getElementById('gateway-restart-confirm-name');
    const modal = document.getElementById('gateway-restart-confirm-modal');
    if (nameEl) nameEl.textContent = gatewayId;
    if (modal) {
        modal.style.display = 'flex';
    } else {
        await confirmGatewayRestartFromConfig();
    }
}

function closeGatewayRestartModal() {
    const modal = document.getElementById('gateway-restart-confirm-modal');
    if (modal) modal.style.display = 'none';
}

async function confirmGatewayRestartFromConfig() {
    const gatewayId = document.getElementById('gateway-reboot-select')?.value;
    const status = document.getElementById('gateway-reboot-now-status');
    const button = document.getElementById('gateway-reboot-now-btn');
    const confirmButton = document.getElementById('gateway-restart-confirm-btn');
    if (!gatewayId) {
        closeGatewayRestartModal();
        showNotification('Please select a gateway.', 'warning');
        return;
    }

    closeGatewayRestartModal();
    if (button) button.disabled = true;
    if (confirmButton) confirmButton.disabled = true;
    if (status) {
        status.textContent = 'Restart requested...';
        status.className = 'gateway-reboot-status is-pending';
    }

    try {
        const response = await fetch(`/api/configuration/gateway-reboots/${encodeURIComponent(gatewayId)}/restart`, {
            method: 'POST',
            headers: getCsrfHeaders()
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

        if (status) {
            status.textContent = 'Restarting...';
            status.className = 'gateway-reboot-status is-success';
        }
        showNotification('Gateway restart requested.', 'success');
        await loadGatewayRebootSchedules();
    } catch (error) {
        if (status) {
            status.textContent = 'Restart failed.';
            status.className = 'gateway-reboot-status is-error';
        }
        showNotification('Failed to restart gateway: ' + error.message, 'error');
    } finally {
        if (button) button.disabled = false;
        if (confirmButton) confirmButton.disabled = false;
    }
}

async function saveGatewayRebootSchedule() {
    const gatewayId = document.getElementById('gateway-reboot-select')?.value;
    const status = document.getElementById('gateway-reboot-schedule-status');
    const enabled = Boolean(document.getElementById('gateway-reboot-enabled')?.checked);
    const intervalMinutes = minutesFromGatewayRebootInput();

    if (!gatewayId) {
        showNotification('Please select a gateway.', 'warning');
        return;
    }
    if (!intervalMinutes) {
        showNotification('Please enter a valid interval.', 'warning');
        return;
    }

    if (status) {
        status.textContent = 'Saving...';
        status.className = 'gateway-reboot-status is-pending';
    }

    try {
        const response = await fetch(`/api/configuration/gateway-reboots/${encodeURIComponent(gatewayId)}/schedule`, {
            method: 'POST',
            headers: getCsrfHeaders('application/json'),
            body: JSON.stringify({ enabled, intervalMinutes })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

        gatewayRebootSchedules[gatewayId] = payload;
        if (status) {
            status.textContent = enabled ? 'Schedule saved.' : 'Automatic reboot disabled.';
            status.className = 'gateway-reboot-status is-success';
        }
        showNotification('Gateway reboot schedule saved.', 'success');
    } catch (error) {
        if (status) {
            status.textContent = 'Save failed.';
            status.className = 'gateway-reboot-status is-error';
        }
        showNotification('Failed to save reboot schedule: ' + error.message, 'error');
    }
}

function collectDatabaseConfig() {
    return {
        type: 'mysql',
        host: document.getElementById('database-host')?.value?.trim() || '',
        port: Number(document.getElementById('database-port')?.value || 3306),
        databaseName: document.getElementById('database-name')?.value?.trim() || '',
        username: document.getElementById('database-username')?.value?.trim() || '',
        password: document.getElementById('database-password')?.value || ''
    };
}

function setDatabaseStatus(message, type = 'info') {
    const status = document.getElementById('database-config-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = `database-config-status is-${type}`;
}

async function loadDatabaseConnectionConfig() {
    try {
        const response = await fetch('/api/configuration/database');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const config = await response.json();

        if (document.getElementById('database-host')) document.getElementById('database-host').value = config.host || '';
        if (document.getElementById('database-port')) document.getElementById('database-port').value = config.port || 3306;
        if (document.getElementById('database-name')) document.getElementById('database-name').value = config.databaseName || '';
        if (document.getElementById('database-username')) document.getElementById('database-username').value = config.username || '';

        const fileInfo = document.getElementById('database-current-file');
        if (fileInfo) {
            if (!config.fileExists) {
                fileInfo.textContent = `No saved local config yet. It will be created at ${config.configuredFile}`;
                fileInfo.className = 'database-config-help';
            } else if (config.savedMatchesActive) {
                fileInfo.textContent = `Active database: ${config.activeDatabase || 'configured database'}`;
                fileInfo.className = 'database-config-help is-success';
            } else {
                fileInfo.textContent = `Saved database: ${config.savedDatabase || 'configured database'} - restart required. Active database: ${config.activeDatabase || 'current startup database'}`;
                fileInfo.className = 'database-config-help is-warning';
            }
        }
    } catch (error) {
        console.error('Error loading database config:', error);
    }
}

async function testDatabaseConnection() {
    setDatabaseStatus('Testing connection...', 'pending');
    try {
        const response = await fetch('/api/configuration/database/test', {
            method: 'POST',
            headers: getCsrfHeaders('application/json'),
            body: JSON.stringify(collectDatabaseConfig())
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || `HTTP ${response.status}`);
        }
        setDatabaseStatus(payload.message || 'Connection successful.', 'success');
        showNotification('Database connection successful.', 'success');
    } catch (error) {
        setDatabaseStatus(error.message, 'error');
        showNotification('Database connection failed: ' + error.message, 'error');
    }
}

async function saveDatabaseConnection() {
    setDatabaseStatus('Testing and saving configuration...', 'pending');
    try {
        const response = await fetch('/api/configuration/database/save', {
            method: 'POST',
            headers: getCsrfHeaders('application/json'),
            body: JSON.stringify(collectDatabaseConfig())
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || `HTTP ${response.status}`);
        }
        setDatabaseStatus(payload.message || 'Configuration saved. Restart required.', 'success');
        showNotification('Database configuration saved. Restart the app to apply it.', 'success');
        await loadDatabaseConnectionConfig();
    } catch (error) {
        setDatabaseStatus(error.message, 'error');
        showNotification('Failed to save database configuration: ' + error.message, 'error');
    }
}

async function restartApplicationFromConfig() {
    const modal = document.getElementById('application-restart-confirm-modal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        await confirmApplicationRestartFromConfig();
    }
}

function closeApplicationRestartModal() {
    const modal = document.getElementById('application-restart-confirm-modal');
    if (modal) modal.style.display = 'none';
}

async function confirmApplicationRestartFromConfig() {
    const confirmButton = document.getElementById('application-restart-confirm-btn');

    closeApplicationRestartModal();
    if (confirmButton) confirmButton.disabled = true;
    setDatabaseStatus('Application restart requested...', 'pending');
    try {
        const response = await fetch('/api/configuration/application/restart', {
            method: 'POST',
            headers: getCsrfHeaders()
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || `HTTP ${response.status}`);
        }
        setDatabaseStatus('Application is restarting. Refresh the page in a few seconds.', 'success');
        showNotification('Application restart requested.', 'success');
    } catch (error) {
        setDatabaseStatus(error.message, 'error');
        showNotification('Failed to restart application: ' + error.message, 'error');
    } finally {
        if (confirmButton) confirmButton.disabled = false;
    }
}

/**
 * Load current gateway thresholds from server
 */
async function loadGatewayThresholds() {
    try {
        const response = await fetch('/api/gateway-config/thresholds');
        if (response.ok) {
            gatewayThresholds = await response.json();
            updateGatewayThresholdInputs();
        } else {
            console.error('Failed to load gateway thresholds');
        }
    } catch (error) {
        console.error('Error loading gateway thresholds:', error);
    }
}

/**
 * Update gateway threshold input fields with current values
 */
function updateGatewayThresholdInputs() {
    // CPU thresholds
    const cpuCritical = document.getElementById('gateway-cpu-critical');
    const cpuWarning = document.getElementById('gateway-cpu-warning');
    if (cpuCritical) cpuCritical.value = gatewayThresholds.cpu.critical;
    if (cpuWarning) cpuWarning.value = gatewayThresholds.cpu.warning;

    // RAM thresholds
    const ramCritical = document.getElementById('gateway-ram-critical');
    const ramWarning = document.getElementById('gateway-ram-warning');
    if (ramCritical) ramCritical.value = gatewayThresholds.ram.critical;
    if (ramWarning) ramWarning.value = gatewayThresholds.ram.warning;

    // Disk thresholds
    const diskCritical = document.getElementById('gateway-disk-critical');
    const diskWarning = document.getElementById('gateway-disk-warning');
    if (diskCritical) diskCritical.value = gatewayThresholds.disk.critical;
    if (diskWarning) diskWarning.value = gatewayThresholds.disk.warning;

    // Temperature thresholds
    const tempCritical = document.getElementById('gateway-temp-critical');
    const tempWarning = document.getElementById('gateway-temp-warning');
    if (tempCritical) tempCritical.value = gatewayThresholds.temperature.critical;
    if (tempWarning) tempWarning.value = gatewayThresholds.temperature.warning;
}

/**
 * Save gateway thresholds to server
 */
async function saveGatewayThresholds() {
    try {
        // Collect values from form inputs
        const newThresholds = {
            cpu: {
                warning: parseFloat(document.getElementById('gateway-cpu-warning').value),
                critical: parseFloat(document.getElementById('gateway-cpu-critical').value)
            },
            ram: {
                warning: parseFloat(document.getElementById('gateway-ram-warning').value),
                critical: parseFloat(document.getElementById('gateway-ram-critical').value)
            },
            disk: {
                warning: parseFloat(document.getElementById('gateway-disk-warning').value),
                critical: parseFloat(document.getElementById('gateway-disk-critical').value)
            },
            temperature: {
                warning: parseFloat(document.getElementById('gateway-temp-warning').value),
                critical: parseFloat(document.getElementById('gateway-temp-critical').value)
            }
        };

        // Validate thresholds
        if (!validateGatewayThresholds(newThresholds)) {
            return;
        }

        // Send to server
        const response = await fetch('/api/gateway-config/thresholds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(newThresholds)
        });

        const result = await response.json();

        if (result.success) {
            gatewayThresholds = newThresholds;
            showNotification('✅ Gateway thresholds saved successfully!', 'success');
        } else {
            showNotification('❌ Failed to save gateway thresholds: ' + result.message, 'error');
        }

    } catch (error) {
        console.error('Error saving gateway thresholds:', error);
        showNotification('❌ Error saving gateway thresholds: ' + error.message, 'error');
    }
}

/**
 * Validate gateway threshold values
 */
function validateGatewayThresholds(thresholds) {
    // Check CPU thresholds
    if (thresholds.cpu.warning >= thresholds.cpu.critical) {
        showNotification('❌ CPU Warning threshold must be less than Critical threshold', 'error');
        return false;
    }

    // Check RAM thresholds
    if (thresholds.ram.warning >= thresholds.ram.critical) {
        showNotification('❌ RAM Warning threshold must be less than Critical threshold', 'error');
        return false;
    }

    // Check Disk thresholds
    if (thresholds.disk.warning >= thresholds.disk.critical) {
        showNotification('❌ Disk Warning threshold must be less than Critical threshold', 'error');
        return false;
    }

    // Check Temperature thresholds
    if (thresholds.temperature.warning >= thresholds.temperature.critical) {
        showNotification('❌ Temperature Warning threshold must be less than Critical threshold', 'error');
        return false;
    }

    // Check reasonable ranges
    if (thresholds.cpu.critical > 100 || thresholds.ram.critical > 100 || thresholds.disk.critical > 100) {
        showNotification('❌ CPU, RAM, and Disk thresholds cannot exceed 100%', 'error');
        return false;
    }

    if (thresholds.temperature.critical > 120) {
        showNotification('❌ Temperature threshold seems too high (>120°C)', 'error');
        return false;
    }

    return true;
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    if (typeof cfgToast === 'function') {
        cfgToast(message.replace(/[\u2705\u274C\u26A0\uFE0F]/g, '').trim(), type);
    } else {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `${message}`;
        document.body.appendChild(notification);
        setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 5000);
    }
}

// ======================================================
// =====================  MAIN ACTION  ===================
// ======================================================

// Utilitaire hex → bytes
function hexToBytes(hex) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, "");
    const bytes = [];
    for (let c = 0; c < clean.length; c += 2) {
        bytes.push(parseInt(clean.substr(c, 2), 16));
    }
    return bytes;
}

// Test du decoder (exécute le code Ace + decodePayload)
function testDecoder() {
    if (!editor) {
        if (typeof cfgToast === 'function') cfgToast("Payload editor not ready.", 'warning'); else alert("Payload editor not ready.");
        return;
    }

    const hexInput = document.getElementById("test-byte-payload").value;
    if (!hexInput) {
        if (typeof cfgToast === 'function') cfgToast("Please enter a hex payload!", 'warning'); else alert("Please enter a hex payload!");
        return;
    }

    const byteArray = hexToBytes(hexInput);
    const editorCode = editor.getValue();

    let result = {};
    try {
        const func = new Function("bytes", editorCode + "\nreturn decodePayload(bytes);");
        result = func(byteArray);
    } catch (err) {
        console.error(err);
        result = { error: err.message };
    }

    const out = document.getElementById("test-decoded");
    if (out) {
        out.innerText = JSON.stringify(result, null, 2);
    }
}

// Toggle notification channel inputs
function toggleNotifChannelInput() {
    const emailChk = document.getElementById("notif-email");
    const smsChk   = document.getElementById("notif-sms");
    const emailDiv = document.getElementById("notif-email-input");
    const phoneDiv = document.getElementById("notif-phone-input");

    if (emailDiv) emailDiv.style.display = emailChk && emailChk.checked ? "block" : "none";
    if (phoneDiv) phoneDiv.style.display = smsChk && smsChk.checked ? "block" : "none";
}

// ======================================================
// =====================  2D CONFIG  ===================
// ======================================================

function populateFloorSelect() {
    const floorSelect = document.getElementById("filter-floor");
    const floorsEl = document.getElementById("building-floors");
    const elementSelect = document.getElementById("filter-element");

    if (!floorSelect) {
        console.warn('Floor select not found (#filter-floor). Skipping floors update.');
        return;
    }

    const previousfloorValue = floorSelect.value;

    floorSelect.innerHTML = '';
    if(!floorsEl || isNaN(floorsEl.value)) {
        console.warn('Building floors input not found or invalid (#building-floors). Skipping floors update.');
        return;
    }

    if (elementSelect && elementSelect.value && elementSelect.value !== "Sensor") {
        floorSelect.innerHTML = '<option value="">All Floors</option>';
    }

    const previouslyExcluded = (window._pendingExcludedFloors !== undefined)
        ? window._pendingExcludedFloors.map(String)
        : getExcludedFloors();
    window._pendingExcludedFloors = undefined;

    // Clear hidden select and checkbox list
    const checkboxList = document.getElementById('floor-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';

    const totalFloors = parseInt(floorsEl.value, 10) || 0;

    for (let i = 0; i < totalFloors; i++) {
        const isExcluded = previouslyExcluded.includes(String(i));
        const label = i === 0 ? 'Ground Floor' : `Floor ${i}`;

        // Populate filter-floor select
        if (!isExcluded){
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = label;
            floorSelect.appendChild(opt);
        }

        // Populate custom checkbox list
        if (checkboxList) {
            const item = document.createElement('label');
            item.className = 'floor-checkbox-item' + (isExcluded ? ' floor-excluded' : '');
            item.innerHTML = `
                <span class="floor-custom-checkbox ${isExcluded ? 'checked' : ''}"></span>
                <input type="checkbox" value="${i}" ${isExcluded ? 'checked' : ''} onchange="onFloorCheckboxChange(this)">
                <span class="floor-checkbox-label">${label}</span>
            `;
            checkboxList.prepend(item);
        }
    }

    floorSelect.value = previousfloorValue;
    updateFloorCheckboxSummary();
}

function getExcludedFloors() {
    const checkboxes = document.querySelectorAll('#floor-checkbox-list input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function toggleFloorCheckboxPanel() {
    const panel = document.getElementById('floor-checkbox-panel');
    const chevron = document.getElementById('floor-checkbox-chevron');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.textContent = isOpen ? '▾' : '▴';
}

function onFloorCheckboxChange(cb) {
    const item = cb.closest('.floor-checkbox-item');
    const customCb = item?.querySelector('.floor-custom-checkbox');

    if (cb.checked) {
        item?.classList.add('floor-excluded');
        customCb?.classList.add('checked');
    } else {
        item?.classList.remove('floor-excluded');
        customCb?.classList.remove('checked');
    }

    updateFloorCheckboxSummary();
    if (window.building3D.dbBuildingConfig && window.building3D.dbBuildingConfig.svgUrl){
        this.applyFormUpdate();
    }
}

function updateFloorCheckboxSummary() {
    const all = document.querySelectorAll('#floor-checkbox-list input[type="checkbox"]');
    const checked = document.querySelectorAll('#floor-checkbox-list input[type="checkbox"]:checked');
    const summary = document.getElementById('floor-checkbox-summary');
    if (!summary) return;

    const total = all.length;
    const excluded = checked.length;

    if (excluded === 0) {
        summary.textContent = 'All floors visible';
    } else if (excluded === total) {
        summary.textContent = 'All floors excluded';
    } else {
        summary.textContent = `${excluded} floor${excluded > 1 ? 's' : ''} excluded`;
    }

    updateMasterCheckboxUI();
}

function updateMasterCheckboxUI() {
    const all = document.querySelectorAll('#floor-checkbox-list input[type="checkbox"]');
    const checked = document.querySelectorAll('#floor-checkbox-list input[type="checkbox"]:checked');
    const masterUI = document.getElementById('master-checkbox-ui');
    const masterInput = document.getElementById('floor-select-all');
    if (!masterUI) return;

    if (checked.length === 0) {
        masterUI.classList.remove('checked', 'indeterminate');
        if (masterInput) masterInput.checked = false;
    } else if (checked.length === all.length) {
        masterUI.classList.add('checked');
        masterUI.classList.remove('indeterminate');
        if (masterInput) masterInput.checked = true;
    } else {
        masterUI.classList.remove('checked');
        masterUI.classList.add('indeterminate');
        if (masterInput) masterInput.checked = false;
    }
}

function toggleFormFields() {
    const elementSelect = document.getElementById('filter-element');
    const sensorTypeSelect = document.getElementById('filter-sensor-type');
    this.applyFormVisibility(elementSelect.value, sensorTypeSelect.value);
}

function applyFormVisibility(elementValue, sensorTypeValue) {
    this.populateFloorSelect();
    const sensorTypeSelect = document.getElementById('filter-sensor-type');

    const sensorTypeContainer = sensorTypeSelect?.parentElement;
    const inputSizeEl = document.getElementById('input_size');
    const inputSizeContainer = inputSizeEl?.parentElement;
    const inputRadiusEl = document.getElementById('input_radius');
    const inputRadiusContainer = inputRadiusEl?.parentElement;
    const inputLabelEl = document.getElementById('input_label');
    const inputLabelContainer = inputLabelEl?.parentElement;
    const inputWidthEl = document.getElementById('input_width');
    const inputWidthContainer = inputWidthEl?.parentElement;
    const inputHeightEl = document.getElementById('input_height');
    const inputHeightContainer = inputHeightEl?.parentElement;
    const inputRotationEl = document.getElementById('input_rotation');
    const inputRotationContainer = inputRotationEl?.parentElement;
    const selectChairPosition = document.getElementById('chair_top');
    const selectChairContainer = selectChairPosition?.parentElement;
    const styleSelect = document.getElementById("filter-style");
    const styleSelectContainer = styleSelect?.parentElement;
    const inputLocationContainer = document.getElementById("input-location-container");
    const labelBoldContainer     = document.getElementById("label-bold-container");
    const chairMainContainer     = document.getElementById("chair-main-container");
    const chairExtraContainer    = document.getElementById("chair-extra-container");

    const sensorMode = (sensorTypeValue ?? sensorTypeSelect?.value ?? 'DESK');

    switch (elementValue) {
        case "Sensor":
            if (sensorTypeContainer) sensorTypeContainer.style.display = 'block';
            if (styleSelectContainer) styleSelectContainer.style.display = 'none';
            if (inputSizeContainer) inputSizeContainer.style.display = 'block';
            if (inputRadiusContainer) inputRadiusContainer.style.display = 'none';
            if (sensorMode === "DESK") {
                if (inputWidthContainer) inputWidthContainer.style.display = 'block';
                if (inputHeightContainer) inputHeightContainer.style.display = 'block';
                if (inputRotationContainer) inputRotationContainer.style.display = 'block';
                if (selectChairContainer) selectChairContainer.style.display = 'block';
                if (chairMainContainer)  chairMainContainer.style.display  = 'block';
                if (chairExtraContainer) chairExtraContainer.style.display = 'block';
                if (inputLabelContainer) inputLabelContainer.style.display = 'block';
            } else {
                if (inputWidthContainer) inputWidthContainer.style.display = 'none';
                if (inputHeightContainer) inputHeightContainer.style.display = 'none';
                if (inputRotationContainer) inputRotationContainer.style.display = 'none';
                if (selectChairContainer) selectChairContainer.style.display = 'none';
                if (chairMainContainer)  chairMainContainer.style.display  = 'none';
                if (chairExtraContainer) chairExtraContainer.style.display = 'none';
                if (inputLabelContainer) inputLabelContainer.style.display = 'none';
            }
            if (labelBoldContainer) labelBoldContainer.style.display = 'none';
            if (inputLocationContainer) {
                inputLocationContainer.style.display = "block";

                // Charger les options si le composant vient d'être affiché
                const buildingId = document.getElementById("filter-building")?.value || "";
                const floor = document.getElementById("filter-floor")?.value ?? "";
                loadLocationOptions(buildingId, floor, getLocationValue());
            }
            break;

        case "Wall":
            if (inputLocationContainer) inputLocationContainer.style.display = "none";
            if (sensorTypeContainer) sensorTypeContainer.style.display = 'none';
            if (inputSizeContainer) inputSizeContainer.style.display = 'block';
            if (inputRadiusContainer) inputRadiusContainer.style.display = 'none';
            if (inputWidthContainer) inputWidthContainer.style.display = 'block';
            if (inputHeightContainer) inputHeightContainer.style.display = 'none';
            if (inputRotationContainer) inputRotationContainer.style.display = 'block';
            if (selectChairContainer) selectChairContainer.style.display = 'none';
            if (chairMainContainer)  chairMainContainer.style.display  = 'none';
            if (chairExtraContainer) chairExtraContainer.style.display = 'none';
            if (labelBoldContainer) labelBoldContainer.style.display = 'none';
            if (inputLabelContainer) inputLabelContainer.style.display = 'none';
            if (styleSelectContainer) styleSelectContainer.style.display = 'block';
            break;

        case "Room":
        case "Door":
        case "Window":
            if (inputLocationContainer) inputLocationContainer.style.display = "none";
            if (sensorTypeContainer) sensorTypeContainer.style.display = 'none';
            if (inputSizeContainer) inputSizeContainer.style.display = 'none';
            if (inputRadiusContainer) inputRadiusContainer.style.display = 'none';
            if (inputWidthContainer) inputWidthContainer.style.display = 'block';
            if (inputHeightContainer) inputHeightContainer.style.display = 'block';
            if (inputRotationContainer) inputRotationContainer.style.display = 'block';
            if (selectChairContainer) selectChairContainer.style.display = 'none';
            if (chairMainContainer)  chairMainContainer.style.display  = 'none';
            if (chairExtraContainer) chairExtraContainer.style.display = 'none';
            if (labelBoldContainer) labelBoldContainer.style.display = 'none';
            if (inputLabelContainer) inputLabelContainer.style.display = 'none';
            if (styleSelectContainer) styleSelectContainer.style.display = 'block';
            break;

        case "Circle":
            if (inputLocationContainer) inputLocationContainer.style.display = "none";
            if (sensorTypeContainer) sensorTypeContainer.style.display = 'none';
            if (inputSizeContainer) inputSizeContainer.style.display = 'none';
            if (inputRadiusContainer) inputRadiusContainer.style.display = 'block';
            if (inputWidthContainer) inputWidthContainer.style.display = 'none';
            if (inputHeightContainer) inputHeightContainer.style.display = 'none';
            if (inputRotationContainer) inputRotationContainer.style.display = 'none';
            if (selectChairContainer) selectChairContainer.style.display = 'none';
            if (chairMainContainer)  chairMainContainer.style.display  = 'none';
            if (chairExtraContainer) chairExtraContainer.style.display = 'none';
            if (labelBoldContainer) labelBoldContainer.style.display = 'none';
            if (inputLabelContainer) inputLabelContainer.style.display = 'none';
            if (styleSelectContainer) styleSelectContainer.style.display = 'block';
            break;

        case "Label":
            if (inputLocationContainer) inputLocationContainer.style.display = "none";
            if (sensorTypeContainer) sensorTypeContainer.style.display = 'none';
            if (inputSizeContainer) inputSizeContainer.style.display = 'block';
            if (inputRadiusContainer) inputRadiusContainer.style.display = 'none';
            if (inputWidthContainer) inputWidthContainer.style.display = 'none';
            if (inputHeightContainer) inputHeightContainer.style.display = 'none';
            if (inputRotationContainer) inputRotationContainer.style.display = 'block';
            if (selectChairContainer) selectChairContainer.style.display = 'none';
            if (chairMainContainer)  chairMainContainer.style.display  = 'none';
            if (chairExtraContainer) chairExtraContainer.style.display = 'none';
            if (labelBoldContainer) labelBoldContainer.style.display = 'flex';
            if (inputLabelContainer) inputLabelContainer.style.display = 'block';
            if (styleSelectContainer) styleSelectContainer.style.display = 'block';
            break;
    }
}

// ======================================================
// ================== MODE AJOUT / ÉDITION ==============
// ======================================================

/**
 * mode = 'add'  : nouveau élément — ID saisissable, bouton Save grisé
 * mode = 'edit' : élément sélectionné — ID readonly, bouton Save actif
 *
 * Appelé par :
 *  - initializeInputs()          → mode 'add'
 *  - window.setFormMode(id)      → mode 'edit' (depuis building3D / managers)
 */
function setFormMode(mode, elementId = '') {
    const idInput   = document.getElementById('input_id');
    const modifyBtn = document.getElementById('btn-modify-plan');
    const saveBtn   = document.getElementById('btn-save-plan');

    if (mode === 'edit') {
        // ID éditable (la modification n'est appliquée qu'au SVG, pas en BDD)
        _editingOriginalId = elementId;
        if (idInput) {
            idInput.value    = elementId;
            idInput.readOnly = false;
            idInput.style.background = '';
            idInput.style.color      = '';
            idInput.style.cursor     = '';
            idInput.title            = '⚠ Modifying the ID updates the SVG only (not saved to DB).';
        }
        // Ne pas écraser les boutons si toggleEditMode est déjà actif
        if (!isEditMode) {
            if (modifyBtn) modifyBtn.style.display = 'inline-block';
            if (saveBtn)   saveBtn.style.display   = 'none';
        }
    } else {
        // mode 'add' — ID libre, bouton Save grisé
        _editingOriginalId = '';
        const element = document.getElementById("filter-element")?.value || 'Element';
        if (idInput) {
            idInput.value    = `${element}_${Date.now()}`;
            idInput.readOnly = false;
            idInput.style.background  = '';
            idInput.style.color       = '';
            idInput.style.cursor      = '';
            idInput.title             = '';
        }
        // Modify visible, Save caché
        if (modifyBtn) modifyBtn.style.display = 'inline-block';
        if (saveBtn)   saveBtn.style.display   = 'none';
        isEditMode = false;
    }
}

function initializeInputs() {
    const element = document.getElementById("filter-element").value;
    const sensorType = document.getElementById("filter-sensor-type").value;

    const sizeInput     = document.getElementById("input_size");
    const widthInput    = document.getElementById("input_width");
    const heightInput   = document.getElementById("input_height");
    const radiusInput   = document.getElementById("input_radius");
    const rotationInput = document.getElementById("input_rotation");
    const labelInput    = document.getElementById("input_label");
    const chairTop      = document.getElementById("chair_top");
    const chairBottom   = document.getElementById("chair_bottom");
    const chairLeft     = document.getElementById("chair_left");
    const chairRight    = document.getElementById("chair_right");
    const styleSelect   = document.getElementById("filter-style");
    const select        = document.getElementById("select_location");
    const wrapper       = document.getElementById("new-location-input-wrapper");
    const inputNew      = document.getElementById("input_location_new");
    const hidden        = document.getElementById("input_location");

    // ✅ Passer en mode ajout : ID libre, Save grisé
    setFormMode('add');

    chairTop.value    = 0;
    chairBottom.value = 0;
    chairLeft.value = 0;
    chairRight.value = 0;
    styleSelect.value = "Dark";
    if (select) select.value = "";
    if (wrapper) wrapper.style.display = "none";
    if (inputNew) inputNew.value = "";
    if (hidden) hidden.value = "";

    // --- Selon le type d'élément ---
    switch (element) {
        case "Sensor":
            if (sensorType === "DESK") {
                widthInput.value = 40;
                heightInput.value = 40;
                rotationInput.value = 0;
                sizeInput.value = "";
                labelInput.value = "Desk Sensor";
            } else {
                sizeInput.value = 20;
                widthInput.value = "";
                heightInput.value = "";
                rotationInput.value = 0;
            }
            break;
        case "Wall":
            sizeInput.value = 120;
            widthInput.value = 5;
            heightInput.value = "";
            radiusInput.value = "";
            rotationInput.value = 0;
            labelInput.value = "";
            break;
        case "Room":
            widthInput.value = 80;
            heightInput.value = 80;
            sizeInput.value = "";
            radiusInput.value = "";
            rotationInput.value = 0;
            labelInput.value = "";
            break;
        case "Door":
            widthInput.value = 10;
            heightInput.value = 5;
            sizeInput.value = "";
            radiusInput.value = "";
            rotationInput.value = 0;
            labelInput.value = "";
            break;
        case "Window":
            widthInput.value = 10;
            heightInput.value = 2;
            sizeInput.value = "";
            radiusInput.value = "";
            rotationInput.value = 0;
            labelInput.value = "";
            break;
        case "Circle":
            radiusInput.value = 40;
            sizeInput.value = "";
            widthInput.value = "";
            heightInput.value = "";
            rotationInput.value = 0;
            labelInput.value = "";
            break;
        case "Label":
            sizeInput.value = 40;
            widthInput.value = "";
            heightInput.value = "";
            rotationInput.value = 0;
            labelInput.value = "New Label";
            break;
    }
}

function onChangeSensor() {
    const sensorTypeSelect = document.getElementById('filter-sensor-type');

    const inputWidthEl = document.getElementById('input_width');
    const inputWidthContainer = inputWidthEl.parentElement;

    const inputHeightEl = document.getElementById('input_height');
    const inputHeightContainer = inputHeightEl.parentElement;

    const inputRotationEl = document.getElementById('input_rotation');
    const inputRotationContainer = inputRotationEl.parentElement;

    const inputLabelEl = document.getElementById('input_label');
    const inputLabelContainer = inputLabelEl.parentElement;

    const selectChairPosition = document.getElementById('chair_top');
    const selectChairContainer = selectChairPosition.parentElement;

    if (sensorTypeSelect.value === "DESK") {
        if (inputWidthContainer) inputWidthContainer.style.display = 'block';
        if (inputHeightContainer) inputHeightContainer.style.display = 'block';
        if (inputRotationContainer) inputRotationContainer.style.display = 'block';
        if (selectChairContainer) selectChairContainer.style.display = 'block';
        if (inputLabelContainer) inputLabelContainer.style.display = 'block';
    } else {
        if (inputWidthContainer) inputWidthContainer.style.display = 'none';
        if (inputHeightContainer) inputHeightContainer.style.display = 'none';
        if (inputRotationContainer) inputRotationContainer.style.display = 'none';
        if (selectChairContainer) selectChairContainer.style.display = 'none';
        if (inputLabelContainer) inputLabelContainer.style.display = 'none';
    }
    this.initializeInputs();
}

function onChangeElement() {
    this.populateFloorSelect();
    this.initializeInputs();
    this.toggleFormFields();

    const floorSelect = document.getElementById('filter-floor');
    const sensorTypeSelect = document.getElementById('filter-sensor-type');
    if (window.building3D) {
        const floorNumber = parseInt(floorSelect.value, 10);
        window.building3D.currentFloorNumber = floorNumber;
        window.building3D.setSensorMode(sensorTypeSelect.value);
    }
}

async function populateBuildingSelect() {
    const select = document.getElementById('filter-building');
    if (!select) return;

    try {
        const resp = await fetch('/api/buildings');
        let buildings = resp.ok ? await resp.json() : [];
        // Remplissage du select
        select.innerHTML = '';

        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = 'New Building';
        select.appendChild(noneOption);

        buildings.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            select.appendChild(opt);
        });

    } catch (e) {
        console.error('Error loading buildings', e);
    }
}

async function initBuildingConfig() {
    const selectBuilding = document.getElementById('filter-building');
    const nameEl   = document.getElementById("building-name");
    const floorsEl = document.getElementById("building-floors");
    const scaleEl  = document.getElementById("building-scale");
    const svgInput = document.getElementById("building-svg");

    const buildingId = selectBuilding.value;

    if (!isNaN(buildingId) && buildingId !== null && buildingId !== "") {
        try {
            const resp = await fetch(`/api/buildings/${buildingId}`);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const b = await resp.json();
            nameEl.value   = b.name || "";
            floorsEl.value = b.floorsCount || 1;
            scaleEl.value  = b.scale || 0.01;
            defaultSVGFile = b.svgPlan || "";
            window._pendingExcludedFloors = b.excludedFloors || [];
        } catch (e) {
            console.error("Erreur lors du chargement du bâtiment :", e);
        }
    } else {
        nameEl.value   = "";
        floorsEl.value = 1;
        scaleEl.value  = 0.01;
        defaultSVGFile = "";
        window._pendingExcludedFloors = [];
    }
    svgInput.value = "";
    this.refresh3DConfig();
}

function refresh3DConfig(){
    const selectBuilding = document.getElementById("filter-building");
    const floorsEl = document.getElementById("building-floors");
    const scaleEl  = document.getElementById("building-scale");

    const buildingId = selectBuilding.value || "tempKeyConfig";
    const previouslyExcluded = (window._pendingExcludedFloors !== undefined)
        ? window._pendingExcludedFloors.map(String)
        : getExcludedFloors();

    window.building3D.buildingKey = buildingId;
    window.building3D.dbShapeCache = null;
    window.building3D.dbBuildingConfig = {floors: floorsEl.value, scale: scaleEl.value, excludedFloors: previouslyExcluded, svgUrl: defaultSVGFile};
    window.building3D.config = {id: buildingId, floors: floorsEl.value, excludedFloors: previouslyExcluded, scale: scaleEl.value};

    this.populateFloorSelect();

    // On révoque le blob s'il existe lorsque l'on modifie le paramétrage 3D
    if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = "";
    }
}

function applyFormUpdate() {
    const svgInput = document.getElementById("building-svg");

    // refresh3DConfig nettoie l'ancien blob et remet la config depuis le formulaire.
    this.refresh3DConfig();

    // Créer le blob après le refresh, sinon l'URL est révoquée avant d'être utilisée.
    if (svgInput?.files?.length) {
        const file = svgInput.files[0];
        if (file && file.size > 0) {
            blobUrl = URL.createObjectURL(file);
            window.building3D.dbBuildingConfig.svgUrl = blobUrl;
        }
    }

    window.building3D.dbShapeCache = null;
    window.building3D.setBuilding();
}

async function deleteBuildingConfig() {
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');

    if (!csrfMeta || !csrfHeaderMeta) {
        if (typeof cfgToast === 'function') cfgToast("CSRF token not found. Please refresh the page.", 'error'); else alert("CSRF token not found. Please refresh the page.");
        return;
    }

    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    const selectBuilding = document.getElementById('filter-building');
    const buildingId = selectBuilding.value;
    if (!isNaN(buildingId) && buildingId !== null && buildingId !== "") {

        try {
            const response = await fetch("/api/buildings/" + buildingId, {
                method: "DELETE",
                headers: {
                    [csrfHeader]: csrfToken
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            } else {
                console.log("Building deleted:" + buildingId);
                if (typeof cfgToast === 'function') cfgToast('Building deleted successfully', 'success'); else alert('Building deleted successfully');
            }

        } catch (error) {
            console.error("Error deleting building:", error);
            if (typeof cfgToast === 'function') cfgToast('Failed to delete building: ' + error.message, 'error'); else alert('Failed to delete building: ' + error.message);
        }

        populateBuildingSelect();

        const nameEl   = document.getElementById("building-name");
        const floorsEl = document.getElementById("building-floors");
        const scaleEl  = document.getElementById("building-scale");

        // Set default values after deletion
        selectBuilding.value = "";
        nameEl.value   = "";
        floorsEl.value = 3;
        scaleEl.value  = 0.01;
        defaultSVGFile = "";
        window._pendingExcludedFloors = [];

        this.refresh3DConfig();
        window.building3D.setBuilding();
    } else {
        if (typeof cfgToast === 'function') cfgToast('Please select a building to delete.', 'warning'); else alert('Please select a building to delete.');
    }
}

async function saveBuildingConfig() {
    const selectBuilding = document.getElementById('filter-building');
    const nameEl   = document.getElementById("building-name");
    const floorsEl = document.getElementById("building-floors");
    const scaleEl  = document.getElementById("building-scale");
    const svgInput = document.getElementById("building-svg");

    const name    = (nameEl.value || "").trim();
    const floors  = parseInt(floorsEl.value, 10) || 1;
    const scale   = parseFloat(scaleEl.value) || 0.01;
    svgFile = svgInput.files[0];

    const excludedFloors = Array.from(
        document.querySelectorAll('#floor-checkbox-list input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value, 10));

    if (!name) {
        if (typeof cfgToast === 'function') cfgToast('Please enter a building name.', 'warning'); else alert('Please enter a building name.');
        return false;
    }

    if (!svgFile) {
        // Si création de bâtiment, le SVG est obligatoire
        if (!isNaN(selectBuilding.value) && selectBuilding.value !== null && selectBuilding.value !== "") {
            svgFile = new File([], "");
        } else {
            if (typeof cfgToast === 'function') cfgToast('Please select an SVG file.', 'warning'); else alert('Please select an SVG file.');
            return false;
        }
    }

    // Récupérer le CSRF sur /api/buildings/csrf-token
    let csrf;
    try {
        const csrfResp = await fetch("/api/buildings/csrf-token", {
            credentials: "same-origin"
        });
        if (!csrfResp.ok) {
            throw new Error("HTTP " + csrfResp.status);
        }
        csrf = await csrfResp.json();
        console.log("CSRF token:", csrf);
    } catch (e) {
        console.error("Erreur CSRF:", e);
        if (typeof cfgToast === 'function') cfgToast('Could not retrieve CSRF token', 'error'); else alert('Could not retrieve CSRF token');
        return false;
    }

    // Exporter le SVG depuis la mémoire uniquement si ce n'est pas une création avec fichier fourni
    const isNewBuilding = !(selectBuilding.value && !isNaN(selectBuilding.value) && selectBuilding.value !== "");
    const archPlan = window.building3D?.currentArchPlan;
    if (!isNewBuilding && archPlan && typeof archPlan.exportSVG === 'function') {
        const fileName = (svgFile && svgFile.name) || (defaultSVGFile && defaultSVGFile.split('/').pop()) || name + '.svg';
        const svgContent = archPlan.exportSVG();
        if (!svgContent) {
            if (typeof cfgToast === 'function') cfgToast('Failed to extract SVG content.', 'error'); else alert('Failed to extract SVG content.');
            return false;
        }
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        svgFile = new File([blob], fileName, { type: "image/svg+xml" });
    }

    // Construire le FormData
    const formData = new FormData();
    formData.append("name", name);
    formData.append("floors", floors);
    formData.append("scale", scale);
    formData.append("svgFile", svgFile);
    formData.append(csrf.parameterName, csrf.token);
    excludedFloors.forEach(f => formData.append("excludedFloors", f));

    // Si aucun bâtiment sélectionné, on appelle la méthode createBuildingConfig sinon updateBuildingConfig
    if (!isNaN(selectBuilding.value) && selectBuilding.value !== null && selectBuilding.value !== "") {
        return updateBuildingConfig(formData);
    } else {
        return createBuildingConfig(formData);
    }
}

async function createBuildingConfig(formData) {
    const selectBuilding = document.getElementById('filter-building');

    try {
        const resp = await fetch("/api/buildings", {
            method: "POST",
            body: formData,
            credentials: "same-origin"
        });
        if (!resp.ok) throw new Error("HTTP error " + resp.status);

        const data = await resp.json();
        console.log("Building created:", data);

        await populateBuildingSelect();

        // ✅ Utiliser l'ID de la réponse, sinon fallback sur le maxValue
        let newId = data.id;
        if (!newId || isNaN(newId)) {
            const values = Array.from(selectBuilding.options)
                .map(opt => parseFloat(opt.value))
                .filter(v => !Number.isNaN(v));
            newId = Math.max(...values);
        }

        if (!newId || isNaN(newId)) {
            if (typeof cfgToast === 'function') cfgToast('Building created but could not determine its ID.', 'error');
            return false;
        }

        selectBuilding.value = String(newId);

        if (typeof cfgToast === 'function') cfgToast('Building created successfully (id=' + newId + ')', 'success');
        else alert('Building created successfully');

        // ✅ Charger la config depuis le serveur (récupère le svgPlan)
        await initBuildingConfig();

        // ✅ Forcer le rechargement du SVG depuis le serveur
        window.building3D.dbShapeCache = null;
        console.log("[createBuildingConfig] svgUrl:", window.building3D.dbBuildingConfig?.svgUrl);

        window.building3D.setBuilding();
        return true;

    } catch (err) {
        console.error(err);
        if (typeof cfgToast === 'function') cfgToast('Error creating building.', 'error'); else alert('Error creating building.');
        return false;
    }
}

async function updateBuildingConfig(formData) {
    const selectBuilding = document.getElementById('filter-building');
    const buildingId = selectBuilding.value;

    try {
        const resp = await fetch("/api/buildings/" + buildingId, {
            method: "POST",
            body: formData,
            credentials: "same-origin"
        });
        if (!resp.ok) throw new Error("HTTP error " + resp.status);

        const data = await resp.json();
        console.log("Building updated:", data);
        if (typeof cfgToast === 'function') cfgToast('Building updated successfully', 'success');
        else alert('Building updated successfully');

        if (data?.svgPlan) {
            defaultSVGFile = data.svgPlan;
        }
        if (data?.floorsCount != null) {
            document.getElementById("building-floors").value = data.floorsCount;
        }
        if (data?.scale != null) {
            document.getElementById("building-scale").value = data.scale;
        }
        window._pendingExcludedFloors = data?.excludedFloors || getExcludedFloors();
        refresh3DConfig();
        window.building3D.dbShapeCache = null;
        // Invalider le cache SVG pour forcer la relecture depuis le serveur
        if (window.building3D?.currentArchPlan) {
            window.building3D.currentArchPlan._svgDocCache = null;
            window.building3D.currentArchPlan._svgCacheKey = null;
        }
        window.building3D.setBuilding();

        return true;

    } catch (err) {
        console.error(err);
        if (typeof cfgToast === 'function') cfgToast('Error updating building.', 'error'); else alert('Error updating building.');
        return false;
    }
}

// ======================================================
// =====================  LOCATION  =====================
// ======================================================

/**
 * Alimente le select location avec toutes les locations du building sélectionné,
 * en filtrant depuis window.LOCATIONS (injecté par Thymeleaf).
 * @param {string|number} buildingId
 * @param {*} _floor - ignoré (conservé pour compatibilité des call sites)
 * @param {number|null} currentLocationId - valeur à pré-sélectionner
 */
function loadLocationOptions(buildingId, _floor, currentLocationId = null) {
    const select = document.getElementById("select_location");
    if (!select) return;

    select.innerHTML = `<option value="">None</option>`;

    const allLocations = Array.isArray(window.LOCATIONS) ? window.LOCATIONS : [];
    const filtered = buildingId
        ? allLocations.filter(l => String(l.buildingId) === String(buildingId))
        : [];

    filtered.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc.id;
        opt.textContent = loc.name;
        select.appendChild(opt);
    });

    if (currentLocationId) {
        select.value = String(currentLocationId);
    }
}

/**
 * Appelé au changement du select location.
 * Affiche/masque le champ libre selon la sélection.
 */
function onLocationChange() {
    // La sauvegarde se fait via le bouton Save — rien à faire ici.
    // Conservé pour compatibilité avec les autres appels éventuels.
}

/**
 * Retourne le locationId sélectionné (integer ou null).
 */
function getLocationValue() {
    const select = document.getElementById("select_location");
    return select?.value ? parseInt(select.value) : null;
}

/**
 * Sauvegarde le locationId d'un capteur via l'API REST
 * @param {string} sensorId - ID du capteur
 * @param {number} locationId - ID de la location
 * @returns {Promise<boolean>}
 */
async function saveSensorLocation(sensorId, locationId) {
    if (!sensorId) return false;

    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    if (!csrfMeta || !csrfHeaderMeta) {
        console.warn("[Location] CSRF token not found");
        return false;
    }

    const payload = locationId ? { locationId: locationId } : { locationId: null };
    console.log(`[Location] POST /api/sensors/${sensorId}/location`, payload);

    try {
        const response = await fetch(`/api/sensors/${encodeURIComponent(sensorId)}/location`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeaderMeta.getAttribute("content")]: csrfMeta.getAttribute("content")
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error(`[Location] Failed for ${sensorId}:`, response.status, err);
            if (typeof cfgToast === 'function') cfgToast('Erreur sauvegarde Location: ' + (err.message || response.status), 'error');
            return false;
        }

        console.info(`[Location] OK locationId=${locationId} for ${sensorId}`);
        return true;

    } catch (e) {
        console.error(`[Location] Network error for ${sensorId}:`, e);
        return false;
    }
}

function syncHiddenLocationField(value) {
    const hidden = document.getElementById("input_location");
    if (hidden) hidden.value = value || "";
}

// ======================================================
// =====================  SVG ELEMENTS  =================
// ======================================================

async function addElementSVG() {
    // ✅ Vérification que le plan est bien initialisé
    if (!window.building3D || !window.building3D.currentArchPlan) {
        if (typeof cfgToast === 'function') cfgToast('Please select and load a building first.', 'warning');
        else alert('Please select and load a building first.');
        return;
    }

    const sensorType  = document.getElementById("filter-sensor-type");
    const floorNumber = document.getElementById("filter-floor");
    const elementSelect = document.getElementById('filter-element');
    const inputIdEl  = document.getElementById("input_id");
    const inputSizeEl = document.getElementById("input_size");
    const inputWidthEl = document.getElementById('input_width');
    const inputHeightEl = document.getElementById('input_height');
    const inputRotationEl = document.getElementById('input_rotation');
    const inputRadiusEl = document.getElementById('input_radius');
    const inputLabelEl = document.getElementById('input_label');
    const inputStyleEl = document.getElementById('filter-style');
    const locationId = getLocationValue();

    if (!inputIdEl || inputIdEl.value.trim() === '') {
        if (typeof cfgToast === 'function') cfgToast('Please enter an ID.', 'warning'); else alert('Please enter an ID.');
        return;
    }

    const id = CSS.escape(inputIdEl.value);
    const elementWithID = Array.from(window.building3D.currentArchPlan.svg.querySelectorAll('#'+id));
    if (elementWithID.length) {
        if (typeof cfgToast === 'function') cfgToast('An element with this ID already exists.', 'warning'); else alert('An element with this ID already exists.');
        return;
    }

    // Récupère le centre du plan (dans le bon repère)
    const { x: centerX, y: centerY } = getPlanCenterXY();

    if (elementSelect.value === "Sensor"){
        if (sensorType.value === "DESK") {
            if (!inputWidthEl || inputWidthEl.value.trim() === '') {
                if (typeof cfgToast === 'function') cfgToast('Please fill the width input', 'warning'); else alert('Please fill the width input');
                return;
            }
            if (!inputHeightEl || inputHeightEl.value.trim() === '') {
                if (typeof cfgToast === 'function') cfgToast('Please fill the height input', 'warning'); else alert('Please fill the height input');
                return;
            }
        } else {
            if (!inputSizeEl || inputSizeEl.value.trim() === '') {
                if (typeof cfgToast === 'function') cfgToast('Please fill the size input', 'warning'); else alert('Please fill the size input');
                return;
            }
        }
        const sensor = {
            id : inputIdEl.value,
            type : sensorType.value,
            floor : floorNumber.value,
            x : centerX,
            y : centerY,
            size : parseInt(inputSizeEl.value),
            width : parseInt(inputWidthEl.value),
            height : parseInt(inputHeightEl.value),
            rotation : parseInt(inputRotationEl.value),
            label : inputLabelEl.value,
            locationId: locationId,
            chairs : {
                top: parseInt(document.getElementById("chair_top").value || 0),
                bottom: parseInt(document.getElementById("chair_bottom").value || 0),
                left: parseInt(document.getElementById("chair_left").value || 0),
                right: parseInt(document.getElementById("chair_right").value || 0),
            },
            chairRadius : parseFloat(document.getElementById("input_chair_radius")?.value) || 5,
        };
        window.building3D.currentArchPlan.overlayManager.drawSensor(sensor);
        if (locationId) await saveSensorLocation(sensor.id, locationId);
    } else {
        switch (elementSelect.value){
            case "Wall":
                if (!inputSizeEl || inputSizeEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the size input', 'warning'); else alert('Please fill the size input');
                    return;
                }
                break;
            case "Room":
                if (!inputWidthEl || inputWidthEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the width input', 'warning'); else alert('Please fill the width input');
                    return;
                }
                if (!inputHeightEl || inputHeightEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the height input', 'warning'); else alert('Please fill the height input');
                    return;
                }
                break;
            case "Door":
                if (!inputWidthEl || inputWidthEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the width input', 'warning'); else alert('Please fill the width input');
                    return;
                }
                if (!inputHeightEl || inputHeightEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the height input', 'warning'); else alert('Please fill the height input');
                    return;
                }
                break;
            case "Window":
                if (!inputWidthEl || inputWidthEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the width input', 'warning'); else alert('Please fill the width input');
                    return;
                }
                if (!inputHeightEl || inputHeightEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the height input', 'warning'); else alert('Please fill the height input');
                    return;
                }
                break;
            case "Circle":
                if (!inputRadiusEl || inputRadiusEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the radius input', 'warning'); else alert('Please fill the radius input');
                    return;
                }
                break;
            case "Label":
                if (!inputLabelEl || inputLabelEl.value.trim() === '') {
                    if (typeof cfgToast === 'function') cfgToast('Please fill the label input', 'warning'); else alert('Please fill the label input');
                    return;
                }
                break;
        }
        const element = {
            id : inputIdEl.value,
            type : elementSelect.value,
            floor : floorNumber.value,
            x : centerX,
            y : centerY,
            size : parseInt(inputSizeEl.value),
            width : parseInt(inputWidthEl.value),
            height : parseInt(inputHeightEl.value),
            radius : parseInt(inputRadiusEl.value),
            rotation : parseInt(inputRotationEl.value),
            label : inputLabelEl.value,
            bold  : document.getElementById('input_label_bold')?.checked ?? false,
            style : inputStyleEl ? inputStyleEl.value : "Dark"
        };
        window.building3D.currentArchPlan.elementsManager.addElement(element);
    }

    // ✅ Sauvegarder le SVG en BDD pour persister l'ajout
    const saveResult = await saveBuildingConfig();
    if (saveResult !== false) {
        if (typeof cfgToast === 'function') cfgToast('Element added and saved!', 'success');
    }
}

function removeElementSVG() {
    const elementId     = document.getElementById("input_id");
    const elementSelect = document.getElementById('filter-element');

    if (!elementId || elementId.value.trim() === '') {
        if (typeof cfgToast === 'function') cfgToast('Please enter an ID.', 'warning'); else alert('Please enter an ID.');
        return;
    }
    if (window.building3D && window.building3D.currentArchPlan) {
        const id = CSS.escape(elementId.value);
        const elementWithID = Array.from(window.building3D.currentArchPlan.svg.querySelectorAll('#'+id));
        if (!elementWithID.length) {
            if (typeof cfgToast === 'function') cfgToast('No element with this ID exists.', 'warning'); else alert('No element with this ID exists.');
            return;
        }
    }
    if (elementSelect.value === "Sensor"){
        window.building3D.currentArchPlan.overlayManager.removeSensorMarkerById(elementId.value);
    } else {
        window.building3D.currentArchPlan.elementsManager.removeElement(elementId.value);
    }

    // ✅ Repasser en mode ajout après suppression
    setFormMode('add');
}

function updateElementSVG() {
    const sensorTypeSelect  = document.getElementById('filter-sensor-type');
    const floorNumberSelect = document.getElementById("filter-floor");
    const elementSelect     = document.getElementById('filter-element');
    const inputIdEl         = document.getElementById('input_id');

    // L'ID courant dans le formulaire (peut avoir été modifié par l'utilisateur)
    const newElementId = (inputIdEl?.value || '').trim();
    if (!newElementId) {
        if (typeof cfgToast === 'function') cfgToast('Aucun élément sélectionné.', 'warning');
        return;
    }

    // ID original (celui présent dans le SVG avant édition)
    const originalId = _editingOriginalId || newElementId;

    // Si l'ID a été modifié, renommer les éléments dans le SVG (sans persistance BDD)
    if (newElementId !== originalId && window.building3D?.currentArchPlan?.svg) {
        const svg = window.building3D.currentArchPlan.svg;

        // Renommer le groupe principal (id="originalId")
        const mainEl = svg.querySelector('#' + CSS.escape(originalId));
        if (mainEl) {
            mainEl.id = newElementId;
        }

        // Renommer le marker desk : son ID est exactement "marker-" + originalId
        // ex: originalId="desk-01-01" → markerEl id="marker-desk-01-01"
        const expectedMarkerId = 'marker-' + originalId;
        const markerEl = svg.querySelector('#' + CSS.escape(expectedMarkerId));
        if (markerEl) {
            markerEl.id = 'marker-' + newElementId;
        }

        // Renommer tous les éléments qui portent un attribut data-id="originalId"
        svg.querySelectorAll('[data-id="' + originalId + '"]').forEach(el => {
            el.setAttribute('data-id', newElementId);
        });

        // Mettre à jour l'ID de référence dans _editingOriginalId pour la suite
        _editingOriginalId = newElementId;
    }

    // Utiliser le nouvel ID pour la mise à jour de la géométrie
    const elementId = newElementId;

    const v = id => { const n = parseInt(document.getElementById(id)?.value); return isNaN(n) ? NaN : n; };
    const rotation = (() => {
        const el = document.getElementById('input_rotation');
        return (el && el.value.trim()) ? parseInt(el.value, 10) : 0;
    })();

    if (elementSelect.value === "Sensor") {
        window.building3D.currentArchPlan.overlayManager.updateSensorGeometry({
            id         : elementId,
            type       : sensorTypeSelect.value,
            floor      : floorNumberSelect.value,
            size       : v('input_size'),
            width      : v('input_width'),
            height     : v('input_height'),
            rotation   : rotation,
            label      : document.getElementById('input_label')?.value ?? '',
            chairs: {
                top:    v('chair_top')    || 0,
                bottom: v('chair_bottom') || 0,
                left:   v('chair_left')   || 0,
                right:  v('chair_right')  || 0,
            },
            chairRadius : parseFloat(document.getElementById("input_chair_radius")?.value) || 5,
        });
    } else {
        window.building3D.currentArchPlan.elementsManager.updateElement({
            id     : elementId,
            type   : elementSelect.value,
            floor  : floorNumberSelect.value,
            size   : v('input_size'),
            width  : v('input_width'),
            height : v('input_height'),
            radius : v('input_radius'),
            rotation,
            label  : document.getElementById('input_label')?.value ?? '',
            bold   : document.getElementById('input_label_bold')?.checked ?? false,
            style  : document.getElementById('filter-style')?.value || 'Dark'
        });
    }
}

function getPlanCenterXY() {
    const arch = window.building3D?.currentArchPlan;
    if (!arch || !arch.svg) {
        return { x: 600, y: 600 };
    }

    const svg = arch.svg;
    const root = svg.querySelector('#content-root') || svg;

    try {
        const rect = svg.getBoundingClientRect();
        const pt = svg.createSVGPoint();
        pt.x = rect.left + rect.width / 2;
        pt.y = rect.top + rect.height / 2;

        const ctm = root.getScreenCTM();
        if (ctm) {
            const p = pt.matrixTransform(ctm.inverse());
            return { x: Math.round(p.x), y: Math.round(p.y) };
        }
    } catch (e) {
        // no-op: on tombera sur le fallback viewBox ci-dessous
    }

    // Fallback: centre du viewBox si disponible
    const vb = svg.viewBox?.baseVal;
    if (vb) {
        return {
            x: Math.round(vb.x + vb.width / 2),
            y: Math.round(vb.y + vb.height / 2)
        };
    }
    return { x: 600, y: 600 };
}

// ======================================================
// ================== MODE ÉDITION ÉLÉMENT ==============
// ======================================================

let isEditMode = false;
let _editingOriginalId = ''; // ID original de l'élément en cours d'édition (avant renommage)

/**
 * Le bouton "Modify Element" active l'édition.
 * Le bouton "Save Element" applique le formulaire au SVG + sauvegarde en BDD.
 * Si la sauvegarde réussit, le formulaire repasse en lecture seule (grisé).
 */
function toggleEditMode() {
    const modifyBtn = document.getElementById('btn-modify-plan');
    const saveBtn   = document.getElementById('btn-save-plan');
    const container = document.getElementById('floor-plan-2d');

    if (!isEditMode) {
        // Activer le mode édition
        isEditMode = true;
        container.classList.remove('plan-readonly');
        container.classList.add('plan-edit');
        if (modifyBtn) modifyBtn.style.display = 'none';
        if (saveBtn)   saveBtn.style.display   = 'inline-block';
    } else {
        // Sauvegarder
        if (saveBtn) {
            saveBtn.disabled  = true;
            saveBtn.innerText = '⏳ Saving...';
        }
        _doSaveElement().finally(() => {
            if (saveBtn) {
                saveBtn.disabled  = false;
                saveBtn.innerText = 'Save Element';
            }
        });
    }
}

async function _doSaveElement() {
    const modifyBtn = document.getElementById('btn-modify-plan');
    const saveBtn   = document.getElementById('btn-save-plan');
    const container = document.getElementById('floor-plan-2d');
    try {
        // ⚠ Capturer l'ID BDD AVANT updateElementSVG() qui met à jour _editingOriginalId
        const dbSensorId = (_editingOriginalId || document.getElementById('input_id')?.value)?.trim();

        updateElementSVG();

        // Sauvegarder la Location en BDD si c'est un Sensor
        const elementSelect = document.getElementById('filter-element');
        if (elementSelect?.value === "Sensor") {
            const sensorId = dbSensorId;
            const locationSelect = document.getElementById('select_location');
            const locationId = locationSelect?.value ? parseInt(locationSelect.value) : null;
            if (sensorId) {
                console.log(`[Location] Saving sensorId=${sensorId} locationId=${locationId}`);
                const locResult = await saveSensorLocation(sensorId, locationId);
                console.log(`[Location] Result:`, locResult);
            }
        }

        // Enregistrer le SVG en BDD
        const result = await saveBuildingConfig();

        if (result === false) {
            // Erreur de validation — rester en mode édition
            if (saveBtn) saveBtn.innerText = 'Save Element';
            return;
        }

        // Succès — repasser en lecture seule
        isEditMode = false;
        container.classList.remove('plan-edit');
        container.classList.add('plan-readonly');
        if (modifyBtn) modifyBtn.style.display = 'inline-block';
        if (saveBtn)   saveBtn.style.display   = 'none';
        if (saveBtn)   saveBtn.innerText        = 'Save Element';
        if (typeof cfgToast === 'function') cfgToast('Élément sauvegardé !', 'success');

        // Repasser en mode ajout après sauvegarde réussie
        setFormMode('add');

    } catch (e) {
        console.error("_doSaveElement error:", e);
        if (typeof cfgToast === 'function') cfgToast('Erreur lors de la sauvegarde.', 'error');
        if (saveBtn) saveBtn.innerText = 'Save Element';
    }
}

// ======================================================
// ================== ALERT CONFIG SAVE ==================
// ======================================================

async function saveAlertConfig() {
    // 1. Get CSRF Token
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');

    if (!csrfMeta || !csrfHeaderMeta) {
        if (typeof cfgToast === 'function') cfgToast("CSRF token not found. Please refresh the page.", 'error'); else alert("CSRF token not found. Please refresh the page.");
        return;
    }

    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    // 2. Gather Data
    const payload = {
        dataMaxAgeMinutes: parseInt(document.getElementById("alert-data-age").value),
        co2: {
            critical: parseFloat(document.getElementById("alert-co2-critical").value),
            warning: parseFloat(document.getElementById("alert-co2-warning").value)
        },
        temperature: {
            criticalHigh: parseFloat(document.getElementById("alert-temp-crit-high").value),
            criticalLow: parseFloat(document.getElementById("alert-temp-crit-low").value),
            warningHigh: parseFloat(document.getElementById("alert-temp-warn-high").value),
            warningLow: parseFloat(document.getElementById("alert-temp-warn-low").value)
        },
        humidity: {
            warningHigh: parseFloat(document.getElementById("alert-hum-warn-high").value),
            warningLow: parseFloat(document.getElementById("alert-hum-warn-low").value)
        },
        noise: {
            warning: parseFloat(document.getElementById("alert-noise-warning").value)
        }
    };

    // 3. Send Request
    try {
        const response = await fetch("/api/configuration/alerts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (typeof cfgToast === 'function') cfgToast('Configuration saved successfully!', 'success'); else alert('Configuration saved successfully!');
        console.log("Alert config saved:", data);

    } catch (error) {
        console.error("Error saving alert config:", error);
        if (typeof cfgToast === 'function') cfgToast('Failed to save configuration: ' + error.message, 'error'); else alert('Failed to save configuration: ' + error.message);
    }
}

// ======================================================
// ============== NOTIFICATION CHANNELS ==================
// ======================================================

async function saveNotificationChannels() {
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');

    if (!csrfMeta || !csrfHeaderMeta) {
        if (typeof cfgToast === 'function') cfgToast('CSRF token not found. Please refresh the page.', 'error'); else alert('CSRF token not found.');
        return;
    }

    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    const parameterType = document.getElementById("notif-parameter").value;
    const emailEnabled = document.getElementById("notif-email").checked;
    const smsEnabled = document.getElementById("notif-sms").checked;
    const customEmail = document.getElementById("notif-custom-email").value.trim();
    const customPhone = document.getElementById("notif-custom-phone").value.trim();

    const payload = {
        parameterType,
        emailEnabled,
        smsEnabled,
        customEmail: customEmail || null,
        customPhone: customPhone || null
    };

    try {
        const response = await fetch("/api/configuration/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (typeof cfgToast === 'function') cfgToast('Notification preferences saved!', 'success'); else alert('Notification preferences saved!');
        loadNotificationPreferences();

    } catch (error) {
        console.error("Error saving notification preferences:", error);
        if (typeof cfgToast === 'function') cfgToast('Failed to save notification preferences: ' + error.message, 'error'); else alert('Failed to save notification preferences: ' + error.message);
    }
}

async function loadNotificationPreferences() {
    try {
        const response = await fetch("/api/configuration/notifications");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const preferences = await response.json();
        const listDiv = document.getElementById("notification-prefs-list");

        if (!preferences || preferences.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">No notification preferences configured yet.</p>';
            return;
        }

        let html = '';
        preferences.forEach(pref => {
            const channels = [];
            if (pref.emailEnabled) channels.push('📧 Email');
            if (pref.smsEnabled) channels.push('📱 SMS');

            html += `
                <div class="notification-item">
                    <div class="notification-info">
                        <div class="notification-label">${pref.parameterType}</div>
                        <div class="notification-details">
                            Channels: ${channels.join(', ') || 'None'}
                            ${pref.customEmail ? '<br>Custom Email: ' + pref.customEmail : ''}
                            ${pref.customPhone ? '<br>Custom Phone: ' + pref.customPhone : ''}
                        </div>
                    </div>
                    <div class="threshold-actions">
                        <button class="btn-edit" onclick="editNotificationPreference('${pref.id}')">
                            ✏️ Edit
                        </button>
                        <button class="btn-delete" onclick="deleteNotificationPreference('${pref.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        });

        listDiv.innerHTML = html;
    } catch (error) {
        console.error("Error loading notification preferences:", error);
        document.getElementById("notification-prefs-list").innerHTML = '<p class="text-muted">Error loading preferences.</p>';
    }
}

// Update parameter units display based on selected parameter type
function updateParameterUnits() {
    const parameterType = document.getElementById("threshold-parameter").value;
    const units = { "CO2": "ppm", "Temperature": "°C", "Humidity": "%", "Noise": "dB" };
    const unit  = units[parameterType] || "";
    document.querySelectorAll("#sensor-threshold-form .input-unit").forEach(span => {
        span.textContent = unit;
    });
}

async function editNotificationPreference(prefId) {
    try {
        const response = await fetch(`/api/configuration/notifications/${prefId}`);
        if (response.ok) {
            const pref = await response.json();
            document.getElementById("notif-parameter").value = pref.parameterType;
            document.getElementById("notif-email").checked = pref.emailEnabled;
            document.getElementById("notif-sms").checked = pref.smsEnabled;
            document.getElementById("notif-custom-email").value = pref.customEmail || '';
            document.getElementById("notif-custom-phone").value = pref.customPhone || '';

            // Show/hide custom inputs based on checked status
            toggleNotifChannelInput('email');
            toggleNotifChannelInput('sms');

            // Scroll to form
            document.getElementById("notif-parameter").scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (error) {
        console.error("Error loading notification preference for edit:", error);
    }
}

// Delete notification preference
async function deleteNotificationPreference(prefId) {
    if (!confirm("Are you sure you want to delete this notification preference?")) {
        return;
    }

    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');

    if (!csrfMeta || !csrfHeaderMeta) {
        if (typeof cfgToast === 'function') cfgToast('CSRF token not found. Please refresh the page.', 'error'); else alert('CSRF token not found.');
        return;
    }

    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    try {
        const response = await fetch(`/api/configuration/notifications/${prefId}`, {
            method: "DELETE",
            headers: {
                [csrfHeader]: csrfToken
            }
        });

        if (response.ok) {
            if (typeof cfgToast === 'function') cfgToast('Notification preference deleted!', 'success'); else alert('Notification preference deleted!');
            loadNotificationPreferences();
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error("Error deleting notification preference:", error);
        if (typeof cfgToast === 'function') cfgToast('Failed to delete notification preference: ' + error.message, 'error'); else alert('Failed to delete notification preference: ' + error.message);
    }
}

// ======================================================
// ================== SENSOR THRESHOLDS ==================
// ======================================================

function loadSensors() {
    console.log("loadSensors function called"); // Debug log

    const select = document.getElementById("sensor-select");
    if (!select) {
        console.error("sensor-select element not found!");
        return;
    }

    // Use sensors data passed from server like manageSensors.html does
    const sensors = window.SENSORS || [];
    console.log("Sensors from server:", sensors); // Debug log
    console.log("Number of sensors:", sensors.length); // Debug log

    // Clear existing options first (except the default one)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    if (sensors.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No sensors found in database";
        select.appendChild(option);
        return;
    }

    sensors.forEach((sensor, index) => {
        const option = document.createElement("option");
        // Use the same property names as manageSensors.html
        const sensorId = sensor.idSensor;
        const deviceType = sensor.deviceType || 'Unknown';

        if (sensorId) {
            option.value = sensorId;
            option.textContent = `${sensorId} (${deviceType})`;
            select.appendChild(option);
        } else {
            console.warn("Sensor has no valid ID:", sensor);
        }
    });

    console.log("Final select options count:", select.children.length);
}

function loadSensorThresholds() {
    const sensorId = document.getElementById("sensor-select").value;
    const form     = document.getElementById("sensor-threshold-form");

    if (!sensorId) {
        form.style.display = "none";
        return;
    }

    form.style.display = "block";
}

async function saveSensorThreshold() {
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');

    if (!csrfMeta || !csrfHeaderMeta) {
        if (typeof cfgToast === 'function') cfgToast('CSRF token not found. Please refresh the page.', 'error'); else alert('CSRF token not found.');
        return;
    }

    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    const sensorId = document.getElementById("sensor-select").value;
    const parameterType = document.getElementById("threshold-parameter").value;
    const criticalHigh = parseFloat(document.getElementById("sensor-critical-high").value);
    const warningHigh = parseFloat(document.getElementById("sensor-warning-high").value);
    const warningLow = parseFloat(document.getElementById("sensor-warning-low").value);
    const criticalLow = parseFloat(document.getElementById("sensor-critical-low").value);

    if (!sensorId) {
        if (typeof cfgToast === 'function') cfgToast('Please select a sensor.', 'warning'); else alert('Please select a sensor.');
        return;
    }

    const payload = {
        sensorId,
        parameterType,
        criticalThreshold: criticalHigh || null,
        warningThreshold: warningHigh || null,
        warningLow: warningLow || null,
        criticalLow: criticalLow || null,
        enabled: true
    };

    try {
        const response = await fetch("/api/configuration/sensor-thresholds", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (typeof cfgToast === 'function') cfgToast('Sensor threshold saved!', 'success'); else alert('Sensor threshold saved!');

    } catch (error) {
        console.error("Error saving sensor threshold:", error);
        if (typeof cfgToast === 'function') cfgToast('Failed to save sensor threshold: ' + error.message, 'error'); else alert('Failed to save sensor threshold: ' + error.message);
    }
}

async function deleteSensorThreshold(thresholdId) {
    if (!confirm("Are you sure you want to delete this sensor threshold override?")) {
        return;
    }

    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');

    if (!csrfMeta || !csrfHeaderMeta) {
        if (typeof cfgToast === 'function') cfgToast('CSRF token not found. Please refresh the page.', 'error'); else alert('CSRF token not found.');
        return;
    }

    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    try {
        const response = await fetch(`/api/configuration/sensor-thresholds/${thresholdId}`, {
            method: "DELETE",
            headers: {
                [csrfHeader]: csrfToken
            }
        });

        if (response.ok) {
            if (typeof cfgToast === 'function') cfgToast('Sensor threshold deleted!', 'success'); else alert('Sensor threshold deleted!');
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error("Error deleting sensor threshold:", error);
        if (typeof cfgToast === 'function') cfgToast('Failed to delete sensor threshold: ' + error.message, 'error'); else alert('Failed to delete sensor threshold: ' + error.message);
    }
}

function changeEditorLanguage(selectEl) {
    if (!editor || !selectEl) return;

    const value = (selectEl.value || "").toLowerCase();
    let mode = "ace/mode/javascript";
    if (value.includes("python")) mode = "ace/mode/python";
    else if (value.includes("java")) mode = "ace/mode/java";
    editor.session.setMode(mode);
}

// ======================================================
// ============= ENERGY CONFIGURATION ====================
// ======================================================

async function loadEnergyConfigs() {
    try {
        const response = await fetch('/api/configuration/building-energy');
        if (!response.ok) throw new Error('Failed to load energy configs');
        const configs = await response.json();
        const tbody = document.getElementById('energy-config-tbody');
        if (!tbody) return;
        if (configs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No configurations yet.</td></tr>';
            return;
        }
        tbody.innerHTML = configs.map(config => `
            <tr>
                <td><strong>${config.buildingName}</strong></td>
                <td>${config.energyCostPerKwh?.toFixed(4) || '0.0000'}</td>
                <td>${config.currency || 'EUR'}</td>
                <td>${config.co2EmissionFactor?.toFixed(4) || '0.0000'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editEnergyConfig('${config.buildingName}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEnergyConfig('${config.buildingName}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading energy configs:', error);
    }
}

async function saveEnergyConfig() {
    const buildingName = document.getElementById('energy-config-building')?.value;
    const energyCostPerKwh = parseFloat(document.getElementById('energy-cost-kwh')?.value);
    const currency = document.getElementById('energy-currency')?.value || 'EUR';
    const co2EmissionFactor = parseFloat(document.getElementById('co2-emission-factor')?.value) || 0;

    if (!buildingName) { if (typeof cfgToast === 'function') cfgToast('Please select a building', 'warning'); else alert('Please select a building'); return; }
    if (isNaN(energyCostPerKwh) || energyCostPerKwh < 0) { if (typeof cfgToast === 'function') cfgToast('Please enter a valid energy cost', 'warning'); else alert('Please enter a valid energy cost'); return; }

    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    if (!csrfMeta || !csrfHeaderMeta) { if (typeof cfgToast === 'function') cfgToast('CSRF token not found.', 'error'); else alert('CSRF token not found.'); return; }

    try {
        const response = await fetch('/api/configuration/building-energy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', [csrfHeaderMeta.getAttribute("content")]: csrfMeta.getAttribute("content") },
            body: JSON.stringify({ buildingName, energyCostPerKwh, currency, co2EmissionFactor })
        });
        if (response.ok) {
            if (typeof cfgToast === 'function') cfgToast('Energy configuration saved!', 'success'); else alert('Configuration saved!');
            loadEnergyConfigs();
            document.getElementById('energy-config-building').value = '';
            document.getElementById('energy-cost-kwh').value = '';
            document.getElementById('co2-emission-factor').value = '';
        } else { throw new Error('Failed to save'); }
    } catch (error) { if (typeof cfgToast === 'function') cfgToast('Error: ' + error.message, 'error'); else alert('Error: ' + error.message); }
}

async function editEnergyConfig(buildingName) {
    try {
        const response = await fetch(`/api/configuration/building-energy/${encodeURIComponent(buildingName)}`);
        if (!response.ok) throw new Error('Failed to load');
        const config = await response.json();
        document.getElementById('energy-config-building').value = config.buildingName;
        document.getElementById('energy-cost-kwh').value = config.energyCostPerKwh || '';
        document.getElementById('energy-currency').value = config.currency || 'EUR';
        document.getElementById('co2-emission-factor').value = config.co2EmissionFactor || '';
    } catch (error) { if (typeof cfgToast === 'function') cfgToast('Error: ' + error.message, 'error'); else alert('Error: ' + error.message); }
}

async function deleteEnergyConfig(buildingName) {
    if (!confirm(`Delete config for ${buildingName}?`)) return;
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    if (!csrfMeta || !csrfHeaderMeta) { if (typeof cfgToast === 'function') cfgToast('CSRF token not found.', 'error'); else alert('CSRF token not found.'); return; }
    try {
        const response = await fetch(`/api/configuration/building-energy/${encodeURIComponent(buildingName)}`, {
            method: 'DELETE',
            headers: { [csrfHeaderMeta.getAttribute("content")]: csrfMeta.getAttribute("content") }
        });
        if (response.ok) { if (typeof cfgToast === 'function') cfgToast('Energy config deleted!', 'success'); else alert('Deleted!'); loadEnergyConfigs(); }
        else { throw new Error('Failed'); }
    } catch (error) { if (typeof cfgToast === 'function') cfgToast('Error: ' + error.message, 'error'); else alert('Error: ' + error.message); }
}

// ======================================================
// ================== GLOBAL EXPORTS =====================
// ======================================================

window.initBuildingConfig = initBuildingConfig;
window.deleteBuildingConfig = deleteBuildingConfig;
window.changeEditorLanguage = changeEditorLanguage;
window.testDecoder = testDecoder;
window.toggleNotifChannelInput = toggleNotifChannelInput;
window.saveBuildingConfig = saveBuildingConfig;
window.saveAlertConfig = saveAlertConfig;
window.saveNotificationChannels = saveNotificationChannels;
window.loadNotificationPreferences = loadNotificationPreferences;
window.loadSensors = loadSensors;
window.loadSensorThresholds = loadSensorThresholds;
window.saveSensorThreshold = saveSensorThreshold;
window.deleteSensorThreshold = deleteSensorThreshold;
window.updateParameterUnits = updateParameterUnits;
window.editNotificationPreference = editNotificationPreference;
window.deleteNotificationPreference = deleteNotificationPreference;
window.applyFormVisibility = applyFormVisibility;
window.saveEnergyConfig = saveEnergyConfig;
window.editEnergyConfig = editEnergyConfig;
window.deleteEnergyConfig = deleteEnergyConfig;
window.loadEnergyConfigs = loadEnergyConfigs;
window.loadGatewayRebootSchedules = loadGatewayRebootSchedules;
window.updateGatewayRebootForm = updateGatewayRebootForm;
window.restartGatewayFromConfig = restartGatewayFromConfig;
window.closeGatewayRestartModal = closeGatewayRestartModal;
window.confirmGatewayRestartFromConfig = confirmGatewayRestartFromConfig;
window.saveGatewayRebootSchedule = saveGatewayRebootSchedule;
window.loadDatabaseConnectionConfig = loadDatabaseConnectionConfig;
window.testDatabaseConnection = testDatabaseConnection;
window.saveDatabaseConnection = saveDatabaseConnection;
window.restartApplicationFromConfig = restartApplicationFromConfig;
window.closeApplicationRestartModal = closeApplicationRestartModal;
window.confirmApplicationRestartFromConfig = confirmApplicationRestartFromConfig;
window.loadLocationOptions     = loadLocationOptions;
window.onLocationChange  = onLocationChange;
window.getLocationValue        = getLocationValue;
window.initializeInputs = initializeInputs;
window.syncHiddenLocationField = syncHiddenLocationField;
// ✅ Exposé pour être appelé depuis building3D / floorElementsManager / sensorOverlays
window.setFormMode                 = setFormMode;


// ✅ Fonctions appelées via onclick/onchange depuis le HTML
window.addElementSVG = addElementSVG;
window.removeElementSVG = removeElementSVG;
window.toggleEditMode = toggleEditMode;
window.onChangeElement = onChangeElement;
window.onChangeSensor = onChangeSensor;
window.applyFormUpdate = applyFormUpdate;
window.refresh3DConfig = refresh3DConfig;
window.populateBuildingSelect = populateBuildingSelect;
window.toggleFloorCheckboxPanel = toggleFloorCheckboxPanel;
window.onFloorCheckboxChange = onFloorCheckboxChange;
// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    if (typeof loadSensors === 'function') loadSensors();
    if (typeof loadNotificationPreferences === 'function') loadNotificationPreferences();
    if (typeof toggleFormFields === 'function') toggleFormFields();
    if (typeof loadEnergyConfigs === 'function') loadEnergyConfigs();
    if (typeof loadGatewayRebootSchedules === 'function') loadGatewayRebootSchedules();
    if (typeof loadDatabaseConnectionConfig === 'function') loadDatabaseConnectionConfig();

    // Initialiser en mode ajout au chargement
    setFormMode('add');

    const inputNew = document.getElementById("input_location_new");
    const buildingSelect = document.getElementById("filter-building");
    const floorSelect = document.getElementById("filter-floor");
    if (inputNew) {
        inputNew.addEventListener("input", () => {
            syncHiddenLocationField(inputNew.value);
        });
    }

    const reloadLocations = () => {
        const buildingId = buildingSelect?.value || "";
        const floor = floorSelect?.value ?? "";
        // Ne recharger que si le composant est visible
        const container = document.getElementById("input-location-container");
        if (container && container.style.display !== "none") {
            loadLocationOptions(buildingId, floor, getLocationValue());
        }
    };

    if (buildingSelect) {
        buildingSelect.addEventListener("change", reloadLocations);
        buildingSelect.addEventListener("change", initializeInputs);
    }
    if (floorSelect) {
        floorSelect.addEventListener("change", reloadLocations);
        floorSelect.addEventListener("change", initializeInputs);
    }

    const container = document.getElementById("floor-plan-2d");
    if (container) {
        container.classList.add("plan-readonly");
    }
});
