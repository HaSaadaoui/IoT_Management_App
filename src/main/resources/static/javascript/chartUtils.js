// ===== CHART UTILITIES =====
// Shared chart creation utilities for dashboard, alerts, and prediction pages

const OCCUPANCY_ZONES = {
    /* ======================================================
     * LEVALLOIS
     * ====================================================== */
    LEVALLOIS: {
        3: {
            OPEN_SPACE: {
                title: "Open_03_01",
                match: (id) => /^desk-03-(0[1-9]|[1-7][0-9]|8[0-2])$/.test(id)
            },
            VALUEMENT: {
                title: "Valuement",
                match: (id) => /^desk-03-(8[3-9]|9[0-2])$/.test(id)
            },
            MEETING_ROOM: {
                title: "Meeting Room",
                match: (id) => /^occup-vs70-03-0[1-2]$/.test(id) || id === "count-03-01"
            },
            INTERVIEW_ROOM: {
                title: "Interview Room",
                match: (id) => /^desk-vs41-03-0[1-2]$/.test(id)
            },
            PHONE_BOOTH: {
                title: "Phone Booth",
                match: (id) =>
                    id === "desk-vs41-03-03" ||  // PB1
                    id === "desk-vs41-03-04" ||  // PB2
                    id === "occup-vs30-03-01" || // PB3
                    id === "occup-vs30-03-02" || // PB4
                    id === "desk-vs40-03-01" ||  // PB5
                    id === "occup-vs70-03-03" || // PB6
                    id === "occup-vs70-03-04"    // PB7
            }
        }
    },

    /* ======================================================
     * CHATEAUDUN
     * ====================================================== */
    CHATEAUDUN: {
        0: {},
        1: {},
        2: {
            OPEN_SPACE: {
                title: "Open Space",
                match: (id) =>
                    /^desk-01-0[1-9]|desk-01-1[0-5]$/.test(id)
            }
        },
        3: {},
        4: {
            OPEN_SPACE: {
                title: "Open Space",
                match: (id) =>
                    /^desk-01-0[1-8]$/.test(id)
            }
        },
        5: {
            OPEN_SPACE: {
                title: "Open Space",
                match: (id) =>
                    /^desk-01-(0[1-9]|1[0-9]|2[0-4])$/.test(id)
            }
        },
        6: {
            OPEN_SPACE: {
                title: "Open Space",
                match: (id) =>
                    /^desk-01-(0[1-9]|1[0-6])$/.test(id)
            }
        }
    }
};



console.log("OCCUPANCY_ZONES", OCCUPANCY_ZONES);

async function fetchOccupancy(building, floor) {
    const url = `/api/dashboard/occupancy?building=${building}&floor=${floor}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Occupancy API failed (${res.status})`);
    }

    const data = await res.json();   // ✅ une seule lecture
    console.log("Occupancy API data:", data);
    return data;
}


function aggregateByZone(rawData, building, floor) {
    const zones = OCCUPANCY_ZONES?.[building]?.[floor];
    if (!zones) return {};

    const result = {};

    Object.entries(zones).forEach(([zoneKey, zone]) => {
        result[zoneKey] = {
            location: zone.title,
            free: 0,
            used: 0,
            invalid: 0
        };
    });

    rawData.forEach(({ id, status }) => {
        Object.entries(zones).forEach(([zoneKey, zone]) => {
            if (zone.match(id)) {
                if (status === "free") result[zoneKey].free++;
                else if (status === "used") result[zoneKey].used++;
                else result[zoneKey].invalid++;
            }
        });
    });

    console.log("Result from alert js", JSON.stringify(result, null, 2));
    return result;
}

function updateAllStatCards(zoneStats) {
    document.querySelectorAll(".stat-card[data-zone]").forEach(card => {
        const zoneKey = card.dataset.zone;
        const data = zoneStats[zoneKey];
        if (!data) return;

        ChartUtils.updateStatCard(card, data);
    });
}



const DASHBOARD_CTX = {
    building: "LEVALLOIS",
    floor: 3
};

async function refreshOccupancyDashboard() {
    try {
        const rawData = await fetchOccupancy(
            DASHBOARD_CTX.building,
            DASHBOARD_CTX.floor
        );

        const zoneStats = aggregateByZone(
            rawData,
            DASHBOARD_CTX.building,
            DASHBOARD_CTX.floor
        );

        updateAllStatCards(zoneStats);

    } catch (e) {
        console.error("Occupancy refresh failed", e);
    }
}

// Initial load
refreshOccupancyDashboard();

// Auto refresh
setInterval(refreshOccupancyDashboard, 30000);











// Color constants - read from CSS variables for single source of truth
const getComputedColor = (varName) => {
    const color = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
    return color || "#94a3b8"; // Fallback color
};

// Base colors
const okColor = "#10b981";
const notOkColor = "#ef4444";
const otherColor = "#94a3b8";

// Extended color palette (matching app theme)
const COLORS = {
    primary: "#662179",
    primaryLight: "#8b2fa3",
    success: "#10b981",
    danger: "#ef4444",
    info: "#3b82f6",
    warning: "#f59e0b",
    gray: "#64748b",
};

// ===== DATE FORMATTING UTILITIES =====

/**
 * Formats an ISO timestamp to a readable date/time string
 * @param {string} isoString - ISO format timestamp
 * @param {string} format - 'date', 'time', 'datetime', or 'short'
 * @returns {string} Formatted date string
 */
function formatTimestamp(isoString, format = "datetime") {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    switch (format) {
        case "date":
            return `${day}/${month}`;
        case "time":
            return `${hours}:${minutes}`;
        case "short":
            return `${day}/${month} ${hours}:${minutes}`;
        case "datetime":
        default:
            return `${day}/${month} ${hours}:${minutes}`;
    }
}

/**
 * Extracts the date part (YYYY-MM-DD) from an ISO timestamp
 * @param {string} isoString - ISO format timestamp
 * @returns {string} Date in YYYY-MM-DD format
 */
function extractDate(isoString) {
    if (!isoString) return "";
    return isoString.split("T")[0];
}

/**
 * Finds indices where the day changes in a list of timestamps
 * @param {Array<string>} timestamps - Array of ISO timestamps
 * @returns {Array<number>} Indices where day changes occur
 */
function findDayBoundaries(timestamps) {
    const boundaries = [];
    let prevDate = null;

    timestamps.forEach((ts, idx) => {
        const currentDate = extractDate(ts);
        if (prevDate && currentDate !== prevDate) {
            boundaries.push(idx);
        }
        prevDate = currentDate;
    });

    return boundaries;
}

// ===== CHART OPTIONS BUILDERS =====

/**
 * Creates base chart options with consistent styling
 * @param {Object} opts - Options object
 * @returns {Object} Chart.js options object
 */
function createBaseChartOptions(opts = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false,
        },
        plugins: {
            legend: createLegendOptions(opts.legend),
            tooltip: createTooltipOptions(opts.tooltip),
        },
    };
}

/**
 * Creates legend options
 * @param {Object} opts - Legend options
 * @returns {Object} Legend config
 */
function createLegendOptions(opts = {}) {
    return {
        display: opts.display !== false,
        position: opts.position || "top",
        labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12 },
        },
    };
}

/**
 * Creates tooltip options
 * @param {Object} opts - Tooltip options
 * @returns {Object} Tooltip config
 */
function createTooltipOptions(opts = {}) {
    return {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
        ...opts,
    };
}

/**
 * Creates grid options
 * @param {boolean} display - Whether to show grid
 * @returns {Object} Grid config
 */
function createGridOptions(display = true) {
    return {
        display,
        color: "rgba(0, 0, 0, 0.05)",
    };
}

/**
 * Creates axis title options
 * @param {string} text - Axis title text
 * @returns {Object} Title config
 */
function createAxisTitle(text) {
    return {
        display: !!text,
        text,
        font: { size: 12, weight: "bold" },
    };
}

// ===== LINE CHART UTILITIES =====

/**
 * Creates a line dataset configuration
 * @param {Object} opts - Dataset options
 * @returns {Object} Dataset config
 */
function createLineDataset(opts) {
    const color = opts.color || COLORS.primary;
    return {
        label: opts.label || "Data",
        data: opts.data || [],
        borderColor: color,
        backgroundColor: opts.fill ? hexToRgba(color, 0.1) : "transparent",
        borderWidth: opts.borderWidth || 2,
        pointRadius: opts.pointRadius || 3,
        pointHoverRadius: opts.pointHoverRadius || 5,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointBorderWidth: 2,
        fill: opts.fill || false,
        tension: opts.tension || 0.3,
    };
}

/**
 * Creates a line chart configuration
 * @param {Object} opts - Chart options
 * @returns {Object} Chart.js config
 */
function createLineChartConfig(opts) {
    const timestamps = opts.timestamps || [];
    const dayBoundaries = opts.showDayBoundaries
        ? findDayBoundaries(timestamps)
        : [];

    return {
        type: "line",
        data: {
            labels: timestamps.map((ts) => formatTimestamp(ts, "short")),
            datasets: opts.datasets || [createLineDataset(opts)],
        },
        options: {
            ...createBaseChartOptions(opts),
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: opts.maxXTicks || 10,
                        autoSkip: true,
                        font: { size: 11 },
                    },
                    title: createAxisTitle(opts.xAxisTitle || "Time"),
                    grid: createGridOptions(true),
                },
                y: {
                    beginAtZero: opts.beginAtZero || false,
                    title: createAxisTitle(opts.yAxisTitle || "Value"),
                    grid: createGridOptions(true),
                },
            },
            plugins: {
                ...createBaseChartOptions(opts).plugins,
                annotation:
                    dayBoundaries.length > 0
                        ? createDayAnnotations(dayBoundaries, timestamps)
                        : undefined,
            },
        },
    };
}

// ===== BAR CHART UTILITIES =====

/**
 * Creates a bar dataset configuration
 * @param {Object} opts - Dataset options
 * @returns {Object} Dataset config
 */
function createBarDataset(opts) {
    const colors = opts.colors || [COLORS.primary];
    return {
        label: opts.label || "Data",
        data: opts.data || [],
        backgroundColor: Array.isArray(colors)
            ? colors.map((c) => hexToRgba(c, 0.8))
            : hexToRgba(colors, 0.8),
        borderColor: colors,
        borderWidth: opts.borderWidth || 2,
        borderRadius: opts.borderRadius || 6,
        barPercentage: opts.barPercentage || 0.7,
    };
}

/**
 * Creates a bar chart configuration
 * @param {Object} opts - Chart options
 * @returns {Object} Chart.js config
 */
function createBarChartConfig(opts) {
    return {
        type: "bar",
        data: {
            labels: opts.labels || [],
            datasets: opts.datasets || [createBarDataset(opts)],
        },
        options: {
            ...createBaseChartOptions(opts),
            scales: {
                x: {
                    title: createAxisTitle(opts.xAxisTitle || "Category"),
                    grid: createGridOptions(false),
                },
                y: {
                    beginAtZero: opts.beginAtZero !== false,
                    title: createAxisTitle(opts.yAxisTitle || "Value"),
                    grid: createGridOptions(true),
                },
            },
        },
    };
}

// ===== DAY BOUNDARY ANNOTATIONS =====

/**
 * Creates annotation config for day boundaries (vertical lines)
 * @param {Array<number>} boundaries - Indices of day boundaries
 * @param {Array<string>} timestamps - Original timestamps
 * @returns {Object} Annotation plugin config
 */
function createDayAnnotations(boundaries, timestamps) {
    const annotations = {};

    boundaries.forEach((idx, i) => {
        const dateStr = extractDate(timestamps[idx]);
        const date = new Date(dateStr);
        const dayLabel = date.toLocaleDateString("en-US", {
            weekday: "short",
            day: "numeric",
            month: "short",
        });

        annotations[`dayLine${i}`] = {
            type: "line",
            xMin: idx,
            xMax: idx,
            borderColor: "rgba(102, 33, 121, 0.3)",
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                display: true,
                content: dayLabel,
                position: "start",
                backgroundColor: "rgba(102, 33, 121, 0.8)",
                color: "white",
                font: { size: 10, weight: "bold" },
                padding: 4,
                cornerRadius: 4,
            },
        };
    });

    return { annotations };
}

// ===== HELPER UTILITIES =====

/**
 * Converts hex color to rgba
 * @param {string} hex - Hex color code
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Destroys existing chart on canvas and creates new one
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Chart.js config
 * @returns {Chart} New Chart instance
 */
function createOrUpdateChart(canvas, config) {
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }
    return new Chart(canvas, config);
}

/**
 * Creates a doughnut chart configuration object with built-in legend
 * @param {Array<number>} data - Array of data values [free, used, invalid]
 * @returns {Object} Chart.js configuration object
 */
function createDoughnutChartConfig(data) {
    return {
        type: "doughnut",
        data: {
            labels: ["Free", "Used", "Invalid"],
            datasets: [
                {
                    data: data,
                    backgroundColor: [okColor, notOkColor, otherColor],
                    borderWidth: 0,
                    hoverOffset: 10,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "70%",
            animation: {
                duration: 0,
            },
            plugins: {
                legend: {
                    display: true,
                    position: "bottom",
                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 20,
                        font: {
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            size: 12,
                        },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    return {
                                        text: `${label} (${value}%)`,
                                        fillStyle:
                                            data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i,
                                    };
                                });
                            }
                            return [];
                        },
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) =>
                            context.label + ": " + context.parsed + "%",
                    },
                },
            },
        },
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

    const chartElement = statCard.querySelector(".chart-office");
    const legendElement = statCard.querySelector(".stat-legend");
    const titleElement = statCard.querySelector(".stat-card-title");

    const total = data.free + data.used + data.invalid;
    if (total === 0) return;

    const freePercent = ((data.free / total) * 100).toFixed(2);
    const usedPercent = ((data.used / total) * 100).toFixed(2);
    const invalidPercent = ((data.invalid / total) * 100).toFixed(2);

    // Update chart
    if (chartElement) {
        createDoughnutChart(chartElement, [
            freePercent,
            usedPercent,
            invalidPercent,
        ]);
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
if (typeof window !== "undefined") {
    window.ChartUtils = {
        // Colors
        COLORS,
        okColor,
        notOkColor,
        otherColor,
        // Date utilities
        formatTimestamp,
        extractDate,
        findDayBoundaries,
        // Chart builders
        createLineChartConfig,
        createLineDataset,
        createBarChartConfig,
        createBarDataset,
        createOrUpdateChart,
        // Options builders
        createBaseChartOptions,
        createLegendOptions,
        createTooltipOptions,
        createGridOptions,
        createAxisTitle,
        createDayAnnotations,
        // Doughnut chart (legacy)
        createDoughnutChartConfig,
        createDoughnutChart,
        updateLegend,
        updateStatCard,
        // Helpers
        hexToRgba,
    };
}
