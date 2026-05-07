// ===== GATEWAY MONITORING - HISTORY PANE =====

const GATEWAY_HISTORY_METRICS = {
    CPU_PERCENT: { title: 'CPU Usage', unit: '%', color: '#007bff' },
    CPU_TEMP: { title: 'CPU Temperature', unit: 'C', color: '#ef4444' },
    RAM_USED_GB: { title: 'RAM Used', unit: 'GB', color: '#28a745' },
    DISK_USAGE_PERCENT: { title: 'Disk Usage', unit: '%', color: '#FFA500' },
    DEVICE_COUNT: { title: 'Connected Sensors', unit: '', color: '#662179' },
    GATEWAY_STATUS: { title: 'Gateway Status', unit: '', color: '#64748b', status: true }
};

let gatewayHistoryCharts = [];

function gatewayHistoryEl(id) {
    return document.getElementById(id);
}

function setGatewayKpi(id, value) {
    const node = gatewayHistoryEl(id);
    if (node) node.textContent = value == null || value === '' ? '--' : String(value);
}

function toLocalDatetimeValue(date) {
    const tzoffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
}

function parseNumericValues(metricMap) {
    return Object.entries(metricMap || {})
        .map(([timestamp, value]) => ({ timestamp, value: Number(value) }))
        .filter(point => Number.isFinite(point.value));
}

function average(values) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPeriodLabel(fromISO, toISO) {
    if (!fromISO || !toISO) return '--';
    const hours = Math.max(0, Math.round((new Date(toISO) - new Date(fromISO)) / 36e5));
    if (hours >= 48) return `${Math.round(hours / 24)} days`;
    return `${hours} hours`;
}

function clearGatewayHistoryCharts() {
    gatewayHistoryCharts.forEach(chart => {
        try {
            chart.destroy();
        } catch (_) {}
    });
    gatewayHistoryCharts = [];

    const container = gatewayHistoryEl('gateway-history-charts');
    if (container) container.innerHTML = '';
}

function metricToChartPoints(metricName, metricMap) {
    const entries = Object.entries(metricMap || {}).sort(([a], [b]) => new Date(a) - new Date(b));
    if (metricName === 'GATEWAY_STATUS') {
        return entries.map(([timestamp, value]) => ({
            x: new Date(timestamp).toLocaleString(),
            y: String(value).toLowerCase() === 'active' ? 1 : 0
        }));
    }
    return entries
        .map(([timestamp, value]) => ({ x: new Date(timestamp).toLocaleString(), y: Number(value) }))
        .filter(point => Number.isFinite(point.y));
}

function createGatewayMetricChart(metricName, metricMap) {
    const container = gatewayHistoryEl('gateway-history-charts');
    const config = GATEWAY_HISTORY_METRICS[metricName];
    if (!container || !config) return;

    const points = metricToChartPoints(metricName, metricMap);
    if (!points.length) return;

    const canvasId = `gateway-history-${metricName.toLowerCase()}`;
    container.insertAdjacentHTML('beforeend', `
        <div class="chart-container">
            <div class="chart-header">
                <h4>${config.title}</h4>
            </div>
            <div class="chart-canvas-wrapper">
                <canvas id="${canvasId}"></canvas>
            </div>
        </div>
    `);

    const ctx = gatewayHistoryEl(canvasId)?.getContext('2d');
    if (!ctx) return;

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map(point => point.x),
            datasets: [{
                label: config.title,
                data: points.map(point => point.y),
                borderColor: config.color,
                backgroundColor: config.color + '22',
                fill: true,
                tension: 0.25,
                pointRadius: 2,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => {
                            if (metricName === 'GATEWAY_STATUS') {
                                return context.parsed.y === 1 ? 'Active' : 'Inactive';
                            }
                            return `${config.title}: ${context.parsed.y}${config.unit ? ' ' + config.unit : ''}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0 },
                    title: { display: true, text: 'Time' }
                },
                y: config.status
                    ? {
                        min: 0,
                        max: 1,
                        ticks: {
                            stepSize: 1,
                            callback: value => value === 1 ? 'Active' : 'Inactive'
                        }
                    }
                    : {
                        beginAtZero: metricName !== 'CPU_TEMP',
                        title: { display: true, text: config.unit ? `${config.title} (${config.unit})` : config.title }
                    }
            }
        }
    });

    gatewayHistoryCharts.push(chart);
}

function updateGatewayHistoryKpis(data, fromISO, toISO) {
    const allMetricMaps = Object.values(data.data || {});
    const total = allMetricMaps.reduce((sum, metricMap) => sum + Object.keys(metricMap || {}).length, 0);
    setGatewayKpi('gateway-kpi-total', total ? total.toLocaleString() : '--');

    const cpuAvg = average(parseNumericValues(data.data?.CPU_PERCENT).map(point => point.value));
    setGatewayKpi('gateway-kpi-cpu', cpuAvg == null ? '--' : `${cpuAvg.toFixed(1)} %`);

    const ramAvg = average(parseNumericValues(data.data?.RAM_USED_GB).map(point => point.value));
    setGatewayKpi('gateway-kpi-ram', ramAvg == null ? '--' : `${ramAvg.toFixed(2)} GB`);

    setGatewayKpi('gateway-kpi-period', getPeriodLabel(fromISO, toISO));
}

async function loadGatewayHistory(fromISO, toISO) {
    const gatewayId = window.gatewayId;
    if (!gatewayId) return;

    const params = new URLSearchParams();
    params.set('startDate', fromISO);
    params.set('endDate', toISO);

    const response = await fetch(`/manage-gateways/monitoring/${encodeURIComponent(gatewayId)}/history?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Gateway history fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const selectedMetric = gatewayHistoryEl('gateway-hist-metric')?.value || 'ALL';

    clearGatewayHistoryCharts();
    updateGatewayHistoryKpis(data, fromISO, toISO);

    const metricNames = selectedMetric === 'ALL'
        ? Object.keys(GATEWAY_HISTORY_METRICS)
        : [selectedMetric];

    metricNames.forEach(metricName => createGatewayMetricChart(metricName, data.data?.[metricName] || {}));

    const container = gatewayHistoryEl('gateway-history-charts');
    if (container && container.children.length === 0) {
        container.innerHTML = '<div class="history-empty card">No gateway data found for this period.</div>';
    }
}

function initGatewayTabs() {
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const pane = button.dataset.pane;
            document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.toggle('is-active', tab === button));
            gatewayHistoryEl('pane-live')?.classList.toggle('hidden', pane !== 'live');
            gatewayHistoryEl('pane-history')?.classList.toggle('hidden', pane !== 'history');
        });
    });
}

function initGatewayHistoryDefaults() {
    const to = new Date();
    to.setHours(23, 0, 0, 0);

    const from = new Date();
    from.setHours(0, 0, 0, 0);

    const fromInput = gatewayHistoryEl('gateway-hist-from');
    const toInput = gatewayHistoryEl('gateway-hist-to');
    if (fromInput) fromInput.value = toLocalDatetimeValue(from);
    if (toInput) toInput.value = toLocalDatetimeValue(to);

    loadGatewayHistory(from.toISOString(), to.toISOString()).catch(error => {
        console.warn('Could not load gateway history defaults:', error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initGatewayTabs();

    gatewayHistoryEl('gateway-hist-load')?.addEventListener('click', async () => {
        const from = gatewayHistoryEl('gateway-hist-from')?.value;
        const to = gatewayHistoryEl('gateway-hist-to')?.value;

        try {
            const fromDate = from ? new Date(from) : null;
            const toDate = to ? new Date(to) : null;
            if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
                alert('Please select a valid period.');
                return;
            }
            if (fromDate) fromDate.setMinutes(0, 0, 0);
            if (toDate) toDate.setMinutes(0, 0, 0);
            await loadGatewayHistory(fromDate.toISOString(), toDate.toISOString());
        } catch (error) {
            console.error(error);
            alert('Could not load gateway history.');
        }
    });

    gatewayHistoryEl('gateway-hist-metric')?.addEventListener('change', () => {
        gatewayHistoryEl('gateway-hist-load')?.click();
    });

    initGatewayHistoryDefaults();
});
