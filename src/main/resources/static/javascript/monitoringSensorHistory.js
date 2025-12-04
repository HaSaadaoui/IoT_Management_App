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

async function loadHistory(fromISO, toISO) {
    const SENSOR_ID = document.documentElement.dataset.deviceId;
    const GATEWAY_ID = document.documentElement.dataset.gatewayId;
    const params = new URLSearchParams();
    if (fromISO) params.set('startDate', fromISO);
    if (toISO) params.set('endDate', toISO);
    const res = await fetch(`/manage-sensors/monitoring/${encodeURIComponent(GATEWAY_ID)}/${encodeURIComponent(SENSOR_ID)}/history?` + params.toString());
    if (!res.ok) throw new Error("History fetch failed");
    const j = await res.json();

    document.getElementById('network-quality-section').style.display = 'none';
    document.getElementById('sensor-metrics-section').style.display = 'none';

    if (networkMetricsContainer) networkMetricsContainer.innerHTML = '';
    if (sensorMetricsContainer) sensorMetricsContainer.innerHTML = '';
    dynamicMetricCharts = [];

    const devType = (document.documentElement.dataset.devType || '').toUpperCase();
    if (devType === 'ENERGY' || devType === 'CONSO') {
        document.getElementById('consumption-histogram-section').style.display = 'block';

        const allGroupData = await Promise.all(
            Object.values(consumptionCharts).map(group =>
                loadChannelHistogramData(group.channels, fromISO, toISO)
            )
        );

        // Helper to group data by a specified interval in hours
        const groupDataByInterval = (data, intervalHours = 1) => {
            if (!data) return {};
            const grouped = {};
            for (const timestamp in data) {
                const date = new Date(timestamp);
                const hour = date.getHours();
                // Calculate the start hour of the interval (e.g., 0, 6, 12, 18)
                const groupHour = Math.floor(hour / intervalHours) * intervalHours;
                
                const groupKeyDate = new Date(date);
                groupKeyDate.setHours(groupHour, 0, 0, 0);
                const groupKey = groupKeyDate.toISOString();

                if (!grouped[groupKey]) {
                    grouped[groupKey] = 0;
                }
                grouped[groupKey] += data[timestamp];
            }
            return grouped;
        };

        const getGroupingText = (interval) => {
            if (interval === 24) {
                return "Daily";
            }
            if (interval === 1) {
                return "Hourly";
            }
            return `every ${interval} hours`;
        };

        // Determine grouping interval based on the selected date range
        let intervalHours = 1; // Default to 1 hour
        const from = new Date(fromISO);
        const to = new Date(toISO);
        const diffTime = Math.abs(to - from);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
            intervalHours = 24; // Group by day if range is more than 1 day
        }
        const intervalGroupedData = allGroupData.map(groupData => groupDataByInterval(groupData, intervalHours));

        // Generate labels showing just the start time for each interval
        const allTimestamps = new Set();
        intervalGroupedData.forEach(group => {
            if (group) {
                Object.keys(group).forEach(ts => allTimestamps.add(ts));
            }
        });
        const allLabels = Array.from(allTimestamps).sort();

        const labels = allLabels.map(intervalStart => {
            // Parse the full ISO string to correctly handle it as a UTC date.
            const startDate = new Date(intervalStart);
            // For daily grouping, show only the date. Otherwise, show date and time.
            if (intervalHours === 24) {
                return startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            } else {
                const startStr = startDate.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
                return startStr;
            }
        });

        const datasets = intervalGroupedData.map((intervalData, index) => {
            const groupInfo = Object.values(consumptionCharts)[index];
            const values = allLabels.map(key => (intervalData[key] || 0) / 1000); // Wh to kWh
            return { label: groupInfo.label, data: values, backgroundColor: groupInfo.color, borderColor: groupInfo.color, borderWidth: 1, borderRadius: 4, barPercentage: 0.8 };
        });

        if (!combinedConsumptionChart) {
            const chartCtx = ctx('histConsumptionRed');
            if (chartCtx) {
                const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: false,
                            ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 }
                        },
                        y: { beginAtZero: true, grace: '5%', title: { display: true, text: 'Total Consumption (kWh)' } }
                    },
                    plugins: { title: { display: true, text: '' } }
                };
                combinedConsumptionChart = new Chart(chartCtx, { type: 'bar', data: { labels: [], datasets: [] }, options: chartOptions });
            }
        }

        if (combinedConsumptionChart) {
            combinedConsumptionChart.data.labels = labels;
            combinedConsumptionChart.data.datasets = datasets;
            // Update the chart title to include the grouping interval
            combinedConsumptionChart.options.plugins.title.text = `Total Consumption (kWh) - ${intervalHours}h`;
            combinedConsumptionChart.options.plugins.title.text = `Consumption (kWh) - ${getGroupingText(intervalHours)}`;
            combinedConsumptionChart.update();
        }

        // Calculate the total for each group and update its display
        const groupTotals = allGroupData.map((groupData, index) => {
            const groupKey = Object.keys(consumptionCharts)[index];
            const totalKWh = Object.values(groupData || {}).reduce((sum, v) => sum + v / 1000, 0);
            const totalEl = document.getElementById(`hist-total-${groupKey}`);
            if (totalEl) totalEl.textContent = totalKWh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return totalKWh;
        });

        // Sum all groups for the total consumption display
        const totalAllGroups = groupTotals.reduce((sum, val) => sum + val, 0);

        // Update the hist-total-total element (below the histogram chart)
        const histTotalEl = document.getElementById('hist-total-total');
        if (histTotalEl) histTotalEl.textContent = totalAllGroups.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Update the KPI card
        updateCard('kpi-card-conso', 'kpi-conso', totalAllGroups > 0 ? totalAllGroups.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', ' kWh');
    }

    const networkMetrics = ['RSSI', 'SNR'];
    const sensorMetrics = DEVICE_TYPE_METRICS[devType] || [];

    const processMetric = (metricName, container) => {
        const canvasId = `histMetric-${metricName.replace(/[^a-zA-Z0-9]/g, '')}`;
        const chartTitle = METRIC_TITLES[metricName] || metricName;
        const legendLabel = chartTitle.replace(/\s*\(.*\)/, ''); // Remove unit for legend
        const color = getMetricColor(metricName);
        const inputData = j.data[metricName] || {};

        if (Object.keys(inputData).length === 0) return;

        container.parentElement.style.display = 'block';
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
            </div>`;
        if (container) container.insertAdjacentHTML('beforeend', chartCardHtml);

        const chartCtx = document.getElementById(canvasId)?.getContext("2d");
        if (chartCtx) {
            let chartConfig = JSON.parse(JSON.stringify(createChartConfig(chartTitle, color, '', getLastTimestamp(Object.keys(inputData)))));
            const transformedData = Object.entries(inputData).map(([timestamp, value]) => ({ x: timestamp, y: value }));
            let bgColor = color + "A0";
            if (metricName === 'RSSI' || metricName === 'SNR') {
                bgColor = 'transparent';
            }
            chartConfig.data = {
                datasets: [{
                    data: transformedData, borderColor: color, backgroundColor: bgColor, fill: true, tension: 0.1,
                }]
            };

            const generatedLabels = generateLabels(Object.values(j.data[metricName] || {}));
            let yType = containsStrings(generatedLabels) ? 'category' : 'linear';
            
            // Omit the last label to prevent it from being cut off at the top of the chart
            if (yType === 'category' && generatedLabels.length > 1) {
                generatedLabels.pop();
            }

            chartConfig.options.scales = {
                y: {
                    type: yType, labels: generatedLabels, title: { display: true, text: chartTitle, font: { size: 14, weight: 'bold' } }, beginAtZero: true,
                },
                x: {
                    type: 'time',
                    time: { displayFormats: { 'day': 'yyyy-MM-dd', 'hour': 'HH:mm', 'minute': 'HH:mm' }, minUnit: 'minute' },
                    title: { display: true, text: 'Time', font: { size: 14, weight: 'bold' } },
                    ticks: { autoSkip: true, maxTicksLimit: 10, major: { enabled: true }, maxRotation: 0, minRotation: 0 },
                    grid: {
                        color: function(context) {
                            return context.tick.major ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)';
                        }
                    }
                }
            };
            let newChart = new Chart(chartCtx, chartConfig);
            newChart.update();
            dynamicMetricCharts.push(newChart);
        }
    };

    networkMetrics.forEach(metricName => processMetric(metricName, networkMetricsContainer));
    sensorMetrics.forEach(metricName => processMetric(metricName, sensorMetricsContainer));

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