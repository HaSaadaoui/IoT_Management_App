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

      // Status (ancien)
      const status = isNormalized ? null : (typeof data.status === "string" ? data.status : null);
      if (statusBadge && status) {
        const s = status.toLowerCase();
        statusBadge.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        statusBadge.style.backgroundColor = (s === "active" || s === "up") ? "green" : (s === "sleep" ? "gray" : "red");
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
        const drParts = [];
        if (data.link.sf) drParts.push(data.link.sf);
        if (data.link["bw (kHz)"] != null) drParts.push(`${data.link["bw (kHz)"]} kHz`);
        if (data.link.coding_rate) drParts.push(data.link.coding_rate);
        if (data.link["frequency (MHz)"] != null) drParts.push(`${data.link["frequency (MHz)"]} MHz`);
        if (drParts.length && el("#s-dr")) setText("#s-dr", drParts.join(" / "));
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
          if (typeof p['battery (%)'] === 'number' && el('#s-count-batt')) updateBatteryBadge('#s-count-batt', p['battery (%)']);
          if (p['period_in']  != null && el('#s-count-in'))  setText('#s-count-in',  p['period_in']);
          if (p['period_out'] != null && el('#s-count-out')) setText('#s-count-out', p['period_out']);
          break;
        case 'TEMPEX':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-tempex-temp')) updateTempBadge('#s-tempex-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)']     === 'number' && el('#s-tempex-hum'))  setText('#s-tempex-hum',  fmt.hum(p['humidity (%)']));
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
          if (typeof p['humidity (%)']     === 'number' && el('#s-co2-hum'))  setText('#s-co2-hum',  fmt.hum(p['humidity (%)']));
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
          if (p.presence != null && el('#s-occup-presence')) setText('#s-occup-presence', p.presence);
          if (p.light    != null && el('#s-occup-illum'))    setText('#s-occup-illum',    p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-occup-batt')) updateBatteryBadge('#s-occup-batt', p['battery (%)']);
          break;
        case 'EYE':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-eye-temp')) updateTempBadge('#s-eye-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)'] === 'number' && el('#s-eye-hum'))      setText('#s-eye-hum',  fmt.hum(p['humidity (%)']));
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
          // Occupancy (vient du champ "presence" du backend)
          if (p.presence != null && el('#s-desk-occupancy')) {
            const occNode = el('#s-desk-occupancy');
            occNode.classList.remove('badge--ok', 'badge--off');
            if (p.presence === 1 || p.presence === true || p.presence === 'occupied') {
              occNode.classList.add('badge--ok');
              setText('#s-desk-occupancy', 'Occupied');
            } else {
              occNode.classList.add('badge--off');
              setText('#s-desk-occupancy', 'Free');
            }
          }
          if (typeof p['temperature (°C)'] === 'number' && el('#s-desk-temp')) updateTempBadge('#s-desk-temp', p['temperature (°C)']);
          if (typeof p['humidity (%)']     === 'number' && el('#s-desk-hum'))  setText('#s-desk-hum',  fmt.hum(p['humidity (%)']));
          // VDD → Battery %
          if (typeof p['vdd (mV)'] === 'number') {
            const battPct = vddToBatteryPercent(p['vdd (mV)']);
            if (battPct != null && el('#s-desk-vdd')) updateBatteryBadge('#s-desk-vdd', battPct);
          }
          break;
        case 'ENERGY':
        case 'CONSO':
          // Gestion des données de consommation énergétique
          if (p && typeof p === 'object') {
            updateEnergyConsumption(p);
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
    data: { labels: [], datasets: [{ label, data: [], borderColor: color, backgroundColor: color.replace("1)", "0.1)").replace("rgb","rgba"), fill:true, tension:.3, pointRadius:2 }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"top" }} }
  });
}
const mkHist = (id, label) => (ctx(id) ? mkLineChart(ctx(id), label, "rgb(102,33,121,1)") : null);

const histBattery = mkHist("histBattery", "Battery (%)");
const histRssi    = mkHist("histRssi",    "RSSI (dBm)");
const histSnr     = mkHist("histSnr",     "SNR (dB)");
const histMetricA = mkHist("histMetricA", "Metric A");
const histMetricB = mkHist("histMetricB", "Metric B");

function setSeries(chart, labels, values) {
  if (!chart) return;
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.update();
}

function setupHistoryTitles() {
  const devType = (document.documentElement.dataset.devType || '').toUpperCase();
  const A = document.getElementById("histMetricA-title");
  const B = document.getElementById("histMetricB-title");
  if (!A || !B) return;
  switch (devType) {
    case 'CO2':       A.textContent = "CO₂ (ppm)";       B.textContent = "Température (°C)"; break;
    case 'DESK':      A.textContent = "Occupancy";       B.textContent = "Température (°C)"; break;
    case 'EYE':
    case 'TEMPEX':    A.textContent = "Température (°C)"; B.textContent = "Humidité (%)";     break;
    case 'SON':       A.textContent = "LAeq (dB)";       B.textContent = "LAI (dB)";         break;
    case 'PIR_LIGHT': A.textContent = "Présence";        B.textContent = "Lumière (lux)";    break;
    case 'OCCUP':     A.textContent = "Présence";        B.textContent = "Illuminance";      break;
    case 'COUNT':     A.textContent = "period_in";       B.textContent = "period_out";       break;
    default:          A.textContent = "Metric A";        B.textContent = "Metric B";
  }
}
setupHistoryTitles();

async function loadHistory(fromISO, toISO) {
  const SENSOR_ID = document.documentElement.dataset.deviceId;
  const params = new URLSearchParams();
  if (fromISO) params.set('from', fromISO);
  if (toISO)   params.set('to',   toISO);
  const res = await fetch(`/manage-sensors/monitoring/${encodeURIComponent(SENSOR_ID)}/history?` + params.toString());
  if (!res.ok) throw new Error("History fetch failed");
  const j = await res.json();

  const labels = (j.timestamps || []).map(t => { try { return new Date(t).toLocaleTimeString(); } catch { return t; } });
  if (j.battery_pct) setSeries(histBattery, labels, j.battery_pct);
  if (j.rssi_dbm)    setSeries(histRssi,    labels, j.rssi_dbm);
  if (j.snr_db)      setSeries(histSnr,     labels, j.snr_db);

  if (j.metrics?.A && histMetricA) {
    document.getElementById("histMetricA-title").textContent = j.metrics.A.label || document.getElementById("histMetricA-title").textContent;
    setSeries(histMetricA, labels, j.metrics.A.values || []);
  }
  if (j.metrics?.B && histMetricB) {
    document.getElementById("histMetricB-title").textContent = j.metrics.B.label || document.getElementById("histMetricB-title").textContent;
    setSeries(histMetricB, labels, j.metrics.B.values || []);
  }

  // Update KPI cards
  updateKPICards(j, fromISO, toISO);
}

// Update KPI Cards with statistics
function updateKPICards(data, fromISO, toISO) {
  // Total measurements
  const totalEl = document.getElementById('kpi-total');
  if (totalEl) {
    const total = data.timestamps?.length || 0;
    totalEl.textContent = total.toLocaleString();
  }

  // Average battery
  const batteryEl = document.getElementById('kpi-battery');
  if (batteryEl && data.battery_pct?.length > 0) {
    const avg = data.battery_pct.reduce((a, b) => a + b, 0) / data.battery_pct.length;
    batteryEl.textContent = `${Math.round(avg)}%`;
  }

  // Average RSSI
  const rssiEl = document.getElementById('kpi-rssi');
  if (rssiEl && data.rssi_dbm?.length > 0) {
    const avg = data.rssi_dbm.reduce((a, b) => a + b, 0) / data.rssi_dbm.length;
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
    'red-outlets': { channels: [0, 1, 2], name: '🔴 Prises rouges', color: '#ef4444' },
    'white-outlets': { channels: [3, 4, 5], name: '⚪ Prises blanches & éclairage', color: '#64748b' },
    'ventilation': { channels: [6, 7, 8], name: '🌬️ Ventilation & convecteurs', color: '#3b82f6' },
    'other': { channels: [9, 10, 11], name: '🔧 Autres circuits', color: '#f59e0b' }
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
            <span class="channel-number">Canal ${channel}</span>
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
          <span class="group-name">${group.name}</span>
          <span class="group-channels">Canaux ${group.channels.join(', ')}</span>
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
        <div class="total-label">Consommation Totale</div>
        <div class="total-values">
          <div class="total-wh">${formatEnergyValue(totalConsumption)} Wh</div>
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

function updateEnergyChart(groups, data) {
  const chartEl = el('#energy-chart');
  if (!chartEl) return;

  // Données pour le graphique en barres
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
      value: total,
      color: group.color
    };
  });

  // Création/mise à jour du graphique simple avec CSS
  chartEl.innerHTML = groupData.map(item => {
    const maxValue = Math.max(...groupData.map(g => g.value));
    const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
    
    return `
      <div class="chart-bar">
        <div class="bar-label">${item.name}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${percentage}%; background-color: ${item.color}"></div>
          <span class="bar-value">${(item.value / 1000).toFixed(1)} kWh</span>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Real-time Charts =====
let realtimeCharts = {
  main: null,
  secondary: null,
  signal: null,
  battery: null
};

let chartData = {
  main: { labels: [], data: [] },
  secondary: { labels: [], data: [] },
  signal: { rssi: [], snr: [], labels: [] },
  battery: { labels: [], data: [] }
};

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
      main: { label: 'CO₂ (ppm)', color: '#ef4444', title: '🌬️ CO₂ Level' },
      secondary: { label: 'Température (°C)', color: '#f59e0b', title: '🌡️ Temperature' }
    },
    'TEMPEX': {
      main: { label: 'Température (°C)', color: '#f59e0b', title: '🌡️ Temperature' },
      secondary: { label: 'Humidité (%)', color: '#3b82f6', title: '💧 Humidity' }
    },
    'DESK': {
      main: { label: 'Occupancy', color: '#10b981', title: '👤 Desk Occupancy' },
      secondary: { label: 'Température (°C)', color: '#f59e0b', title: '🌡️ Temperature' }
    },
    'SON': {
      main: { label: 'LAeq (dB)', color: '#8b5cf6', title: '🔊 Sound Level' },
      secondary: { label: 'LAI (dB)', color: '#ec4899', title: '📢 Sound Impact' }
    },
    'ENERGY': {
      main: { label: 'Consommation (kWh)', color: '#f59e0b', title: '⚡ Energy Consumption' },
      secondary: { label: 'Puissance (W)', color: '#ef4444', title: '🔌 Power Usage' }
    },
    'CONSO': {
      main: { label: 'Consommation (kWh)', color: '#f59e0b', title: '⚡ Energy Consumption' },
      secondary: { label: 'Puissance (W)', color: '#ef4444', title: '🔌 Power Usage' }
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
  const signalCtx = el('#realtime-chart-signal')?.getContext('2d');
  const batteryCtx = el('#realtime-chart-battery')?.getContext('2d');

  if (mainCtx) {
    realtimeCharts.main = new Chart(mainCtx, createChartConfig(config.main.label, config.main.color));
  }
  
  if (secondaryCtx) {
    realtimeCharts.secondary = new Chart(secondaryCtx, createChartConfig(config.secondary.label, config.secondary.color));
  }
  
  if (signalCtx) {
    realtimeCharts.signal = new Chart(signalCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'RSSI (dBm)',
            data: [],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'SNR (dB)',
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 2
          }
        ]
      },
      options: getChartOptions()
    });
  }
  
  if (batteryCtx) {
    realtimeCharts.battery = new Chart(batteryCtx, createChartConfig('Battery (%)', '#10b981'));
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

function createChartConfig(label, color) {
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: label,
        data: [],
        borderColor: color,
        backgroundColor: color.replace('1)', '0.1)').replace('rgb', 'rgba'),
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 4
      }]
    },
    options: getChartOptions()
  };
}

function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 0,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        display: true,
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
      y: {
        display: true,
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
      }
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

function updateRealtimeCharts(data) {
  if (chartsPaused) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const devType = (document.documentElement.dataset.devType || '').toUpperCase();
  
  // Mise à jour selon le type de capteur
  switch (devType) {
    case 'CO2':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['co2 (ppm)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['temperature (°C)']);
      break;
    case 'TEMPEX':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['temperature (°C)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['humidity (%)']);
      break;
    case 'DESK':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data.presence ? 1 : 0);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['temperature (°C)']);
      break;
    case 'SON':
      updateChart(realtimeCharts.main, chartData.main, timestamp, data['LAeq (dB)']);
      updateChart(realtimeCharts.secondary, chartData.secondary, timestamp, data['LAI (dB)']);
      break;
    case 'ENERGY':
    case 'CONSO':
      // Pour l'énergie, on calcule la consommation totale
      let totalWh = 0;
      Object.values(data).forEach(channelData => {
        if (channelData && channelData.value) {
          totalWh += channelData.value;
        }
      });
      updateChart(realtimeCharts.main, chartData.main, timestamp, totalWh / 1000); // kWh
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
  if (chartsPaused || !realtimeCharts.signal) return;
  
  const timestamp = new Date().toLocaleTimeString();
  
  chartData.signal.labels.push(timestamp);
  chartData.signal.rssi.push(rssi);
  chartData.signal.snr.push(snr);
  
  // Limiter le nombre de points
  if (chartData.signal.labels.length > MAX_CHART_POINTS) {
    chartData.signal.labels.shift();
    chartData.signal.rssi.shift();
    chartData.signal.snr.shift();
  }
  
  realtimeCharts.signal.data.labels = [...chartData.signal.labels];
  realtimeCharts.signal.data.datasets[0].data = [...chartData.signal.rssi];
  realtimeCharts.signal.data.datasets[1].data = [...chartData.signal.snr];
  realtimeCharts.signal.update('none');
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
  Object.keys(chartData).forEach(key => {
    if (key === 'signal') {
      chartData[key] = { rssi: [], snr: [], labels: [] };
    } else {
      chartData[key] = { labels: [], data: [] };
    }
  });
  
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
  loadHistory();
  
  // Initialiser les graphiques en temps réel
  if (window.Chart) {
    initRealtimeCharts();
  }
});

showPane('live');
