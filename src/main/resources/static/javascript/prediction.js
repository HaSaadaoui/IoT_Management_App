// ===== PREDICTION PAGE - CHART LOGIC =====
// Uses shared utilities from chartUtils.js

// Chart instance storage
const predictionCharts = {};
const historicalCharts = {};
const scenarioCharts = {};

let historicalT0Loaded = false;

// ===== DATA EXTRACTION HELPERS =====

/**
 * Extracts consumption data from API response
 */
function extractConsumptionData(data) {
    return {
        timestamps: data.timestamps || [],
        predicted:
            data.predicted_consumption ?? data.predictedConsumption ?? [],
        truth: data.true_consumption ?? data.trueConsumption ?? [],
        absError: data.abs_error ?? data.absError ?? [],
    };
}

/**
 * Aggregates time-series data by hour or day
 * @param {Object} data - Consumption data with timestamps and values
 * @param {string} granularity - 'raw', 'hourly', or 'daily'
 * @returns {Object} Aggregated data
 */
function aggregateData(data, granularity) {
    if (granularity === "raw") {
        return data;
    }

    const { timestamps, predicted, truth, absError } = data;

    if (!timestamps.length) {
        return data;
    }

    const aggregated = {};

    timestamps.forEach((ts, idx) => {
        const date = new Date(ts);
        let key;

        if (granularity === "hourly") {
            // Group by date + hour (e.g., "2024-08-06T09")
            key = ts.substring(0, 13); // "YYYY-MM-DDTHH"
        } else if (granularity === "daily") {
            // Group by date (e.g., "2024-08-06")
            key = ts.substring(0, 10); // "YYYY-MM-DD"
        }

        if (!aggregated[key]) {
            aggregated[key] = {
                timestamp: key,
                predicted: [],
                truth: [],
                absError: [],
                count: 0,
            };
        }

        aggregated[key].predicted.push(predicted[idx]);
        aggregated[key].truth.push(truth[idx]);
        aggregated[key].absError.push(absError[idx]);
        aggregated[key].count++;
    });

    // Calculate averages for each bucket
    const keys = Object.keys(aggregated).sort();
    const newTimestamps = [];
    const newPredicted = [];
    const newTruth = [];
    const newAbsError = [];

    keys.forEach((key) => {
        const bucket = aggregated[key];
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

        newTimestamps.push(bucket.timestamp);
        newPredicted.push(avg(bucket.predicted));
        newTruth.push(avg(bucket.truth));
        newAbsError.push(avg(bucket.absError));
    });

    return {
        timestamps: newTimestamps,
        predicted: newPredicted,
        truth: newTruth,
        absError: newAbsError,
    };
}

/**
 * Extracts scenario data from API response
 */
function extractScenarioData(data) {
    const rawScenarios = data.scenarios || [];
    const filtered = rawScenarios.filter(
        (s) =>
            !String(s.scenario).startsWith("Low temperature") &&
            !String(s.scenario).startsWith("High temperature"),
    );

    return {
        labels: filtered.map((s) => s.scenario),
        values: filtered.map((s) =>
            Number(s.predictedConsumption ?? s.predicted_consumption),
        ),
        deltas: filtered.map((s) => Number(s.delta ?? s.delta_pct)),
    };
}

// ===== CHART RENDERING FUNCTIONS =====

/**
 * Renders a prediction line chart (Online tab)
 */
function renderPredictionChart(canvasId, data, labelSuffix) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn("Canvas not found:", canvasId);
        return;
    }

    const { timestamps, predicted } = extractConsumptionData(data);
    const {
        COLORS,
        createLineDataset,
        createOrUpdateChart,
        formatTimestamp,
        findDayBoundaries,
        createDayAnnotations,
    } = ChartUtils;

    // Destroy existing chart
    if (predictionCharts[canvasId]) {
        predictionCharts[canvasId].destroy();
    }

    // Find day boundaries for grid splits
    const dayBoundaries = findDayBoundaries(timestamps);

    // Create config using shared utilities
    const config = {
        type: "line",
        data: {
            labels: timestamps.map((ts) => formatTimestamp(ts, "short")),
            datasets: [
                createLineDataset({
                    label:
                        "Predicted consumption" +
                        (labelSuffix ? ` (${labelSuffix})` : ""),
                    data: predicted,
                    color: COLORS.primary,
                    fill: true,
                }),
            ],
        },
        options: buildLineChartOptions({
            yAxisTitle: "Consumption (W)",
            dayBoundaries,
            timestamps,
        }),
    };

    predictionCharts[canvasId] = createOrUpdateChart(canvas, config);
}

/**
 * Renders historical charts (backtest + error) as histograms
 * @param {Object} data - Raw data from API
 * @param {string} granularity - 'raw', 'hourly', or 'daily'
 */
function renderHistoricalCharts(data, granularity = "hourly") {
    const canvas1 = document.getElementById("chart-historical-backtest");
    const canvas2 = document.getElementById("chart-historical-scenarios");

    if (!canvas1 || !canvas2) {
        console.warn("Historical canvases not found");
        return;
    }

    // Extract and aggregate data
    const rawData = extractConsumptionData(data);
    const aggregatedData = aggregateData(rawData, granularity);
    const { timestamps, predicted, truth, absError } = aggregatedData;

    const {
        COLORS,
        createBarDataset,
        createOrUpdateChart,
        formatTimestamp,
        findDayBoundaries,
        hexToRgba,
    } = ChartUtils;

    const dayBoundaries = findDayBoundaries(timestamps);

    // Format labels based on granularity
    const formattedLabels = timestamps.map((ts) => {
        if (granularity === "daily") {
            return formatTimestamp(ts + "T00:00:00Z", "date");
        } else if (granularity === "hourly") {
            return formatTimestamp(ts + ":00:00Z", "short");
        } else {
            return formatTimestamp(ts, "short");
        }
    });

    // Convert W to kWh and calculate difference
    const predictedKWh = predicted.map((w) => w / 1000);
    const truthKWh = truth.map((w) => w / 1000);
    const differenceKWh = predicted.map((p, i) => (p - truth[i]) / 1000);

    // Chart 1: Predicted vs Real (Bar chart)
    destroyChart(historicalCharts, "backtest");
    historicalCharts["backtest"] = createOrUpdateChart(canvas1, {
        type: "bar",
        data: {
            labels: formattedLabels,
            datasets: [
                {
                    label: "Predicted (kWh)",
                    data: predictedKWh,
                    backgroundColor: hexToRgba(COLORS.primary, 0.7),
                    borderColor: COLORS.primary,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.9,
                    categoryPercentage: 0.9,
                },
                {
                    label: "Real (kWh)",
                    data: truthKWh,
                    backgroundColor: hexToRgba(COLORS.success, 0.7),
                    borderColor: COLORS.success,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.9,
                    categoryPercentage: 0.9,
                },
            ],
        },
        options: {
            ...buildBarChartOptions({
                xAxisTitle: "Time",
                yAxisTitle: "Consumption (kWh)",
                dayBoundaries,
                timestamps,
            }),
            scales: {
                ...buildBarChartOptions({
                    xAxisTitle: "Time",
                    yAxisTitle: "Consumption (kWh)",
                    dayBoundaries,
                    timestamps,
                }).scales,
                x: {
                    ...buildBarChartOptions({
                        xAxisTitle: "Time",
                        yAxisTitle: "Consumption (kWh)",
                        dayBoundaries,
                        timestamps,
                    }).scales.x,
                    stacked: true,
                },
                y: {
                    ...buildBarChartOptions({
                        xAxisTitle: "Time",
                        yAxisTitle: "Consumption (kWh)",
                        dayBoundaries,
                        timestamps,
                    }).scales.y,
                    stacked: true,
                },
            },
        },
    });

    // Update summary text below the chart
    const totalPredicted = predictedKWh.reduce((a, b) => a + b, 0);
    const totalReal = truthKWh.reduce((a, b) => a + b, 0);
    const totalDifference = totalPredicted - totalReal;

    const summaryEl = document.getElementById("historical-summary");
    if (summaryEl) {
        summaryEl.innerHTML = `
            <span><strong>Predicted:</strong> ${totalPredicted.toFixed(3)} kWh</span>
            <span><strong>Real:</strong> ${totalReal.toFixed(3)} kWh</span>
            <span><strong>Difference:</strong> ${totalDifference.toFixed(3)} kWh</span>
        `;
    }

    // Convert absolute error to kWh
    const absErrorKWh = absError.map((w) => w / 1000);

    // Chart 2: Absolute Error (Line chart)
    destroyChart(historicalCharts, "error");
    historicalCharts["error"] = createOrUpdateChart(canvas2, {
        type: "line",
        data: {
            labels: formattedLabels,
            datasets: [
                {
                    label: "Absolute error (kWh)",
                    data: absErrorKWh,
                    backgroundColor: hexToRgba(COLORS.danger, 0.1),
                    borderColor: COLORS.danger,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: COLORS.danger,
                    pointBorderColor: COLORS.danger,
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3,
                },
            ],
        },
        options: buildLineChartOptions({
            yAxisTitle: "Error (kWh)",
            dayBoundaries,
            timestamps,
        }),
    });
}

/**
 * Renders scenario bar chart
 */
function renderScenarioChart(data) {
    const canvas = document.getElementById("chart-scenarios");
    if (!canvas) {
        console.warn("Scenario canvas not found");
        return;
    }

    const { labels, values, deltas } = extractScenarioData(data);
    const { COLORS, hexToRgba, createOrUpdateChart } = ChartUtils;

    destroyChart(scenarioCharts, "main");

    // Color bars based on delta direction
    const barColors = deltas.map((d) => getColorForDelta(d));

    scenarioCharts["main"] = createOrUpdateChart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Predicted daily consumption",
                    data: values,
                    backgroundColor: barColors.map((c) => hexToRgba(c, 0.8)),
                    borderColor: barColors,
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.7,
                },
            ],
        },
        options: buildBarChartOptions({
            xAxisTitle: "Scenario",
            yAxisTitle: "Consumption (W)",
            tooltipCallback: (ctx) =>
                formatScenarioTooltip(ctx, values, deltas),
        }),
    });
}

// ===== CHART OPTIONS BUILDERS =====

/**
 * Builds line chart options with day boundaries
 */
function buildLineChartOptions({
    yAxisTitle,
    dayBoundaries = [],
    timestamps = [],
}) {
    const {
        createBaseChartOptions,
        createAxisTitle,
        createGridOptions,
        createDayAnnotations,
    } = ChartUtils;

    const baseOptions = createBaseChartOptions({});

    return {
        ...baseOptions,
        scales: {
            x: {
                ticks: {
                    maxTicksLimit: 10,
                    autoSkip: true,
                    font: { size: 11 },
                },
                title: createAxisTitle("Time"),
                grid: createGridOptions(true),
            },
            y: {
                beginAtZero: false,
                title: createAxisTitle(yAxisTitle),
                grid: createGridOptions(true),
            },
        },
        plugins: {
            ...baseOptions.plugins,
            annotation:
                dayBoundaries.length > 0
                    ? createDayAnnotations(dayBoundaries, timestamps)
                    : undefined,
        },
    };
}

/**
 * Builds bar chart options with optional day boundaries
 */
function buildBarChartOptions({
    xAxisTitle,
    yAxisTitle,
    tooltipCallback,
    dayBoundaries = [],
    timestamps = [],
}) {
    const {
        createBaseChartOptions,
        createAxisTitle,
        createGridOptions,
        createTooltipOptions,
        createDayAnnotations,
    } = ChartUtils;

    const baseOptions = createBaseChartOptions({});

    return {
        ...baseOptions,
        scales: {
            x: {
                title: createAxisTitle(xAxisTitle),
                grid: createGridOptions(false),
                ticks: {
                    maxTicksLimit: 15,
                    autoSkip: true,
                    font: { size: 10 },
                },
            },
            y: {
                beginAtZero: true,
                title: createAxisTitle(yAxisTitle),
                grid: createGridOptions(true),
            },
        },
        plugins: {
            ...baseOptions.plugins,
            tooltip: {
                ...createTooltipOptions({}),
                callbacks: tooltipCallback
                    ? { label: tooltipCallback }
                    : undefined,
            },
            annotation:
                dayBoundaries.length > 0
                    ? createDayAnnotations(dayBoundaries, timestamps)
                    : undefined,
        },
    };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Returns color based on delta value
 */
function getColorForDelta(delta) {
    const { COLORS } = ChartUtils;
    if (delta > 0) return COLORS.warning; // Increase = orange
    if (delta < 0) return COLORS.success; // Decrease = green
    return COLORS.primary; // Baseline = purple
}

/**
 * Formats tooltip for scenario chart
 */
function formatScenarioTooltip(ctx, values, deltas) {
    const idx = ctx.dataIndex;
    const val = values[idx];
    const d = deltas[idx];
    const sign = d > 0 ? "+" : "";
    return ` ${val.toFixed(1)} W (${sign}${d.toFixed(1)}%)`;
}

/**
 * Safely destroys a chart if it exists
 */
function destroyChart(storage, key) {
    if (storage[key]) {
        storage[key].destroy();
        storage[key] = null;
    }
}

// ===== API DATA LOADERS =====

/**
 * Loads prediction data for a specific horizon
 */
async function loadPredictionForHorizon(horizon) {
    const canvasId = "chart-online-" + horizon;

    try {
        const response = await fetch(
            `/prediction/realtime/data?horizon=${encodeURIComponent(horizon)}`,
        );
        if (!response.ok) throw new Error("HTTP error " + response.status);

        const data = await response.json();
        renderPredictionChart(canvasId, data, horizon);
    } catch (err) {
        console.error("Error loading prediction for horizon", horizon, err);
    }
}

/**
 * Loads scenario data
 */
async function loadScenarios() {
    try {
        const resp = await fetch("/prediction/scenarios/data");
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        const data = await resp.json();
        renderScenarioChart(data);
    } catch (err) {
        console.error("Error loading scenarios", err);
    }
}

/**
 * Loads historical t0 list
 */
async function loadHistoricalT0List(horizon = "1h") {
    const select = document.getElementById("historical-t0-select");
    const statusEl = document.getElementById("historical-status");
    if (!select) return;

    try {
        setStatus(statusEl, "Loading t0 list...");

        const resp = await fetch(
            `/prediction/historical/t0-list?horizon=${encodeURIComponent(horizon)}`,
        );
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        const data = await resp.json();
        populateT0Select(select, data.t0_list || []);

        historicalT0Loaded = true;
        setStatus(statusEl, "");
    } catch (err) {
        console.error("Error loading t0 list", err);
        setStatus(statusEl, "Failed to load t0 list");
    }
}

/**
 * Determines appropriate granularity based on horizon
 * @param {string} horizon - Horizon value (1h, 1d, 1w, 3m)
 * @returns {string} Granularity ('raw', 'hourly', or 'daily')
 */
function getGranularityForHorizon(horizon) {
    switch (horizon) {
        case "1h":
            return "raw"; // Show all data points for 1 hour
        case "1d":
            return "hourly"; // Aggregate by hour for 1 day
        case "1w":
            return "daily"; // Aggregate by day for 1 week
        case "3m":
            return "daily"; // Aggregate by day for 3 months
        default:
            return "hourly";
    }
}

/**
 * Loads historical prediction data
 */
async function loadHistoricalPrediction() {
    const horizonSelect = document.getElementById("historical-horizon-select");
    const t0Select = document.getElementById("historical-t0-select");
    const statusEl = document.getElementById("historical-status");

    if (!horizonSelect || !t0Select) return;

    const horizon = horizonSelect.value;
    const t0 = t0Select.value;
    const granularity = getGranularityForHorizon(horizon);

    if (!t0) {
        setStatus(statusEl, "Please select t0");
        return;
    }

    try {
        setStatus(statusEl, "Loading historical prediction...");

        const url = `/prediction/historical/data?horizon=${encodeURIComponent(horizon)}&t0=${encodeURIComponent(t0)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        const data = await resp.json();
        renderHistoricalCharts(data, granularity);
        setStatus(statusEl, "");
    } catch (err) {
        console.error("Error loading historical prediction", err);
        setStatus(statusEl, "Failed to load historical prediction");
    }
}

// ===== UI HELPERS =====

/**
 * Sets status text
 */
function setStatus(el, text) {
    if (el) el.textContent = text;
}

/**
 * Populates t0 select dropdown
 * Uses batch rendering to prevent UI blocking with large datasets
 */
function populateT0Select(select, list) {
    select.innerHTML = "";

    if (list.length === 0) {
        addOption(select, "", "No t0 available");
        return;
    }

    // Limit the number of items to prevent performance issues
    const MAX_ITEMS = 200;
    const ordered = [...list].reverse();
    const limitedList = ordered.slice(0, MAX_ITEMS);

    // Show warning if list was truncated
    if (ordered.length > MAX_ITEMS) {
        console.warn(
            `T0 list truncated: showing ${MAX_ITEMS} of ${ordered.length} items`,
        );
        addOption(select, "", `-- Showing most recent ${MAX_ITEMS} items --`);
        select.options[0].disabled = true;
    }

    // Batch rendering to keep UI responsive
    const BATCH_SIZE = 50;
    let currentIndex = 0;

    function renderBatch() {
        const endIndex = Math.min(
            currentIndex + BATCH_SIZE,
            limitedList.length,
        );

        // Add options for this batch
        for (let i = currentIndex; i < endIndex; i++) {
            addOption(select, limitedList[i], limitedList[i]);
        }

        currentIndex = endIndex;

        // Continue rendering if more items remain
        if (currentIndex < limitedList.length) {
            requestAnimationFrame(renderBatch);
        } else {
            // All items rendered - set default selection
            const DEFAULT_T0 = "2024-08-06T09:30:00+00:00";
            select.value = limitedList.includes(DEFAULT_T0)
                ? DEFAULT_T0
                : limitedList[0];
        }
    }

    // Start batch rendering
    requestAnimationFrame(renderBatch);
}

/**
 * Adds option to select element
 */
function addOption(select, value, text) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    select.appendChild(opt);
}

// ===== TAB NAVIGATION =====

/**
 * Handles main tab switching
 */
function handleTabClick(btn) {
    const target = btn.dataset.tab;

    // Update tab active states
    document
        .querySelectorAll(".tabs .tab-btn")
        .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    // Update panel visibility
    document
        .querySelectorAll(".prediction-panel")
        .forEach((p) => p.classList.remove("active"));
    const panel = document.getElementById("panel-" + target);
    if (panel) panel.classList.add("active");

    // Load data for target panel
    onPanelActivated(target);
}

/**
 * Handles panel activation
 */
function onPanelActivated(panelName) {
    switch (panelName) {
        case "historical":
            if (!historicalT0Loaded) {
                const h =
                    document.getElementById("historical-horizon-select")
                        ?.value || "1h";
                loadHistoricalT0List(h);
            }
            break;
        case "scenarios":
            loadScenarios();
            break;
        case "online":
            const activeBtn =
                document.querySelector(".horizon-tab.active") ||
                document.querySelector('.horizon-tab[data-horizon="1h]');
            if (activeBtn) loadPredictionForHorizon(activeBtn.dataset.horizon);
            break;
    }
}

/**
 * Handles horizon tab switching
 */
function handleHorizonClick(btn) {
    const horizon = btn.dataset.horizon;

    // Update active state
    document
        .querySelectorAll(".horizon-tab")
        .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Show/hide cards
    document
        .querySelectorAll("#panel-online .chart-card")
        .forEach((c) => c.classList.add("hidden"));
    const card = document.getElementById("card-online-" + horizon);
    if (card) card.classList.remove("hidden");

    loadPredictionForHorizon(horizon);
}

// ===== INITIALIZATION =====

document.addEventListener("DOMContentLoaded", () => {
    // Main tabs
    document.querySelectorAll(".tabs .tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => handleTabClick(btn));
    });

    // Horizon sub-tabs
    document.querySelectorAll(".horizon-tab").forEach((btn) => {
        btn.addEventListener("click", () => handleHorizonClick(btn));
    });

    // Historical horizon select change
    const historicalHorizonSelect = document.getElementById(
        "historical-horizon-select",
    );
    if (historicalHorizonSelect) {
        historicalHorizonSelect.addEventListener("change", () => {
            loadHistoricalT0List(historicalHorizonSelect.value || "1h");
        });
    }

    // Run backtest button
    const histBtn = document.getElementById("historical-load-btn");
    if (histBtn) {
        histBtn.addEventListener("click", loadHistoricalPrediction);
    }

    // Initial panel load
    initializeDefaultPanel();
});

/**
 * Initializes the default active panel
 */
function initializeDefaultPanel() {
    const panels = {
        historical: document.getElementById("panel-historical"),
        online: document.getElementById("panel-online"),
        scenarios: document.getElementById("panel-scenarios"),
    };

    for (const [name, panel] of Object.entries(panels)) {
        if (panel?.classList.contains("active")) {
            onPanelActivated(name);
            break;
        }
    }
}
