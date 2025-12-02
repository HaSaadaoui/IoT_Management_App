// ===== CHART UTILITIES =====
// Shared chart creation utilities for dashboard and alerts pages

// Color constants - read from CSS variables for single source of truth
const getComputedColor = (varName) => {
    const color = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return color || '#94a3b8'; // Fallback color
};

const okColor = '#8b2fa3';
const notOkColor = '#4a1857';
const otherColor = '#94a3b8';

/**
 * Creates a doughnut chart configuration object with built-in legend
 * @param {Array<number>} data - Array of data values [free, used, invalid]
 * @returns {Object} Chart.js configuration object
 */
function createDoughnutChartConfig(data) {
    return {
        type: 'doughnut',
        data: {
            labels: ['Free', 'Used', 'Invalid'],
            datasets: [{
                data: data,
                backgroundColor: [okColor, notOkColor, otherColor],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '70%',
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: {
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            size: 12
                        },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    return {
                                        text: `${label} (${value}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => context.label + ': ' + context.parsed + '%'
                    }
                }
            }
        }
    };
}

/**
 * Creates and renders a doughnut chart on a canvas element
 * @param {HTMLCanvasElement} chartElement - The canvas element to render on
 * @param {Array<number>} data - Array of data values [free, used, invalid]
 * @returns {Chart} The created Chart.js instance
 */
function createDoughnutChart(chartElement, data) {
    // Destroy existing chart if present
    const existingChart = Chart.getChart(chartElement);
    if (existingChart) {
        existingChart.destroy();
    }

    return new Chart(chartElement, createDoughnutChartConfig(data));
}

/**
 * Updates a stat card legend with percentages
 * @param {HTMLElement} legendElement - The legend container element
 * @param {number} freePercent - Free percentage
 * @param {number} usedPercent - Used percentage
 * @param {number} invalidPercent - Invalid percentage
 */
function updateLegend(legendElement, freePercent, usedPercent, invalidPercent) {
    if (!legendElement) return;

    legendElement.innerHTML = `
        <div class="custom-label"><span class="dot free"></span> Free (${freePercent}%)</div>
        <div class="custom-label"><span class="dot used"></span> Used (${usedPercent}%)</div>
        <div class="custom-label"><span class="dot invalid"></span> Invalid (${invalidPercent}%)</div>
    `;
}

/**
 * Updates a complete stat card (chart, legend, and title)
 * @param {HTMLElement} statCard - The stat card container
 * @param {Object} data - Data object containing counts and location name
 * @param {number} data.freeCount - Number of free items
 * @param {number} data.usedCount - Number of used items
 * @param {number} data.invalidCount - Number of invalid items
 * @param {string} data.location - Location name
 */
function updateStatCard(statCard, data) {
    if (!statCard) return;

    const chartElement = statCard.querySelector('.chart-office');
    const legendElement = statCard.querySelector('.stat-legend');
    const titleElement = statCard.querySelector('.stat-card-title');

    const total = data.freeCount + data.usedCount + data.invalidCount;
    if (total === 0) return;

    const freePercent = (data.freeCount / total * 100).toFixed(2);
    const usedPercent = (data.usedCount / total * 100).toFixed(2);
    const invalidPercent = (data.invalidCount / total * 100).toFixed(2);

    // Update chart
    if (chartElement) {
        createDoughnutChart(chartElement, [freePercent, usedPercent, invalidPercent]);
    }

    // Update legend
    if (legendElement) {
        updateLegend(legendElement, freePercent, usedPercent, invalidPercent);
    }

    // Update title
    if (titleElement && data.location) {
        titleElement.textContent = data.location;
    }
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    window.ChartUtils = {
        okColor,
        notOkColor,
        otherColor,
        createDoughnutChartConfig,
        createDoughnutChart,
        updateLegend,
        updateStatCard
    };
}
