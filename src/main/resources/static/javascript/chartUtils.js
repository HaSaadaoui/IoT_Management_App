// ===== CHART UTILITIES + LIVE OCCUPANCY =====
// ============================================
// DYNAMIC OCCUPANCY ZONES (loaded from API)
// ============================================

// Cache des zones par buildingId : { [buildingId]: { [floor]: { ZONE_KEY: { title, match, expectedCount } } } }
const DYNAMIC_ZONES = {};

async function loadZonesForBuilding(buildingId) {
    // Ne pas cacher les erreurs : utiliser `in` pour distinguer "non chargé" de "chargé vide"
    if (buildingId in DYNAMIC_ZONES) return DYNAMIC_ZONES[buildingId];

    try {
        const resp = await fetch(`/api/sensors/zones?buildingId=${buildingId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // API returns: { "3": { "Open Space": ["desk-03-01", ...], "Meeting Room": [...] } }
        const apiZones = await resp.json();

        const zones = {};
        Object.entries(apiZones).forEach(([floor, locationMap]) => {
            zones[floor] = {};
            Object.entries(locationMap).forEach(([locationName, sensorIds]) => {
                const key = locationName.toUpperCase().replace(/[\s\-]+/g, '_');
                const idSet = new Set(sensorIds);
                zones[floor][key] = {
                    title: locationName,
                    match: (id) => idSet.has(id),
                    expectedCount: sensorIds.length,
                    free: 0, used: 0, invalid: 0
                };
            });
        });

        DYNAMIC_ZONES[buildingId] = zones;
        console.log(`[ChartUtils] Zones loaded for building ${buildingId}:`, zones);
        return zones;
    } catch (e) {
        console.error(`[ChartUtils] Failed to load zones for building ${buildingId}:`, e);
        // Ne pas mettre en cache l'erreur → permettre un retry au prochain appel
        return {};
    }
}
// ============================================
// DASHBOARD CONTEXT
// ============================================
const DASHBOARD_CTX = { building: "", floor: null };

// ============================================
// GLOBAL STATE
// ============================================
let occupancyUnsub = null;          // <-- à la place de occupancySource
const occupancyState = {};
// ============================================
// SSE / LIVE OCCUPANCY
// ============================================
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
    occupancyUnsub = window.SSEManager.subscribeOccupancy(building, ({ type, data }) => {
        try {
            const msg = data;
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
            updateAllStatCards(zoneStats);

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

// Bonus: auto-clean si tu veux (recommandé)
window.addEventListener("beforeunload", () => {
    closeOccupancySSE();
});
// ============================================
// HELPERS
// ============================================
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

// ============================================
// AGGREGATION
// ============================================
function aggregateByZone(rawData, building, floor) {
    const buildingZones = DYNAMIC_ZONES[building];
    if (!buildingZones || Object.keys(buildingZones).length === 0) return {};

    const floorsToProcess =
        floor != null ? { [floor]: buildingZones[floor] } : buildingZones;

    const result = {};

    // Init floors (structure plate, pas de FLOOR_X wrapper)
    Object.entries(floorsToProcess).forEach(([floorNum, zones]) => {
        if (!zones) return;

        const floorData = {
            title: `Floor ${floorNum}`,
            free: 0,
            used: 0,
            invalid: 0,
            expectedCount: 0,
            zones: {}
        };

        Object.entries(zones).forEach(([key, val]) => {
            if (!val || typeof val !== "object" || !("title" in val)) return;
            floorData.zones[key] = {
                location: val.title,
                free: 0,
                used: 0,
                invalid: 0,
                expectedCount: val.expectedCount || 0,
                match: val.match
            };
        });

        result[floorNum] = floorData;
    });

    //AGRÉGATION
    rawData.forEach(({ id, status }) => {
        Object.values(result).forEach(floorData => {
            Object.values(floorData.zones).forEach(zone => {

                if (zone.match && zone.match(id)) {   //matching
                    if (status === "free") zone.free++;
                    else if (status === "used") zone.used++;
                    else zone.invalid++;
                }

            });
        });
    });

    // Totaux floor
    Object.values(result).forEach(floorData => {
        floorData.free = 0;
        floorData.used = 0;
        floorData.invalid = 0;
        floorData.expectedCount = 0;

        Object.values(floorData.zones).forEach(zone => {
            const actual = zone.free + zone.used + zone.invalid;

            if (zone.expectedCount > actual) {
                zone.invalid += (zone.expectedCount - actual);
            }

            floorData.free += zone.free;
            floorData.used += zone.used;
            floorData.invalid += zone.invalid;
            floorData.expectedCount += zone.expectedCount;
        });
    });

    console.log("📊 Zone stats:", result);

    return result;
}

// ============================================
// STAT CARD UPDATE
// ============================================
function updateAllStatCards(zoneStats) {
    document.querySelectorAll(".stat-card[data-zone]").forEach(card => {
        const zoneKey = card.dataset.zone;
        let foundData = null;

        //Cas 1 : carte = FLOOR_X
        if (zoneKey.startsWith("FLOOR_")) {
            const floorNumber = zoneKey.split("_")[1];
            foundData = zoneStats[floorNumber];
        }
        // Cas 2 : carte = vraie zone
        else {
            Object.values(zoneStats).forEach(floorData => {
                if (floorData?.zones?.[zoneKey]) {
                    foundData = floorData.zones[zoneKey];
                }
            });
        }

        if (!foundData) return;

        updateStatCard(card, foundData);
    });
}

// Recycler le chart existant au lieu de le recréer
function updateStatCard(statCard, data) {
    if (!statCard) return;

    const chartElement = statCard.querySelector(".chart-office");
    const legendElement = statCard.querySelector(".stat-legend");
    const titleElement = statCard.querySelector(".stat-card-title");

    const total = data.free + data.used + data.invalid;

    let freePercent = 0;
    let usedPercent = 0;
    let invalidPercent = 0;

    if (total === 0) {
        invalidPercent = 100;
    } else {
        freePercent = parseFloat(((data.free / total) * 100).toFixed(2));
        usedPercent = parseFloat(((data.used / total) * 100).toFixed(2));
        invalidPercent = parseFloat(((data.invalid / total) * 100).toFixed(2));
    }

    if (chartElement) {
        if (chartElement._chartInstance) {
            const chart = chartElement._chartInstance;
            chart.data.datasets[0].data = [freePercent, usedPercent, invalidPercent];
            chart.update();
        } else {
            const config = {
                type: "doughnut",
                data: {
                    labels: ["Free", "Used", "Invalid"],
                    datasets: [{
                        data: [freePercent, usedPercent, invalidPercent],
                        backgroundColor: ["#10b981", "#ef4444", "#94a3b8"],
                        borderWidth: 0,
                        hoverOffset: 10,
                    }],
                },
                options: {
                    aspectRatio: 1,
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: "70%",
                    layout: { padding: { top: 10, bottom: 5 } },
                    animation: { duration: 0 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    const percent = Math.round(context.parsed);

                                    const counts = [
                                        data.free,
                                        data.used,
                                        data.invalid
                                    ];

                                    return `${context.label}: ${percent}% (${counts[idx]} desks)`;
                                }
                            }
                        }
                    }
                }
            };

            chartElement._chartInstance = new Chart(chartElement, config);
        }
    }

    // Legend propre (inchangée)
    if (legendElement) {
        legendElement.innerHTML = `
            <div class="custom-label">
                <span class="dot free"></span>
                Free (${freePercent.toFixed(0)}%)
            </div>
            <div class="custom-label">
                <span class="dot used"></span>
                Used (${usedPercent.toFixed(0)}%)
            </div>
            <div class="custom-label">
                <span class="dot invalid"></span>
                Invalid (${invalidPercent.toFixed(0)}%)
            </div>
        `;
    }

    if (titleElement && data.location) {
        titleElement.textContent = data.location;
    }
}


// ============================================
// GENERATE STAT CARDS FOR BUILDING
// ============================================
async function generateStatCardsForBuilding(building, selectedFloor = null) {
    const container = document.getElementById('sensor-stats-container');
    if (!container) return;

    // Load zones dynamically from API
    const buildingZones = await loadZonesForBuilding(building);

    if (!buildingZones || Object.keys(buildingZones).length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    let index = 0;

    // ======================================================
    // CASE 1: FLOOR SÉLECTIONNÉ → afficher les zones du floor
    // ======================================================
    if (selectedFloor != null) {
        const floorZones = buildingZones[selectedFloor];

        if (!floorZones || Object.keys(floorZones).length === 0) {
            container.innerHTML = '';
            return;
        }

        Object.entries(floorZones).forEach(([zoneKey, zoneData]) => {
            html += `
                <div class="stat-card"
                     data-zone="${zoneKey}"
                     data-floor="${selectedFloor}"
                     data-chart-index="${index}">
                    <div class="stat-chart-wrapper">
                        <canvas class="chart-office"></canvas>
                    </div>
                    <div class="stat-legend"></div>
                </div>
            `;
            index++;
        });

    }
        // ======================================================
        // CASE 2: AUCUN FLOOR → une carte par floor
    // ======================================================
    else {
        Object.entries(buildingZones).forEach(([floorId, floorZones]) => {
            if (!floorZones || Object.keys(floorZones).length === 0) return;

            html += `
                <div class="stat-card"
                     data-zone="FLOOR_${floorId}"
                     data-floor="${floorId}"
                     data-chart-index="${index}">
                    <div class="stat-chart-wrapper">
                        <canvas class="chart-office"></canvas>
                    </div>
                    <div class="stat-legend"></div>
                </div>
            `;
            index++;
        });
    }


    // 🔥 Destroy all existing charts before regenerating DOM
    container.querySelectorAll("canvas").forEach(c => {
        const ch = Chart.getChart(c);
        if (ch) ch.destroy();
    });

    container.innerHTML = html;

    // Vider l'état d'occupancy pour ne pas polluer avec les anciens sensors
    Object.keys(occupancyState).forEach(k => delete occupancyState[k]);

    // Mise à jour du contexte
    DASHBOARD_CTX.building = building;
    DASHBOARD_CTX.floor = selectedFloor;

    // Les stat-cards viennent d'être (re)créées dans #sensor-stats-container.
    // On notifie renderZones (dashboard.js) pour qu'il absorbe les nouvelles cartes
    // dans les zone-blocks correspondants — sans avoir à rappeler renderZones entier.
    document.dispatchEvent(new CustomEvent("occupancyStatCardsReady"));

    // Fetch initial + SSE
    fetchInitialOccupancyData(building, selectedFloor);
    openOccupancySSE(building, selectedFloor);
}

// ============================================
// FETCH INITIAL OCCUPANCY DATA FROM API
// ============================================
async function fetchInitialOccupancyData(building, floor) {
    try {
        const qs = new URLSearchParams();
        if (building) qs.set('building', building);
        if (floor != null) qs.set('floor', floor);  // floor=0 est valide (Ground Floor)

        const response = await fetch(`/api/dashboard/occupancy?${qs.toString()}`);
        if (!response.ok) {
            console.warn('Failed to fetch initial occupancy data');
            return;
        }

        const data = await response.json();
        if (!Array.isArray(data)) return;

        console.log(`📥 Fetched ${data.length} occupancy items from API`);
        console.log(`📋 Sample sensor IDs:`, data.slice(0, 10).map(d => d.id));

        // Convert API data to snapshot format and update occupancyState
        data.forEach(item => {
            const id = item?.id || item?.deviceId;
            const status = normalizeDeskStatus(item?.status || item?.occupancy);
            if (id) {
                occupancyState[id] = status;
            }
        });

        // Create snapshot and update all stat cards
        const snapshot = Object.entries(occupancyState).map(([id, status]) => ({ id, status }));
        const zoneStats = aggregateByZone(snapshot, building, floor);
        updateAllStatCards(zoneStats);

    } catch (err) {
        console.warn('Error fetching initial occupancy data:', err);
    }
}

// generateStatCardsForBuilding est appelé par dashboard.js une fois les buildings chargés

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
        // Stat card generation
        generateStatCardsForBuilding,
    };
}