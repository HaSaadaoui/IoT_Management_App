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

const batteryCtx = document.getElementById("batteryChart").getContext("2d");
const rssiCtx    = document.getElementById("rssiChart").getContext("2d");
const snrCtx     = document.getElementById("snrChart").getContext("2d");

const batteryChart = mkLineChart(batteryCtx, "Battery (%)", "rgb(40,167,69,1)");
batteryChart.options.scales.y.beginAtZero = true;
batteryChart.options.scales.y.max = 100;

const rssiChart = mkLineChart(rssiCtx, "RSSI (dBm)", "rgb(0,123,255,1)");
rssiChart.options.scales.y.suggestedMin = -130;
rssiChart.options.scales.y.suggestedMax = -30;

const snrChart = mkLineChart(snrCtx, "SNR (dB)", "rgb(255,165,0,1)");
snrChart.options.scales.y.suggestedMin = -20;
snrChart.options.scales.y.suggestedMax = 20;

function pushPoint(chart, value, max = 60) {
  if (value == null || Number.isNaN(value)) return;
  chart.data.labels.push(timeNowLabel());
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > max) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

// ===== Map =====
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
let sensorMarker = L.marker([0, 0]).addTo(map);

// ===== Badges & fields =====
const el = (sel) => document.querySelector(sel);
const statusBadge   = el("#sensor-status");
const batteryBadge  = el("#battery-badge");
const lastSeenEl    = el("#last-seen");
const appIdEl       = el("#application-id");
const uplinkCountEl = el("#uplink-count");
const rssiNowEl     = el("#rssi-now");
const snrNowEl      = el("#snr-now");
const locEl         = el("#sensor-location");
const uplinksTbody  = el("#uplinks-tbody");

// ===== SSE stream =====
(function initSSE() {
  if (!window.SENSOR_ID) return;
  const url = `/manage-sensors/monitoring/${encodeURIComponent(window.SENSOR_ID)}/stream?t=` + Date.now();
  const es = new EventSource(url);

  es.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data || "{}");

      // device/app meta
      if (data.device && data.device.application_id && appIdEl.textContent === "--") {
        appIdEl.textContent = data.device.application_id;
      }
      if (data.meta && data.meta.last_seen) {
        lastSeenEl.textContent = new Date(data.meta.last_seen).toLocaleString();
      }

      // status
      if (statusBadge && typeof data.status === "string") {
        const s = data.status.toLowerCase();
        statusBadge.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        statusBadge.style.backgroundColor = (s === "active" || s === "up") ? "green" :
                                            (s === "sleep" ? "gray" : "red");
      }

      // battery
      const bat = (data.battery && (data.battery.percent ?? data.battery.level)) ?? null;
      if (bat != null) {
        batteryBadge.textContent = bat + " %";
        batteryBadge.style.backgroundColor = bat >= 60 ? "green" : (bat >= 30 ? "orange" : "red");
        pushPoint(batteryChart, Number(bat), 60);
      }

      // radio metrics
      if (data.radio) {
        const rssi = Number(data.radio.rssi);
        const snr  = Number(data.radio.snr);
        if (!Number.isNaN(rssi)) {
          rssiNowEl.textContent = rssi.toFixed(0);
          pushPoint(rssiChart, rssi, 120);
        }
        if (!Number.isNaN(snr)) {
          snrNowEl.textContent = snr.toFixed(1);
          pushPoint(snrChart, snr, 120);
        }
      }

      // counters
      if (data.counters && typeof data.counters.uplinks !== "undefined") {
        uplinkCountEl.textContent = data.counters.uplinks;
      }

      // location
      if (data.meta && typeof data.meta.lat === "number" && typeof data.meta.lon === "number") {
        const { lat, lon } = data.meta;
        sensorMarker.setLatLng([lat, lon]);
        map.setView([lat, lon], 13);
        locEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }

      // recent uplinks table (optional)
      if (Array.isArray(data.uplinks) && uplinksTbody) {
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

    } catch (e) {
      console.error("Sensor SSE parse error:", e);
    }
  };

  es.onerror = (err) => {
    console.error("Sensor SSE error:", err);
    es.close();
  };
})();
