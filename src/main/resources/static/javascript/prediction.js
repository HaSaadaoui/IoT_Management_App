// Глобальное хранилище активных графиков Chart.js
const predictionCharts = {};
const historicalCharts = {};
const scenarioCharts = {};

let historicalT0Loaded = false;

/**
 * Рисуем график в указанном canvas (ONLINE).
 */
function renderPredictionChart(canvasId, data, labelSuffix) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn("Canvas not found:", canvasId);
        return;
    }

    console.log("Rendering chart for", canvasId, "data:", data);

    if (predictionCharts[canvasId]) {
        predictionCharts[canvasId].destroy();
    }

    const ctx = canvas.getContext("2d");

    const timestamps = data.timestamps || [];
    const predicted =
        data.predicted_consumption ??
        data.predictedConsumption ??
        [];

    predictionCharts[canvasId] = new Chart(ctx, {
        type: "line",
        data: {
            labels: timestamps,
            datasets: [{
                label: "Predicted consumption" + (labelSuffix ? " (" + labelSuffix + ")" : ""),
                data: predicted,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        autoSkip: true
                    },
                    title: {
                        display: true,
                        text: "Timestamp"
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: "Consumption"
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    mode: "index",
                    intersect: false
                }
            }
        }
    });
}

/**
 * Загружаем ONLINE предсказание с бэка для выбранного горизонта.
 */
async function loadPredictionForHorizon(horizon) {
    const canvasId = "chart-online-" + horizon;

    try {
        const response = await fetch("/prediction/realtime/data?horizon=" + encodeURIComponent(horizon));
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        const data = await response.json();

        renderPredictionChart(canvasId, data, horizon);
    } catch (err) {
        console.error("Error loading prediction for horizon", horizon, err);
    }
}

/**
 * Рисуем HISTORICAL графики (pred vs true + abs error).
 */
function renderHistoricalCharts(data) {
    const canvas1 = document.getElementById("chart-historical-backtest");
    const canvas2 = document.getElementById("chart-historical-scenarios");
    if (!canvas1 || !canvas2) {
        console.warn("Historical canvases not found");
        return;
    }

    const timestamps = data.timestamps || [];
    const pred =
        data.predicted_consumption ??
        data.predictedConsumption ??
        [];
    const truth =
        data.true_consumption ??
        data.trueConsumption ??
        [];
    const absErr =
        data.abs_error ??
        data.absError ??
        [];

    // Предсказание vs реальное
    if (historicalCharts["backtest"]) {
        historicalCharts["backtest"].destroy();
    }
    historicalCharts["backtest"] = new Chart(canvas1.getContext("2d"), {
        type: "line",
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: "Predicted consumption",
                    data: pred,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.25
                },
                {
                    label: "True consumption",
                    data: truth,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.25
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                x: { title: { display: true, text: "Timestamp" } },
                y: { title: { display: true, text: "Consumption" } }
            }
        }
    });

    // Абсолютная ошибка
    if (historicalCharts["error"]) {
        historicalCharts["error"].destroy();
    }
    historicalCharts["error"] = new Chart(canvas2.getContext("2d"), {
        type: "line",
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: "Absolute error",
                    data: absErr,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.25
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                x: { title: { display: true, text: "Timestamp" } },
                y: { title: { display: true, text: "Error" } }
            }
        }
    });
}

function renderScenarioChart(data) {
    const canvas = document.getElementById("chart-scenarios");
    if (!canvas) {
        console.warn("Scenario canvas not found");
        return;
    }

    if (scenarioCharts["main"]) {
        scenarioCharts["main"].destroy();
    }

    const ctx = canvas.getContext("2d");

    const scenarios = data.scenarios || [];
    const labels = scenarios.map(s => s.scenario);
    const values = scenarios.map(s =>
        Number(s.predictedConsumption ?? s.predicted_consumption)
    );
    const deltas = scenarios.map(s =>
        Number(s.delta ?? s.delta_pct)
    );

    scenarioCharts["main"] = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Predicted daily consumption",
                    data: values,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const idx = ctx.dataIndex;
                            const val = values[idx];
                            const d = deltas[idx];
                            const sign = d > 0 ? "+" : "";
                            return ` ${val.toFixed(1)} (Δ ${sign}${d.toFixed(1)})`;
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: "Scenario" } },
                y: { title: { display: true, text: "Consumption (kWh)" } }
            }
        }
    });
}

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


async function loadHistoricalT0List(horizon = "1d") {
    const select = document.getElementById("historical-t0-select");
    const statusEl = document.getElementById("historical-status");
    if (!select) return;

    try {
        if (statusEl) statusEl.textContent = "Loading t0 list...";

        const resp = await fetch(
            "/prediction/historical/t0-list?horizon=" + encodeURIComponent(horizon)
        );
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        const data = await resp.json();

        select.innerHTML = "";
        const list = data.t0_list || [];

        if (list.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No t0 available";
            select.appendChild(opt);
        } else {
            const ordered = [...list].reverse();
            ordered.forEach(t0 => {
                const opt = document.createElement("option");
                opt.value = t0;
                opt.textContent = t0;
                select.appendChild(opt);
            });

            // 🎯 хотим по умолчанию 2024-08-06 09:30:00+00:00 для всех горизонтов
            const DEFAULT_T0 = "2024-08-06T09:30:00+00:00";

            if (ordered.includes(DEFAULT_T0)) {
                // если такая дата есть в списке – выбираем именно её
                select.value = DEFAULT_T0;
            } else {
                // иначе fallback – берём самую старую (первую в ordered)
                select.value = ordered[0];
            }
        }


        historicalT0Loaded = true;
        if (statusEl) statusEl.textContent = "";
    } catch (err) {
        console.error("Error loading t0 list", err);
        if (statusEl) statusEl.textContent = "Failed to load t0 list";
    }
}

/**
 * Загружаем HISTORICAL предсказание.
 */
async function loadHistoricalPrediction() {
    const horizonSelect = document.getElementById("historical-horizon-select");
    const t0Select = document.getElementById("historical-t0-select");
    const statusEl = document.getElementById("historical-status");
    if (!horizonSelect || !t0Select) return;

    const horizon = horizonSelect.value;
    const t0 = t0Select.value;
    if (!t0) {
        if (statusEl) statusEl.textContent = "Please select t0";
        return;
    }

    try {
        if (statusEl) statusEl.textContent = "Loading historical prediction...";

        const url = "/prediction/historical/data?horizon=" +
            encodeURIComponent(horizon) +
            "&t0=" + encodeURIComponent(t0);

        const resp = await fetch(url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();

        renderHistoricalCharts(data);
        if (statusEl) statusEl.textContent = "";
    } catch (err) {
        console.error("Error loading historical prediction", err);
        if (statusEl) statusEl.textContent = "Failed to load historical prediction";
    }
}

/**
 * Инициализация табов и первичная отрисовка.
 */
document.addEventListener("DOMContentLoaded", () => {
    // --- верхние табы: Online / Historical ---
    document.querySelectorAll(".prediction-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab; // "online" или "historical"

            document.querySelectorAll(".prediction-tab")
                .forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll(".prediction-panel")
                .forEach(p => p.classList.remove("active"));
            const panel = document.getElementById("panel-" + target);
            if (panel) panel.classList.add("active");

            // если открыли Historical — грузим t0 список (один раз при первом входе)
            if (target === "historical" && !historicalT0Loaded) {
                const horizonSelect = document.getElementById("historical-horizon-select");
                const h = horizonSelect ? horizonSelect.value : "1d";
                loadHistoricalT0List(h);
            }
            if (target === "scenarios") {
                loadScenarios();
            }
            // если открыли Online — подгружаем текущий активный горизонт
            if (target === "online") {
                const activeHorizonBtn = document.querySelector('.horizon-tab.active')
                    || document.querySelector('.horizon-tab[data-horizon="1h"]');
                if (activeHorizonBtn) {
                    const h = activeHorizonBtn.dataset.horizon;
                    loadPredictionForHorizon(h);
                }
            }
        });
    });

    // --- подтабы горизонтов внутри Online ---
    document.querySelectorAll(".horizon-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            const horizon = btn.dataset.horizon; // "1h", "1d", "1w", "1m", "3m"

            document.querySelectorAll(".horizon-tab")
                .forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll("#panel-online .prediction-card")
                .forEach(c => c.classList.add("hidden"));

            const card = document.getElementById("card-online-" + horizon);
            if (card) {
                card.classList.remove("hidden");
            }

            loadPredictionForHorizon(horizon);
        });
    });

    // --- смена горизонта в HISTORICAL → перезагрузить список t0 ---
    const historicalHorizonSelect = document.getElementById("historical-horizon-select");
    if (historicalHorizonSelect) {
        historicalHorizonSelect.addEventListener("change", () => {
            const h = historicalHorizonSelect.value || "1d";
            loadHistoricalT0List(h);
        });
    }

    // --- Инициализация при загрузке страницы ---
    const historicalPanel = document.getElementById("panel-historical");
    const onlinePanel = document.getElementById("panel-online");
    const scenariosPanel = document.getElementById("panel-scenarios"); // 👈 добавить


    // Если по умолчанию активен Historical — сразу грузим t0 список с учётом выбранного горизонта
    if (historicalPanel && historicalPanel.classList.contains("active")) {
        const horizonSelect = document.getElementById("historical-horizon-select");
        const h = horizonSelect ? horizonSelect.value : "1d";
        loadHistoricalT0List(h);
    }
    if (scenariosPanel && scenariosPanel.classList.contains("active")) {
        loadScenarios();
    }


    // Если по умолчанию активен Online — ведём себя как раньше
    if (onlinePanel && onlinePanel.classList.contains("active")) {
        const defaultHorizonBtn = document.querySelector('.horizon-tab.active')
            || document.querySelector('.horizon-tab[data-horizon="1h"]');

        if (defaultHorizonBtn) {
            const defaultHorizon = defaultHorizonBtn.dataset.horizon;

            document.querySelectorAll("#panel-online .prediction-card")
                .forEach(c => c.classList.add("hidden"));
            const card = document.getElementById("card-online-" + defaultHorizon);
            if (card) card.classList.remove("hidden");

            loadPredictionForHorizon(defaultHorizon);
        }
    }

    // --- кнопка "Run backtest" для Historical ---
    const histBtn = document.getElementById("historical-load-btn");
    if (histBtn) {
        histBtn.addEventListener("click", () => {
            loadHistoricalPrediction();
        });
    }
});
