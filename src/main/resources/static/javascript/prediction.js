// Глобальное хранилище активных графиков Chart.js
const predictionCharts = {};

/**
 * Рисуем график в указанном canvas.
 */
function renderPredictionChart(canvasId, data, labelSuffix) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn("Canvas not found:", canvasId);
        return;
    }

    // Лог, чтобы видеть, что реально приходит с бэка
    console.log("Rendering chart for", canvasId, "data:", data);

    // Если для этого canvas график уже был — удаляем, чтобы не плодить экземпляры
    if (predictionCharts[canvasId]) {
        predictionCharts[canvasId].destroy();
    }

    const ctx = canvas.getContext("2d");

    // Поддерживаем оба варианта на всякий случай
    const timestamps = data.timestamps || [];
    const predicted =
        data.predicted_consumption ?? // snake_case (как реально приходит)
        data.predictedConsumption ?? // вдруг потом поменяешь серилизацию
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
            maintainAspectRatio: false, // высота задаётся через CSS для .prediction-card
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
 * Загружаем предсказание с бэка для выбранного горизонта.
 */
async function loadPredictionForHorizon(horizon) {
    const canvasId = "chart-online-" + horizon;

    try {
        // Передаём horizon как query param (Java его уже принимает)
        const response = await fetch("/prediction/realtime/data?horizon=" + encodeURIComponent(horizon));
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        const data = await response.json();

        // Рисуем график
        renderPredictionChart(canvasId, data, horizon);
    } catch (err) {
        console.error("Error loading prediction for horizon", horizon, err);
        // TODO: Можно показать сообщение в UI
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

            // Загружаем предсказание / рисуем график для выбранного горизонта
            loadPredictionForHorizon(horizon);
        });
    });

    // --- первичная загрузка по умолчанию (1h) ---
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
});
