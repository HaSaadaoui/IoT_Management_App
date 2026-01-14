// ===== Helpers =====

// Shortcut for document.querySelector
const el = (sel) => document.querySelector(sel);
// Helper to safely set text content of an element
const setText = (selector, value) => {
    const target = typeof selector === 'string' ? el(selector) : selector;
    if (target) target.textContent = (value == null ? "--" : String(value));
};

// --- Battery helper (icône + couleur)
function updateBatteryBadge(selector, pct) {
    const node = typeof selector === 'string' ? el(selector) : selector;
    if (!node) return;
    node.classList.remove('battery--good', 'battery--warn', 'battery--low', 'battery--crit', 'battery--unk');

    if (pct == null || Number.isNaN(Number(pct))) {
        node.classList.add('battery--unk');
        const span = node.querySelector('span') || node;
        span.textContent = '--';
        return;
    }
    const p = Math.max(0, Math.min(100, Math.round(Number(pct))));
    let cls = 'battery--crit';
    if (p >= 60) cls = 'battery--good';
    else if (p >= 30) cls = 'battery--warn';
    else if (p >= 10) cls = 'battery--low';

    node.classList.add(cls);
    const span = node.querySelector('span') || node;
    span.textContent = p + ' %';
}

// --- CO2 helper (couleur selon niveau)
function updateCO2Badge(selector, ppm) {
    const node = typeof selector === 'string' ? el(selector) : selector;
    if (!node) return;
    node.classList.remove('co2--good', 'co2--warn', 'co2--danger');

    if (ppm == null || Number.isNaN(Number(ppm))) {
        node.classList.add('co2--good');
        node.textContent = '-- ppm';
        return;
    }
    const p = Math.round(Number(ppm));
    let cls = 'co2--good';
    if (p > 1000) cls = 'co2--danger';
    else if (p > 800) cls = 'co2--warn';

    node.classList.add(cls);
    node.textContent = p + ' ppm';
}

// --- VDD to Battery % converter (règle de trois: 2500mV=0%, 3600mV=100%)
function vddToBatteryPercent(vddMv) {
    if (vddMv == null || Number.isNaN(Number(vddMv))) return null;
    const v = Number(vddMv);
    const MIN_VDD = 2500; // 0%
    const MAX_VDD = 3600; // 100%
    const pct = ((v - MIN_VDD) / (MAX_VDD - MIN_VDD)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
}

// --- Temperature helper (couleur selon température)
function updateTempBadge(selector, temp) {
    const node = typeof selector === 'string' ? el(selector) : selector;
    if (!node) return;
    node.classList.remove('temp--cold', 'temp--normal', 'temp--warm', 'temp--hot');

    if (temp == null || Number.isNaN(Number(temp))) {
        node.classList.add('temp--normal');
        node.textContent = '--';
        return;
    }
    const t = Number(temp);
    let cls = 'temp--normal';
    if (t < 18) cls = 'temp--cold';
    else if (t > 26) cls = 'temp--hot';
    else if (t > 24) cls = 'temp--warm';

    node.classList.add(cls);
    node.textContent = t.toFixed(1) + ' °C';
}

// --- Humidity helper (couleur selon humidité)
function updateHumidityBadge(selector, humidity) {
    const node = typeof selector === 'string' ? el(selector) : selector;
    if (!node) return;
    node.classList.remove('humidity--low', 'humidity--normal', 'humidity--high', 'humidity--veryhigh');

    if (humidity == null || Number.isNaN(Number(humidity))) {
        node.classList.add('humidity--normal');
        node.textContent = '-- %';
        return;
    }
    const h = Math.round(Number(humidity));
    let cls = 'humidity--normal';
    if (h < 30) cls = 'humidity--low'; // Trop sec
    else if (h > 70) cls = 'humidity--veryhigh'; // Trop humide
    else if (h > 60) cls = 'humidity--high'; // Un peu humide

    node.classList.add(cls);
    node.textContent = h + ' %';
}

// ===== Leaflet (optionnel) =====
const mapEl = document.getElementById('map');
let map = null,
    sensorMarker = null;
if (mapEl && window.L) {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    sensorMarker = L.marker([0, 0]).addTo(map);
}

// ==================================
// ===== DOM Element References =====
// ==================================

// Badges optionnels (anciens emplacements éventuels)
const statusBadge = el("#sensor-status");
const batteryBadge = el("#battery-badge"); // si présent ailleurs dans le layout
const lastSeenEl = el("#last-seen");
const appIdEl = el("#s-app");
const uplinkCountEl = el("#uplink-count");
const rssiNowEl = el("#rssi-now");
const snrNowEl = el("#snr-now");
const locEl = el("#sensor-location");
const uplinksTbody = el("#uplinks-tbody");

// Live-data COUNT
const sCountBatt = el("#s-count-batt");
const sCountIn = el("#s-count-in");
const sCountOut = el("#s-count-out");
const sGenBatt = el("#s-gen-batt");

// =====================================
// ===== Sensor Metric Definitions =====
// =====================================
// Map metric names to backend names
// See: src/main/java/com/amaris/sensorprocessor/entity/PayloadValueType.java
const DEVICE_TYPE_METRICS = {
    "COUNT": [
        "BATTERY",
        "PERIOD_IN",
        "PERIOD_OUT",
    ],
    "RSSI": ["RSSI"],
    "SNR": ["SNR"],
    "CO2": [
        "LAST_BATTERY_PERCENTAGE",
        "CO2",
        "TEMPERATURE",
        "HUMIDITY",
        // "VDD",
        "LIGHT",
        "MOTION",
    ],
    "OCCUP": [
        "BATTERY",
        "OCCUPANCY",
        "DISTANCE",
        "ILLUMINANCE",
    ],
    "TEMPEX": [
        "LAST_BATTERY_PERCENTAGE",
        "TEMPERATURE",
        "HUMIDITY",
    ],
    "PIR_LIGHT": [
        "LAST_BATTERY_PERCENTAGE",
        "DAYLIGHT",
        "PIR",
    ],
    "EYE": [
        "LAST_BATTERY_PERCENTAGE",
        "TEMPERATURE",
        "HUMIDITY",
        "LIGHT",
        "MOTION",
        "OCCUPANCY", // TODO: Double check that
        // "VDD",
    ],
    "SON": [
        "LAST_BATTERY_PERCENTAGE",
        "LAI",
        "LAIMAX",
        "LAEQ",
    ],
    "DESK": [
        "LAST_BATTERY_PERCENTAGE",
        "OCCUPANCY",
        "TEMPERATURE",
        "HUMIDITY",
        // "VDD",
    ],
};

// =================================================
// ===== Server-Sent Events (SSE) for Live Data =====
// =================================================

// SSE connection instance
let es = null;
// Flag to control live updates
let LIVE_MODE = true;

function startSSE() {
    if (es || !LIVE_MODE) return;

    const html = document.documentElement;
    const SENSOR_ID = window.SENSOR_ID || html.dataset.deviceId;
    const SSE_TOKEN = window.SSE_TOKEN || html.dataset.sseToken;
    const GATEWAY_ID = window.GATEWAY_ID || html.dataset.gatewayId;
    if (!SENSOR_ID) return;

    const baseUrl = `/manage-sensors/monitoring/${encodeURIComponent(SENSOR_ID)}/stream`;
    const url = SSE_TOKEN ? `${baseUrl}?token=${encodeURIComponent(SSE_TOKEN)}` : `${baseUrl}?t=${Date.now()}`;

    es = new EventSource(url);

    es.onmessage = (evt) => {
        if (!LIVE_MODE) return;
        try {
            const data = JSON.parse(evt.data || "{}");
            const isNormalized = !!data.ids || !!data.payload || !!data.link;

            // App ID
            let appId = null;
            if (isNormalized) appId = data.ids?.application_id ?? null;
            else if (data.device?.application_id) appId = data.device.application_id;
            else if (GATEWAY_ID) appId = (String(GATEWAY_ID).toLowerCase() === 'leva-rpi-mantu') ? 'lorawan-network-mantu' : `${GATEWAY_ID}-appli`;
            if (appIdEl && appId) setText(appIdEl, appId);
            if (isNormalized && data.ids?.device_id && el("#s-device")) setText("#s-device", data.ids.device_id);

            // Last seen
            const lastSeen = isNormalized ? data.timestamp : (data.meta?.last_seen);
            const lastSeenHuman = lastSeen ? (() => {
                try {
                    return new Date(lastSeen).toLocaleString();
                } catch {
                    return lastSeen;
                }
            })() : null;
            if (lastSeenHuman && lastSeenEl) setText(lastSeenEl, lastSeenHuman);
            if (lastSeenHuman && el("#s-last")) setText("#s-last", lastSeenHuman);

            // Status dynamique - Si on reçoit des données, le sensor est actif
            const statusBadgeEl = el("#sensor-status");
            const statusTextEl = el("#sensor-status-text");
            if (statusBadgeEl && statusTextEl) {
                // Si on reçoit des données, le sensor est actif
                statusBadgeEl.className = "badge badge--ok";
                statusTextEl.textContent = "Active";
                // Mettre à jour l'icône si elle existe
                const iconImg = statusBadgeEl.querySelector('img');
                if (iconImg) iconImg.src = '/image/toggle_on.svg';
            }

            // Battery
            let battery = null;
            if (isNormalized) battery = (typeof data.payload?.["battery (%)"] === "number") ? data.payload["battery (%)"] : null;
            else {
                const batObj = data.battery || {};
                battery = (batObj.percent ?? batObj.level ?? null);
            }
            if (battery != null) {
                if (batteryBadge) updateBatteryBadge(batteryBadge, battery);
                if (sCountBatt) updateBatteryBadge(sCountBatt, battery);
                if (sGenBatt) updateBatteryBadge(sGenBatt, battery);

                const sOccupBatt = el("#s-occup-batt");
                const sPirBatt = el("#s-pir-batt");
                const sDeskBatt = el("#s-desk-batt");
                const sSoundBatt = el("#s-sound-batt");
                if (sOccupBatt) updateBatteryBadge(sOccupBatt, battery);
                if (sPirBatt) updateBatteryBadge(sPirBatt, battery);
                if (sDeskBatt) updateBatteryBadge(sDeskBatt, battery);
                if (sSoundBatt) updateBatteryBadge(sSoundBatt, battery);

                // Mise à jour du graphique batterie
                updateBatteryChart(battery);
            }

            // RSSI/SNR
            let rssi = null,
                snr = null;
            if (isNormalized) {
                const link = data.link || {};
                rssi = (typeof link["rssi (dBm)"] === "number") ? link["rssi (dBm)"] : null;
                snr = (typeof link["snr (dB)"] === "number") ? link["snr (dB)"] : null;
            } else if (data.radio) {
                rssi = Number(data.radio.rssi);
                snr = Number(data.radio.snr);
            }
            if (rssi != null && !Number.isNaN(rssi)) {
                if (rssiNowEl) setText(rssiNowEl, rssi.toFixed(0));
                const sRssi = el("#s-rssi");
                if (sRssi) setText(sRssi, `${rssi.toFixed(0)} dBm`);
            }
            if (snr != null && !Number.isNaN(snr)) {
                if (snrNowEl) setText(snrNowEl, snr.toFixed(1));
                const sSnr = el("#s-snr");
                if (sSnr) setText(sSnr, `${snr.toFixed(1)} dB`);
            }

            // Mise à jour du graphique signal
            if (rssi != null && snr != null && !Number.isNaN(rssi) && !Number.isNaN(snr)) {
                updateSignalChart(rssi, snr);
            }

            // Compteurs uplinks (ancien)
            if (!isNormalized && typeof data.counters?.uplinks !== "undefined" && uplinkCountEl) {
                setText(uplinkCountEl, data.counters.uplinks);
            }

            // Détails link
            if (isNormalized && data.link) {
                if (el("#s-fcnt") && data.link.f_cnt != null) setText("#s-fcnt", data.link.f_cnt);
                if (el("#s-fport") && data.link.f_port != null) setText("#s-fport", data.link.f_port);
                if (el("#s-rxgw") && data.link.gateway_id) setText("#s-rxgw", data.link.gateway_id);
                // Remplir les badges séparés pour SF / BW / Coding Rate / Frequency
                if (el("#s-sf") && data.link.sf) setText("#s-sf", data.link.sf);
                if (el("#s-bw") && data.link["bw (kHz)"] != null) setText("#s-bw", `${data.link["bw (kHz)"]} kHz`);
                if (el("#s-cr") && data.link.coding_rate) setText("#s-cr", data.link.coding_rate);
                if (el("#s-freq") && data.link["frequency (MHz)"] != null) setText("#s-freq", `${data.link["frequency (MHz)"]} MHz`);
            }

            // COUNT → periods
            if (isNormalized && data.payload) {
                const pin = data.payload["period_in"];
                const pout = data.payload["period_out"];
                if (sCountIn && pin != null) setText(sCountIn, pin);
                if (sCountOut && pout != null) setText(sCountOut, pout);
            }

            // Localisation
            if (isNormalized && data.link?.location && map && sensorMarker) {
                const loc = data.link.location;
                const lat = (typeof loc.latitude === "number") ? loc.latitude : null;
                const lon = (typeof loc.longitude === "number") ? loc.longitude : null;
                if (lat != null && lon != null) {
                    sensorMarker.setLatLng([lat, lon]);
                    map.setView([lat, lon], 13);
                    if (locEl) setText(locEl, `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
                }
            } else if (!isNormalized && typeof data.meta?.lat === "number" && typeof data.meta?.lon === "number" && map && sensorMarker) {
                const {
                    lat,
                    lon
                } = data.meta;
                sensorMarker.setLatLng([lat, lon]);
                map.setView([lat, lon], 13);
                if (locEl) setText(locEl, `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
            }

            // Tableau uplinks (ancien)
            if (!isNormalized && Array.isArray(data.uplinks) && uplinksTbody) {
                uplinksTbody.innerHTML = "";
                data.uplinks.slice(-20).reverse().forEach(u => {
                    const tr = document.createElement("tr");
                    const decoded = (u.decoded && typeof u.decoded === "object") ?
                        JSON.stringify(u.decoded) :
                        (u.payload_hex || "");
                    tr.innerHTML = `
            <td>${u.time ? new Date(u.time).toLocaleTimeString() : "--"}</td>
            <td>${u.fcnt ?? "--"}</td>
            <td>${u.fport ?? "--"}</td>
            <td><code>${decoded}</code></td>
          `;
                    uplinksTbody.appendChild(tr);
                });
            }

            // Dispatch par profil (badges)
            const fmt = {
                batt: v => `${Math.round(v)} %`,
                temp: v => `${v} °C`,
                hum: v => `${v} %`,
                vdd: v => `${v} mV`,
                db: v => `${v} dB`
            };
            const devTypeFromHtml = (document.documentElement.dataset.devType || '').toUpperCase();
            const PROF = String((isNormalized && data.ids?.profile) ? data.ids.profile : devTypeFromHtml).toUpperCase();
            const p = (isNormalized && data.payload) ? data.payload : {};

            switch (PROF) {
                case 'COUNT':
                    if (typeof p['battery'] === 'number' && el('#s-count-batt')) updateBatteryBadge('#s-count-batt', p['battery']);
                    if (p['period_in'] != null && el('#s-count-in')) setText('#s-count-in', p['period_in']);
                    if (p['period_out'] != null && el('#s-count-out')) setText('#s-count-out', p['period_out']);
                    break;
                case 'TEMPEX':
                    if (typeof p['temperature (°C)'] === 'number' && el('#s-tempex-temp')) updateTempBadge('#s-tempex-temp', p['temperature (°C)']);
                    if (typeof p['humidity (%)'] === 'number' && el('#s-tempex-hum')) updateHumidityBadge('#s-tempex-hum', p['humidity (%)']);
                    if (typeof p['battery (%)'] === 'number' && el('#s-tempex-batt')) updateBatteryBadge('#s-tempex-batt', p['battery (%)']);
                    break;
                case 'SON':
                    if (typeof p['LAeq (dB)'] === 'number' && el('#s-sound-laeq')) setText('#s-sound-laeq', fmt.db(p['LAeq (dB)']));
                    if (typeof p['LAI (dB)'] === 'number' && el('#s-sound-lai')) setText('#s-sound-lai', fmt.db(p['LAI (dB)']));
                    if (typeof p['LAImax (dB)'] === 'number' && el('#s-sound-laimax')) setText('#s-sound-laimax', fmt.db(p['LAImax (dB)']));
                    if (typeof p['battery (%)'] === 'number' && el('#s-sound-batt')) updateBatteryBadge('#s-sound-batt', p['battery (%)']);
                    break;
                case 'CO2':
                    if (typeof p['co2 (ppm)'] === 'number' && el('#s-co2-ppm')) updateCO2Badge('#s-co2-ppm', p['co2 (ppm)']);
                    if (typeof p['temperature (°C)'] === 'number' && el('#s-co2-temp')) updateTempBadge('#s-co2-temp', p['temperature (°C)']);
                    if (typeof p['humidity (%)'] === 'number' && el('#s-co2-hum')) updateHumidityBadge('#s-co2-hum', p['humidity (%)']);
                    // VDD → Battery %
                    if (typeof p['vdd (v)'] === 'number') {
                        const vddMv = Math.round(p['vdd (v)'] * 1000);
                        const battPct = vddToBatteryPercent(vddMv);
                        if (battPct != null && el('#s-co2-vdd')) updateBatteryBadge('#s-co2-vdd', battPct);
                    } else if (typeof p['vdd (mV)'] === 'number') {
                        const battPct = vddToBatteryPercent(p['vdd (mV)']);
                        if (battPct != null && el('#s-co2-vdd')) updateBatteryBadge('#s-co2-vdd', battPct);
                    }
                    if (p.light != null && el('#s-co2-light')) setText('#s-co2-light', p.light);
                    if (p.presence != null && el('#s-co2-motion')) setText('#s-co2-motion', p.presence);
                    break;
                case 'OCCUP':
                    // Occupancy avec code couleur
                    if (p.presence != null && el('#s-occup-presence')) {
                        const occNode = el('#s-occup-presence');
                        occNode.classList.remove('badge--ok', 'badge--occupied');
                        const presenceValue = String(p.presence).toLowerCase();
                        if (presenceValue === 'occupied' || presenceValue === '1' || p.presence === 1 || p.presence === true) {
                            occNode.classList.add('badge--occupied'); // Rouge pour occupied
                            setText('#s-occup-presence', 'Occupied');
                        } else {
                            occNode.classList.add('badge--ok'); // Vert pour vacant/free
                            setText('#s-occup-presence', presenceValue === 'vacant' ? 'Vacant' : 'Free');
                        }
                    }
                    if (p.light != null && el('#s-occup-illum')) {
                        // For VS70, 'light' is a status string like 'dim' or 'bright'
                        const illuminanceStatus = String(p.light);
                        setText('#s-occup-illum', illuminanceStatus.charAt(0).toUpperCase() + illuminanceStatus.slice(1));
                    }
                    if (typeof p['battery (%)'] === 'number' && el('#s-occup-batt')) updateBatteryBadge('#s-occup-batt', p['battery (%)']);
                    // VS30 (distance) vs VS70 (illuminance)
                    if (p.distance != null && el('#s-occup-distance')) {
                        setText('#s-occup-distance', p.distance + ' mm');
                        el('#s-occup-distance-card').style.display = '';
                        el('#s-occup-illum-card').style.display = 'none';
                    }
                    break;
                case 'EYE':
                    if (typeof p['temperature (°C)'] === 'number' && el('#s-eye-temp')) updateTempBadge('#s-eye-temp', p['temperature (°C)']);
                    if (typeof p['humidity (%)'] === 'number' && el('#s-eye-hum')) updateHumidityBadge('#s-eye-hum', p['humidity (%)']);
                    if (p.light != null && el('#s-eye-light')) {
                        setText('#s-eye-light', p.light + ' lux');
                    }
                    if (p.presence != null && el('#s-eye-presence')) setText('#s-eye-presence', p.presence);
                    // VDD → Battery %
                    if (typeof p['vdd (mV)'] === 'number') {
                        const battPct = vddToBatteryPercent(p['vdd (mV)']);
                        if (battPct != null && el('#s-eye-vdd')) updateBatteryBadge('#s-eye-vdd', battPct);
                    }
                    break;
                case 'PIR_LIGHT':
                    if (p.presence != null && el('#s-pir-presence')) setText('#s-pir-presence', p.presence);
                    if (p.light != null && el('#s-pir-daylight')) setText('#s-pir-daylight', p.light);
                    if (typeof p['battery (%)'] === 'number' && el('#s-pir-batt')) updateBatteryBadge('#s-pir-batt', p['battery (%)']);
                    break;
                case 'DESK':
                    // Occupancy avec code couleur (rouge=occupied, vert=free)
                    const presence = p.presence;
                    if (presence != null && el('#s-desk-occupancy')) {
                        const occNode = el('#s-desk-occupancy');
                        occNode.classList.remove('badge--ok', 'badge--occupied');
                        if (presence === 1 || presence === true || String(presence).toLowerCase() === 'occupied') {
                            occNode.classList.add('badge--occupied'); // Rouge pour occupied
                            setText('#s-desk-occupancy', 'Occupied');
                        } else {
                            occNode.classList.add('badge--ok'); // Vert pour free
                            setText('#s-desk-occupancy', 'Free');
                        }
                    }
                    // Show/hide temp/hum cards based on payload for different DESK models (e.g. VS41 vs EMS)
                    // TODO: check if it works
                    const temp = p['temperature (°C)'];
                    const hum = p['humidity (%)'];
                    el('#s-desk-temp-card').style.display = (temp != null) ? '' : 'none';
                    el('#s-desk-hum-card').style.display = (hum != null) ? '' : 'none';
                    if (temp != null && el('#s-desk-temp')) updateTempBadge('#s-desk-temp', temp);
                    if (hum != null && el('#s-desk-hum')) updateHumidityBadge('#s-desk-hum', hum);
                    // VDD → Battery %
                    if (typeof p['vdd (mV)'] === 'number') {
                        const battPct = vddToBatteryPercent(p['vdd (mV)']);
                        if (battPct != null && el('#s-desk-vdd')) updateBatteryBadge('#s-desk-vdd', battPct);
                    }
                    break;
                case 'ENERGY':
                case 'CONSO':
                    // Gestion des données de consommation énergétique
                    console.log('ENERGY/CONSO case triggered with payload:', p);
                    if (p && p.energy_data && typeof p.energy_data === 'object') {
                        console.log('Energy data found:', p.energy_data);
                        updateEnergyConsumption(p.energy_data);
                    } else {
                        console.log('No energy_data in payload:', p);
                    }
                    break;
                default:
                    if (typeof p['battery (%)'] === 'number' && el('#s-gen-batt')) updateBatteryBadge('#s-gen-batt', p['battery (%)']);
                    break;
            }

            // Mise à jour des graphiques en temps réel pour tous les capteurs
            if (isNormalized && p && typeof p === 'object') {
                updateRealtimeCharts(p);
            }
        } catch (e) {
            console.error("Sensor SSE parse error:", e);
        }
    };

    es.onerror = (err) => {
        console.error("Sensor SSE error:", err);
        stopSSE();
    };
}

function stopSSE() {
    if (es) {
        es.close();
        es = null;
    }
}

// =================================
// ===== History Chart Setup =====
// =================================

// Chart.js context helper
const ctx = id => (document.getElementById(id)?.getContext("2d") || null);

// Factory function for creating a line chart
function mkLineChart(ctx, label, color) {
    return new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label,
                // data: [],
                borderColor: color,
                backgroundColor: color.replace("1)", "0.1)").replace("rgb", "rgba"),
                fill: true,
                tension: .3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                legend: {
                    position: "top",
                }
            }
        }
    });
}

// Factory function for creating a bar chart
const mkHist = (id, label) => (ctx(id) ? mkLineChart(ctx(id), label, "rgb(102,33,121,1)") : null);

function mkBarChart(ctx, label, color) {
    return new Chart(ctx, {
        type: "bar",
        data: {
            labels: [],
            datasets: [{
                label,
                borderColor: color,
                backgroundColor: color.replace("1)", "0.5)").replace("rgb", "rgba"),
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                legend: {
                    position: "top",
                }
            }
        }
    });
}

// DOM containers for history charts
const networkMetricsContainer = el('#network-metrics-container');
const sensorMetricsContainer = el('#sensor-metrics-container');
const consumptionCharts = {
    'red': {
        id: 'histConsumptionAll',
        channels: [0, 1, 2],
        label: 'Red Outlets',
        color: 'rgb(239, 68, 68, 1)'
    },
    'white': {
        id: 'histConsumptionAll',
        channels: [3, 4, 5],
        label: 'White Outlets & Lightning',
        color: 'rgb(100, 116, 139, 1)'
    },
    'vent': {
        id: 'histConsumptionAll',
        channels: [6, 7, 8],
        label: 'Ventilation & Heaters',
        color: 'rgb(59, 130, 246, 1)'
    },
    'other': {
        id: 'histConsumptionAll',
        channels: [9, 10, 11],
        label: 'Other Circuits',
        color: 'rgb(245, 158, 11, 1)'
    }
};
let combinedConsumptionChart = null;

// Array to hold dynamically created metric chart instances
let dynamicMetricCharts = [];

// Map backend metric names to user-friendly titles with units
const METRIC_TITLES = {
    'CO2': 'CO₂ (ppm)',
    'TEMPERATURE': 'Temperature (°C)',
    'HUMIDITY': 'Humidity (%)',
    'VDD': 'Voltage (mV)',
    'LIGHT': 'Light (lux)',
    'MOTION': 'Motion',
    'PRESENCE': 'Presence',
    'OCCUPANCY': 'Occupancy',
    'PERIOD_IN': 'Number of employees in',
    'PERIOD_OUT': 'Number of employees out',
    'LAI': 'Sound Impact (LAI)',
    'LAIMAX': 'Max Sound Impact (LAImax)',
    'LAEQ': 'Equivalent Sound Level (LAeq)',
    'BATTERY': 'Battery (%)',
    'LAST_BATTERY_PERCENTAGE': 'Battery (%)',
    'RSSI': 'Signal (RSSI)',
    'SNR': 'Signal/Noise (SNR)',
    'DISTANCE': 'Distance (mm)',
    'ILLUMINANCE': 'Illuminance',
    'CONSUMPTION_CHANNEL_0': 'Consumption Channel 0',
    'CONSUMPTION_CHANNEL_1': 'Consumption Channel 1',
    'CONSUMPTION_CHANNEL_2': 'Consumption Channel 2',
    'CONSUMPTION_CHANNEL_3': 'Consumption Channel 3',
    'CONSUMPTION_CHANNEL_4': 'Consumption Channel 4',
    'CONSUMPTION_CHANNEL_5': 'Consumption Channel 5',
    'CONSUMPTION_CHANNEL_6': 'Consumption Channel 6',
    'CONSUMPTION_CHANNEL_7': 'Consumption Channel 7',
    'CONSUMPTION_CHANNEL_8': 'Consumption Channel 8',
    'CONSUMPTION_CHANNEL_9': 'Consumption Channel 9',
    'CONSUMPTION_CHANNEL_10': 'Consumption Channel 10',
    'CONSUMPTION_CHANNEL_11': 'Consumption Channel 11',
};

// Helper function to get a consistent color for metrics
function getMetricColor(metricName) {
    const colors = {
        'temperature': '#f59e0b', // Orange
        'humidity': '#3b82f6', // Blue
        'co2': '#ef4444', // Red
        'vdd': '#10b981', // Green
        'light': '#fbbf24', // Amber
        'motion': '#6366f1', // Indigo
        'presence': '#10b981', // Green (similar to VDD for status)
        'occupancy': '#10b981', // Green
        'period_in': '#6366f1', // Indigo
        'period_out': '#8b5cf6', // Violet
        'lai': '#ec4899', // Pink
        'laeq': '#db2777', // Darker Pink
        'laimax': '#9333ea', // Purple
        'battery': '#059669', // Dark Green
        'rssi': '#2563eb', // Darker Blue
        'snr': '#7c3aed', // Darker Violet
    };
    return colors[metricName.toLowerCase()] || '#662179'; // Default purple
}

// Helper to update chart data
function setSeries(chart, labels, values) {
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
}

// Helper to get the last timestamp from a dataset
function getLastTimestamp(values) {
    const ts = values[values.length - 1]
    const parsed = new Date(ts)
    return parsed.toLocaleDateString("en-CA")
}

// Main function to load and render history data
async function loadHistory(fromISO, toISO) {
    const SENSOR_ID = document.documentElement.dataset.deviceId;
    const GATEWAY_ID = document.documentElement.dataset.gatewayId;
    const params = new URLSearchParams();
    if (fromISO) params.set('startDate', fromISO);
    if (toISO) params.set('endDate', toISO);
    const res = await fetch(`/manage-sensors/monitoring/${encodeURIComponent(GATEWAY_ID)}/${encodeURIComponent(SENSOR_ID)}/history?` + params.toString());
    if (!res.ok) throw new Error("History fetch failed");
    const j = await res.json();

    // Hide sections by default, show them if they have data
    el('#network-quality-section').style.display = 'none';
    el('#sensor-metrics-section').style.display = 'none';

    const getChartData = (metricName) => {
        const GROUPING_THRESHOLD = 50; // Max data points before grouping
        const rawData = j.data[metricName] || {};
        const dataPoints = Object.keys(rawData).length;

        if (dataPoints > GROUPING_THRESHOLD) {
            // Group data into 6-hour intervals
            const groupedData = {};
            for (const timestamp in rawData) {
                const date = new Date(timestamp);
                const hour = date.getHours();
                const groupHour = Math.floor(hour / 6) * 6; // 0, 6, 12, 18
                date.setHours(groupHour, 0, 0, 0);
                const groupKey = date.toISOString();

                if (!groupedData[groupKey]) {
                    groupedData[groupKey] = {
                        sum: 0,
                        count: 0
                    };
                }
                groupedData[groupKey].sum += parseFloat(rawData[timestamp]);
                groupedData[groupKey].count++;
            }

            // Calculate averages
            const averagedData = {};
            for (const key in groupedData) {
                averagedData[key] = groupedData[key].sum / groupedData[key].count;
            }

            const labels = Object.keys(averagedData).map(t => new Date(t).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit'
            }));
            const values = Object.values(averagedData);
            return {
                labels,
                values
            };

        }

        // Default behavior (no grouping)
        const metricData = j.data[metricName] || {};
        const labels = Object.keys(metricData).map(t => new Date(t).toLocaleString());
        const values = Object.values(metricData);
        return {
            labels,
            values
        };
    };

    // Clear previous dynamic charts before loading new ones
    if (networkMetricsContainer) {
        networkMetricsContainer.innerHTML = '';
    }
    if (sensorMetricsContainer) {
        sensorMetricsContainer.innerHTML = '';
    }
    dynamicMetricCharts = [];

    const devType = (document.documentElement.dataset.devType || '').toUpperCase();
    if (devType === 'ENERGY' || devType === 'CONSO') {
        // Fetch all data
        const allGroupData = await Promise.all(
            Object.values(consumptionCharts).map(group =>
                loadChannelHistogramData(group.channels, fromISO, toISO)
            )
        );

        const firstGroupData = allGroupData[0] || {};
        const labels = Object.keys(firstGroupData).map(d => new Date(d).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }));

        const datasets = allGroupData.map((groupData, index) => {
            const groupInfo = Object.values(consumptionCharts)[index];
            const values = Object.values(groupData || {}).map(v => v / 1000); // Wh to kWh
            return {
                label: groupInfo.label,
                data: values,
                backgroundColor: groupInfo.color,
                borderColor: groupInfo.color,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8,
            };
        });

        if (!combinedConsumptionChart) {
            const chartCtx = ctx('histConsumptionAll');
            if (chartCtx) {
                combinedConsumptionChart = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: []
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                stacked: false
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Total Consumption (kWh)'
                                }
                            }
                        }
                    }
                });
            }
        }

        if (combinedConsumptionChart) {
            combinedConsumptionChart.data.labels = labels;
            combinedConsumptionChart.data.datasets = datasets;
            combinedConsumptionChart.update();
        }

        // Update total displays
        allGroupData.forEach((groupData, index) => {
            const groupKey = Object.keys(consumptionCharts)[index];
            const totalKw = Object.values(groupsKW).reduce((a, b) => a + b, 0);
            const totalEl = document.getElementById(`hist-total-${groupKey}`);
            if (totalEl) {
                totalEl.textContent = totalKWh.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
        });

        const consumptionSection = el('#consumption-histogram-section');
        if (consumptionSection) consumptionSection.style.display = 'block';
    }

    const networkMetrics = ['RSSI', 'SNR'];
    const sensorMetrics = DEVICE_TYPE_METRICS[devType] || [];

    const processMetric = (metricName, container) => {
        // Generate a unique ID for the canvas
        const canvasId = `histMetric-${metricName.replace(/[^a-zA-Z0-9]/g, '')}`; // Sanitize metric name for ID
        const chartTitle = METRIC_TITLES[metricName] || metricName; // Get user-friendly title
        const color = getMetricColor(metricName);

        // Create the HTML structure for the chart card
        const inputData = j.data[metricName] || {};
        if (Object.keys(inputData).length === 0) {
            return; // Do not create a chart if there is no data
        }

        container.parentElement.style.display = 'block'; // Show the parent section
        const chartCardHtml = `



                  <div class="chart-container">
                    <div class="chart-header">
                        <h4>
                          ${chartTitle}
                        </h4>
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-color" style="background: ${color};"></span> ${metricName}</span>
                        </div>
                    </div>
                    <div class="chart-canvas-wrapper">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
    `;

        // Append the new chart card to the container
        if (container) {
            container.insertAdjacentHTML('beforeend', chartCardHtml);
        }

        // Get the context of the newly created canvas
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (ctx) {
            // Create a new Chart.js instance
            // Deep clone the config to prevent object reference issues between charts
            let chartConfig = JSON.parse(JSON.stringify(createChartConfig(chartTitle, color, '', getLastTimestamp(Object.keys(inputData)))));

            const transformedData = Object.entries(inputData).map(([timestamp, value]) => ({
                x: timestamp,
                y: value
            }));

            // Transparent background for RSSI, otherwise a semi-transparent version of the color
            const bgColor = metricName === 'RSSI' ? 'transparent' : color + "A0";
            chartConfig.data = {
                datasets: [{
                    data: transformedData,
                    borderColor: color,
                    backgroundColor: bgColor,
                    fill: true,
                    tension: 0.1,
                }]
            }

            const generatedLabels = generateLabels(Object.values(j.data[metricName] || {}))
            let yType = 'linear'
            if (containsStrings(generatedLabels)) {
                yType = 'category'
            }

            chartConfig.options.scales = {
                y: {
                    type: yType,
                    labels: generatedLabels,
                    title: {
                        display: true,
                        text: chartTitle,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                },
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            'day': 'yyyy-MM-dd', // e.g., "Nov 24, 2025"
                            'hour': 'h:mm a', // e.g., "Nov 24, 1:00 PM"
                            'minute': 'h:mm a'
                        },

                        // Optional: Specify the smallest unit to parse (your raw data is seconds/milliseconds)
                        minUnit: 'minute'
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10, // Adjust this number (e.g., 5, 8, 10, etc.)
                        major: {
                            enabled: true // This is crucial for identifying day boundaries
                        },
                        maxRotation: 0, // Prevent labels from rotating
                        minRotation: 0
                    },
                    grid: {
                        color: function(context) {
                            // Make grid lines for day boundaries more prominent
                            if (context.tick.major) {
                                return 'rgba(0, 0, 0, 0.3)'; // Darker line for the start of a new day
                            }
                            return 'rgba(0, 0, 0, 0.05)'; // Lighter line for other grid lines
                        }
                    }
                }
            }
            let newChart = new Chart(ctx, chartConfig);
            newChart.update();
            dynamicMetricCharts.push(newChart); // Store the instance
        }
    };

    networkMetrics.forEach(metricName => processMetric(metricName, networkMetricsContainer));
    sensorMetrics.forEach(metricName => processMetric(metricName, sensorMetricsContainer));

    // Update KPI cards
    updateKPICards(j, fromISO, toISO);
}

// Fetches consumption data for specific channels and a date range
async function loadChannelHistogramData(channels = [], fromISO, toISO) {
    const SENSOR_ID = document.documentElement.dataset.deviceId;
    const GATEWAY_ID = document.documentElement.dataset.gatewayId;
    if (!SENSOR_ID || !GATEWAY_ID || !fromISO || !toISO) return null;

    try {
        const params = new URLSearchParams();
        params.set('startDate', fromISO.split('T')[0]);
        params.set('endDate', toISO.split('T')[0]);
        channels.forEach(ch => params.append('channels', String(ch)));
        const res = await fetch(`/manage-sensors/monitoring/${GATEWAY_ID}/${SENSOR_ID}/consumption?` + params.toString());
        if (!res.ok) throw new Error(`Failed to fetch consumption data for channels ${channels.join(',')}: ${res.statusText}`);
        return await res.json(); // Returns Map<Date, Double>
    } catch (e) {
        console.error("Error loading channel histogram data:", e);
        return null;
    }
}

// Checks if an array contains non-numeric string values
function containsStrings(values) {
    if (!Array.isArray(values)) return false;
    return values.some(v => {
        // try to parse as number, if it fails, return
        return isNaN(Number(v));
    })
}

// Generates unique labels from an array of values, for categorical chart axes
function generateLabels(values) {
    // Use a Set to automatically handle uniqueness.
    const uniqueLabels = new Set(values.filter(v => typeof v === 'string'));
    // Convert the Set back to an array.
    return Array.from(uniqueLabels);
}

// Extracts battery data from the history payload
function getBattery(data) {
    const lastBattery = Object.values(data.LAST_BATTERY_PERCENTAGE_VALUE || []);
    const battery = Object.values(data.BATTERY || []);
    if ((lastBattery?.length) > 0) {
        return lastBattery.map(x => parseInt(x, 10))
    } else if ((battery?.length) > 0) {
        return battery.map(x => parseInt(x, 10))
    } else {
        console.error("No battery data found");
        return [];
    }
}

// Update KPI Cards with statistics
function updateKPICards(data, fromISO, toISO) {
    // Total measurements
    const totalEl = document.getElementById('kpi-total');
    if (totalEl) {
        const values = Object.values(data.data || []);
        let total = 0;
        if (values.length > 0) {
            total = values.map(x => Object.values(x).length).reduce((a, b) => a + b)
        }
        totalEl.textContent = total.toLocaleString();
    }

    // Average battery
    const batteryEl = document.getElementById('kpi-battery');
    const pctValues = getBattery(data.data || []);
    if (batteryEl && pctValues?.length > 0) {
        const avg = pctValues.reduce((a, b) => a + b, 0) / pctValues.length;
        batteryEl.textContent = `${Math.round(avg)}%`;
    }

    // Average RSSI
    const rssiEl = document.getElementById('kpi-rssi');
    const rssiValues = Object.values(data.data.RSSI || []).map(x => parseInt(x, 10));
    if (rssiEl && rssiValues?.length > 0) {
        const avg = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;
        rssiEl.textContent = `${Math.round(avg)} dBm`;
    }

    // Period
    const periodEl = document.getElementById('kpi-period');
    if (periodEl && fromISO && toISO) {
        const from = new Date(fromISO);
        const to = new Date(toISO);
        const diffMs = to - from;
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffHours / 24);

        if (diffDays > 0) {
            periodEl.textContent = `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
        } else {
            periodEl.textContent = `${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        }
    }
}

// =========================================
// ===== Live/History Tab Switching =====
// =========================================

function showPane(which) {
    const live = document.getElementById("pane-live");
    const hist = document.getElementById("pane-history");
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('is-active', b.dataset.pane === which));

    if (which === 'live') {
        hist.classList.add('hidden');
        live.classList.remove('hidden');
        LIVE_MODE = true;
        startSSE();
    } else {
        live.classList.add('hidden');
        hist.classList.remove('hidden');
        LIVE_MODE = false;
        stopSSE();
    }
}

// Overridden updateBatteryBadge to handle specific DOM structure
function updateBatteryBadge(selector, pct) {
    const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!node) return;

    node.classList.remove('battery--good', 'battery--warn', 'battery--low', 'battery--crit', 'battery--unk');
    const textSpan = node.querySelector('span:last-child');
    const val = (pct == null || Number.isNaN(Number(pct))) ? '--' : Math.max(0, Math.min(100, Math.round(Number(pct))));
    const p = Number(val);

    if (val === '--') node.classList.add('battery--unk');
    else if (p >= 60) node.classList.add('battery--good');
    else if (p >= 30) node.classList.add('battery--warn');
    else if (p >= 10) node.classList.add('battery--low');
    else node.classList.add('battery--crit');

    if (textSpan) textSpan.textContent = val === '--' ? '--' : `${val} %`;
}


// ========================
// ===== Event Listeners =====
// ========================

// Tab switching event listener
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showPane(btn.dataset.pane));
});

// =================================================
// ===== Real-time Energy Consumption Functions =====
// =================================================

function updateEnergyConsumption(data) {
    // 0) Normalise : valeur absolue UNIQUEMENT pour les entries de type "power"
    const normalized = {};
    Object.keys(data || {}).forEach(k => {
        normalized[k] = absIfPower(data[k]);
    });

    // 1) Regroupe par channel -> powerW
    const byChannel = {}; // ch -> { powerW }

    const getChannel = (entry, key) => {
        const candidates = [
            entry?.hardwareData?.channel,
            entry?.hardware_data?.channel,
            entry?.hardwareEXPLICIT?.channel,
            entry?.hardware?.channel,
            entry?.hw?.channel,
            entry?.channel
        ];
        for (const c of candidates) {
            const n = Number(c);
            if (Number.isFinite(n)) return n;
        }
        const s = String(key ?? '');
        const m = s.match(/(?:CHANNEL[_\s-]?)(\d{1,2})/i) || s.match(/\b(\d{1,2})\b/);
        if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n)) return n;
        }
        return null;
    };

    Object.entries(normalized).forEach(([key, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        if (String(entry.type || '').toLowerCase() !== 'power') return;

        const ch = getChannel(entry, key);
        if (ch == null) return;

        const v = numOrNull(entry.value);
        if (v == null) return;

        byChannel[ch] ??= {
            powerW: 0
        };
        byChannel[ch].powerW = Math.abs(v);
    });

    // 2) Sync store global power par channel (0..11)
    for (let ch = 0; ch <= 11; ch++) {
        channelPowerData[ch] = (typeof byChannel[ch]?.powerW === 'number') ? byChannel[ch].powerW : (Number(channelPowerData[ch]) || 0);
    }

    // 3) Render cards "Channel Details"
    for (let ch = 0; ch <= 11; ch++) {
        const channelEl = el(`#energy-channel-${ch}`);
        if (!channelEl) continue;
        renderChannelCard(channelEl, ch, channelPowerData[ch]);
    }

    // 4) Calcul GROUPES (W) selon tes formules
    const sumW = (chs) => chs.reduce((s, ch) => s + (Number(channelPowerData[ch]) || 0), 0);

    const redW = Math.abs(sumW([0, 1, 2]));
    const ventW = Math.abs(sumW([6, 7, 8]));
    const whiteW = Math.abs(ventW - sumW([3, 4, 5]));
    const otherW = Math.abs(sumW([9, 10, 11]));


    // 5) Update UI groupes : affiche W + kW
    function setGroupPower(groupId, powerW) {
        const groupEl = el(`#energy-group-${groupId}`);
        if (!groupEl) return;

        // Tu as actuellement .wh-value et .kwh-value dans le DOM
        // On les réutilise, mais en POWER :
        const wEl = groupEl.querySelector('.wh-value');
        const kwEl = groupEl.querySelector('.kwh-value');

        const w = Number.isFinite(powerW) ? powerW : 0;
        if (wEl) wEl.textContent = `${Math.round(w)} W`;
        if (kwEl) kwEl.textContent = `${(w / 1000).toFixed(3)} kW`;
    }

    setGroupPower('red-outlets', redW);
    setGroupPower('white-outlets', whiteW);
    setGroupPower('ventilation', ventW);
    setGroupPower('other', otherW);

    // 6) Total (W + kW)
    const totalW = redW + whiteW + ventW + otherW;
    const totalKw = totalW / 1000;

    const totalEl = el('#energy-total');
    if (totalEl) {
        totalEl.innerHTML = `
      <div class="total-consumption">
        <div class="total-label">Total Power</div>
        <div class="total-kwh">${totalKw.toFixed(3)} kW</div>
        <div class="total-wh">${Math.round(totalW)} W</div>
      </div>
    `;
    }

    // 7) Doughnut : POWER by group (kW)
    const channelGroups = {
        'red-outlets': {
            channels: [0, 1, 2],
            name: 'Red Outlets',
            color: '#ef4444'
        },
        'white-outlets': {
            channels: [3, 4, 5],
            name: 'White Outlets & Lighting',
            color: '#64748b'
        },
        'ventilation': {
            channels: [6, 7, 8],
            name: 'Ventilation & Heaters',
            color: '#3b82f6'
        },
        'other': {
            channels: [9, 10, 11],
            name: 'Other Circuits',
            color: '#f59e0b'
        }
    };

    const chartDataPower = {};
    for (let ch = 0; ch <= 11; ch++) {
        chartDataPower[ch] = {
            value: Number(channelPowerData[ch]) || 0
        }; // W
    }

    updateEnergyChart(channelGroups, chartDataPower, {
        mode: 'power'
    });
}

function renderChannelCard(channelEl, ch, powerW) {
    if (!channelEl) return;

    const wTxt =
        (typeof powerW === 'number' && Number.isFinite(powerW)) ?
        `${Math.round(powerW)} W` :
        `-- W`;

    channelEl.innerHTML = `
    <div class="channel-card">
      <div class="channel-left">
        Channel ${ch}
      </div>
      <div class="channel-right">
        ${wTxt}
      </div>
    </div>
  `;
}

function formatEnergyValue(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toLocaleString();
}

// Doughnut chart instance for energy distribution
let energyDoughnutChart = null;

function updateEnergyChart(groups, data, opts = {}) {
    const chartEl = el('#energy-chart');
    if (!chartEl) return;

    const mode = opts.mode || 'energy'; // 'energy' ou 'power'
    const unit = (mode === 'power') ? 'kW' : 'kWh';

    const groupData = Object.entries(groups).map(([groupId, group]) => {
        let total = 0;
        group.channels.forEach(channel => {
            const channelData = data[channel];
            if (channelData && typeof channelData.value === 'number') {
                total += channelData.value; // W si mode=power, Wh si mode=energy
            }
        });

        return {
            name: group.name,
            value: total / 1000, // W->kW ou Wh->kWh
            color: group.color
        };
    });

    if (!chartEl.querySelector('.doughnut-container')) {
        chartEl.innerHTML = `
      <div class="doughnut-container">
        <div class="doughnut-labels">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-secondary);">
            ${mode === 'power' ? 'Power by Group' : 'Consumption by Group'}
          </h4>
          <div class="labels-list"></div>
        </div>
        <div class="doughnut-chart">
          <canvas id="energy-doughnut-canvas"></canvas>
        </div>
      </div>
    `;
    } else {
        // update du titre si le conteneur existe déjà
        const h4 = chartEl.querySelector('.doughnut-labels h4');
        if (h4) h4.textContent = (mode === 'power') ? 'Power by Group' : 'Consumption by Group';
    }

    const canvas = chartEl.querySelector('canvas');
    const labelsList = chartEl.querySelector('.labels-list');

    if (!energyDoughnutChart) {
        const ctx = canvas.getContext('2d');
        energyDoughnutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: groupData.map(g => g.name),
                datasets: [{
                    data: groupData.map(g => g.value),
                    backgroundColor: groupData.map(g => g.color),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: ${value.toFixed(2)} ${unit}`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        energyDoughnutChart.data.labels = groupData.map(g => g.name);
        energyDoughnutChart.data.datasets[0].data = groupData.map(g => g.value);
        energyDoughnutChart.data.datasets[0].backgroundColor = groupData.map(g => g.color);

        // MAJ tooltip unit
        energyDoughnutChart.options.plugins.tooltip.callbacks.label = function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            return `${label}: ${value.toFixed(2)} ${unit}`;
        };

        energyDoughnutChart.update('none');
    }

    if (labelsList) {
        labelsList.innerHTML = groupData.map((group) => {
            return `
        <div class="custom-label" style="display: flex; align-items: center; margin-bottom: 0.75rem;">
          <div class="label-color" style="width: 12px; height: 12px; background-color: ${group.color}; border-radius: 50%; margin-right: 0.5rem;"></div>
          <div class="label-text" style="flex: 1; font-size: 0.8rem;">
            <div style="font-weight: 600; color: var(--text-primary);">${group.name}</div>
            <div style="color: var(--text-secondary); font-size: 0.75rem;">${group.value.toFixed(3)} ${unit}</div>
          </div>
        </div>
      `;
        }).join('');
    }
}

// =======================================================
// ===== Real-time Consumption Functions =====
// =======================================================

let currentConsumptionInterval = null;

const groupConsumptionData = {};
const channelConsumptionData = {}; // To store consumption per channel
const channelPowerData = {}; // {0: W, 1: W, ...}


/**
 * Fetches and updates the consumption for the user-defined period for all channel groups.
 */
function fetchAndUpdateCurrentConsumption() {
    const SENSOR_ID = document.documentElement.dataset.deviceId;
    if (!SENSOR_ID) return;

    const channelGroups = {
        'red-outlets': {
            channels: [0, 1, 2],
            name: 'Red Outlets',
            emoji: '🔴',
            color: '#ef4444'
        },
        'white-outlets': {
            channels: [3, 4, 5],
            name: 'White Outlets & Lighting',
            emoji: '⚪',
            color: '#64748b'
        },
        'ventilation': {
            channels: [6, 7, 8],
            name: 'Ventilation & Heaters',
            emoji: '🌬️',
            color: '#3b82f6'
        },
        'other': {
            channels: [9, 10, 11],
            name: 'Other Circuits',
            emoji: '🔧',
            color: '#f59e0b'
        }
    };

    const oldChannelGroups = {
        'red-outlets': {
            channels: [0, 1, 2]
        },
        'white-outlets': {
            channels: [3, 4, 5]
        },
        'ventilation': {
            channels: [6, 7, 8]
        },
        'other': {
            channels: [9, 10, 11]
        }
    };

    // Clear any existing interval to avoid duplicates
    if (currentConsumptionInterval) {
        clearInterval(currentConsumptionInterval);
    }

    let totalCurrentConsumptionWh = 0;

    const fetchGroupConsumption = async (groupId, group) => {
        const minutesInput = el('#consumption-period-minutes');
        const minutes = minutesInput ? minutesInput.value : 30;

        const params = new URLSearchParams();
        group.channels.forEach(ch => params.append('channels', ch));

        let groupTotalConsumption = 0;

        // Fetch consumption for each channel individually
        for (const channel of group.channels) {
            const channelParams = new URLSearchParams();
            channelParams.append('channels', channel);
            channelParams.append('minutes', minutes);

            try {
                const res = await fetch(`/manage-sensors/monitoring/${SENSOR_ID}/consumption/current?${channelParams.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    const consumption = data.consumption || 0;
                    channelConsumptionData[channel] = consumption; // Store per-channel data
                    groupTotalConsumption += consumption;
                }
            } catch (e) {
                console.error(`Error fetching consumption for channel ${channel}:`, e);
                channelConsumptionData[channel] = 0; // Default to 0 on error
            }
        }

        groupConsumptionData[groupId] = groupTotalConsumption;
        totalCurrentConsumptionWh += groupTotalConsumption;

        // Update the UI for the group with the total
        const groupEl = el(`#energy-group-${groupId}`);
        if (groupEl) {
            const kwhEl = groupEl.querySelector('.kwh-value');
            const whEl = groupEl.querySelector('.wh-value');
            if (kwhEl) kwhEl.textContent = `${(groupTotalConsumption / 1000).toFixed(3)} kWh`;
            if (whEl) whEl.textContent = `${Math.round(groupTotalConsumption)} Wh`;

        }
    };

    // Fetch immediately and then set an interval to refetch every 10 seconds
    const fetchAllGroups = async () => {
        totalCurrentConsumptionWh = 0; // Reset total before fetching
        await Promise.all(Object.entries(oldChannelGroups).map(([id, group]) => fetchGroupConsumption(id, group)));

        // Apply white outlets formula: white = |channels 3,4,5 - channels 6,7,8|
        const whiteRawConsumption = groupConsumptionData['white-outlets'] || 0;
        const ventConsumption = groupConsumptionData['ventilation'] || 0;
        const whiteAdjustedConsumption = Math.abs(whiteRawConsumption - ventConsumption);

        // Update white outlets with adjusted value
        groupConsumptionData['white-outlets'] = whiteAdjustedConsumption;

        // Recalculate total with adjusted white value
        totalCurrentConsumptionWh = (groupConsumptionData['red-outlets'] || 0) +
            whiteAdjustedConsumption +
            ventConsumption +
            (groupConsumptionData['other'] || 0);

        // Update the UI for white outlets with adjusted value
        const whiteGroupEl = el(`#energy-group-white-outlets`);
        if (whiteGroupEl) {
            const kwhEl = whiteGroupEl.querySelector('.kwh-value');
            const whEl = whiteGroupEl.querySelector('.wh-value');
            if (kwhEl) kwhEl.textContent = `${(whiteAdjustedConsumption / 1000).toFixed(3)} kWh`;
            if (whEl) whEl.textContent = `${whiteAdjustedConsumption} Wh`;
        }

        // Prepare data for updateEnergyChart
        const chartDataForUpdate = {};
        Object.entries(channelGroups).forEach(([groupId, group]) => {
            const consumption = groupConsumptionData[groupId] || 0;
            // Distribute the group consumption among its channels for the chart function to work
            // This is a simplification as we don't have per-channel data here.
            group.channels.forEach((channel, index) => {
                chartDataForUpdate[channel] = {
                    value: (index === 0 ? consumption : 0)
                };
            });
        });

        // After all groups are fetched, update the total display
        const totalEl = el('#energy-total');
        if (totalEl) {
            const totalKWh = (totalCurrentConsumptionWh / 1000).toFixed(3);
            totalEl.innerHTML = `
        <div class="total-consumption">
 <div class="total-label">Total Consumption</div>
 <div class="total-kwh">${totalKWh} kWh</div>
        </div>
      `;
        }

        // Update the doughnut chart with the fetched period data
        updateEnergyChart(channelGroups, chartDataForUpdate);
    };

    fetchAllGroups();
    currentConsumptionInterval = setInterval(() => {
        fetchAllGroups();
    }, 10000); // Update every 10 seconds

    // Add event listener to the input to refetch on change
    const minutesInput = el('#consumption-period-minutes');
    if (minutesInput) {
        minutesInput.addEventListener('change', fetchAndUpdateCurrentConsumption);
    }
}

// ==================================
// ===== Real-time Chart System =====
// ==================================

let realtimeCharts = {
    main: null,
    secondary: null,
    laiMax: null,
    humidity: null,
    light: null,
    occupancy: null,
    illuminance: null,
    distance: null,
    motion: null,
    rssi: null,
    snr: null,
    battery: null
};

// Data stores for the real-time charts
let chartData = {
    main: {
        labels: [],
        data: []
    },
    secondary: {
        labels: [],
        data: []
    },
    laiMax: {
        labels: [],
        data: []
    },
    humidity: {
        labels: [],
        data: []
    },
    light: {
        labels: [],
        data: []
    },
    occupancy: {
        labels: [],
        data: []
    },
    illuminance: {
        labels: [],
        data: []
    },
    distance: {
        labels: [],
        data: []
    },
    motion: {
        labels: [],
        data: []
    },
    rssi: {
        labels: [],
        data: []
    },
    snr: {
        labels: [],
        data: []
    },
    battery: {
        labels: [],
        data: []
    },
    // Pour ENERGY/CONSO - 3 datasets
    powerUsage: {
        labels: [],
        red: [],
        white: [],
        ventilation: []
    }
};

// Specific update function for the power usage chart (ENERGY/CONSO sensors)
function updatePowerUsageChart(timestamp, values) {
    if (chartsPaused || !realtimeCharts.secondary) return;

    const data = chartData.powerUsage;
    data.labels.push(timestamp);
    data.red.push(values.red);
    data.white.push(values.white);
    data.ventilation.push(values.ventilation);

    // Limiter le nombre de points
    if (data.labels.length > MAX_CHART_POINTS) {
        data.labels.shift();
        data.red.shift();
        data.white.shift();
        data.ventilation.shift();
    }

    realtimeCharts.secondary.data.labels = data.labels;
    realtimeCharts.secondary.data.datasets[0].data = data.red;
    realtimeCharts.secondary.data.datasets[1].data = data.white;
    realtimeCharts.secondary.data.datasets[2].data = data.ventilation;
    realtimeCharts.secondary.update('none');
}

// State for pausing/resuming charts
let chartsPaused = false;
const MAX_CHART_POINTS = 50;

// Initializes all real-time charts based on sensor type
function initRealtimeCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded, skipping chart initialization');
        return;
    }
    const devType = (document.documentElement.dataset.devType || '').toUpperCase();

    const chartConfigs = {
        'CO2': {
            main: {
                label: 'CO₂',
                color: '#ef4444',
                title: '🌬️ CO₂ Level',
                unit: 'ppm'
            },
            secondary: {
                label: 'Temperature',
                color: '#f59e0b',
                title: '🌡️ Temperature',
                unit: '°C'
            },
            humidity: {
                label: 'Humidity',
                color: '#10b981',
                title: '💧 Humidity',
                unit: '%'
            },
            light: {
                label: 'Light',
                color: '#fbbf24',
                title: '💡 Light Level',
                unit: 'lux'
            }
        },
        'TEMPEX': {
            main: {
                label: 'Temperature',
                color: '#f59e0b',
                title: '🌡️ Temperature',
                unit: '°C'
            },
            secondary: {
                label: 'Humidity',
                color: '#3b82f6',
                title: '💧 Humidity',
                unit: '%'
            },
            // humidity: { label: 'Humidity', color: '#10b981', title: '💧 Humidity', unit: '%' }
        },
        'DESK': {
            main: {
                label: 'Occupancy',
                color: '#10b981',
                title: '👤 Occupancy',
                unit: 'Status'
            },
            secondary: {
                label: 'Temperature',
                color: '#f59e0b',
                title: '🌡️ Temperature',
                unit: '°C'
            },
            humidity: {
                label: 'Humidity',
                color: '#10b981',
                title: '💧 Humidity',
                unit: '%'
            }
        },
        'EYE': {
            main: {
                label: 'Temperature',
                color: '#f59e0b',
                title: '🌡️ Temperature',
                unit: '°C'
            },
            secondary: {
                label: 'Humidity',
                color: '#3b82f6',
                title: '💧 Humidity',
                unit: '%'
            },
            light: {
                label: 'Light',
                color: '#fbbf24',
                title: '💡 Light Level',
                unit: 'lux'
            },
            motion: {
                label: 'Motion',
                color: '#ec4899',
                title: '🏃 Motion',
                unit: 'MotionStatus'
            },
            occupancy: {
                label: 'Occupancy',
                color: '#10b981',
                title: '👤 Occupancy',
                unit: 'Status'
            },
        },
        'OCCUP': {
            main: {
                label: 'Occupancy',
                color: '#10b981',
                title: '👤 Occupancy',
                unit: 'Status'
            },
            illuminance: {
                label: 'Illuminance',
                color: '#fbbf24',
                title: '💡 Illuminance',
                unit: 'IlluminanceStatus'
            },
            distance: {
                label: 'Distance',
                color: '#a855f7',
                title: '📏 Distance',
                unit: 'mm'
            }
        },
        'PIR_LIGHT': {
            main: {
                label: 'Presence',
                color: '#10b981',
                title: '👤 Motion Detection',
                unit: 'Status'
            },
            secondary: {
                label: 'Daylight',
                color: '#fbbf24',
                title: '☀️ Daylight Level',
                unit: 'DaylightLevel'
            }
        },
        'SON': {
            main: {
                label: 'LAeq',
                color: '#8b5cf6',
                title: '🔊 Sound Level',
                unit: 'dB'
            },
            secondary: {
                label: 'LAI',
                color: '#ec4899',
                title: '📢 Sound Impact',
                unit: 'dB'
            },
            laiMax: {
                label: 'LAImax',
                color: '#9333ea',
                title: '💥 Max Sound Impact',
                unit: 'dB'
            }
        },
        'COUNT': {
            main: {
                label: 'In',
                color: '#10b981',
                title: '📥 Number of Employees In',
                unit: 'Persons'
            },
            secondary: {
                label: 'Out',
                color: '#ef4444',
                title: '📤 Number of Employees Out',
                unit: 'Persons'
            }
        },
        'ENERGY': {
            main: {
                label: 'Consumption',
                color: '#f59e0b',
                title: '⚡ Energy Consumption',
                unit: 'kWh'
            },
            secondary: {
                label: 'Consumption by Group',
                color: '#ef4444',
                title: '🔌 Consumption by Group',
                unit: 'kWh'
            }
        },
        'CONSO': {
            main: {
                label: 'Consumption',
                color: '#f59e0b',
                title: '⚡ Energy Consumption',
                unit: 'kWh'
            },
            secondary: {
                label: 'Consumption by Group',
                color: '#ef4444',
                title: '🔌 Consumption by Group',
                unit: 'kWh'
            }
        }
    };

    const config = chartConfigs[devType] || {
        main: {
            label: 'Metric A',
            color: '#6366f1',
            title: '📊 Primary Metric'
        },
        secondary: {
            label: 'Metric B',
            color: '#8b5cf6',
            title: '📈 Secondary Metric'
        }
    };

    const mainTitle = el('#realtime-chart-title');
    const secondaryTitle = el('#realtime-chart-secondary-title');
    if (mainTitle) mainTitle.textContent = config.main.title;
    if (secondaryTitle && config.secondary) {
        secondaryTitle.textContent = config.secondary.title;
    } else {
        console.warn('Secondary chart config or title element not found.');
    }

    const mainCtx = el('#realtime-chart-main')?.getContext('2d');
    const secondaryCtx = el('#realtime-chart-secondary')?.getContext('2d');
    const laiMaxCtx = el('#realtime-chart-laimax')?.getContext('2d');
    const humidityCtx = el('#realtime-chart-humidity')?.getContext('2d');
    const lightCtx = el('#realtime-chart-light')?.getContext('2d');
    const occupancyCtx = el('#realtime-chart-occupancy')?.getContext('2d');
    const illuminanceCtx = el('#realtime-chart-illuminance')?.getContext('2d');
    const distanceCtx = el('#realtime-chart-distance')?.getContext('2d');
    const motionCtx = el('#realtime-chart-motion')?.getContext('2d');
    const rssiCtx = el('#realtime-chart-rssi')?.getContext('2d');
    const snrCtx = el('#realtime-chart-snr')?.getContext('2d');

    if (mainCtx) {
        realtimeCharts.main = new Chart(mainCtx, createChartConfig(config.main.label, config.main.color, config.main.unit || ''));
    }

    if (secondaryCtx) {
        if (devType === 'ENERGY' || devType === 'CONSO') {
            realtimeCharts.secondary = new Chart(secondaryCtx, createEnergyPowerUsageChartConfig());
        } else if (devType === 'OCCUP') {
            // For OCCUP sensors (like VS41), we only want the main occupancy chart.
            // The illuminance/distance charts are handled separately and shown based on payload.
            const secondaryContainer = el('#secondary-chart-container');
            if (secondaryContainer) secondaryContainer.style.display = 'none';
        } else {
            realtimeCharts.secondary = new Chart(secondaryCtx, createChartConfig(config.secondary.label, config.secondary.color, config.secondary.unit || ''));
        }
    }

    if (config.laiMax && laiMaxCtx) {
        const laiMaxContainer = el('#laimax-chart-container');
        if (laiMaxContainer) {
            laiMaxContainer.style.display = 'block';
            el('#realtime-chart-laimax-title').textContent = config.laiMax.title;
        }
        realtimeCharts.laiMax = new Chart(laiMaxCtx, createChartConfig(config.laiMax.label, config.laiMax.color, config.laiMax.unit || ''));
    }

    if (config.humidity && humidityCtx) {
        const humidityContainer = el('#humidity-chart-container');
        if (humidityContainer) {
            humidityContainer.style.display = 'block';
        }
        realtimeCharts.humidity = new Chart(humidityCtx, createChartConfig(config.humidity.label, config.humidity.color, config.humidity.unit || ''));
    }

    if (config.light && lightCtx) {
        const lightContainer = el('#light-chart-container');
        if (lightContainer) {
            lightContainer.style.display = 'block';
        }
        realtimeCharts.light = new Chart(lightCtx, createChartConfig(config.light.label, config.light.color, config.light.unit || ''));
    }

    if (config.occupancy && occupancyCtx) {
        const occupancyContainer = el('#occupancy-chart-container');
        if (occupancyContainer) {
            occupancyContainer.style.display = 'block';
        }
        realtimeCharts.occupancy = new Chart(occupancyCtx, createChartConfig(config.occupancy.label, config.occupancy.color, config.occupancy.unit || ''));
    }

    if (config.illuminance && illuminanceCtx) {
        const illuminanceContainer = el('#illuminance-chart-container');
        if (illuminanceContainer) {
            illuminanceContainer.style.display = 'block';
        }
        realtimeCharts.illuminance = new Chart(illuminanceCtx, createChartConfig(config.illuminance.label, config.illuminance.color, config.illuminance.unit || ''));
    }

    if (config.distance && distanceCtx) {
        const distanceContainer = el('#distance-chart-container');
        if (distanceContainer) {
            distanceContainer.style.display = 'block';
        }
        realtimeCharts.distance = new Chart(distanceCtx, createChartConfig(config.distance.label, config.distance.color, config.distance.unit || ''));
    }

    if (config.motion && motionCtx) {
        const motionContainer = el('#motion-chart-container');
        if (motionContainer) {
            motionContainer.style.display = 'block';
        }
        realtimeCharts.motion = new Chart(motionCtx, createChartConfig(config.motion.label, config.motion.color, config.motion.unit || ''));
    }

    if (rssiCtx) {
        realtimeCharts.rssi = new Chart(rssiCtx, createChartConfig('RSSI (dBm)', '#ef4444', 'dBm'));
    }

    if (snrCtx) {
        realtimeCharts.snr = new Chart(snrCtx, createChartConfig('SNR (dB)', '#3b82f6', 'dB'));
    }

    const pauseBtn = el('#chart-pause');
    const clearBtn = el('#chart-clear');

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            chartsPaused = !chartsPaused;
            pauseBtn.textContent = chartsPaused ? '▶️ Resume' : '⏸️ Pause';
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllCharts);
    }
}

// Creates a configuration for the multi-dataset energy power usage chart
function createEnergyPowerUsageChartConfig() {
    const currentDate = new Date().toLocaleDateString('en-CA');

    return {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                    label: 'Red (kW)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'White (kW)',
                    data: [],
                    borderColor: '#64748b',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'Ventilation (kW)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }
            ]
        },
        options: getChartOptionsWithUnits('Power by Group (kW)', 'kW', currentDate)
    };
}

function numOrNull(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
}

/**
 * Valeur absolue UNIQUEMENT si type == "power"
 * (on ne touche pas aux index Wh)
 */
function absIfPower(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    if (String(entry.type).toLowerCase() !== 'power') return entry;

    const v = numOrNull(entry.value);
    if (v == null) return entry;

    // clone léger pour éviter des effets de bord
    return {
        ...entry,
        value: Math.abs(v)
    };
}

// Generic factory function for creating a line chart configuration
function createChartConfig(label, color, yAxisUnit = '', currentDate) {
    if (!currentDate) currentDate = new Date().toLocaleDateString('en-CA');
    let yAxisLabel = label;
    const hideUnits = [
        "IlluminanceStatus",
        "Level",
        "Status",
        "LightStatus",
        "MotionStatus",
        "DaylightLevel",
        "Persons"
    ]

    if (yAxisUnit && !hideUnits.includes(yAxisUnit) && !label.includes(`(${yAxisUnit})`)) {
        yAxisLabel += ' (' + yAxisUnit + ')';
    }

    return {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: color,
                pointBorderColor: color,
                pointBorderWidth: 2
            }]
        },
        options: getChartOptionsWithUnits(yAxisLabel, yAxisUnit, currentDate)
    };
}

// Generates Chart.js options with customized axes based on the unit of measurement
function getChartOptionsWithUnits(yAxisLabel = '', yAxisUnit = '', currentDate = '') {
    let yAxisConfig = {
        display: true,
        title: {
            display: true,
            text: yAxisLabel,
            font: {
                size: 14,
                weight: 'bold'
            }
        },
        grid: {
            color: 'rgba(0,0,0,0.1)',
            drawBorder: false
        },
        ticks: {
            maxTicksLimit: 6,
            font: {
                size: 11
            }
        }
    };

    switch (yAxisUnit) {
        case 'ppm': // CO2
            yAxisConfig.suggestedMin = 0;
            yAxisConfig.suggestedMax = 2000;
            break;

        case 'kW':
            yAxisConfig.beginAtZero = true;
            yAxisConfig.grace = '10%';
            break;

        case '°C': // Température
            yAxisConfig.suggestedMin = 15;
            yAxisConfig.suggestedMax = 30;
            break;
        case '%': // Humidité ou Batterie
            yAxisConfig.min = 0;
            yAxisConfig.max = 100;
            break;
        case 'dBm': // RSSI
            yAxisConfig.suggestedMin = -120;
            yAxisConfig.suggestedMax = -30;
            break;
        case 'dB': // SNR ou Sound
            if (yAxisLabel.includes('Sound') || yAxisLabel.includes('LAeq') || yAxisLabel.includes('LAI')) {
                yAxisConfig.suggestedMin = 0;
                yAxisConfig.suggestedMax = 100;
            } else {
                yAxisConfig.suggestedMin = -10;
                yAxisConfig.suggestedMax = 15;
            }
            break;
        case 'lux': // Lumière
            yAxisConfig.suggestedMin = 0;
            yAxisConfig.suggestedMax = 1000;
            break;
        case 'kWh': // Énergie
            yAxisConfig.beginAtZero = true;
            yAxisConfig.grace = '10%'; // Ajoute 10% d'espace au-dessus de la valeur max
            break;
        case 'W': // Puissance
            yAxisConfig.beginAtZero = true;
            yAxisConfig.grace = '10%';
            break;
        case 'Status': // Présence/Occupancy (0 ou 1)
            yAxisConfig.min = 0;
            yAxisConfig.max = 1;
            yAxisConfig.ticks = {
                ...yAxisConfig.ticks,
                stepSize: 1,
                callback: function(value) {
                    return value === 1 ? 'Occupied' : (value === 0 ? 'Free' : '');
                }
            };
            break;
        case 'MotionStatus':
            yAxisConfig.min = 0;
            yAxisConfig.beginAtZero = false;
            yAxisConfig.ticks.stepSize = 1; // Ensure integer values on the axis
            break;
        case 'DaylightLevel': // "dim" or "bright"
            yAxisConfig.min = 0;
            yAxisConfig.max = 2;
            yAxisConfig.ticks = {
                ...yAxisConfig.ticks,
                callback: function(value) {
                    return {
                        dim: 'Dim',
                        bright: 'Bright'
                    } [value] ?? '';
                }
            }
        case 'IlluminanceStatus': // For Illuminance status on OCCUP sensors
            yAxisConfig.min = 0;
            yAxisConfig.max = 2;
            yAxisConfig.ticks = {
                ...yAxisConfig.ticks,
                stepSize: 1,
                callback: function(value) {
                    return {
                        0: 'Disable',
                        1: 'Dim',
                        2: 'Bright'
                    } [value] ?? '';
                }
            };
            break;
        case 's': // Seconds
            yAxisConfig.beginAtZero = true;
            yAxisConfig.grace = '10%';
            break;
        case 'persons': // Staff count for COUNT sensors
            yAxisConfig.beginAtZero = true;
            yAxisConfig.grace = '10%';
            yAxisConfig.ticks.stepSize = 1; // Ensure integer values on the axis
            break;
        case 'mm': // Millimètres (Distance OCCUP)
            yAxisConfig.beginAtZero = true;
            yAxisConfig.grace = '10%';
            break;
        default:
            yAxisConfig.beginAtZero = false;
    }

    return {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        layout: {
            padding: {
                right: 15 // Espace supplémentaire à droite pour les valeurs de l'axe Y
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: currentDate,
                position: 'top',
                align: 'end',
                font: {
                    size: 12,
                    weight: 'normal'
                },
                color: '#666',
                padding: {
                    bottom: 10
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y;
                            if (yAxisUnit) {
                                label += ' ' + yAxisUnit;
                            }
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Time',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0,0,0,0.1)',
                    drawBorder: false
                },
                ticks: {
                    maxTicksLimit: 8,
                    font: {
                        size: 11
                    }
                }
            },
            y: yAxisConfig
        },
        animation: {
            duration: 0
        },
        elements: {
            point: {
                radius: 2,
                hoverRadius: 4
            },
            line: {
                tension: 0.3
            }
        }
    };
}

// Fallback for chart options when no units are specified
function getChartOptions() {
    return getChartOptionsWithUnits('', '', '');
}

// Main dispatcher for updating real-time charts with new data from SSE
function updateRealtimeCharts(data) {
    if (chartsPaused) return;

    const timestamp = new Date().toLocaleTimeString();
    const devType = (document.documentElement.dataset.devType || '').toUpperCase();

    function getBatteryLevel(data) {
        // Priorité 1: battery (%) direct
        if (typeof data['battery (%)'] === 'number') {
            return data['battery (%)'];
        }
        // Priorité 2: conversion VDD → Battery %
        if (typeof data['vdd (mV)'] === 'number') {
            const battPct = vddToBatteryPercent(data['vdd (mV)']);
            if (battPct != null) return battPct;
        }
        // Priorité 3: conversion VDD (V) → Battery %
        if (typeof data['vdd (v)'] === 'number') {
            const vddMv = Math.round(data['vdd (v)'] * 1000);
            const battPct = vddToBatteryPercent(vddMv);
            if (battPct != null) return battPct;
        }
        return 0; // Valeur par défaut
    }

    switch (devType) {
        case 'CO2':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data['co2 (ppm)']);
            updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['temperature (°C)']);
            updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, data['humidity (%)']);
            updateChart(realtimeCharts.light, chartData.light, timestamp, data.light);
            break;
        case 'TEMPEX':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data['temperature (°C)']);
            updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['humidity (%)']);
            // updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, data['humidity (%)']);
            break;
        case 'DESK':
            const temp = data['temperature (°C)'];
            const hum = data['humidity (%)'];
            // Hide charts if data is not present (for models like VS41)
            // TODO: check if hiding works
            el('#secondary-chart-container').style.display = (temp != null) ? 'block' : 'none';
            el('#humidity-chart-container').style.display = (hum != null) ? 'block' : 'none';

            updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
            if (temp != null) updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, temp);
            if (hum != null) updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, hum);
            break;
        case 'EYE':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data['temperature (°C)']);
            updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['humidity (%)']);
            updateChart(realtimeCharts.light, chartData.light, timestamp, data.light);
            updateChart(realtimeCharts.motion, chartData.motion, timestamp, data.motion);
            updateChart(realtimeCharts.occupancy, chartData.occupancy, timestamp, data.occupancy ? 1 : 0);
            break;
        case 'OCCUP':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
            // VS30 (distance) vs VS70 (illuminance)
            if (data.distance != null && typeof data.distance === 'number') {
                // This is a VS30 sensor, show distance chart and hide illuminance chart
                el('#distance-chart-container').style.display = 'block';
                el('#illuminance-chart-container').style.display = 'none';
                updateChart(realtimeCharts.distance, chartData.distance, timestamp, data.distance);
            }
            if (data.light != null) {
                // This is a VS70 sensor, show illuminance chart and hide distance chart
                el('#illuminance-chart-container').style.display = 'block';
                el('#distance-chart-container').style.display = 'none';
                const illuminanceStatus = (data.light || 'disable').toLowerCase();
                let numericValue = 0; // Default for 'disable' or unknown
                if (illuminanceStatus === 'dim') numericValue = 1;
                else if (illuminanceStatus === 'bright') numericValue = 2;
                updateChart(realtimeCharts.illuminance, chartData.illuminance, timestamp, numericValue);
            }
            break;
        case 'PIR_LIGHT':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
            updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data.light || 0);
            break;
        case 'SON':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data['LAeq (dB)']);
            updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['LAI (dB)']);
            updateChart(realtimeCharts.laiMax, chartData.laiMax, timestamp, data['LAImax (dB)']);
            break;
        case 'COUNT':
            updateChart(realtimeCharts.main, chartData.main, timestamp, data['period_in']);
            updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['period_out']);
            break;
        case 'ENERGY':
        case 'CONSO': {
            // Live POWER en kW, basé sur channelPowerData alimenté par updateEnergyConsumption()
            const sumW = (chs) => chs.reduce((s, ch) => s + (Number(channelPowerData[ch]) || 0), 0);

            const redW = Math.abs(sumW([0, 1, 2]));
            const ventW = Math.abs(sumW([6, 7, 8]));
            const whiteW = Math.abs(ventW - sumW([3, 4, 5]));
            const otherW = Math.abs(sumW([9, 10, 11]));


            const totalKw = (redW + whiteW + ventW + otherW) / 1000;

            updateChart(realtimeCharts.main, chartData.main, timestamp, totalKw);

            updatePowerUsageChart(timestamp, {
                red: redW / 1000,
                white: whiteW / 1000,
                ventilation: ventW / 1000
            });

            break;
        }
    }

}

// Generic function to update a single chart instance
function updateChart(chart, dataStore, timestamp, value) {
    if (!chart || value == null || isNaN(value)) return;

    dataStore.labels.push(timestamp);
    dataStore.data.push(Number(value));

    if (dataStore.labels.length > MAX_CHART_POINTS) {
        dataStore.labels.shift();
        dataStore.data.shift();
    }

    chart.data.labels = dataStore.labels;
    chart.data.datasets[0].data = dataStore.data;
    chart.update('none');
}

// Updates the signal quality (RSSI/SNR) charts
function updateSignalChart(rssi, snr) {
    if (chartsPaused) return;

    const timestamp = new Date().toLocaleTimeString();

    if (realtimeCharts.rssi) {
        updateChart(realtimeCharts.rssi, chartData.rssi, timestamp, rssi);
    }

    if (realtimeCharts.snr) {
        updateChart(realtimeCharts.snr, chartData.snr, timestamp, snr);
    }
}

// Updates the battery chart
function updateBatteryChart(batteryPct) {
    if (chartsPaused || !realtimeCharts.battery) return;

    const timestamp = new Date().toLocaleTimeString();

    chartData.battery.labels.push(timestamp);
    chartData.battery.data.push(batteryPct);

    if (chartData.battery.labels.length > MAX_CHART_POINTS) {
        chartData.battery.labels.shift();
        chartData.battery.data.shift();
    }

    realtimeCharts.battery.data.labels = [...chartData.battery.labels];
    realtimeCharts.battery.data.datasets[0].data = [...chartData.battery.data];
    realtimeCharts.battery.update('none');

    const batteryStatus = el('#battery-status');
    if (batteryStatus) {
        batteryStatus.textContent = `${Math.round(batteryPct)}%`;
        batteryStatus.className = 'battery-status';
        if (batteryPct >= 60) batteryStatus.classList.add('good');
        else if (batteryPct >= 30) batteryStatus.classList.add('warning');
        else batteryStatus.classList.add('critical');
    }
}

function initEnergyPlaceholders() {
    ['red-outlets', 'white-outlets', 'ventilation', 'other'].forEach(id => {
        const groupEl = el(`#energy-group-${id}`);
        if (!groupEl) return;
        const wEl = groupEl.querySelector('.wh-value');
        const kwEl = groupEl.querySelector('.kwh-value');
        if (wEl) wEl.textContent = `-- W`;
        if (kwEl) kwEl.textContent = `-- kW`;
    });

    const totalEl = el('#energy-total');
    if (totalEl) {
        totalEl.innerHTML = `
      <div class="total-consumption">
        <div class="total-label">Total Power</div>
        <div class="total-kwh">-- kW</div>
        <div class="total-wh">-- W</div>
      </div>
    `;
    }
}


// Clears all data from real-time charts
function clearAllCharts() {
    chartData = {
        main: {
            labels: [],
            data: []
        },
        secondary: {
            labels: [],
            data: []
        },
        laiMax: {
            labels: [],
            data: []
        },
        humidity: {
            labels: [],
            data: []
        },
        light: {
            labels: [],
            data: []
        },
        occupancy: {
            labels: [],
            data: []
        },
        illuminance: {
            labels: [],
            data: []
        },
        distance: {
            labels: [],
            data: []
        },
        motion: {
            labels: [],
            data: []
        },
        rssi: {
            labels: [],
            data: []
        },
        snr: {
            labels: [],
            data: []
        },
        battery: {
            labels: [],
            data: []
        },
        powerUsage: {
            labels: [],
            red: [],
            white: [],
            ventilation: []
        }
    };

    Object.values(realtimeCharts).forEach(chart => {
        if (chart) {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        }
    });
}

// =================================
// ===== Initialization on Boot =====
// =================================

// Main entry point when the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    if (LIVE_MODE) startSSE();

    if (window.Chart) {
        initRealtimeCharts();

        // For energy sensors, fetch the initial consumption data on load
        const devType = (document.documentElement.dataset.devType || '').toUpperCase();
        if (devType === 'ENERGY' || devType === 'CONSO') {

            initEnergyPlaceholders();
        }

    }
});