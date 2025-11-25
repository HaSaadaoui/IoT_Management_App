// ===== Helpers =====
const el = (sel) => document.querySelector(sel);
const setText = (selector, value) => {
  const target = typeof selector === 'string' ? el(selector) : selector;
  if (target) target.textContent = (value == null ? "--" : String(value));
};

// --- Battery helper (icône + couleur)
function updateBatteryBadge(selector, pct) {
  const node = typeof selector === 'string' ? el(selector) : selector;
  if (!node) return;
  node.classList.remove('battery--good','battery--warn','battery--low','battery--crit','battery--unk');

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
  node.classList.remove('co2--good','co2--warn','co2--danger');

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
  node.classList.remove('temp--cold','temp--normal','temp--warm','temp--hot');

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
  node.classList.remove('humidity--low','humidity--normal','humidity--high','humidity--veryhigh');

  if (humidity == null || Number.isNaN(Number(humidity))) {
    node.classList.add('humidity--normal');
    node.textContent = '-- %';
    return;
  }
  const h = Math.round(Number(humidity));
  let cls = 'humidity--normal';
  if (h < 30) cls = 'humidity--low';        // Trop sec
  else if (h > 70) cls = 'humidity--veryhigh'; // Trop humide
  else if (h > 60) cls = 'humidity--high';     // Un peu humide

  node.classList.add(cls);
  node.textContent = h + ' %';
}

// ===== Leaflet (optionnel) =====
const mapEl = document.getElementById('map');
let map = null, sensorMarker = null;
if (mapEl && window.L) {
  map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  sensorMarker = L.marker([0, 0]).addTo(map);
}

// Badges optionnels (anciens emplacements éventuels)
const statusBadge   = el("#sensor-status");
const batteryBadge  = el("#battery-badge"); // si présent ailleurs dans le layout
const lastSeenEl    = el("#last-seen");
const appIdEl       = el("#s-app");
const uplinkCountEl = el("#uplink-count");
const rssiNowEl     = el("#rssi-now");
const snrNowEl      = el("#snr-now");
const locEl         = el("#sensor-location");
const uplinksTbody  = el("#uplinks-tbody");

// Live-data COUNT
const sCountBatt = el("#s-count-batt");
const sCountIn   = el("#s-count-in");
const sCountOut  = el("#s-count-out");
const sGenBatt   = el("#s-gen-batt");

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
    "VDD",
    "LIGHT",
    "MOTION",
  ],
  "OCCUP": [
    "BATTERY",
    "OCCUPANCY",
    "DISTANCE",
    // "LIGHT",
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
    "VDD",
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
    "VDD",
  ],
  // "CONSO": [
  //   "CONSUMPTION_CHANNEL_0",
  //   "CONSUMPTION_CHANNEL_1",
  //   "CONSUMPTION_CHANNEL_2",
  //   "CONSUMPTION_CHANNEL_3",
  //   "CONSUMPTION_CHANNEL_4",
  //   "CONSUMPTION_CHANNEL_5",
  //   "CONSUMPTION_CHANNEL_6",
  //   "CONSUMPTION_CHANNEL_7",
  //   "CONSUMPTION_CHANNEL_8",
  //   "CONSUMPTION_CHANNEL_9",
  //   "CONSUMPTION_CHANNEL_10",
  //   "CONSUMPTION_CHANNEL_11",
  // ],
  // "ENERGY": [
  //   "LAST_BATTERY_PERCENTAGE",
  //   "CONSUMPTION_CHANNEL_0",
  //   "CONSUMPTION_CHANNEL_1",
  //   "CONSUMPTION_CHANNEL_2",
  //   "CONSUMPTION_CHANNEL_3",
  //   "CONSUMPTION_CHANNEL_4",
  //   "CONSUMPTION_CHANNEL_5",
  //   "CONSUMPTION_CHANNEL_6",
  //   "CONSUMPTION_CHANNEL_7",
  //   "CONSUMPTION_CHANNEL_8",
  //   "CONSUMPTION_CHANNEL_9",
  //   "CONSUMPTION_CHANNEL_10",
  //   "CONSUMPTION_CHANNEL_11",
  // ]
};

// ====== SSE ======
let es = null;
let LIVE_MODE = true;

function startSSE() {
  if (es || !LIVE_MODE) return;

  const html = document.documentElement;
  const SENSOR_ID  = window.SENSOR_ID  || html.dataset.deviceId;
  const SSE_TOKEN  = window.SSE_TOKEN  || html.dataset.sseToken;
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
      const lastSeenHuman = lastSeen ? (() => { try { return new Date(lastSeen).toLocaleString(); } catch { return lastSeen; } })() : null;
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
        if (sCountBatt)   updateBatteryBadge(sCountBatt,   battery);
        if (sGenBatt)     updateBatteryBadge(sGenBatt,     battery);

        const sOccupBatt = el("#s-occup-batt");
        const sPirBatt   = el("#s-pir-batt");
        const sDeskBatt  = el("#s-desk-batt");
        const sSoundBatt = el("#s-sound-batt");
        if (sOccupBatt) updateBatteryBadge(sOccupBatt, battery);
        if (sPirBatt)   updateBatteryBadge(sPirBatt,   battery);
        if (sDeskBatt)  updateBatteryBadge(sDeskBatt,  battery);
        if (sSoundBatt) updateBatteryBadge(sSoundBatt, battery);
        
        // Mise à jour du graphique batterie
        updateBatteryChart(battery);
      }

      // RSSI/SNR
      let rssi = null, snr = null;
      if (isNormalized) {
        const link = data.link || {};
        rssi = (typeof link["rssi (dBm)"] === "number") ? link["rssi (dBm)"] : null;
        snr  = (typeof link["snr (dB)"]   === "number") ? link["snr (dB)"]   : null;
      } else if (data.radio) {
        rssi = Number(data.radio.rssi);
        snr  = Number(data.radio.snr);
      }
      if (rssi != null && !Number.isNaN(rssi)) {
        if (rssiNowEl) setText(rssiNowEl, rssi.toFixed(0));
        const sRssi = el("#s-rssi"); if (sRssi) setText(sRssi, `${rssi.toFixed(0)} dBm`);
      }
      if (snr != null && !Number.isNaN(snr)) {
        if (snrNowEl) setText(snrNowEl, snr.toFixed(1));
        const sSnr = el("#s-snr"); if (sSnr) setText(sSnr, `${snr.toFixed(1)} dB`);
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
        if (el("#s-fcnt")  && data.link.f_cnt  != null) setText("#s-fcnt",  data.link.f_cnt);
        if (el("#s-fport") && data.link.f_port != null) setText("#s-fport", data.link.f_port);
        if (el("#s-rxgw")  && data.link.gateway_id)     setText("#s-rxgw",  data.link.gateway_id);
        // Remplir les badges séparés pour SF / BW / Coding Rate / Frequency
        if (el("#s-sf") && data.link.sf) setText("#s-sf", data.link.sf);
        if (el("#s-bw") && data.link["bw (kHz)"] != null) setText("#s-bw", `${data.link["bw (kHz)"]} kHz`);
        if (el("#s-cr") && data.link.coding_rate) setText("#s-cr", data.link.coding_rate);
        if (el("#s-freq") && data.link["frequency (MHz)"] != null) setText("#s-freq", `${data.link["frequency (MHz)"]} MHz`);
      }

      // COUNT → periods
      if (isNormalized && data.payload) {
        const pin  = data.payload["period_in"];
        const pout = data.payload["period_out"];
        if (sCountIn  && pin  != null) setText(sCountIn,  pin);
        if (sCountOut && pout != null) setText(sCountOut, pout);
      }

      // Localisation
      if (isNormalized && data.link?.location && map && sensorMarker) {
        const loc = data.link.location;
        const lat = (typeof loc.latitude  === "number") ? loc.latitude  : null;
        const lon = (typeof loc.longitude === "number") ? loc.longitude : null;
        if (lat != null && lon != null) {
          sensorMarker.setLatLng([lat, lon]);
          map.setView([lat, lon], 13);
          if (locEl) setText(locEl, `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        }
      } else if (!isNormalized && typeof data.meta?.lat === "number" && typeof data.meta?.lon === "number" && map && sensorMarker) {
        const { lat, lon } = data.meta;
        sensorMarker.setLatLng([lat, lon]);
        map.setView([lat, lon], 13);
        if (locEl) setText(locEl, `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }

      // Tableau uplinks (ancien)
      if (!isNormalized && Array.isArray(data.uplinks) && uplinksTbody) {
        uplinksTbody.innerHTML = "";
        data.uplinks.slice(-20).reverse().forEach(u => {
          const tr = document.createElement("tr");
          const decoded = (u.decoded && typeof u.decoded === "object")
            ? JSON.stringify(u.decoded)
            : (u.payload_hex || "");
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
      const fmt = { batt:v=>`${Math.round(v)} %`, temp:v=>`${v} °C`, hum:v=>`${v} %`, vdd:v=>`${v} mV`, db:v=>`${v} dB` };
      const devTypeFromHtml = (document.documentElement.dataset.devType || '').toUpperCase();
      const PROF = String((isNormalized && data.ids?.profile) ? data.ids.profile : devTypeFromHtml).toUpperCase();
      const p = (isNormalized && data.payload) ? data.payload : {};

      switch (PROF) {
        case 'COUNT':
          if (typeof p['battery'] === 'number' && el('#s-count-batt')) updateBatteryBadge('#s-count-batt', p['battery']);
          if (p['period_in']  != null && el('#s-count-in'))  setText('#s-count-in',  p['period_in']);
          if (p['period_out'] != null && el('#s-count-out')) setText('#s-count-out', p['period_out']);
          break;
        case 'TEMPEX':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-tempex-temp')) updateTempBadge('#s-tempex-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)']     === 'number' && el('#s-tempex-hum'))  updateHumidityBadge('#s-tempex-hum', p['humidity (%)']);
          if (typeof p['battery (%)'] === 'number' && el('#s-tempex-batt')) updateBatteryBadge('#s-tempex-batt', p['battery (%)']);
          break;
        case 'SON':
          if (typeof p['LAeq (dB)']   === 'number' && el('#s-sound-laeq'))   setText('#s-sound-laeq',   fmt.db(p['LAeq (dB)']));
          if (typeof p['LAI (dB)']    === 'number' && el('#s-sound-lai'))    setText('#s-sound-lai',    fmt.db(p['LAI (dB)']));
          if (typeof p['LAImax (dB)'] === 'number' && el('#s-sound-laimax')) setText('#s-sound-laimax', fmt.db(p['LAImax (dB)']));
          if (typeof p['battery (%)'] === 'number' && el('#s-sound-batt'))   updateBatteryBadge('#s-sound-batt', p['battery (%)']);
          break;
        case 'CO2':
          if (typeof p['co2 (ppm)']        === 'number' && el('#s-co2-ppm'))  updateCO2Badge('#s-co2-ppm',  p['co2 (ppm)']);
          if (typeof p['temperature (°C)'] === 'number' && el('#s-co2-temp')) updateTempBadge('#s-co2-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)']     === 'number' && el('#s-co2-hum'))  updateHumidityBadge('#s-co2-hum', p['humidity (%)']);
          // VDD → Battery %
          if (typeof p['vdd (v)']  === 'number') {
            const vddMv = Math.round(p['vdd (v)'] * 1000);
            const battPct = vddToBatteryPercent(vddMv);
            if (battPct != null && el('#s-co2-vdd')) updateBatteryBadge('#s-co2-vdd', battPct);
          } else if (typeof p['vdd (mV)'] === 'number') {
            const battPct = vddToBatteryPercent(p['vdd (mV)']);
            if (battPct != null && el('#s-co2-vdd')) updateBatteryBadge('#s-co2-vdd', battPct);
          }
          if (p.light    != null && el('#s-co2-light'))   setText('#s-co2-light',   p.light);
          if (p.presence != null && el('#s-co2-motion'))  setText('#s-co2-motion',  p.presence);
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
          if (p.light    != null && el('#s-occup-illum'))    setText('#s-occup-illum',    p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-occup-batt')) updateBatteryBadge('#s-occup-batt', p['battery (%)']);
          break;
        case 'EYE':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-eye-temp')) updateTempBadge('#s-eye-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)'] === 'number' && el('#s-eye-hum'))      updateHumidityBadge('#s-eye-hum', p['humidity (%)']);
          if (p.light != null && el('#s-eye-light')) setText('#s-eye-light', p.light);
          if (p.presence != null && el('#s-eye-presence')) setText('#s-eye-presence', p.presence);
          // VDD → Battery %
          if (typeof p['vdd (mV)'] === 'number') {
            const battPct = vddToBatteryPercent(p['vdd (mV)']);
            if (battPct != null && el('#s-eye-vdd')) updateBatteryBadge('#s-eye-vdd', battPct);
          }
          break;
        case 'PIR_LIGHT':
          if (p.presence != null && el('#s-pir-presence')) setText('#s-pir-presence', p.presence);
          if (p.light    != null && el('#s-pir-daylight')) setText('#s-pir-daylight', p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-pir-batt')) updateBatteryBadge('#s-pir-batt', p['battery (%)']);
          break;
        case 'DESK':
          // Occupancy avec code couleur (rouge=occupied, vert=free)
          if (p.presence != null && el('#s-desk-occupancy')) {
            const occNode = el('#s-desk-occupancy');
            occNode.classList.remove('badge--ok', 'badge--occupied');
            if (p.presence === 1 || p.presence === true || p.presence === 'occupied') {
              occNode.classList.add('badge--occupied'); // Rouge pour occupied
              setText('#s-desk-occupancy', 'Occupied');
            } else {
              occNode.classList.add('badge--ok'); // Vert pour free
              setText('#s-desk-occupancy', 'Free');
            }
          }
          if (typeof p['temperature (°C)'] === 'number' && el('#s-desk-temp')) updateTempBadge('#s-desk-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)']     === 'number' && el('#s-desk-hum'))  updateHumidityBadge('#s-desk-hum', p['humidity (%)']);
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

function stopSSE() { if (es) { es.close(); es = null; } }

// ===== Charts Historique =====
const ctx = id => (document.getElementById(id)?.getContext("2d") || null);
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
const networkMetricsContainer = el('#network-metrics-container');
const sensorMetricsContainer = el('#sensor-metrics-container');
const consumptionCharts = {
    'red':   { id: 'histConsumptionRed',   chart: null, channels: [0, 1, 2],  label: 'Red Outlets (kWh)',   color: 'rgb(239, 68, 68, 1)' },
    'white': { id: 'histConsumptionWhite', chart: null, channels: [3, 4, 5],  label: 'White Outlets (kWh)', color: 'rgb(100, 116, 139, 1)' },
    'vent':  { id: 'histConsumptionVent',  chart: null, channels: [6, 7, 8],  label: 'Ventilation (kWh)',   color: 'rgb(59, 130, 246, 1)' },
    'other': { id: 'histConsumptionOther', chart: null, channels: [9, 10, 11], label: 'Other (kWh)',         color: 'rgb(245, 158, 11, 1)' }
};

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
  'PERIOD_IN': 'Staff IN (s)',
  'PERIOD_OUT': 'Staff OUT (s)',
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
    'humidity': '#3b82f6',    // Blue
    'co2': '#ef4444',         // Red
    'vdd': '#10b981',         // Green
    'light': '#fbbf24',       // Amber
    'motion': '#6366f1',      // Indigo
    'presence': '#10b981',    // Green (similar to VDD for status)
    'occupancy': '#10b981',   // Green
    'period_in': '#6366f1',   // Indigo
    'period_out': '#8b5cf6',  // Violet
    'lai': '#ec4899',         // Pink
    'laeq': '#db2777',        // Darker Pink
    'laimax': '#9333ea',      // Purple
    'battery': '#059669',     // Dark Green
    'rssi': '#2563eb',        // Darker Blue
    'snr': '#7c3aed',         // Darker Violet
  };
  return colors[metricName.toLowerCase()] || '#662179'; // Default purple
}

function setSeries(chart, labels, values) {
  if (!chart) return;
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.update();
}

function getLastTimestamp(values) {
  const ts = values[values.length-1]
  const parsed = new Date(ts)
  return parsed.toLocaleDateString("en-CA")
}

async function loadHistory(fromISO, toISO) {
  const SENSOR_ID = document.documentElement.dataset.deviceId;
  const GATEWAY_ID = document.documentElement.dataset.gatewayId;
  const params = new URLSearchParams();
  if (fromISO) params.set('startDate', fromISO);
  if (toISO)   params.set('endDate',   toISO);
  const res = await fetch(`/manage-sensors/monitoring/${encodeURIComponent(GATEWAY_ID)}/${encodeURIComponent(SENSOR_ID)}/history?` + params.toString());
  if (!res.ok) throw new Error("History fetch failed");
  const j = await res.json();

  // Hide sections by default, show them if they have data
  el('#network-quality-section').style.display = 'none';
  el('#sensor-metrics-section').style.display = 'none';

  const getChartData = (metricName) => {
    const metricData = j.data[metricName] || {};
    const labels = Object.keys(metricData).map(t => new Date(t).toLocaleString());
    const values = Object.values(metricData);
    return { labels, values };
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
    // Fetch all data first to find the global max value
    const allGroupData = await Promise.all(
      Object.values(consumptionCharts).map(group =>
        loadChannelHistogramData(group.channels, fromISO, toISO)
      )
    );

    // Find the max kWh value across all datasets
    const globalMaxKWh = allGroupData.reduce((max, groupData) => {
      if (!groupData) return max;
      const currentMax = Math.max(...Object.values(groupData).map(v => v / 1000));
      return Math.max(max, currentMax);
    }, 0);

    // Set a ceiling for the chart, e.g., 10% above the max value
    const yAxisMax = Math.ceil(globalMaxKWh * 1.1);

    // Now, create and update each chart with the shared scale
    Object.values(consumptionCharts).forEach((group, index) => {
      if (!group.chart) {
        const chartCtx = ctx(group.id);
        if (chartCtx) group.chart = mkBarChart(chartCtx, group.label, group.color);
      }
      if (group.chart) {
        const data = allGroupData[index];
        updateChannelHistogram(group.chart, data, yAxisMax);
      }
    });

    el('#consumption-histogram-section').style.display = 'block';
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

      chartConfig.data =  {
        datasets: [{
          data: transformedData,
          borderColor: color,
          backgroundColor: color + "A0",
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
              'day': 'yyyy-MM-dd',      // e.g., "Nov 24, 2025"
              'hour': 'h:mm a',    // e.g., "Nov 24, 1:00 PM"
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

function updateChannelHistogram(chart, data, yAxisMax) {
  if (!chart || !data) return;

  const labels = Object.keys(data).map(d => {
    const date = new Date(d);
    return date.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  });
  const values = Object.values(data).map(v => v / 1000); // Convert Wh to kWh
  const totalKWh = values.reduce((sum, v) => sum + v, 0);

  setSeries(chart, labels, values);

  chart.options.scales.y.max = yAxisMax;
  chart.update();

  // Update the total kWh display in the chart header
  const canvasId = chart.canvas.id; // e.g., "histConsumptionRed"
  const groupKey = canvasId.replace('histConsumption', '').toLowerCase(); // "red"
  const totalEl = document.getElementById(`hist-total-${groupKey}`);
  if (totalEl) {
    totalEl.textContent = totalKWh.toFixed(2);
  }
}

function containsStrings(values) {
  if (!Array.isArray(values)) return false;
  return values.some(v => {
    // try to parse as number, if it fails, return
    return isNaN(Number(v));
  })
}

function generateLabels(values) {
  // Use a Set to automatically handle uniqueness.
  const uniqueLabels = new Set(values.filter(v => typeof v === 'string'));
  // Convert the Set back to an array.
  return Array.from(uniqueLabels);
}

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

// ===== Bascule Live/History =====
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

function updateBatteryBadge(selector, pct) {
  const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!node) return;

  node.classList.remove('battery--good','battery--warn','battery--low','battery--crit','battery--unk');
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


// Events
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => showPane(btn.dataset.pane));
});
document.getElementById('hist-load')?.addEventListener('click', async () => {
  const from = document.getElementById('hist-from')?.value || '';
  const to   = document.getElementById('hist-to')?.value   || '';
  try {
    await loadHistory(from ? new Date(from).toISOString() : '', to ? new Date(to).toISOString() : '');
  } catch (e) {
    console.error(e);
    alert("Impossible de charger l'historique.");
  }
});

// ===== Energy Consumption Functions =====
function updateEnergyConsumption(data) {
  console.log('Energy data received:', data);
  
  // Groupes de canaux selon votre spécification
  const channelGroups = {
    'red-outlets': { channels: [0, 1, 2], name: 'Red Outlets', emoji: '🔴', color: '#ef4444' },
    'white-outlets': { channels: [3, 4, 5], name: 'White Outlets & Lighting', emoji: '⚪', color: '#64748b' },
    'ventilation': { channels: [6, 7, 8], name: 'Ventilation & Heaters', emoji: '🌬️', color: '#3b82f6' },
    'other': { channels: [9, 10, 11], name: 'Other Circuits', emoji: '🔧', color: '#f59e0b' }
  };

  let totalConsumption = 0;
  
  // Mise à jour des canaux individuels
  Object.keys(data).forEach(key => {
    const channelData = data[key];
    if (channelData && typeof channelData === 'object') {
      const channel = channelData.hardwareData?.channel;
      const value = channelData.value || 0;
      const unit = channelData.unit || 'Wh';
      
      // Ajouter au total seulement si c'est un nombre valide
      if (typeof value === 'number' && value > 0) {
        totalConsumption += value;
      }
      
      console.log(`Canal ${channel}: ${value} ${unit}`);
      
      // Mise à jour de l'affichage du canal individuel
      const channelEl = el(`#energy-channel-${channel}`);
      if (channelEl) {
        channelEl.innerHTML = `
          <div class="energy-channel-header">
            <span class="channel-number">Channel ${channel}</span>
            <span class="channel-uuid">${channelData.uuid || ''}</span>
          </div>
          <div class="energy-value">
            <span class="value">${formatEnergyValue(value)}</span>
            <span class="unit">${unit}</span>
          </div>
        `;
      }
    }
  });

  // Mise à jour des groupes
  Object.entries(channelGroups).forEach(([groupId, group]) => {
    let groupTotal = 0;
    group.channels.forEach(channel => {
      // Accès aux données avec la clé string du canal
      const channelData = data[channel.toString()];
      if (channelData && typeof channelData.value === 'number') {
        groupTotal += channelData.value;
      }
    });

    console.log(`Groupe ${groupId} (${group.name}): ${groupTotal} Wh`);

    const groupEl = el(`#energy-group-${groupId}`);
    if (groupEl) {
      const kWh = (groupTotal / 1000).toFixed(2);
      groupEl.innerHTML = `
        <div class="energy-group-header">
          <span class="group-name">${group.emoji} ${group.name}</span>
          <span class="group-channels">Channels ${group.channels.join(', ')}</span>
        </div>
        <div class="energy-group-values">
          <div class="wh-value">${formatEnergyValue(groupTotal)} Wh</div>
          <div class="kwh-value">${kWh} kWh</div>
        </div>
      `;
      groupEl.style.borderLeftColor = group.color;
    }
  });

  // Mise à jour du total général
  console.log(`Total consommation: ${totalConsumption} Wh`);
  
  const totalEl = el('#energy-total');
  if (totalEl) {
    const totalKWh = (totalConsumption / 1000).toFixed(2);
    totalEl.innerHTML = `
      <div class="total-consumption">
        <div class="total-label">Total Consumption</div>
        <div class="total-values">
          <div class="total-kwh">${totalKWh} kWh</div>
        </div>
      </div>
    `;
  }

  // Mise à jour du graphique en temps réel
  updateEnergyChart(channelGroups, data);
}

function formatEnergyValue(value) {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  }
  return value.toLocaleString();
}

// Variable globale pour le graphique doughnut
let energyDoughnutChart = null;

function updateEnergyChart(groups, data) {
  const chartEl = el('#energy-chart');
  if (!chartEl) return;

  // Données pour le graphique doughnut
  const groupData = Object.entries(groups).map(([groupId, group]) => {
    let total = 0;
    group.channels.forEach(channel => {
      const channelData = data[channel];
      if (channelData && channelData.value) {
        total += channelData.value;
      }
    });
    return {
      name: group.name,
      value: total / 1000, // Convertir en kWh
      color: group.color
    };
  });

  // Créer le layout horizontal avec labels à gauche et chart à droite
  if (!chartEl.querySelector('.doughnut-container')) {
    chartEl.innerHTML = `
      <div class="doughnut-container">
        <div class="doughnut-labels">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-secondary);">Consumption by Group</h4>
          <div class="labels-list"></div>
        </div>
        <div class="doughnut-chart">
          <canvas id="energy-doughnut-canvas"></canvas>
        </div>
      </div>
    `;
  }
  
  const canvas = chartEl.querySelector('canvas');
  const labelsList = chartEl.querySelector('.labels-list');

  // Créer ou mettre à jour le graphique doughnut
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
            display: false // Désactiver la légende par défaut
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ${value.toFixed(2)} kWh`;
              }
            }
          }
        }
      }
    });
  } else {
    // Mettre à jour les données existantes
    energyDoughnutChart.data.labels = groupData.map(g => g.name);
    energyDoughnutChart.data.datasets[0].data = groupData.map(g => g.value);
    energyDoughnutChart.data.datasets[0].backgroundColor = groupData.map(g => g.color);
    energyDoughnutChart.update('none');
  }
  
  // Générer les labels personnalisés à gauche
  if (labelsList) {
    labelsList.innerHTML = groupData.map((group) => {
      return `
        <div class="custom-label" style="display: flex; align-items: center; margin-bottom: 0.75rem;">
          <div class="label-color" style="width: 12px; height: 12px; background-color: ${group.color}; border-radius: 50%; margin-right: 0.5rem;"></div>
          <div class="label-text" style="flex: 1; font-size: 0.8rem;">
            <div style="font-weight: 600; color: var(--text-primary);">${group.name}</div>
            <div style="color: var(--text-secondary); font-size: 0.75rem;">${group.value.toFixed(1)} kWh</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ===== Real-time Charts =====
let realtimeCharts = {
  main: null,
  secondary: null,
  humidity: null,
  rssi: null,
  snr: null,
  battery: null
};

let chartData = {
  main: { labels: [], data: [] },
  secondary: { labels: [], data: [] },
  humidity: { labels: [], data: [] },
  rssi: { labels: [], data: [] },
  snr: { labels: [], data: [] },
  battery: { labels: [], data: [] },
  // Pour ENERGY/CONSO - 3 datasets
  powerUsage: {
    labels: [],
    red: [],
    white: [],
    ventilation: []
  }
};

// Fonction pour mettre à jour le graphique Power Usage avec 3 groupes
function updatePowerUsageChart(timestamp, values) {
  if (chartsPaused || !realtimeCharts.secondary) return;
  
  const data = chartData.powerUsage;
  
  // Ajouter les nouvelles valeurs
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
  
  // Mettre à jour le graphique
  realtimeCharts.secondary.data.labels = data.labels;
  realtimeCharts.secondary.data.datasets[0].data = data.red;
  realtimeCharts.secondary.data.datasets[1].data = data.white;
  realtimeCharts.secondary.data.datasets[2].data = data.ventilation;
  realtimeCharts.secondary.update('none');
}

let chartsPaused = false;
const MAX_CHART_POINTS = 50;

function initRealtimeCharts() {
  // Vérifier si Chart.js est disponible
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, skipping chart initialization');
    return;
  }
  
  const devType = (document.documentElement.dataset.devType || '').toUpperCase();
  
  // Configuration des couleurs par type de capteur
  const chartConfigs = {
    'CO2': {
      main: { label: 'CO₂', color: '#ef4444', title: '🌬️ CO₂ Level', unit: 'ppm' },
      secondary: { label: 'Temperature', color: '#f59e0b', title: '🌡️ Temperature', unit: '°C' },
      humidity: { label: 'Humidity', color: '#10b981', title: '💧 Humidity', unit: '%' }
    },
    'TEMPEX': {
      main: { label: 'Temperature', color: '#f59e0b', title: '🌡️ Temperature', unit: '°C' },
      secondary: { label: 'Humidity', color: '#3b82f6', title: '💧 Humidity', unit: '%' },
      humidity: { label: 'Humidity', color: '#10b981', title: '💧 Humidity', unit: '%' }
    },
    'DESK': {
      main: { label: 'Occupancy', color: '#10b981', title: '👤 Desk Occupancy', unit: 'Status' },
      secondary: { label: 'Temperature', color: '#f59e0b', title: '🌡️ Temperature', unit: '°C' },
      humidity: { label: 'Humidity', color: '#10b981', title: '💧 Humidity', unit: '%' }
    },
    'EYE': {
      main: { label: 'Temperature', color: '#f59e0b', title: '🌡️ Temperature', unit: '°C' },
      secondary: { label: 'Humidity', color: '#3b82f6', title: '💧 Humidity', unit: '%' },
      humidity: { label: 'Humidity', color: '#10b981', title: '💧 Humidity', unit: '%' }
    },
    'OCCUP': {
      main: { label: 'Occupancy', color: '#10b981', title: '👤 Occupancy Status', unit: 'Status' },
      secondary: { label: 'Distance', color: '#fbbf24', title: '📏 Distance', unit: 'mm' }
    },
    'PIR_LIGHT': {
      main: { label: 'Presence', color: '#10b981', title: '👤 Motion Detection', unit: 'Status' },
      secondary: { label: 'Daylight', color: '#fbbf24', title: '☀️ Daylight Level', unit: 'Level' }
    },
    'SON': {
      main: { label: 'Sound Level', color: '#8b5cf6', title: '🔊 Sound Level', unit: 'dB' },
      secondary: { label: 'Sound Impact', color: '#ec4899', title: '📢 Sound Impact', unit: 'dB' }
    },
    'COUNT': {
      main: { label: 'Staff IN', color: '#10b981', title: '📥 Staff IN', unit: 's' },
      secondary: { label: 'Staff OUT', color: '#ef4444', title: '📤 Staff OUT', unit: 's' }
    },
    'ENERGY': {
      main: { label: 'Consumption', color: '#f59e0b', title: '⚡ Energy Consumption', unit: 'kWh' },
      secondary: { label: 'Consumption by Group', color: '#ef4444', title: '🔌 Consumption by Group', unit: 'kWh' }
    },
    'CONSO': {
      main: { label: 'Consumption', color: '#f59e0b', title: '⚡ Energy Consumption', unit: 'kWh' },
      secondary: { label: 'Consumption by Group', color: '#ef4444', title: '🔌 Consumption by Group', unit: 'kWh' }
    }
  };

  const config = chartConfigs[devType] || {
    main: { label: 'Metric A', color: '#6366f1', title: '📊 Primary Metric' },
    secondary: { label: 'Metric B', color: '#8b5cf6', title: '📈 Secondary Metric' }
  };

  // Mise à jour des titres
  const mainTitle = el('#realtime-chart-title');
  const secondaryTitle = el('#realtime-chart-secondary-title');
  if (mainTitle) mainTitle.textContent = config.main.title;
  if (secondaryTitle) secondaryTitle.textContent = config.secondary.title;

  // Création des graphiques
  const mainCtx = el('#realtime-chart-main')?.getContext('2d');
  const secondaryCtx = el('#realtime-chart-secondary')?.getContext('2d');
  const humidityCtx = el('#realtime-chart-humidity')?.getContext('2d');
  const rssiCtx = el('#realtime-chart-rssi')?.getContext('2d');
  const snrCtx = el('#realtime-chart-snr')?.getContext('2d');

  if (mainCtx) {
    realtimeCharts.main = new Chart(mainCtx, createChartConfig(config.main.label, config.main.color, config.main.unit || ''));
  }
  
  if (secondaryCtx) {
    // Pour ENERGY/CONSO, créer un graphique avec 3 datasets
    if (devType === 'ENERGY' || devType === 'CONSO') {
      realtimeCharts.secondary = new Chart(secondaryCtx, createEnergyPowerUsageChartConfig());
    } else {
      realtimeCharts.secondary = new Chart(secondaryCtx, createChartConfig(config.secondary.label, config.secondary.color, config.secondary.unit || ''));
    }
  }
  
  // Show and initialize humidity chart for sensors with humidity data
  if (config.humidity && humidityCtx) {
    const humidityContainer = el('#humidity-chart-container');
    if (humidityContainer) {
      humidityContainer.style.display = 'block';
    }
    realtimeCharts.humidity = new Chart(humidityCtx, createChartConfig(config.humidity.label, config.humidity.color, config.humidity.unit || ''));
  }
  
  if (rssiCtx) {
    realtimeCharts.rssi = new Chart(rssiCtx, createChartConfig('RSSI (dBm)', '#ef4444', 'dBm'));
  }
  
  if (snrCtx) {
    realtimeCharts.snr = new Chart(snrCtx, createChartConfig('SNR (dB)', '#3b82f6', 'dB'));
  }
  

  // Event listeners pour les contrôles
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

function createEnergyPowerUsageChartConfig() {
  const currentDate = new Date().toLocaleDateString('en-CA');
  
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Red Outlets',
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
          label: 'White Outlets & Lighting',
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
          label: 'Ventilation & Heaters',
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
    options: getChartOptionsWithUnits('Consumption by Group', 'kWh', currentDate)
  };
}

function createChartConfig(label, color, yAxisUnit = '', currentDate) {
  if (!currentDate) currentDate = new Date().toLocaleDateString('en-CA'); // Format: 2025-11-13
  
  // Create Y-axis label with metric name and unit
  let yAxisLabel = label;
  if (yAxisUnit && yAxisUnit !== 'Status' && yAxisUnit !== 'Level') {
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

function getChartOptionsWithUnits(yAxisLabel = '', yAxisUnit = '', currentDate = '') {
  // Déterminer l'échelle Y appropriée selon le type de métrique
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
  
  // Configuration spécifique selon l'unité
  switch(yAxisUnit) {
    case 'ppm': // CO2
      yAxisConfig.suggestedMin = 0;
      yAxisConfig.suggestedMax = 2000;
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
    case 'Level': // Daylight level
      yAxisConfig.suggestedMin = 0;
      yAxisConfig.suggestedMax = 10;
      break;
    case 's': // Secondes (Staff IN/OUT)
      yAxisConfig.beginAtZero = true;
      yAxisConfig.grace = '10%';
      break;
    case 'mm': // Millimètres (Distance OCCUP)
      yAxisConfig.beginAtZero = true;
      yAxisConfig.grace = '10%';
      break;
    default:
      // Échelle automatique pour les autres cas
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

function getChartOptions() {
  return getChartOptionsWithUnits('', '', '');
}

function updateRealtimeCharts(data) {
  if (chartsPaused) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const devType = (document.documentElement.dataset.devType || '').toUpperCase();
  
  // Fonction helper pour obtenir le niveau de batterie
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

  // Mise à jour selon le type de capteur
  switch (devType) {
    case 'CO2':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['co2 (ppm)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['temperature (°C)']);
      updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, data['humidity (%)']);
      break;
    case 'TEMPEX':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['temperature (°C)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['humidity (%)']);
      updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, data['humidity (%)']);
      break;
    case 'DESK':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['temperature (°C)']);
      updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, data['humidity (%)']);
      break;
    case 'EYE':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['temperature (°C)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['humidity (%)']);
      updateChart(realtimeCharts.humidity, chartData.humidity, timestamp, data['humidity (%)']);
      break;
    case 'OCCUP':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data.light || 0);
      break;
    case 'PIR_LIGHT':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data.light || 0);
      break;
    case 'SON':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['LAeq (dB)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['LAI (dB)']);
      break;
    case 'COUNT':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['period_in']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['period_out']);
      break;
    case 'ENERGY':
    case 'CONSO':
      // Pour l'énergie, afficher les 3 groupes principaux sur Power Usage
      if (data.energy_data && typeof data.energy_data === 'object') {
        // Calculer les totaux par groupe
        const redOutlets = [0, 1, 2].reduce((sum, ch) => {
          const channelData = data.energy_data[ch];
          return sum + (channelData?.value || 0);
        }, 0);
        
        const whiteOutlets = [3, 4, 5].reduce((sum, ch) => {
          const channelData = data.energy_data[ch];
          return sum + (channelData?.value || 0);
        }, 0);
        
        const ventilation = [6, 7, 8].reduce((sum, ch) => {
          const channelData = data.energy_data[ch];
          return sum + (channelData?.value || 0);
        }, 0);
        
        // Consommation totale pour le graphique principal
        const totalWh = redOutlets + whiteOutlets + ventilation + 
          [9, 10, 11].reduce((sum, ch) => {
            const channelData = data.energy_data[ch];
            return sum + (channelData?.value || 0);
          }, 0);
        
        updateChart(realtimeCharts.main, chartData.main, timestamp, totalWh / 1000); // kWh
        
        // Mettre à jour le graphique Power Usage avec les 3 groupes
        updatePowerUsageChart(timestamp, {
          red: redOutlets / 1000,
          white: whiteOutlets / 1000,
          ventilation: ventilation / 1000
        });
      }
      break;
  }
  
}

function updateChart(chart, dataStore, timestamp, value) {
  if (!chart || value == null || isNaN(value)) return;
  
  dataStore.labels.push(timestamp);
  dataStore.data.push(Number(value));
  
  // Limiter le nombre de points
  if (dataStore.labels.length > MAX_CHART_POINTS) {
    dataStore.labels.shift();
    dataStore.data.shift();
  }
  
  // Mise à jour efficace sans animation
  chart.data.labels = dataStore.labels;
  chart.data.datasets[0].data = dataStore.data;
  chart.update('none');
}

function updateSignalChart(rssi, snr) {
  if (chartsPaused) return;
  
  const timestamp = new Date().toLocaleTimeString();
  
  // Update RSSI chart
  if (realtimeCharts.rssi) {
    updateChart(realtimeCharts.rssi, chartData.rssi, timestamp, rssi);
  }
  
  // Update SNR chart
  if (realtimeCharts.snr) {
    updateChart(realtimeCharts.snr, chartData.snr, timestamp, snr);
  }
}

function updateBatteryChart(batteryPct) {
  if (chartsPaused || !realtimeCharts.battery) return;
  
  const timestamp = new Date().toLocaleTimeString();
  
  chartData.battery.labels.push(timestamp);
  chartData.battery.data.push(batteryPct);
  
  // Limiter le nombre de points
  if (chartData.battery.labels.length > MAX_CHART_POINTS) {
    chartData.battery.labels.shift();
    chartData.battery.data.shift();
  }
  
  realtimeCharts.battery.data.labels = [...chartData.battery.labels];
  realtimeCharts.battery.data.datasets[0].data = [...chartData.battery.data];
  realtimeCharts.battery.update('none');
  
  // Mise à jour du statut de la batterie
  const batteryStatus = el('#battery-status');
  if (batteryStatus) {
    batteryStatus.textContent = `${Math.round(batteryPct)}%`;
    batteryStatus.className = 'battery-status';
    if (batteryPct >= 60) batteryStatus.classList.add('good');
    else if (batteryPct >= 30) batteryStatus.classList.add('warning');
    else batteryStatus.classList.add('critical');
  }
}

function clearAllCharts() {
  // Re-initialize chartData to ensure no shared references
  chartData = {
    main: { labels: [], data: [] },
    secondary: { labels: [], data: [] },
    humidity: { labels: [], data: [] },
    rssi: { labels: [], data: [] },
    snr: { labels: [], data: [] },
    battery: { labels: [], data: [] },
    powerUsage: { labels: [], red: [], white: [], ventilation: [] }
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

// Boot
document.addEventListener("DOMContentLoaded", () => {
  if (LIVE_MODE) startSSE();
  
  // Default date range: last 3 days including today
  const to = new Date();
  to.setHours(23, 59, 59, 999); // End of today

  const from = new Date();
  from.setDate(from.getDate() - 2); // Go back 2 days to include today as the 3rd day
  from.setHours(0, 0, 0, 0); // Beginning of that day

  // Helper to format Date to 'yyyy-MM-ddThh:mm' for datetime-local input
  const toLocalISOString = (date) => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Set default values for date inputs
  el('#hist-from').value = toLocalISOString(from);
  el('#hist-to').value = toLocalISOString(to);

  loadHistory(from.toISOString(), to.toISOString());
  
  if (window.Chart) {
    initRealtimeCharts();
  }
});
