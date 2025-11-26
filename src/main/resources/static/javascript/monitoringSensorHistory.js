// ===== SENSOR MONITORING - HISTORY PANE =====

// ===== Chart Helpers =====
// `createChartConfig` and `getChartOptionsWithUnits` are defined in monitoringSensor.js
// and are globally available.

// ===== History Chart Variables =====
// `networkMetricsContainer`, `sensorMetricsContainer`, `consumptionCharts`
// and `METRIC_TITLES` are defined in monitoringSensor.js and are globally available.
// `DEVICE_TYPE_METRICS` is also defined in monitoringSensor.js.
// `getMetricColor` is also defined in monitoringSensor.js.

function getLastTimestamp(values) {
    const ts = values[values.length - 1];
    const parsed = new Date(ts);
    return parsed.toLocaleDateString("en-CA");
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
        const groupDataByInterval = (data, intervalHours = 6) => {
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
            return `By ${interval}h`;
        };

        // Determine grouping interval based on the selected date range
        let intervalHours = 1; // Default to 1 hour
        const from = new Date(fromISO);
        const to = new Date(toISO);
        const diffDays = (to - from) / (1000 * 60 * 60 * 24);

        if (diffDays > 30) {
            intervalHours = 24; // Group by day for ranges over a month
        } else if (diffDays > 7) {
            intervalHours = 12; // Group by 12 hours for ranges over a week
        } else if (diffDays > 2) {
            intervalHours = 6;  // Group by 6 hours for ranges over 2 days
        }
        // Group all datasets by 6-hour intervals
        const intervalGroupedData = allGroupData.map(groupData => groupDataByInterval(groupData, intervalHours));

        // Generate labels showing just the start time for each interval
        const firstGroupInterval = intervalGroupedData[0] || {};
        const labels = Object.keys(firstGroupInterval).map(intervalStart => {
            const startDate = new Date(intervalStart);
            // For daily grouping, show only the date. Otherwise, show date and time.
            if (intervalHours === 24) {
                return startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            } else {
                const startStr = startDate.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                return startStr;
            }
        });

        const datasets = intervalGroupedData.map((intervalData, index) => {
            const groupInfo = Object.values(consumptionCharts)[index];
            const values = Object.keys(firstGroupInterval).map(key => (intervalData[key] || 0) / 1000); // Wh to kWh
            return { label: groupInfo.label, data: values, backgroundColor: groupInfo.color, borderColor: groupInfo.color, borderWidth: 1, borderRadius: 4, barPercentage: 0.8 };
        });

        if (!combinedConsumptionChart) {
            const chartCtx = ctx('histConsumptionRed');
            if (chartCtx) {
                const chartOptions = { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false }, y: { beginAtZero: true, title: { display: true, text: 'Total Consumption (kWh)' } } }, plugins: { title: { display: true, text: '' } } };
                combinedConsumptionChart = new Chart(chartCtx, { type: 'bar', data: { labels: [], datasets: [] }, options: chartOptions });
            }
        }

        if (combinedConsumptionChart) {
            combinedConsumptionChart.data.labels = labels;
            combinedConsumptionChart.data.datasets = datasets;
            // Update the chart title to include the grouping interval
            combinedConsumptionChart.options.plugins.title.text = `Total Consumption (kWh) - Grouped by ${intervalHours}h`;
            combinedConsumptionChart.options.plugins.title.text = `Consumption (kWh) - ${getGroupingText(intervalHours)} Grouping`;
            combinedConsumptionChart.update();
        }

        allGroupData.forEach((groupData, index) => {
            const groupKey = Object.keys(consumptionCharts)[index];
            const totalKWh = Object.values(groupData || {}).reduce((sum, v) => sum + v, 0) / 1000;
            const totalEl = document.getElementById(`hist-total-${groupKey}`);
            if (totalEl) {
                totalEl.textContent = totalKWh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        });
    }

    const networkMetrics = ['RSSI', 'SNR'];
    const sensorMetrics = DEVICE_TYPE_METRICS[devType] || [];

    const processMetric = (metricName, container) => {
        const canvasId = `histMetric-${metricName.replace(/[^a-zA-Z0-9]/g, '')}`;
        const chartTitle = METRIC_TITLES[metricName] || metricName;
        const color = getMetricColor(metricName);
        const inputData = j.data[metricName] || {};

        if (Object.keys(inputData).length === 0) return;

        container.parentElement.style.display = 'block';
        const chartCardHtml = `
            <div class="chart-container">
                <div class="chart-header">
                    <h4>${chartTitle}</h4>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-color" style="background: ${color};"></span> ${metricName}</span>
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

            chartConfig.options.scales = {
                y: {
                    type: yType, labels: generatedLabels, title: { display: true, text: chartTitle, font: { size: 14, weight: 'bold' } }, beginAtZero: true,
                },
                x: {
                    type: 'time',
                    time: { unit: 'day', displayFormats: { 'day': 'yyyy-MM-dd', 'hour': 'h:mm a', 'minute': 'h:mm a' }, minUnit: 'minute' },
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
        const params = new URLSearchParams();
        params.set('startDate', fromISO.split('T')[0]);
        params.set('endDate', toISO.split('T')[0]);
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
    // Helper to update a KPI card's value and visibility
    const updateCard = (cardId, valueElId, value, unit = '') => {
        const card = document.getElementById(cardId);
        const valueEl = document.getElementById(valueElId);
        if (!card || !valueEl) return;

        const hasValue = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);

        card.style.display = hasValue ? 'flex' : 'none';
        if (hasValue) {
            valueEl.textContent = `${value}${unit}`;
        }
    };

    const devType = (document.documentElement.dataset.devType || '').toUpperCase();

    // Total measurements
    const values = Object.values(data.data || []);
    let total = 0;
    if (values.length > 0) {
        total = values.map(x => Object.values(x).length).reduce((a, b) => a + b, 0);
    }
    updateCard('kpi-card-total', 'kpi-total', total > 0 ? total.toLocaleString() : '');

    if (devType === 'CONSO' || devType === 'ENERGY') {
        // Average kWh for CONSO/ENERGY sensors
        const consumptionMetrics = Object.keys(data.data).filter(k => k.startsWith('CONSUMPTION_CHANNEL_'));
        let totalKWh = 0;
        let pointCount = 0;
        consumptionMetrics.forEach(metric => {
            const metricValues = Object.values(data.data[metric] || {});
            totalKWh += metricValues.reduce((sum, v) => sum + (parseFloat(v) || 0), 0) / 1000;
            pointCount += metricValues.length;
        });
        const avgKWh = pointCount > 0 ? (totalKWh / pointCount).toFixed(2) : '';
        updateCard('kpi-card-conso', 'kpi-conso', avgKWh, ' kWh');
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
            await loadHistory(from ? new Date(from).toISOString() : '', to ? new Date(to).toISOString() : '');
        } catch (e) {
            console.error(e);
            alert("Could not load history.");
        }
    });

    // Default date range: last 3 days including today
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const from = new Date();
    from.setDate(from.getDate() - 2);
    from.setHours(0, 0, 0, 0);

    const toLocalISOString = (date) => {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        return new Date(date - tzoffset).toISOString().slice(0, 16);
    };

    document.getElementById('hist-from').value = toLocalISOString(from);
    document.getElementById('hist-to').value = toLocalISOString(to);

    loadHistory(from.toISOString(), to.toISOString());
});