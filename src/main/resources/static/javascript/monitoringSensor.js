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
    node.textContent = '--';
    return;
  }
  const p = Math.max(0, Math.min(100, Math.round(Number(pct))));
  let cls = 'battery--crit';
  if (p >= 60) cls = 'battery--good';
  else if (p >= 30) cls = 'battery--warn';
  else if (p >= 10) cls = 'battery--low';

  node.classList.add(cls);
  node.textContent = p + ' %';
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
          if (typeof p['temperature (°C)'] === 'number' && el('#s-tempex-temp')) setText('#s-tempex-temp', fmt.temp(p['temperature (°C)']));
          if (typeof p['humidity (%)']     === 'number' && el('#s-tempex-hum'))  setText('#s-tempex-hum',  fmt.hum(p['humidity (%)']));
          break;
        case 'SON':
          if (typeof p['LAeq (dB)']   === 'number' && el('#s-sound-laeq'))   setText('#s-sound-laeq',   fmt.db(p['LAeq (dB)']));
          if (typeof p['LAI (dB)']    === 'number' && el('#s-sound-lai'))    setText('#s-sound-lai',    fmt.db(p['LAI (dB)']));
          if (typeof p['LAImax (dB)'] === 'number' && el('#s-sound-laimax')) setText('#s-sound-laimax', fmt.db(p['LAImax (dB)']));
          if (typeof p['battery (%)'] === 'number' && el('#s-sound-batt'))   updateBatteryBadge('#s-sound-batt', p['battery (%)']);
          break;
        case 'CO2':
          if (typeof p['co2 (ppm)']        === 'number' && el('#s-co2-ppm'))  setText('#s-co2-ppm',  p['co2 (ppm)']);
          if (typeof p['temperature (°C)'] === 'number' && el('#s-co2-temp')) setText('#s-co2-temp', fmt.temp(p['temperature (°C)']));
          if (typeof p['humidity (%)']     === 'number' && el('#s-co2-hum'))  setText('#s-co2-hum',  fmt.hum(p['humidity (%)']));
          if (typeof p['vdd (v)']          === 'number' && el('#s-co2-vdd'))  setText('#s-co2-vdd',  fmt.vdd(Math.round(p['vdd (v)'] * 1000)));
          if (typeof p['vdd (mV)']         === 'number' && el('#s-co2-vdd'))  setText('#s-co2-vdd',  fmt.vdd(p['vdd (mV)']));
          if (p.light    != null && el('#s-co2-light'))   setText('#s-co2-light',   p.light);
          if (p.presence != null && el('#s-co2-motion'))  setText('#s-co2-motion',  p.presence);
          break;
        case 'OCCUP':
          if (p.presence != null && el('#s-occup-presence')) setText('#s-occup-presence', p.presence);
          if (p.light    != null && el('#s-occup-illum'))    setText('#s-occup-illum',    p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-occup-batt')) updateBatteryBadge('#s-occup-batt', p['battery (%)']);
          break;
        case 'EYE':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-eye-temp')) setText('#s-eye-temp', fmt.temp(p['temperature (°C)']));
          if (typeof p['humidity (%)'] === 'number' && el('#s-eye-hum'))      setText('#s-eye-hum',  fmt.hum(p['humidity (%)']));
          if (p.light != null && el('#s-eye-light')) setText('#s-eye-light', p.light);
          if (p.presence != null && el('#s-eye-presence')) setText('#s-eye-presence', p.presence);
          if (typeof p['vdd (mV)'] === 'number' && el('#s-eye-vdd')) setText('#s-eye-vdd', fmt.vdd(p['vdd (mV)']));
          break;
        case 'PIR_LIGHT':
          if (p.presence != null && el('#s-pir-presence')) setText('#s-pir-presence', p.presence);
          if (p.light    != null && el('#s-pir-daylight')) setText('#s-pir-daylight', p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-pir-batt')) updateBatteryBadge('#s-pir-batt', p['battery (%)']);
          break;
        case 'DESK':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-desk-temp')) setText('#s-desk-temp', fmt.temp(p['temperature (°C)']));
          if (typeof p['humidity (%)']     === 'number' && el('#s-desk-hum'))  setText('#s-desk-hum',  fmt.hum(p['humidity (%)']));
          if (typeof p['vdd (mV)']         === 'number' && el('#s-desk-vdd'))  setText('#s-desk-vdd',  fmt.vdd(p['vdd (mV)']));
          break;
        default:
          if (typeof p['battery (%)'] === 'number' && el('#s-gen-batt')) updateBatteryBadge('#s-gen-batt', p['battery (%)']);
          break;
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

// Boot
showPane('live');
