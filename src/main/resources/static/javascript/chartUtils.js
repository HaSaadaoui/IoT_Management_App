// =============== BUILDING CHART INSTANCES ================
const chartsByBuilding = {
    CHATEAUDUN: {},
    LEVALLOIS: {}
};

function renderOpenEspace(building, data) {

    if (!chartsByBuilding[building]) {
        chartsByBuilding[building] = {};
    }

    if (chartsByBuilding[building].openEspace) {
        chartsByBuilding[building].openEspace.destroy();
    }

    const canvas = document.querySelector(`#${building}_OPEN_ESPACE`);
    if (!canvas) {
        console.warn("Canvas not found for building:", building);
        return;
    }

    const ctx = canvas.getContext("2d");

    chartsByBuilding[building].openEspace = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: { responsive: true }
    });
}

// ===== CHART UTILITIES + LIVE OCCUPANCY =====
// =============  OCCUPANCY ZONES ===================
const OCCUPANCY_ZONES = {
    LEVALLOIS: {
        3: {
            OPEN_SPACE: { title: "Open_03_01", match: (id) => /^desk-03-(0[1-9]|[1-7][0-9]|8[0-2])$/.test(id) },
            VALUEMENT: { title: "Valuement", match: (id) => /^desk-03-(8[3-9]|9[0-2])$/.test(id) },
            MEETING_ROOM: { title: "Meeting Room", match: (id) => /^occup-vs70-03-0[1-2]$/.test(id) || id === "count-03-01" },
            INTERVIEW_ROOM: { title: "Interview Room", match: (id) => /^desk-vs41-03-0[1-2]$/.test(id) },
            PHONE_BOOTH: { title: "Phone Booth", match: (id) => [
                "desk-vs41-03-03",
                "desk-vs41-03-04",
                "occup-vs30-03-01",
                "occup-vs30-03-02",
                "desk-vs40-03-01",
                "occup-vs70-03-03",
                "occup-vs70-03-04"
            ].includes(id) }
        }
    },
    CHATEAUDUN: {
        2: {
            OPEN_SPACE: {
                title: "Open Space",
                prefix: "desk-01-",
                start: 1,
                end: 15,
                match: (id) => /^desk-01-(0[1-9]|1[0-5])$/.test(id)
            }
        },
        3: {
            OPEN_SPACE: {
                title: "Open Space",
                prefix: "desk-03-",
                start: 1,
                end: 15,
                match: (id) => /^desk-03-(0[1-9]|1[0-5])$/.test(id)
            }
        },
        4: {
            OPEN_SPACE: {
                title: "Open Space",
                prefix: "desk-04-",
                start: 1,
                end: 8,
                match: (id) => /^desk-04-0[1-8]$/.test(id)
            }
        },
        5: {
            OPEN_SPACE: {
                title: "Open Space",
                prefix: "desk-05-",
                start: 1,
                end: 24,
                match: (id) => /^desk-05-(0[1-9]|1[0-9]|2[0-4])$/.test(id)
            }
        },
        6: {
            OPEN_SPACE: {
                title: "Open Space",
                prefix: "desk-06-",
                start: 1,
                end: 16,
                match: (id) => /^desk-06-(0[1-9]|1[0-6])$/.test(id)
            }
        }
    }
};

let occupancyUnsub = null;
const occupancyState = {};

// =============== SSE / LIVE OCCUPANCY ================
function openOccupancySSE(building, floor) {
  console.log("🔄 openOccupancySSE (SSEManager) called with:", building, floor);

  // coupe l'ancienne souscription si on re-switch building/floor
  if (occupancyUnsub) {
    console.log("🔁 Unsub previous SSE");
    occupancyUnsub();
    occupancyUnsub = null;
  }

  if (!window.SSEManager?.subscribeOccupancy) {
    console.warn("❌ SSEManager not available (script not loaded yet?)");
    return;
  }

  // Souscription au hub (1 seul EventSource partagé)
  occupancyUnsub = window.SSEManager.subscribeOccupancy(building, (msg) => {
    try {
      const deviceId =
        msg?.end_device_ids?.device_id ||
        msg?.deviceId ||
        msg?.device_id;

      const decoded =
        msg?.uplink_message?.decoded_payload ??
        msg?.decoded_payload ??
        msg?.payload ??
        {};

      const occRaw = decoded?.occupancy;
      if (!deviceId) return;

      const status = normalizeDeskStatus(occRaw);

      // (perf) si status inchangé -> ne rerender pas
      if (occupancyState[deviceId] === status) return;

      occupancyState[deviceId] = status;

      // Snapshot complet
      const snapshot = Object.entries(occupancyState).map(([id, s]) => ({ id, status: s }));

      const zoneStats = aggregateByZone(snapshot, building, floor);

      if (building === "CHATEAUDUN") {
          renderChateaudunCards(zoneStats);
      } else {
          updateAllStatCards(zoneStats);
      }

    } catch (err) {
      console.warn("[SSEManager][occupancy] handler error", err);
    }
  });
}


function closeOccupancySSE() {
  if (occupancyUnsub) {
    console.log("🔒 Unsubscribe SSE (SSEManager)");
    occupancyUnsub();
    occupancyUnsub = null;
  }
}

// Auto-clean
window.addEventListener("beforeunload", () => {
  closeOccupancySSE();
});

// ============== HELPERS =================
function normalizeDeskStatus(v) {
    if (v == null) return "invalid";
    if (typeof v === "string") {
        const s = v.toLowerCase();
        if (s === "occupied" || s === "used" || s === "true" || s === "1") return "used";
        if (s === "vacant" || s === "free" || s === "false" || s === "0") return "free";
        return "invalid";
    }
    if (typeof v === "boolean") return v ? "used" : "free";
    if (typeof v === "number") return v > 0 ? "used" : "free";
    return "invalid";
}

// =============== AGGREGATION ===================
function aggregateByZone(rawData, building, floor) {
    if (building === "CHATEAUDUN" && (!floor || floor === "")) {
        return aggregateChateaudunAllFloors(rawData);
    }

    if (building === "LEVALLOIS" && (!floor || floor === "" || floor === "all")) {
        return aggregateLevalloisAllFloors(rawData);
    }

    // sinon → floor normal
    return aggregateByZonesForFloor(rawData, building, floor);
}

// =============== LEVALLOIS ALL FLOORS =================
function aggregateLevalloisAllFloors(rawData) {

    const floors = OCCUPANCY_ZONES.LEVALLOIS;
    const result = {};

    Object.entries(floors).forEach(([floorNumber, zones]) => {

        Object.entries(zones).forEach(([zoneKey, zone]) => {

            if (!result[zoneKey]) {
                result[zoneKey] = {
                    location: zone.title,
                    free: 0,
                    used: 0,
                    invalid: 0
                };
            }

            rawData.forEach(({ id, status }) => {
                if (zone.match(id)) {
                    if (status === "free") result[zoneKey].free++;
                    else if (status === "used") result[zoneKey].used++;
                    else result[zoneKey].invalid++;
                }
            });

            // ===== INTEGRITY CHECK =====
            if (zone.prefix && zone.start && zone.end) {

                const expected = [];

                for (let i = zone.start; i <= zone.end; i++) {
                    expected.push(zone.prefix + i.toString().padStart(2,'0'));
                }

                const actual = rawData
                    .filter(d => zone.match(d.id))
                    .map(d => d.id);

                const missing = expected.filter(d => !actual.includes(d));
                result[zoneKey].invalid += missing.length;
            }
        });

    });

    console.log("Result from alert js", JSON.stringify(result, null, 2));
    return result;
}

// ===== MODE ALL FLOORS (Châteaudun uniquement) =====
function aggregateChateaudunAllFloors(rawData){
    const floors = OCCUPANCY_ZONES.CHATEAUDUN;
    const result = {};

    Object.entries(floors).forEach(([floorNumber, zones]) => {
        result[`FLOOR_${floorNumber}`] = {
            location: `FLOOR_${floorNumber}`,
            free: 0,
            used: 0,
            invalid: 0
        };

        Object.values(zones).forEach(zone => {
            const expectedDesks = [];
            // Génération desks attendus
            for (let i = zone.start; i <= zone.end; i++) {
                expectedDesks.push(
                    zone.prefix + i.toString().padStart(2,'0')
                );
            }

            const actualDesks = rawData
                .filter(d => zone.match(d.id))
                .map(d => d.id);

            // Comptage réel
            rawData.forEach(({ id, status }) => {
                if (zone.match(id)) {
                    if (status === "free") result[`FLOOR_${floorNumber}`].free++;
                    else if (status === "used") result[`FLOOR_${floorNumber}`].used++;
                    else result[`FLOOR_${floorNumber}`].invalid++;
                }
            });

            // Missing desks
            const missing = expectedDesks.filter(d => !actualDesks.includes(d));
            result[`FLOOR_${floorNumber}`].invalid += missing.length;
        });

    });

    console.log("Result from alert js", JSON.stringify(result, null, 2));
    return result;
}

// sinon → floor normal
function aggregateByZonesForFloor(rawData, building, floor){
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

        rawData.forEach(({ id, status }) => {
            if (zone.match(id)) {
                if (status === "free") result[zoneKey].free++;
                else if (status === "used") result[zoneKey].used++;
                else result[zoneKey].invalid++;
            }
        });

        // ===== INTEGRITY CHECK =====
        if (zone.prefix && zone.start && zone.end) {

            const expected = [];

            for (let i = zone.start; i <= zone.end; i++) {
                expected.push(zone.prefix + i.toString().padStart(2,'0'));
            }

            const actual = rawData
                .filter(d => zone.match(d.id))
                .map(d => d.id);

            const missing = expected.filter(d => !actual.includes(d));
            result[zoneKey].invalid += missing.length;
        }

    });

    console.log("Result from alert js", JSON.stringify(result, null, 2));
    return result;
}


function renderChateaudunCards(zoneStats) {
    console.log("Chateaudun zoneStats: ", zoneStats);
    const container = document.getElementById("stats-chateaudun");
    if (!container) return;

    container.innerHTML = "";

    Object.keys(zoneStats).forEach(zoneKey => {

        const card = document.createElement("div");
        card.className = "stat-card";
        card.dataset.zone = zoneKey;

        card.innerHTML = `
            <h4 class="stat-card-title">${zoneStats[zoneKey].location}</h4>
            <div class="stat-chart-container">
                <canvas class="chart-office"></canvas>
            </div>
        `;

        container.appendChild(card);
    });

    updateAllStatCards(zoneStats);
}

// =========== STAT CARD UPDATE ==============
function updateAllStatCards(zoneStats) {
    document.querySelectorAll(".stat-card[data-zone]").forEach(card => {
        const zoneKey = card.dataset.zone;
        const data = zoneStats[zoneKey];
        if (!data) return;
        updateStatCard(card, data);
    });
}

// Recycler le chart existant au lieu de le recréer
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

    // Recycle chart
    if (chartElement) {
        if (chartElement._chartInstance) {
            const chart = chartElement._chartInstance;
            chart.data.datasets[0].data = [freePercent, usedPercent, invalidPercent];
            chart.update();
        } else {
            chartElement._chartInstance = new Chart(chartElement, ChartUtils.createDoughnutChartConfig([freePercent, usedPercent, invalidPercent]));
        }
    }

    if (legendElement) ChartUtils.updateLegend(legendElement, freePercent, usedPercent, invalidPercent);
    if (titleElement && data.location) titleElement.textContent = data.location;
}

// ============== INITIALISATION =================
const DASHBOARD_CTX = {
    building: null,
    floor: null
};

function normalizeFloor(value) {
    if (!value || value === "all") return "";
    return parseInt(value, 10);
}


window.addEventListener("DOMContentLoaded", () => {
    const buildingSelect = document.getElementById("filter-building");
    const floorSelect = document.getElementById("filter-floor");

    if (!buildingSelect || !floorSelect) {
        console.warn("Filters not found in DOM");
        return;
    }

    // Initialisation contexte
    DASHBOARD_CTX.building = buildingSelect.value;
    DASHBOARD_CTX.floor = normalizeFloor(floorSelect.value);
    console.log("DASHBOARD_CTX.building ===>", DASHBOARD_CTX.building );
    console.log("DASHBOARD_CTX.floor ===>", DASHBOARD_CTX.floor );

    openOccupancySSE(DASHBOARD_CTX.building, DASHBOARD_CTX.floor);

    // ===== EVENT LISTENERS =====
    buildingSelect.addEventListener("change", () => {
        DASHBOARD_CTX.building = buildingSelect.value;
        DASHBOARD_CTX.floor = normalizeFloor(floorSelect.value);

        openOccupancySSE(DASHBOARD_CTX.building, DASHBOARD_CTX.floor);
    });

    floorSelect.addEventListener("change", () => {
        DASHBOARD_CTX.floor = normalizeFloor(floorSelect.value);

        openOccupancySSE(DASHBOARD_CTX.building, DASHBOARD_CTX.floor);
    });
});

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
 function createDoughnutChartConfig(dataCounts) {
     // dataCounts = [freeCount, usedCount, invalidCount]
     const total = dataCounts.reduce((a, b) => a + b, 0);
     return {
         type: "doughnut",
         data: {
             labels: ["Free", "Used", "Invalid"],
             datasets: [
                 {
                     data: dataCounts.map(count => total ? (count / total) * 100 : 0),
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
             layout: {
                padding: {
                    top: 20,
                    bottom: 5
                }
             },
             animation: { duration: 0 },
             plugins: {
                 legend: {
                     display: true,
                     position: "bottom",
                     labels: {
                         usePointStyle: true,
                         pointStyle: "circle",
                         padding: 12,
                         font: { family: "'Inter', sans-serif", size: 12 },
                         generateLabels: (chart) => {
                             const data = chart.data;
                             if (data.labels.length && data.datasets.length) {
                                 const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                 return data.labels.map((label, i) => {
                                     const value = data.datasets[0].data[i];
                                     return {
                                         text: `${label} (${value.toFixed(0)}%)`,
                                         fillStyle: data.datasets[0].backgroundColor[i],
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
                         label: (context) => {
                             const idx = context.dataIndex;
                             const label = context.label;
                             const percent = Math.round(context.parsed);
                             const count = dataCounts[idx];
                             return `${label}: ${percent}% (${count} desks)`;
                         },
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

    const counts = [data.free, data.used, data.invalid];
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return;

    // Arrondir pour que la somme des % = 100
    let rawPercents = counts.map(c => (c / total) * 100);
    let rounded = rawPercents.map(p => Math.floor(p));
    let remainder = 100 - rounded.reduce((a, b) => a + b, 0);
    const remainders = rawPercents.map((p, i) => ({ idx: i, diff: p - Math.floor(p) }))
                                  .sort((a, b) => b.diff - a.diff);
    for (let i = 0; i < remainder; i++) {
        rounded[remainders[i].idx]++;
    }

    if (chartElement) {
        createDoughnutChart(chartElement, counts);
    }

    if (legendElement) {
        updateLegend(legendElement, rounded[0], rounded[1], rounded[2]);
    }

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
