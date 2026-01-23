// ===== SENSOR MONITORING - HISTORY PANE =====

// ===== Chart Helpers =====
// `createChartConfig` and `getChartOptionsWithUnits` are defined in monitoringSensor.js
// and are globally available.

// ===== History Chart Variables =====
// `networkMetricsContainer`, `sensorMetricsContainer`, `consumptionCharts`
// and `METRIC_TITLES` are defined in monitoringSensor.js and are globally available.
// `DEVICE_TYPE_METRICS` is also defined in monitoringSensor.js.
// `getMetricColor` is also defined in monitoringSensor.js.

/**
 * Helper to update a KPI card's value and visibility.
 * Hides the card if the value is empty or null.
 * @param {string} cardId - The ID of the card container element.
 * @param {string} valueElId - The ID of the element that displays the value.
 * @param {string|number|null|undefined} value - The value to display.
 * @param {string} [unit=''] - The unit to append to the value.
 */
function updateCard(cardId, valueElId, value, unit = '') {
    const card = document.getElementById(cardId);
    const valueEl = document.getElementById(valueElId);
    if (!card || !valueEl) return;
    const hasValue = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
    card.style.display = hasValue ? 'flex' : 'none';
    if (hasValue) valueEl.textContent = `${value}${unit}`;
}

function getLastTimestamp(values) {
    const ts = values[values.length - 1];
    const parsed = new Date(ts);
    return parsed.toLocaleDateString("en-CA", { timeZone: 'UTC' });
}

function energyIndexToDeltasWh(energyMap) {
  // energyMap: { "2026-01-20T11:19:43.850103": "50450", ... }  // Wh cumulés
  const entries = Object.entries(energyMap || {})
    .map(([ts, v]) => [new Date(ts).getTime(), Number(v)])
    .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);

  const deltas = {}; // { isoTs: deltaWh }
  for (let i = 1; i < entries.length; i++) {
    const [tPrev, vPrev] = entries[i - 1];
    const [tCur, vCur] = entries[i];

    let d = vCur - vPrev;

    // compteur reset / rollback / out-of-order => on neutralise
    if (!Number.isFinite(d) || d < 0) d = 0;

    deltas[new Date(tCur).toISOString()] = d; // delta attribué au point courant
  }
  return deltas;
}

function sumDeltaGroupsFromHistory(j) {
  // 1) deltas par channel
  const deltasByChannel = {};
  for (let ch = 0; ch <= 11; ch++) {
    const key = `ENERGY_CHANNEL_${ch}`;
    deltasByChannel[ch] = energyIndexToDeltasWh(j.data?.[key] || {});
  }

  // 2) union des timestamps (après delta)
  const allTs = new Set();
  Object.values(deltasByChannel).forEach(m => Object.keys(m).forEach(ts => allTs.add(ts)));
  const tsSorted = Array.from(allTs).sort(); // ISO => tri lexical OK

  const sumAt = (chs, ts) => chs.reduce((s, ch) => s + (Number(deltasByChannel[ch]?.[ts]) || 0), 0);

  // 3) séries Wh par groupe
  const red = {};
  const vent = {};
  const white = {};
  const other = {};

  for (const ts of tsSorted) {
    const redWh = sumAt([0,1,2], ts);
    const ventWh = sumAt([6,7,8], ts);
    const whiteRawWh = sumAt([3,4,5], ts);

    red[ts] = redWh;
    vent[ts] = ventWh;
    white[ts] = Math.abs(ventWh - whiteRawWh);
    other[ts] = sumAt([9,10,11], ts);
  }

  return { red, white, vent, other };
}

function groupWhByInterval(seriesWh, intervalHours) {
  // seriesWh: { isoTs: whDelta }
  const grouped = {};
  for (const [ts, wh] of Object.entries(seriesWh || {})) {
    const d = new Date(ts);
    const hour = d.getUTCHours(); // important si tu bosses en UTC côté back
    const bucketHour = Math.floor(hour / intervalHours) * intervalHours;
    const bucket = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), bucketHour, 0, 0, 0)).toISOString();
    grouped[bucket] = (grouped[bucket] || 0) + (Number(wh) || 0);
  }
  return grouped;
}

function firstLastDeltaWh(energyMap) {
  const entries = Object.entries(energyMap || {})
    .map(([ts, v]) => [new Date(ts).getTime(), Number(v)])
    .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);

  if (entries.length < 2) return 0;

  const first = entries[0][1];
  const last  = entries[entries.length - 1][1];

  let d = last - first;
  if (!Number.isFinite(d) || d < 0) d = 0; // reset/rollback
  return d;
}

function totalKWhLikeBackend(j) {
  const d = Array.from({ length: 12 }, (_, ch) =>
    firstLastDeltaWh(j.data?.[`ENERGY_CHANNEL_${ch}`] || {})
  );

  const red   = d[0] + d[1] + d[2];
  const vent  = d[6] + d[7] + d[8];
  const white = Math.abs(vent - (d[3] + d[4] + d[5]));
  const other = d[9] + d[10] + d[11];

  const totalWh = Math.abs(red + white + vent + other);
  return totalWh / 1000;
}


async function loadHistory(fromISO, toISO) {
    const SENSOR_ID = document.documentElement.dataset.deviceId;
    const GATEWAY_ID = document.documentElement.dataset.gatewayId;

    const params = new URLSearchParams();
    if (fromISO) params.set('startDate', fromISO);
    if (toISO) params.set('endDate', toISO);

    const res = await fetch(
        `/manage-sensors/monitoring/${encodeURIComponent(GATEWAY_ID)}/${encodeURIComponent(SENSOR_ID)}/history?` + params.toString()
    );
    if (!res.ok) throw new Error("History fetch failed");
    const j = await res.json();

    // Hide sections by default
    const netSection = document.getElementById('network-quality-section');
    const sensSection = document.getElementById('sensor-metrics-section');
    if (netSection) netSection.style.display = 'none';
    if (sensSection) sensSection.style.display = 'none';

    // Clear containers
    if (networkMetricsContainer) networkMetricsContainer.innerHTML = '';
    if (sensorMetricsContainer) sensorMetricsContainer.innerHTML = '';
    dynamicMetricCharts = [];

    const devType = (document.documentElement.dataset.devType || '').toUpperCase();

    // ==============================
    // ENERGY / CONSO (HISTOGRAM)
    // ==============================
    if (devType === 'ENERGY' || devType === 'CONSO') {
        const consoSection = document.getElementById('consumption-histogram-section');
        if (consoSection) consoSection.style.display = 'block';

        // 1) Build delta series (Wh) per group from cumulative ENERGY indexes
        const { red, white, vent, other } = sumDeltaGroupsFromHistory(j);

        // 2) Choose grouping: hourly for <= 1 day, daily for > 1 day
        let intervalHours = 1;
        if (fromISO && toISO) {
            const fromD = new Date(fromISO);
            const toD = new Date(toISO);
            const diffDays = Math.ceil(Math.abs(toD - fromD) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) intervalHours = 24;
        }

        const getGroupingText = (interval) => {
            if (interval === 24) return "Daily";
            if (interval === 1) return "Hourly";
            return `every ${interval} hours`;
        };

        // 3) Group deltas by interval
        const redG = groupWhByInterval(red, intervalHours);
        const whiteG = groupWhByInterval(white, intervalHours);
        const ventG = groupWhByInterval(vent, intervalHours);
        const otherG = groupWhByInterval(other, intervalHours);

        // 4) Build sorted buckets union
        const allBuckets = Array.from(new Set([
            ...Object.keys(redG),
            ...Object.keys(whiteG),
            ...Object.keys(ventG),
            ...Object.keys(otherG),
        ])).sort();

        // 5) Labels
        const labels = allBuckets.map(bucketIso => {
            const d = new Date(bucketIso);
            if (intervalHours === 24) {
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
        });

        // 6) Datasets (kWh)
        const groupInfos = Object.values(consumptionCharts); // expected order: red, white, vent, other
        const datasets = [
            {
                label: groupInfos[0]?.label || 'Red Outlets',
                data: allBuckets.map(k => (Number(redG[k]) || 0) / 1000),
                backgroundColor: groupInfos[0]?.color,
                borderColor: groupInfos[0]?.color,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8
            },
            {
                label: groupInfos[1]?.label || 'White Outlets & Lightning',
                data: allBuckets.map(k => (Number(whiteG[k]) || 0) / 1000),
                backgroundColor: groupInfos[1]?.color,
                borderColor: groupInfos[1]?.color,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8
            },
            {
                label: groupInfos[2]?.label || 'Ventilation & Heaters',
                data: allBuckets.map(k => (Number(ventG[k]) || 0) / 1000),
                backgroundColor: groupInfos[2]?.color,
                borderColor: groupInfos[2]?.color,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8
            },
            {
                label: groupInfos[3]?.label || 'Other Circuits',
                data: allBuckets.map(k => (Number(otherG[k]) || 0) / 1000),
                backgroundColor: groupInfos[3]?.color,
                borderColor: groupInfos[3]?.color,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8
            }
        ];

        // 7) Create chart if needed
        if (!combinedConsumptionChart) {
            const chartCtx = ctx('histConsumptionAll');
            if (chartCtx) {
                const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: false,
                            ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 }
                        },
                        y: {
                            beginAtZero: true,
                            grace: '5%',
                            title: { display: true, text: 'Total Consumption (kWh)' }
                        }
                    },
                    plugins: { title: { display: true, text: '' } }
                };
                combinedConsumptionChart = new Chart(chartCtx, {
                    type: 'bar',
                    data: { labels: [], datasets: [] },
                    options: chartOptions
                });
            }
        }

        // 8) Update chart
        if (combinedConsumptionChart) {
            combinedConsumptionChart.data.labels = labels;
            combinedConsumptionChart.data.datasets = datasets;
            combinedConsumptionChart.options.plugins.title.text = `Consumption (kWh) - ${getGroupingText(intervalHours)}`;
            combinedConsumptionChart.update();
        }

        // 9) Totals by group (kWh)
        const sumKWh = (obj) => Object.values(obj || {}).reduce((s, v) => s + ((Number(v) || 0) / 1000), 0);

        const totals = {
            red: sumKWh(red),
            white: sumKWh(white),
            vent: sumKWh(vent),
            other: sumKWh(other)
        };

        // Update per-group totals
        const keys = Object.keys(consumptionCharts); // should match: red, white, vent, other
        const totalsArr = [totals.red, totals.white, totals.vent, totals.other];

        keys.forEach((groupKey, idx) => {
            const totalEl = document.getElementById(`hist-total-${groupKey}`);
            if (totalEl) {
                totalEl.textContent = totalsArr[idx].toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
        });

        // Total all groups
const totalAllGroups = totalKWhLikeBackend(j);
updateCard('kpi-card-conso','kpi-conso',
  totalAllGroups.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}),
  ' kWh'
);

        const histTotalEl = document.getElementById('hist-total-total');
        if (histTotalEl) {
            histTotalEl.textContent = totalAllGroups.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        // KPI conso
        updateCard(
            'kpi-card-conso',
            'kpi-conso',
            totalAllGroups > 0
                ? totalAllGroups.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '',
            ' kWh'
        );
    } else {
        // If not energy, hide conso histogram section if it exists
        const consoSection = document.getElementById('consumption-histogram-section');
        if (consoSection) consoSection.style.display = 'none';
        // hide conso KPI for non-energy, KPIs handler does it too but keep safe
        updateCard('kpi-card-conso', 'kpi-conso', '');
    }

    // ==============================
    // OTHER METRICS (RSSI/SNR + device metrics)
    // ==============================
    const networkMetrics = ['RSSI', 'SNR'];
    const sensorMetrics = DEVICE_TYPE_METRICS[devType] || [];

    const processMetric = (metricName, container) => {
        const canvasId = `histMetric-${metricName.replace(/[^a-zA-Z0-9]/g, '')}`;
        const chartTitle = METRIC_TITLES[metricName] || metricName;
        const legendLabel = chartTitle.replace(/\s*\(.*\)/, '');
        const color = getMetricColor(metricName);
        const inputData = j.data?.[metricName] || {};

        if (!container || Object.keys(inputData).length === 0) return;

        // Show section
        if (container.parentElement) container.parentElement.style.display = 'block';

        const chartCardHtml = `
            <div class="chart-container">
                <div class="chart-header">
                    <h4>${chartTitle}</h4>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-color" style="background: ${color};"></span> ${legendLabel}</span>
                    </div>
                </div>
                <div class="chart-canvas-wrapper">
                    <canvas id="${canvasId}"></canvas>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', chartCardHtml);

        const chartCtx = document.getElementById(canvasId)?.getContext("2d");
        if (!chartCtx) return;

        // Clone config to avoid shared references
        let chartConfig = JSON.parse(JSON.stringify(
            createChartConfig(chartTitle, color, '', getLastTimestamp(Object.keys(inputData)))
        ));

        const transformedData = Object.entries(inputData).map(([timestamp, value]) => ({ x: timestamp, y: value }));

        let bgColor = color + "A0";
        if (metricName === 'RSSI' || metricName === 'SNR') bgColor = 'transparent';

        chartConfig.data = {
            datasets: [{
                data: transformedData,
                borderColor: color,
                backgroundColor: bgColor,
                fill: true,
                tension: 0.1
            }]
        };

        const generatedLabels = generateLabels(Object.values(inputData || {}));
        let yType = containsStrings(generatedLabels) ? 'category' : 'linear';

        // Prevent last category label cut
        if (yType === 'category' && generatedLabels.length > 1) generatedLabels.pop();

        chartConfig.options.scales = {
            y: {
                type: yType,
                labels: generatedLabels,
                title: {
                    display: true,
                    text: chartTitle,
                    font: { size: 14, weight: 'bold' }
                },
                beginAtZero: true
            },
            x: {
                type: 'time',
                time: {
                    displayFormats: { 'day': 'yyyy-MM-dd', 'hour': 'HH:mm', 'minute': 'HH:mm' },
                    minUnit: 'minute'
                },
                title: {
                    display: true,
                    text: 'Time',
                    font: { size: 14, weight: 'bold' }
                },
                ticks: {
                    autoSkip: true,
                    maxTicksLimit: 10,
                    major: { enabled: true },
                    maxRotation: 0,
                    minRotation: 0
                },
                grid: {
                    color: function (context) {
                        return context.tick.major ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)';
                    }
                }
            }
        };

        const newChart = new Chart(chartCtx, chartConfig);
        newChart.update();
        dynamicMetricCharts.push(newChart);
    };

    networkMetrics.forEach(metricName => processMetric(metricName, networkMetricsContainer));
    sensorMetrics.forEach(metricName => processMetric(metricName, sensorMetricsContainer));

    // KPI cards (battery/rssi/period etc.)
    updateKPICards(j, fromISO, toISO);
}

async function loadChannelHistogramData(channels = [], fromISO, toISO) {
    const SENSOR_ID = document.documentElement.dataset.deviceId;
    const GATEWAY_ID = document.documentElement.dataset.gatewayId;
    if (!SENSOR_ID || !GATEWAY_ID || !fromISO || !toISO) return null;

    try {
        // Convert ISO strings to Date objects to interpret them in the browser's local timezone,
        // then convert back to an ISO string which will be in UTC but represent the correct local time.
        const startDate = new Date(fromISO);
        const endDate = new Date(toISO);

        const params = new URLSearchParams();
        params.set('startDate', startDate.toISOString());
        params.set('endDate', endDate.toISOString());
        channels.forEach(ch => params.append('channels', String(ch)));
        const res = await fetch(`/manage-sensors/monitoring/${GATEWAY_ID}/${SENSOR_ID}/consumption?` + params.toString());
        if (!res.ok) throw new Error(`Failed to fetch consumption data for channels ${channels.join(',')}: ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error("Error loading channel histogram data:", e);
        return null;
    }
}

// `containsStrings` and `generateLabels` are defined in monitoringSensor.js
// and are globally available.

function getBattery(data) {
    const lastBattery = Object.values(data.LAST_BATTERY_PERCENTAGE_VALUE || []);
    const battery = Object.values(data.BATTERY || []);
    if (lastBattery?.length > 0) {
        return lastBattery.map(x => parseInt(x, 10));
    } else if (battery?.length > 0) {
        return battery.map(x => parseInt(x, 10));
    } else {
        console.error("No battery data found");
        return [];
    }
}

function updateKPICards(data, fromISO, toISO) {
    const devType = (document.documentElement.dataset.devType || '').toUpperCase();

    // Total measurements
    const values = Object.values(data.data || []);
    let total = 0;
    if (values.length > 0) {
        total = values.map(x => Object.values(x).length).reduce((a, b) => a + b, 0);
    }
    updateCard('kpi-card-total', 'kpi-total', total > 0 ? total.toLocaleString() : '');

    if (devType === 'CONSO' || devType === 'ENERGY') {
        // The 'kpi-card-conso' is now updated inside the loadHistory function for ENERGY/CONSO sensors
        updateCard('kpi-card-battery', 'kpi-battery', ''); // Hide battery card
    } else {
        // Average battery for other sensors
        const pctValues = getBattery(data.data || []);
        const avgBattery = pctValues.length > 0 ? Math.round(pctValues.reduce((a, b) => a + b, 0) / pctValues.length) : '';
        updateCard('kpi-card-battery', 'kpi-battery', avgBattery, avgBattery !== '' ? '%' : '');
        updateCard('kpi-card-conso', 'kpi-conso', ''); // Hide conso card
    }

    // Average RSSI
    const rssiValues = Object.values(data.data.RSSI || []).map(x => parseInt(x, 10));
    const avgRssi = rssiValues.length > 0 ? Math.round(rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length) : '';
    updateCard('kpi-card-rssi', 'kpi-rssi', avgRssi, avgRssi !== '' ? ' dBm' : '');

    // Period
    if (fromISO && toISO) {
        const from = new Date(fromISO);
        const to = new Date(toISO);
        const diffMs = to - from;
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffHours / 24);
        const periodText = diffDays > 0 ? `${diffDays} day${diffDays > 1 ? 's' : ''}` : `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
        updateCard('kpi-card-period', 'kpi-period', periodText);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('hist-load')?.addEventListener('click', async () => {
        const from = document.getElementById('hist-from')?.value || '';
        const to = document.getElementById('hist-to')?.value || '';
        try {
            // Construct ISO string, ensuring minutes are set to 00.
            const fromDate = from ? new Date(from) : null;
            if (fromDate) fromDate.setMinutes(0, 0, 0);
            const fromISO = fromDate ? fromDate.toISOString() : '';
            const toDate = to ? new Date(to) : null;
            if (toDate) toDate.setMinutes(0, 0, 0);
            const toISO = toDate ? toDate.toISOString() : '';
            await loadHistory(fromISO, toISO);
        } catch (e) {
            console.error(e);
            alert("Could not load history.");
        }
    });

    // Default date range
    const to = new Date();
    to.setHours(23, 0, 0, 0);

    const from = new Date();
    from.setHours(0, 0, 0, 0);

    const toLocalISOString = (date) => {
        const tzoffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
    };

    document.getElementById('hist-from').value = toLocalISOString(from);
    document.getElementById('hist-to').value = toLocalISOString(to);

    loadHistory(from.toISOString(), to.toISOString());
});