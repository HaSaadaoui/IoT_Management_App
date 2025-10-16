// ===== Charts setup =====
const timeNowLabel = () => {
  const d = new Date();
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
};

function mkLineChart(ctx, label, color) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: color.replace("1)", "0.1)").replace("rgb", "rgba"),
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Time" } },
        y: { beginAtZero: false }
      },
      plugins: { legend: { position: "top" } }
    }
  });
}

const getCtx = (id) => {
  const el = document.getElementById(id);
  return el ? el.getContext("2d") : null;
};

const batteryCtx = getCtx("batteryChart");
const rssiCtx    = getCtx("rssiChart");
const snrCtx     = getCtx("snrChart");

const batteryChart = batteryCtx ? mkLineChart(batteryCtx, "Battery (%)", "rgb(40,167,69,1)") : null;
if (batteryChart) {
  batteryChart.options.scales.y.beginAtZero = true;
  batteryChart.options.scales.y.max = 100;
}

const rssiChart = rssiCtx ? mkLineChart(rssiCtx, "RSSI (dBm)", "rgb(0,123,255,1)") : null;
if (rssiChart) {
  rssiChart.options.scales.y.suggestedMin = -130;
  rssiChart.options.scales.y.suggestedMax = -30;
}

const snrChart = snrCtx ? mkLineChart(snrCtx, "SNR (dB)", "rgb(255,165,0,1)") : null;
if (snrChart) {
  snrChart.options.scales.y.suggestedMin = -20;
  snrChart.options.scales.y.suggestedMax = 20;
}

function pushPoint(chart, value, max = 60) {
  if (!chart || value == null || Number.isNaN(value)) return;
  chart.data.labels.push(timeNowLabel());
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > max) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

// ===== Map (facultative) =====
const mapEl = document.getElementById('map');
let map = null, sensorMarker = null;
if (mapEl) {
  map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  sensorMarker = L.marker([0, 0]).addTo(map);
}

// ===== DOM helpers =====
const el = (sel) => document.querySelector(sel);
const setText = (selector, value) => {
  const target = typeof selector === 'string' ? el(selector) : selector;
  if (target) target.textContent = (value == null ? "--" : String(value));
};

// Badges globaux optionnels (ancien écran)
const statusBadge   = el("#sensor-status");
const batteryBadge  = el("#battery-badge");
const lastSeenEl    = el("#last-seen");
const appIdEl       = el("#application-id") || el("#s-app");
const uplinkCountEl = el("#uplink-count");
const rssiNowEl     = el("#rssi-now");
const snrNowEl      = el("#snr-now");
const locEl         = el("#sensor-location");
const uplinksTbody  = el("#uplinks-tbody");

// Live-data COUNT basiques si présents
const sCountBatt = el("#s-count-batt");
const sCountIn   = el("#s-count-in");
const sCountOut  = el("#s-count-out");
const sGenBatt   = el("#s-gen-batt");

// ===== SSE stream =====
(function initSSE() {
  // IDs + token injectés via <html data-*>
  const html = document.documentElement;
  const SENSOR_ID  = window.SENSOR_ID  || html.dataset.deviceId;
  const SSE_TOKEN  = window.SSE_TOKEN  || html.dataset.sseToken;
  const GATEWAY_ID = window.GATEWAY_ID || html.dataset.gatewayId;

  if (!SENSOR_ID) return;

  const baseUrl = `/manage-sensors/monitoring/${encodeURIComponent(SENSOR_ID)}/stream`;
  const url = SSE_TOKEN ? `${baseUrl}?token=${encodeURIComponent(SSE_TOKEN)}` : `${baseUrl}?t=${Date.now()}`;

  const es = new EventSource(url);

  es.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data || "{}");

      // Deux formats pris en charge :
      // - Format normalisé (ids/payload/link/timestamp)
      // - Ancien format (device/meta/battery/radio/…)
      const isNormalized = !!data.ids || !!data.payload || !!data.link;

      // ===== Application ID =====
      let appId = null;
      if (isNormalized) {
        appId = data.ids?.application_id ?? null;
      } else if (data.device?.application_id) {
        appId = data.device.application_id;
      } else if (GATEWAY_ID) {
        appId = (String(GATEWAY_ID).toLowerCase() === 'leva-rpi-mantu') ? 'lorawan-network-mantu' : `${GATEWAY_ID}-appli`;
      }
      if (appIdEl && appId) setText(appIdEl, appId);
      if (isNormalized && data.ids?.device_id && el("#s-device")) setText("#s-device", data.ids.device_id);

      // ===== Last seen =====
      const lastSeen = isNormalized ? data.timestamp : (data.meta?.last_seen);
      const lastSeenHuman = lastSeen ? (() => { try { return new Date(lastSeen).toLocaleString(); } catch { return lastSeen; } })() : null;
      if (lastSeenHuman && lastSeenEl) setText(lastSeenEl, lastSeenHuman);
      if (lastSeenHuman && el("#s-last")) setText("#s-last", lastSeenHuman);

      // ===== Status (ancien écran) =====
      const status = isNormalized ? null : (typeof data.status === "string" ? data.status : null);
      if (statusBadge && status) {
        const s = status.toLowerCase();
        statusBadge.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        statusBadge.style.backgroundColor = (s === "active" || s === "up") ? "green" : (s === "sleep" ? "gray" : "red");
      }

      // ===== Battery (chart + badges compatibles) =====
      let battery = null;
      if (isNormalized) {
        battery = (typeof data.payload?.["battery (%)"] === "number") ? data.payload["battery (%)"] : null;
      } else {
        const batObj = data.battery || {};
        battery = (batObj.percent ?? batObj.level ?? null);
      }
      if (battery != null) {
        pushPoint(batteryChart, Number(battery), 60);
        if (batteryBadge) {
          setText(batteryBadge, battery + " %");
          batteryBadge.style.backgroundColor = battery >= 60 ? "green" : (battery >= 30 ? "orange" : "red");
        }
        if (sCountBatt) setText(sCountBatt, Math.round(battery) + " %");
        if (sGenBatt)   setText(sGenBatt,   Math.round(battery) + " %");
        const sOccupBatt = el("#s-occup-batt");
        const sPirBatt   = el("#s-pir-batt");
        if (sOccupBatt) setText(sOccupBatt, Math.round(battery) + " %");
        if (sPirBatt)   setText(sPirBatt,   Math.round(battery) + " %");
        if (sDeskBatt)  setText(sDeskBatt,  Math.round(battery) + " %");
      }

      // ===== Radio metrics (RSSI/SNR) =====
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
        pushPoint(rssiChart, rssi, 120);
        const sRssi = el("#s-rssi"); if (sRssi) setText(sRssi, `${rssi.toFixed(0)} dBm`);
      }
      if (snr != null && !Number.isNaN(snr)) {
        if (snrNowEl) setText(snrNowEl, snr.toFixed(1));
        pushPoint(snrChart, snr, 120);
        const sSnr = el("#s-snr"); if (sSnr) setText(sSnr, `${snr.toFixed(1)} dB`);
      }

      // ===== Compteurs uplinks (ancien écran) =====
      if (!isNormalized && typeof data.counters?.uplinks !== "undefined" && uplinkCountEl) {
        setText(uplinkCountEl, data.counters.uplinks);
      }

      // ===== Détails link (nouvel écran) =====
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

      // ===== COUNT → period_in / period_out =====
      if (isNormalized && data.payload) {
        const pin  = data.payload["period_in"];
        const pout = data.payload["period_out"];
        if (sCountIn  && pin  != null) setText(sCountIn,  pin);
        if (sCountOut && pout != null) setText(sCountOut, pout);
      }

      // ===== Localisation (carte) =====
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

      // ===== Tableau uplinks (ancien écran) =====
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


        const fmt = {
          batt: (v)=> `${Math.round(v)} %`,
          temp: (v)=> `${v} °C`,
          hum : (v)=> `${v} %`,
          vdd : (v)=> `${v} mV`,
          db  : (v)=> `${v} dB`
        };

      const devTypeFromHtml = (document.documentElement.dataset.devType || '').toUpperCase();
      const PROF = String((isNormalized && data.ids?.profile) ? data.ids.profile : devTypeFromHtml).toUpperCase();
      const p = (isNormalized && data.payload) ? data.payload : {};

      switch (PROF) {
        case 'COUNT':
          if (typeof p['battery (%)'] === 'number' && el('#s-count-batt')) setText('#s-count-batt', fmt.batt(p['battery (%)']));
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
          if (typeof p['battery (%)'] === 'number' && el('#s-sound-batt'))   setText('#s-sound-batt',   fmt.batt(p['battery (%)']));
          break;

        case 'CO2':
          if (typeof p['co2 (ppm)']        === 'number' && el('#s-co2-ppm'))  setText('#s-co2-ppm',  p['co2 (ppm)']);
          if (typeof p['temperature (°C)'] === 'number' && el('#s-co2-temp')) setText('#s-co2-temp', fmt.temp(p['temperature (°C)']));
          if (typeof p['humidity (%)']     === 'number' && el('#s-co2-hum'))  setText('#s-co2-hum',  fmt.hum(p['humidity (%)']));
          if (typeof p['vdd (v)']          === 'number' && el('#s-co2-vdd'))  setText('#s-co2-vdd',  fmt.vdd(Math.round(p['vdd (v)'] * 1000)));
          if (typeof p['vdd (mV)']         === 'number' && el('#s-co2-vdd'))  setText('#s-co2-vdd',  fmt.vdd(p['vdd (mV)']));
          if (p.light    != null && el('#s-co2-light'))   setText('#s-co2-light',   p.light);
          if (p.presence != null && el('#s-co2-motion'))  setText('#s-co2-motion',  p.presence);
          // Pour afficher la batterie CO2, ajoute un span id="s-co2-batt" dans l'HTML, puis dé-commente :
          // if (typeof p['battery (%)'] === 'number' && el('#s-co2-batt')) setText('#s-co2-batt', fmt.batt(p['battery (%)']));
          break;

        case 'OCCUP':
          if (p.presence != null && el('#s-occup-presence')) setText('#s-occup-presence', p.presence);
          if (p.light    != null && el('#s-occup-illum'))    setText('#s-occup-illum',    p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-occup-batt')) setText('#s-occup-batt', fmt.batt(p['battery (%)']));
          break;

          case 'EYE':
            if (typeof p['temperature (°C)'] === 'number' && el('#s-eye-temp'))
              setText('#s-eye-temp', fmt.temp(p['temperature (°C)']));
            if (typeof p['humidity (%)'] === 'number' && el('#s-eye-hum'))
              setText('#s-eye-hum', fmt.hum(p['humidity (%)']));
            if (p.light != null && el('#s-eye-light'))
              setText('#s-eye-light', p.light);
            if (p.presence != null && el('#s-eye-presence'))
              setText('#s-eye-presence', p.presence);
            if (typeof p['vdd (mV)'] === 'number' && el('#s-eye-vdd'))
              setText('#s-eye-vdd', fmt.vdd(p['vdd (mV)']));
            break;


        case 'PIR_LIGHT':
          if (p.presence != null && el('#s-pir-presence')) setText('#s-pir-presence', p.presence);
          if (p.light    != null && el('#s-pir-daylight')) setText('#s-pir-daylight', p.light);
          if (typeof p['battery (%)'] === 'number' && el('#s-pir-batt')) setText('#s-pir-batt', fmt.batt(p['battery (%)']));
          break;

        case 'DESK':
          if (typeof p['temperature (°C)'] === 'number' && el('#s-desk-temp')) setText('#s-desk-temp', fmt.temp(p['temperature (°C)']));
          if (typeof p['humidity (%)']     === 'number' && el('#s-desk-hum'))  setText('#s-desk-hum',  fmt.hum(p['humidity (%)']));
          if (typeof p['vdd (mV)']         === 'number' && el('#s-desk-vdd'))  setText('#s-desk-vdd',  fmt.vdd(p['vdd (mV)']));
          break;

        default:
          if (typeof p['battery (%)'] === 'number' && el('#s-gen-batt')) setText('#s-gen-batt', fmt.batt(p['battery (%)']));
          break;
      }
    } catch (e) {
      console.error("Sensor SSE parse error:", e);
    }
  };

  es.onerror = (err) => {
    console.error("Sensor SSE error:", err);
    es.close();
  };
})();
