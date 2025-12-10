// ===== DASHBOARD MAIN FUNCTIONALITY =====
// Handles sensor search, filtering, visualization, and cost calculations

// ===== UTILITY: THROTTLE AND DEBOUNCE =====
//
// Request Optimization Strategy:
// 1. DEBOUNCING: Applied to user-triggered actions (filter changes, sensor selection)
//    - Waits for user to finish interactions before making API calls
//    - Prevents excessive requests during rapid filter changes
//    - Delays: 300-500ms depending on action frequency
//
// 2. THROTTLING: Applied to periodic actions (auto-refresh)
//    - Limits execution frequency to prevent server overload
//    - Ensures minimum time between requests
//    - Limit: 2000ms for auto-refresh
//
// 3. REQUEST GUARDS: Prevents duplicate concurrent requests
//    - Tracks active requests and skips duplicates
//    - Applied to all async fetch methods
//    - Releases lock in finally block to ensure cleanup

/**
 * Throttle function - limits function execution to once per interval.
 * Useful for events that fire frequently (scroll, resize, etc.)
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time (ms) between executions
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Debounce function - delays execution until after a pause in calls.
 * Useful for search inputs, filter changes, etc.
 * @param {Function} func - Function to debounce
 * @param {number} delay - Time (ms) to wait after last call
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

class DashboardManager {
    constructor() {
        // Current filter state
        this.filters = {
            year: '2025',
            month: '11',
            building: 'all',
            floor: 'all',
            sensorType: 'DESK',
            timeSlot: 'all'
        };

        // Cached data
        this.currentData = null;
        this.selectedSensor = null;

        // Cost calculation constants (per hour in euros)
        this.sensorCosts = {
            'DESK': 0.12,
            'CO2': 0.15,
            'TEMP': 0.08,
            'LIGHT': 0.10,
            'MOTION': 0.11,
            'NOISE': 0.13,
            'HUMIDITY': 0.09,
            'TEMPEX': 0.18,
            'PR': 0.14,
            'SECURITY': 0.20
        };

        // Charts references
        this.charts = {
            historicalBar: null,
            globalDonut: null,
            sensorCost: null
        };

        // Request tracking to prevent concurrent duplicate requests
        // Each entry stores: { active: boolean, controller: AbortController }
        this.activeRequests = {
            dashboard: { active: false, controller: null },
            histogram: { active: false, controller: null },
            occupationHistory: { active: false, controller: null },
            sensors: { active: false, controller: null }
        };

        // Loading indicator labels
        this.loadingLabels = {
            dashboard: { title: 'Loading Dashboard', details: 'Fetching live and historical data...' },
            histogram: { title: 'Loading Histogram', details: 'Computing sensor statistics...' },
            occupationHistory: { title: 'Loading History', details: 'Fetching occupation data...' },
            sensors: { title: 'Loading Sensors', details: 'Retrieving sensor list...' }
        };

        // Create debounced/throttled versions of fetch-heavy methods
        // Debounce: Wait for user to stop changing filters before fetching
        this.debouncedLoadDashboardData = debounce(() => this.loadDashboardData(), 500);
        this.debouncedLoadHistogramData = debounce(() => this.loadHistogramData(), 300);
        this.debouncedUpdateOccupationHistory = debounce(() => this.updateOccupationHistory(), 300);
        this.debouncedLoadSensors = debounce(() => this.loadSensors(), 300);

        // Throttle: Limit refresh rate to prevent hammering the server
        this.throttledRefreshData = throttle(() => this.refreshData(), 2000);

        this.init();
    }

    init() {
        console.log('=== Dashboard Manager Initialized ===');
        console.log('Initial filters:', this.filters);
        this.initializeFilters();
        this.initializeHistogramControls();
        this.initializeSensorSelection();
        this.initializeCancelButton();
        this.loadSampleData(); // TODO: remove sample data
        this.loadDashboardData();

        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshData(), 30000);
    }

    initializeCancelButton() {
        const cancelBtn = document.getElementById('cancel-requests-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelAllRequests());
        }
    }

    // ===== FILTER MANAGEMENT =====

    initializeFilters() {
        console.log('=== Initializing Filters ===');
        const filterIds = ['year', 'month', 'building', 'floor', 'sensor-type', 'time'];

        filterIds.forEach(filterId => {
            const element = document.getElementById(`filter-${filterId}`);
            if (element) {
                // Set initial value from filters state
                const filterKey = filterId.replace('-', '');
                const mappedKey = filterKey === 'sensortype' ? 'sensorType' :
                                 filterKey === 'time' ? 'timeSlot' : filterKey;

                if (this.filters[mappedKey]) {
                    element.value = this.filters[mappedKey];
                    console.log(`Filter ${filterId} set to:`, this.filters[mappedKey]);
                }

                // Add change listener
                element.addEventListener('change', (e) => this.handleFilterChange(filterId, e.target.value));
            } else {
                console.warn(`Filter element not found: filter-${filterId}`);
            }
        });
    }

    handleFilterChange(filterId, value) {
        console.log(`=== Filter Change: ${filterId} ===`);
        console.log('New value:', value);

        // Update filters state
        const filterKey = filterId.replace('filter-', '').replace('-', '');
        const mappedKey = filterKey === 'sensortype' ? 'sensorType' :
                         filterKey === 'time' ? 'timeSlot' : filterKey;

        this.filters[mappedKey] = value;
        console.log('Updated filters:', this.filters);

        // Handle sensor type change - update UI
        if (filterId === 'sensor-type') {
            console.log('Sensor type changed, updating UI...');
            this.updateSensorTypeUI(value);

            // Update 3D building if available
            if (window.building3D) {
                console.log('Updating 3D building sensor mode...');
                window.building3D.setSensorMode(value);
            }
        }

        // Refresh data with new filters (debounced to prevent excessive requests)
        console.log('Refreshing dashboard data with new filters...');
        this.debouncedLoadDashboardData();

        // Automatically reload sensors when filters that affect sensor list change
        if (['building', 'floor', 'sensor-type'].includes(filterId)) {
            console.log('Filter affecting sensor list changed, reloading sensors...');
            this.debouncedLoadSensors();
        }
    }

    updateSensorTypeUI(sensorType) {
        const sensorInfo = {
            'DESK': { icon: '📊', name: 'Desk Occupancy' },
            'CO2': { icon: '🌫️', name: 'CO₂ Air Quality' },
            'TEMP': { icon: '🌡️', name: 'Temperature' },
            'LIGHT': { icon: '💡', name: 'Light Levels' },
            'MOTION': { icon: '👁️', name: 'Motion Detection' },
            'NOISE': { icon: '🔉', name: 'Noise Levels' },
            'HUMIDITY': { icon: '💧', name: 'Humidity' },
            'TEMPEX': { icon: '🌀', name: 'HVAC Flow (TEMPex)' },
            'PR': { icon: '👤', name: 'Presence & Light' },
            'SECURITY': { icon: '🚨', name: 'Security Alerts' }
        };

        const info = sensorInfo[sensorType] || sensorInfo['DESK'];

        // Update section titles
        const liveTitle = document.getElementById('live-section-title');
        if (liveTitle) {
            liveTitle.textContent = `${info.icon} Live ${info.name} - ${this.getBuildingName()}`;
        }

        const historicalTitle = document.getElementById('historical-section-title');
        if (historicalTitle) {
            historicalTitle.textContent = `📈 Historical ${info.name} Data - ${this.getBuildingName()}`;
        }
    }

    getBuildingName() {
        const buildingNames = {
            'rpi-mantu-appli': 'Châteaudun Office',
            'lil-rpi-mantu-appli': 'Levallois Office',
            'lorawan-network-mantu': 'Lille Office'
        };
        return buildingNames[this.filters.building] || 'Office';
    }

    // ===== DATA LOADING =====

    async loadDashboardData() {
        console.log('=== Loading Dashboard Data ===');

        // Prevent duplicate concurrent requests
        if (this.activeRequests.dashboard.active) {
            console.log('Dashboard request already in progress, skipping...');
            return;
        }

        // Create AbortController for this request
        const controller = new AbortController();

        try {
            this.activeRequests.dashboard.active = true;
            this.activeRequests.dashboard.controller = controller;
            this.showGlobalLoading('dashboard');

            // Fetch data from API
            const params = new URLSearchParams({
                year: this.filters.year,
                month: this.filters.month,
                building: this.filters.building,
                floor: this.filters.floor,
                sensorType: this.filters.sensorType,
                timeSlot: this.filters.timeSlot
            });

            const apiUrl = `/api/dashboard?${params}`;
            console.log('API URL:', apiUrl);
            console.log('Request parameters:', Object.fromEntries(params));

            const response = await fetch(apiUrl, { signal: controller.signal });
            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('=== API Response Data ===');
            console.log('Alerts:', data.alerts?.length || 0);
            console.log('Live Sensor Data:', data.liveSensorData?.length || 0);
            console.log('Historical Data Points:', data.historicalData?.dataPoints?.length || 0);
            console.log('Full response:', data);

            this.currentData = data;

            // Update all visualizations
            console.log('Updating dashboard visualizations...');
            // throw "TODO: updateDashboard(data)";
            this.updateDashboard(data);

            // Update last refresh time
            this.updateRefreshTime();
            console.log('Dashboard data loaded successfully!');

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Dashboard request was cancelled');
                return;
            }

            console.error('=== Error Loading Dashboard Data ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            this.showError('Failed to load dashboard data. Using sample data.');

            // Fall back to sample data
            console.log('Falling back to sample data...');
            this.loadSampleData();
        } finally {
            this.activeRequests.dashboard.active = false;
            this.activeRequests.dashboard.controller = null;
            this.hideGlobalLoading();
        }
    }

    async refreshData() {
        console.log('Auto-refreshing dashboard data...');
        await this.loadDashboardData();
    }

    loadSampleData() {
        // Generate sample data for demonstration
        this.currentData = this.generateSampleData();
        this.updateDashboard(this.currentData);
        this.updateRefreshTime();
    }

    generateSampleData() {
        const days = 30;
        const historicalData = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            historicalData.push({
                date: date.toISOString().split('T')[0],
                occupancyRate: Math.random() * 40 + 20, // 20-60%
                sensorCount: Math.floor(Math.random() * 50) + 100,
                avgValue: Math.random() * 100
            });
        }

        return {
            alerts: this.generateSampleAlerts(),
            liveSensorData: this.generateSampleLiveData(),
            historicalData: {
                dataPoints: historicalData,
                globalOccupancy: 32.93,
                totalSensors: 150,
                activeSensors: 142
            }
        };
    }

    generateSampleAlerts() {
        return [
            {
                type: 'critical',
                title: 'Critical CO2 Level',
                message: 'Sensor CO2-B2 detected 1200 ppm',
                timestamp: new Date(Date.now() - 2 * 60000).toISOString()
            },
            {
                type: 'warning',
                title: 'High Temperature',
                message: 'Room A-103 temperature at 28°C',
                timestamp: new Date(Date.now() - 15 * 60000).toISOString()
            }
        ];
    }

    generateSampleLiveData() {
        const rooms = ['Open_05-01', 'Open_05-02', 'Meeting Room A'];
        return rooms.map(room => ({
            location: room,
            freeCount: Math.floor(Math.random() * 20) + 10,
            usedCount: Math.floor(Math.random() * 15) + 5,
            invalidCount: Math.floor(Math.random() * 2)
        }));
    }

    // ===== DASHBOARD UPDATE =====

    updateDashboard(data) {
        console.log('=== Updating Dashboard ===');
        console.log('Updating alerts...');
        this.updateAlerts(data.alerts);

        console.log('Updating live data...');
        this.updateLiveData(data.liveSensorData);

        // Histogram is now only updated via sensor selection, not global updates
        // console.log('Updating historical data...');
        // this.updateHistoricalData(data.historicalData);

        console.log('Updating occupation history...');
        this.updateOccupationHistory(data.historicalData);

        console.log('Updating cost analysis...');
        this.updateCostAnalysis(data.historicalData);

        console.log('Updating global statistics...');
        this.updateGlobalStatistics(data.historicalData);

        this.hideLoading();
        console.log('Dashboard update complete!');
    }

    updateAlerts(alerts) {
        // Alerts are static in HTML, could be made dynamic here
        console.log('Alerts updated:', alerts?.length || 0);
    }

    updateLiveData(liveData) {
        console.log('=== Updating Live Data ===');
        if (!liveData || liveData.length === 0) {
            console.warn('No live data available');
            return;
        }

        console.log('Live data entries:', liveData.length);
        console.log('Live data:', liveData);

        // Update donut charts for each location
        liveData.forEach((location, index) => {
            console.log(`Updating chart ${index + 1}:`, location);
            this.updateLocationChart(location, index);
        });

        // Calculate and update total
        console.log('Updating total chart...');
        this.updateTotalChart(liveData);
    }

    updateLocationChart(location, index) {
        // Find the stat-card with matching data-chart-index
        const statCard = document.querySelector(`.stat-card[data-chart-index="${index}"]`);
        if (!statCard) {
            console.warn(`Stat card not found for index: ${index}`);
            return;
        }

        // Use shared utility function to update the entire card
        window.ChartUtils.updateStatCard(statCard, location);
    }

    updateTotalChart(liveData) {
        const totalFree = liveData.reduce((sum, loc) => sum + loc.freeCount, 0);
        const totalUsed = liveData.reduce((sum, loc) => sum + loc.usedCount, 0);
        const totalInvalid = liveData.reduce((sum, loc) => sum + loc.invalidCount, 0);

        // Find total stat card
        const totalStatCard = document.querySelector('.stat-card[data-chart-type="total"]');
        if (!totalStatCard) {
            console.warn('Total stat card not found');
            return;
        }

        // Use shared utility function to update the entire card
        window.ChartUtils.updateStatCard(totalStatCard, {
            freeCount: totalFree,
            usedCount: totalUsed,
            invalidCount: totalInvalid,
            location: 'Total Live Data'
        });
    }

    updateHistoricalData(historicalData) {
        console.log('=== Updating Historical Data Chart ===');
        if (!historicalData || !historicalData.dataPoints) {
            console.warn('No historical data available');
            return;
        }

        console.log('Data points:', historicalData.dataPoints.length);

        const chartElement = document.getElementById('chart-historical-bar');
        if (!chartElement) {
            console.error('Chart element not found: chart-historical-bar');
            return;
        }

        const dates = historicalData.dataPoints.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-CA', { day: '2-digit', month: '2-digit' });
        });

        const usedData = historicalData.dataPoints.map(d => d.occupancyRate);
        const freeData = historicalData.dataPoints.map(d => 100 - d.occupancyRate);

        console.log('Chart dates:', dates.length);
        console.log('Sample dates:', dates.slice(0, 5));

        // Destroy existing chart - use both methods to ensure cleanup
        if (this.charts.historicalBar) {
            this.charts.historicalBar.destroy();
            this.charts.historicalBar = null;
        }

        // Also check if there's an existing Chart.js instance on this canvas
        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        this.charts.historicalBar = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Used',
                        data: usedData,
                        backgroundColor: notOkColor,
                        borderRadius: 4,
                        barPercentage: 0.8
                    },
                    {
                        label: 'Free',
                        data: freeData,
                        backgroundColor: okColor,
                        borderRadius: 4,
                        barPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date (day)',
                            color: '#64748b',
                            font: { size: 12, weight: '600' },
                            padding: { top: 10 }
                        },
                        stacked: true,
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Occupancy Rate (%)',
                            color: '#64748b',
                            font: { size: 12, weight: '600' },
                            padding: { bottom: 10 }
                        },
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    // ===== OCCUPATION HISTORY =====

    updateOccupationHistory(historicalData) {
        if (!historicalData || !historicalData.dataPoints) return;

        const tableBody = document.querySelector('.history-table tbody');
        if (!tableBody) return;

        // Take last 10 days
        const recentData = historicalData.dataPoints.slice(-10).reverse();

        tableBody.innerHTML = recentData.map(d => {
            const date = new Date(d.date);
            const formattedDate = date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            return `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${d.occupancyRate.toFixed(0)}%</td>
                </tr>
            `;
        }).join('');
    }

    // ===== COST ANALYSIS =====

    updateCostAnalysis(historicalData) {
        console.log('=== Updating Cost Analysis ===');
        if (!historicalData || !historicalData.dataPoints) {
            console.warn('No historical data for cost analysis');
            return;
        }

        const sensorType = this.filters.sensorType;
        const hourlyRate = this.sensorCosts[sensorType] || 0.10;
        console.log('Sensor type:', sensorType);
        console.log('Hourly rate:', hourlyRate);

        // Calculate costs based on sensor activity
        const costData = historicalData.dataPoints.map(d => {
            // Assume sensors run 24 hours, cost varies with activity
            const activityFactor = d.occupancyRate / 100;
            const baseCost = hourlyRate * 24; // 24 hours per day
            const activityCost = baseCost * (0.5 + activityFactor * 0.5); // 50% base + 50% variable
            return activityCost;
        });

        const totalMonthlyCost = costData.reduce((sum, cost) => sum + cost, 0);
        const averageDailyCost = totalMonthlyCost / costData.length;

        console.log('Total monthly cost:', totalMonthlyCost.toFixed(2));
        console.log('Average daily cost:', averageDailyCost.toFixed(2));

        // Update cost summary
        const totalCostElement = document.querySelector('.cost-total .cost-value');
        if (totalCostElement) {
            totalCostElement.textContent = `€${totalMonthlyCost.toFixed(2)}`;
        }

        const avgCostElement = document.querySelector('.cost-average .cost-value');
        if (avgCostElement) {
            avgCostElement.textContent = `€${averageDailyCost.toFixed(2)}`;
        }

        // Update cost chart
        this.updateCostChart(historicalData.dataPoints, costData);
    }

    updateCostChart(dataPoints, costData) {
        const chartElement = document.getElementById('chart-sensor-cost');
        if (!chartElement) {
            console.warn('Chart element not found: chart-sensor-cost');
            return;
        }

        const dates = dataPoints.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        });

        // Destroy existing chart - use both methods to ensure cleanup
        if (this.charts.sensorCost) {
            this.charts.sensorCost.destroy();
            this.charts.sensorCost = null;
        }

        // Also check if there's an existing Chart.js instance on this canvas
        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        const color = '#662179';
        this.charts.sensorCost = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily Cost',
                    data: costData,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: color,
                    pointBorderColor: color,
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                elements: {
                    point: {
                        radius: 2,
                        hoverRadius: 4
                    },
                    line: {
                        tension: 0.3
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: 8,
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45 / 2
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: "Cost (€)",
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: 6,
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return '€' + value.toFixed(2);
                            }
                        }
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderColor: '#662179',
                        borderWidth: 1,
                        callbacks: {
                            title: (context) => 'Date: ' + context[0].label,
                            label: (context) => 'Cost: €' + context.parsed.y.toFixed(2)
                        }
                    }
                }
            }
        });
    }

    // ===== GLOBAL STATISTICS =====

    updateGlobalStatistics(historicalData) {
        console.log('=== Updating Global Statistics ===');
        if (!historicalData) {
            console.warn('No historical data for global statistics');
            return;
        }

        const globalOccupancy = historicalData.globalOccupancy || 0;
        console.log('Global occupancy:', globalOccupancy.toFixed(2) + '%');
        console.log('Total sensors:', historicalData.totalSensors);
        console.log('Active sensors:', historicalData.activeSensors);

        // Update global donut chart
        const chartElement = document.getElementById('chart-global');
        if (!chartElement) {
            console.warn('Chart element not found: chart-global');
            return;
        }

        const occupied = globalOccupancy;
        const free = 100 - globalOccupancy;

        // Destroy existing chart - use both methods to ensure cleanup
        if (this.charts.globalDonut) {
            this.charts.globalDonut.destroy();
            this.charts.globalDonut = null;
        }

        // Also check if there's an existing Chart.js instance on this canvas
        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        this.charts.globalDonut = new Chart(chartElement, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Occupied'],
                datasets: [{
                    data: [free, occupied],
                    backgroundColor: [okColor, notOkColor],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => context.label + ': ' + context.parsed.toFixed(2) + '%'
                        }
                    }
                }
            }
        });

        // Update percentage display (showing occupied percentage in center)
        const percentageElement = document.getElementById('global-percentage-value');
        if (percentageElement) {
            percentageElement.textContent = globalOccupancy.toFixed(2) + '%';
        }

        // Update legend
        const legendElement = document.getElementById('global-legend');
        if (legendElement) {
            legendElement.innerHTML = `
                <div class="custom-label"><span class="dot free"></span> Free (${free.toFixed(2)}%)</div>
                <div class="custom-label"><span class="dot used"></span> Occupied (${occupied.toFixed(2)}%)</div>
            `;
        }
    }

    // ===== UTILITY FUNCTIONS =====

    updateRefreshTime() {
        const now = new Date();
        const formatted = now.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const element = document.getElementById('last-refresh-time');
        if (element) {
            element.textContent = formatted;
        }
    }

    showLoading() {
        console.log('⏳ Loading data...');
        // Legacy method - now handled by showGlobalLoading
    }

    hideLoading() {
        console.log('✅ Data loaded successfully');
        // Legacy method - now handled by hideGlobalLoading
    }

    showError(message) {
        console.error('❌ Error:', message);
        // Could show a toast notification
    }

    // ===== LOADING INDICATOR MANAGEMENT =====

    /**
     * Show the global loading indicator with specific request details
     * @param {string} requestType - Type of request (dashboard, histogram, occupationHistory, sensors)
     */
    showGlobalLoading(requestType) {
        const indicator = document.getElementById('global-loading-indicator');
        const titleEl = document.getElementById('loading-title');
        const detailsEl = document.getElementById('loading-details');

        if (!indicator || !titleEl || !detailsEl) return;

        const label = this.loadingLabels[requestType] || { title: 'Loading...', details: '' };

        titleEl.textContent = label.title;
        detailsEl.textContent = label.details;
        indicator.classList.add('show');

        console.log(`⏳ ${label.title} - ${label.details}`);
    }

    /**
     * Hide the global loading indicator if no requests are active
     */
    hideGlobalLoading() {
        // Check if any requests are still active
        const hasActiveRequests = Object.values(this.activeRequests).some(req => req.active);

        if (!hasActiveRequests) {
            const indicator = document.getElementById('global-loading-indicator');
            if (indicator) {
                indicator.classList.remove('show');
            }
            console.log('✅ All requests completed');
        }
    }

    /**
     * Update loading indicator to show current active request
     * If multiple requests are active, shows the most recent one
     */
    updateLoadingIndicator() {
        // Find the first active request to display
        for (const [requestType, req] of Object.entries(this.activeRequests)) {
            if (req.active) {
                this.showGlobalLoading(requestType);
                return;
            }
        }
        // No active requests, hide indicator
        this.hideGlobalLoading();
    }

    /**
     * Cancel all active requests
     */
    cancelAllRequests() {
        console.log('🛑 Cancelling all active requests...');
        let cancelledCount = 0;

        for (const [requestType, req] of Object.entries(this.activeRequests)) {
            if (req.active && req.controller) {
                console.log(`  Cancelling ${requestType} request`);
                req.controller.abort();
                req.active = false;
                req.controller = null;
                cancelledCount++;
            }
        }

        this.hideGlobalLoading();
        console.log(`✅ Cancelled ${cancelledCount} request(s)`);

        // Show feedback to user
        if (cancelledCount > 0) {
            this.showTemporaryMessage('Requests cancelled', 'info');
        }
    }

    /**
     * Show temporary message to user
     */
    showTemporaryMessage(message, type = 'info') {
        const indicator = document.getElementById('global-loading-indicator');
        if (!indicator) return;

        const titleEl = document.getElementById('loading-title');
        const detailsEl = document.getElementById('loading-details');

        titleEl.textContent = message;
        detailsEl.textContent = '';
        indicator.classList.add('show');

        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    // ===== HISTOGRAM FUNCTIONALITY =====

    initializeHistogramControls() {
        console.log('=== Initializing Histogram Controls ===');

        // Histogram state
        this.histogramConfig = {
            timeRange: 'LAST_7_DAYS',
            granularity: 'DAILY',
            metricType: 'OCCUPANCY'
        };

        // Initialize chart reference
        this.charts.histogram = null;

        // Add event listeners
        const timeRangeEl = document.getElementById('histogram-time-range');
        const granularityEl = document.getElementById('histogram-granularity');
        const metricTypeEl = document.getElementById('histogram-metric-type');
        const refreshBtn = document.getElementById('histogram-refresh-btn');

        if (timeRangeEl) {
            timeRangeEl.addEventListener('change', (e) => {
                this.histogramConfig.timeRange = e.target.value;
                console.log('Time range changed:', this.histogramConfig.timeRange);

                // If sensors are selected, refresh occupation history with new time range
                if (this.sensorSelection && this.sensorSelection.selectedSensors.length > 0) {
                    this.debouncedUpdateOccupationHistory();
                }
            });
        }

        if (granularityEl) {
            granularityEl.addEventListener('change', (e) => {
                this.histogramConfig.granularity = e.target.value;
                console.log('Granularity changed:', this.histogramConfig.granularity);
            });
        }

        if (metricTypeEl) {
            metricTypeEl.addEventListener('change', (e) => {
                this.histogramConfig.metricType = e.target.value;
                console.log('Metric type changed:', this.histogramConfig.metricType);
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Refresh histogram button clicked');
                // Histogram is now populated by occupation history when sensors are selected
                if (this.sensorSelection && this.sensorSelection.selectedSensors.length > 0) {
                    this.debouncedUpdateOccupationHistory();
                }
            });
        }

        // Chart is now populated by occupation history when sensors are selected
        // Initial state shows empty chart until sensors are selected
    }

    async loadHistogramData() {
        console.log('=== Loading Histogram Data ===');
        console.log('Config:', this.histogramConfig);

        // Prevent duplicate concurrent requests
        if (this.activeRequests.histogram.active) {
            console.log('Histogram request already in progress, skipping...');
            return;
        }

        // Create AbortController for this request
        const controller = new AbortController();

        // Show loading indicator
        const loadingEl = document.getElementById('histogram-loading');
        if (loadingEl) {
            loadingEl.style.display = 'block';
        }

        try {
            this.activeRequests.histogram.active = true;
            this.activeRequests.histogram.controller = controller;
            this.showGlobalLoading('histogram');

            // If single sensor is selected, use sensor-by-sensor approach
            if (this.sensorSelection && this.sensorSelection.selectedSensors.length === 1) {
                const sensorId = this.sensorSelection.selectedSensors[0];
                console.log('Loading histogram for single sensor:', sensorId);

                const params = new URLSearchParams({
                    sensorId: sensorId,
                    metricType: this.histogramConfig.metricType,
                    timeRange: this.histogramConfig.timeRange,
                    granularity: this.histogramConfig.granularity,
                    timeSlot: this.filters.timeSlot.toUpperCase()
                });

                // Remove empty parameters
                for (const [key, value] of [...params]) {
                    if (!value) params.delete(key);
                }

                const url = '/api/dashboard/histogram?' + params.toString();
                console.log('Fetching single sensor:', url);

                const response = await fetch(url, { signal: controller.signal });

                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }

                const data = await response.json();
                console.log('Histogram data received:', data);

                this.renderHistogramChart(data);
                this.updateHistogramSummary(data.summary);
                this.updateHistogramTitle(data);

            } else {
                // Multiple sensors or no selection - use group approach
                const params = new URLSearchParams({
                    building: this.filters.building !== 'all' ? this.filters.building : '',
                    floor: this.filters.floor !== 'all' ? this.filters.floor : '',
                    sensorType: this.filters.sensorType,
                    metricType: this.histogramConfig.metricType,
                    timeRange: this.histogramConfig.timeRange,
                    granularity: this.histogramConfig.granularity,
                    timeSlot: this.filters.timeSlot.toUpperCase()
                });

                // Remove empty parameters
                for (const [key, value] of [...params]) {
                    if (!value) params.delete(key);
                }

                const url = '/api/dashboard/histogram?' + params.toString();
                console.log('Fetching:', url);

                const response = await fetch(url, { signal: controller.signal });

                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }

                const data = await response.json();
                console.log('Histogram data received:', data);

                // Render the histogram
                this.renderHistogramChart(data);

                // Update summary statistics
                this.updateHistogramSummary(data.summary);

                // Update title
                this.updateHistogramTitle(data);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Histogram request was cancelled');
                return;
            }

            console.error('Error loading histogram data:', error);
            this.showError('Failed to load histogram data: ' + error.message);
        } finally {
            this.activeRequests.histogram.active = false;
            this.activeRequests.histogram.controller = null;
            this.hideGlobalLoading();
            // Hide loading indicator
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    }

    renderHistogramChart(data) {
        console.log('=== Rendering Histogram Chart ===');

        const chartElement = document.getElementById('chart-historical-bar');
        if (!chartElement) {
            console.warn('Histogram chart element not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.histogram) {
            this.charts.histogram.destroy();
            this.charts.histogram = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        // Prepare data
        const labels = data.dataPoints.map(dp => {
            if (data.granularity === 'HOURLY') {
                // Format: "14:00" (time only for hourly data)
                const timestamp = dp.timestamp; // Format: "yyyy-MM-dd HH:00"
                const timePart = timestamp.split(' ')[1]; // Extract "HH:00"
                return timePart || timestamp;
            } else {
                // Format: "25/11" (date only for daily data)
                const date = new Date(dp.timestamp);
                return date.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit'
                });
            }
        });

        const values = data.dataPoints.map(dp => dp.value);

        // Determine color based on metric type
        let barColor = '#662179';
        let borderColor = '#8e44ad';

        if (data.metricType === 'TEMPERATURE') {
            barColor = '#ff6b6b';
            borderColor = '#ff5252';
        } else if (data.metricType === 'CO2') {
            barColor = '#4ecdc4';
            borderColor = '#45b7d1';
        } else if (data.metricType === 'HUMIDITY') {
            barColor = '#95e1d3';
            borderColor = '#7ec4b8';
        } else if (data.metricType === 'ILLUMINANCE') {
            barColor = '#f9ca24';
            borderColor = '#f0b90b';
        } else if (data.metricType === 'LAEQ') {
            barColor = '#ff9ff3';
            borderColor = '#ff79e1';
        }

        // Create chart
        this.charts.histogram = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: this.getMetricLabel(data.metricType),
                    data: values,
                    backgroundColor: barColor,
                    borderColor: borderColor,
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: data.granularity === 'HOURLY' ? 'Time (Hour)' : 'Date',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        ticks: {
                            maxRotation: data.granularity === 'HOURLY' ? 0 : 45,
                            minRotation: data.granularity === 'HOURLY' ? 0 : 45,
                            font: { size: 11 }
                        },
                        grid: {
                            display: false
                        },
                        stacked: true,
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.getMetricUnit(data.metricType, data.aggregationType),
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: { size: 12, weight: '600' },
                            color: '#34495e'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderColor: barColor,
                        borderWidth: 2,
                        callbacks: {
                            title: (context) => 'Time: ' + context[0].label,
                            label: (context) => {
                                const value = context.parsed.y.toFixed(2);
                                const unit = this.getMetricUnit(data.metricType, data.aggregationType);
                                return `${context.dataset.label}: ${value} ${unit}`;
                            },
                            afterLabel: (context) => {
                                const dp = data.dataPoints[context.dataIndex];
                                return `Sensors: ${dp.sensorCount}\nData Points: ${dp.dataPointCount}`;
                            }
                        }
                    }
                }
            }
        });

        console.log('Histogram chart rendered successfully');
    }

    updateHistogramSummary(summary) {
        console.log('=== Updating Histogram Summary ===', summary);

        const totalEl = document.getElementById('summary-total-sensors');
        const activeEl = document.getElementById('summary-active-sensors');
        const avgEl = document.getElementById('summary-avg-value');
        const minEl = document.getElementById('summary-min-value');
        const maxEl = document.getElementById('summary-max-value');

        // Dummy test data here TODO: enable real data after demo
        let useMockData = true;
        if (!useMockData) {
            if (totalEl) totalEl.textContent   = summary.totalSensors || '--';
            if (activeEl) activeEl.textContent = summary.activeSensors || '--';
            if (avgEl) avgEl.textContent       = summary.avgValue ? summary.avgValue.toFixed(2) : '--';
            if (minEl) minEl.textContent       = summary.minValue ? summary.minValue.toFixed(2) : '--';
            if (maxEl) maxEl.textContent       = summary.maxValue ? summary.maxValue.toFixed(2) : '--';
        } else {
            if (totalEl) totalEl.textContent   = '150';
            if (activeEl) activeEl.textContent = '142';
            if (avgEl) avgEl.textContent       = '23.45%';
            if (minEl) minEl.textContent       = '18.90%';
            if (maxEl) maxEl.textContent       = '29.80%';
        }
    }

    updateHistogramTitle(data) {
        const titleEl = document.getElementById('histogram-chart-title');
        if (titleEl) {
            const metricLabel = this.getMetricLabel(data.metricType);
            const timeRangeLabel = this.getTimeRangeLabel(data.timeRange);
            const granularityLabel = data.granularity === 'DAILY' ? 'Daily' : 'Hourly';

            titleEl.textContent = `📊 Histogram - ${metricLabel} (${timeRangeLabel}, ${granularityLabel})`;
        }
    }

    getMetricLabel(metricType) {
        const labels = {
            'OCCUPANCY': 'Occupancy',
            'TEMPERATURE': 'Temperature',
            'CO2': 'CO₂ Level',
            'HUMIDITY': 'Humidity',
            'ILLUMINANCE': 'Light Level',
            'LAEQ': 'Noise Level',
            'MOTION': 'Motion Events'
        };
        return labels[metricType] || metricType;
    }

    getMetricUnit(metricType, aggregationType) {
        const units = {
            'OCCUPANCY': 'count',
            'TEMPERATURE': '°C',
            'CO2': 'ppm',
            'HUMIDITY': '%',
            'ILLUMINANCE': 'lux',
            'LAEQ': 'dB',
            'MOTION': 'events'
        };

        if (aggregationType === 'COUNT') {
            return 'count';
        }

        return units[metricType] || '';
    }

    getTimeRangeLabel(timeRange) {
        const labels = {
            'TODAY': 'Today',
            'LAST_7_DAYS': 'Last 7 Days',
            'LAST_30_DAYS': 'Last 30 Days',
            'THIS_MONTH': 'This Month',
            'LAST_MONTH': 'Last Month'
        };
        return labels[timeRange] || timeRange;
    }

    // ===== SENSOR SELECTION =====

    initializeSensorSelection() {
        console.log('=== Initializing Sensor Selection ===');

        // Sensor selection state (uses main filter values)
        this.sensorSelection = {
            selectedSensors: [],
            availableSensors: []
        };

        // Add event listeners
        const selectAllBtn = document.getElementById('select-all-sensors-btn');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        }

        // Automatically load sensors on page load with initial filters
        console.log('Loading sensors automatically on page load...');
        this.debouncedLoadSensors();
    }

    async loadSensors() {
        console.log('Loading sensors with filters:', this.filters);

        // Prevent duplicate concurrent requests
        if (this.activeRequests.sensors.active) {
            console.log('Sensors request already in progress, skipping...');
            return;
        }

        // Create AbortController for this request
        const controller = new AbortController();

        try {
            this.activeRequests.sensors.active = true;
            this.activeRequests.sensors.controller = controller;
            this.showGlobalLoading('sensors');

            const params = new URLSearchParams({
                building: this.filters.building,
                floor: this.filters.floor,
                sensorType: this.filters.sensorType
            });

            const response = await fetch('/api/dashboard/sensors?' + params, { signal: controller.signal });
            if (!response.ok) throw new Error('Failed to load sensors');

            const sensors = await response.json();
            this.sensorSelection.availableSensors = sensors;

            console.log('Loaded sensors:', sensors);

            // Show sensor list container
            const containerEl = document.getElementById('sensor-list-container');
            if (containerEl) {
                containerEl.style.display = 'block';
            }

            this.renderSensorList(sensors);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Sensors request was cancelled');
                return;
            }

            console.error('Error loading sensors:', error);
            alert('Failed to load sensors. Please try again.');
        } finally {
            this.activeRequests.sensors.active = false;
            this.activeRequests.sensors.controller = null;
            this.hideGlobalLoading();
        }
    }

    renderSensorList(sensors) {
        const sensorListEl = document.getElementById('sensor-list');
        const sensorCountEl = document.getElementById('sensor-count');

        if (!sensorListEl) return;

        // Update count
        if (sensorCountEl) {
            sensorCountEl.textContent = sensors.length;
        }

        // Clear existing list
        sensorListEl.innerHTML = '';

        if (sensors.length === 0) {
            sensorListEl.innerHTML = '<div class="sensor-list-placeholder">No sensors found</div>';
            return;
        }

        // Render each sensor
        sensors.forEach(sensor => {
            const isSelected = this.sensorSelection.selectedSensors.includes(sensor.idSensor);

            const sensorItem = document.createElement('div');
            sensorItem.className = 'sensor-item' + (isSelected ? ' selected' : '');
            sensorItem.dataset.sensorId = sensor.idSensor;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'sensor-' + sensor.idSensor;
            checkbox.checked = isSelected;
            checkbox.addEventListener('change', () => this.toggleSensorSelection(sensor.idSensor));

            const infoDiv = document.createElement('div');
            infoDiv.className = 'sensor-item-info';
            infoDiv.innerHTML = '<span class="sensor-item-name">' + sensor.idSensor + '</span>' +
                '<div class="sensor-item-details">' +
                    '<span>' + (sensor.location || 'No location') + '</span>' +
                    '<span>Floor ' + sensor.floor + '</span>' +
                    '<span class="sensor-badge ' + (sensor.active ? 'active' : 'inactive') + '">' +
                        (sensor.active ? 'Active' : 'Inactive') +
                    '</span>' +
                '</div>';

            sensorItem.appendChild(checkbox);
            sensorItem.appendChild(infoDiv);

            // Click on item toggles checkbox
            sensorItem.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    this.toggleSensorSelection(sensor.idSensor);
                }
            });

            sensorListEl.appendChild(sensorItem);
        });
    }

    toggleSensorSelection(sensorId) {
        const index = this.sensorSelection.selectedSensors.indexOf(sensorId);

        if (index > -1) {
            // Deselect
            this.sensorSelection.selectedSensors.splice(index, 1);
        } else {
            // Select
            this.sensorSelection.selectedSensors.push(sensorId);
        }

        // Update UI
        const sensorItem = document.querySelector('[data-sensor-id="' + sensorId + '"]');
        if (sensorItem) {
            sensorItem.classList.toggle('selected');
        }

        console.log('Selected sensors:', this.sensorSelection.selectedSensors);

        // Update occupation history when sensors are selected/deselected (debounced)
        this.debouncedUpdateOccupationHistory();
    }

    toggleSelectAll() {
        const allSelected = this.sensorSelection.selectedSensors.length === this.sensorSelection.availableSensors.length;

        if (allSelected) {
            // Deselect all
            this.sensorSelection.selectedSensors = [];
        } else {
            // Select all
            this.sensorSelection.selectedSensors = this.sensorSelection.availableSensors.map(s => s.idSensor);
        }

        // Re-render
        this.renderSensorList(this.sensorSelection.availableSensors);

        // Update occupation history (debounced)
        this.debouncedUpdateOccupationHistory();
    }

    async updateOccupationHistory() {
        const historyTable = document.querySelector('.history-table tbody');
        if (!historyTable) return;

        // If no sensors selected, clear table and chart
        if (!this.sensorSelection.selectedSensors || this.sensorSelection.selectedSensors.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="2" style="text-align: center;">Select sensors to view occupation history</td></tr>';
            this.clearOccupationHistoryChart();

            // Reset title
            const titleElement = document.getElementById('occupation-history-title');
            if (titleElement) {
                titleElement.textContent = '📊 Occupation History - Last 30 Days';
            }
            return;
        }

        // Prevent duplicate concurrent requests
        if (this.activeRequests.occupationHistory.active) {
            console.log('Occupation history request already in progress, skipping...');
            return;
        }

        // Create AbortController for this request
        const controller = new AbortController();

        try {
            this.activeRequests.occupationHistory.active = true;
            this.activeRequests.occupationHistory.controller = controller;
            this.showGlobalLoading('occupationHistory');

            // Build query parameters
            const params = new URLSearchParams();
            this.sensorSelection.selectedSensors.forEach(id => params.append('sensorIds', id));

            // Calculate days based on histogram time range
            let days = 30; // default
            switch (this.histogramConfig.timeRange) {
                case 'TODAY':
                    days = 1;
                    break;
                case 'LAST_7_DAYS':
                    days = 7;
                    break;
                case 'LAST_30_DAYS':
                    days = 30;
                    break;
                case 'THIS_MONTH':
                    // Calculate days in current month
                    const now = new Date();
                    days = now.getDate(); // Days elapsed in current month
                    break;
                case 'LAST_MONTH':
                    // Get days in previous month
                    const lastMonth = new Date();
                    lastMonth.setMonth(lastMonth.getMonth() - 1);
                    days = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate();
                    break;
                default:
                    days = 30;
            }

            params.append('days', days.toString());

            const response = await fetch('/api/dashboard/occupation-history?' + params.toString(), { signal: controller.signal });
            if (!response.ok) throw new Error('Failed to fetch occupation history');

            const history = await response.json();
            console.log('Occupation history received:', history);

            // Clear existing rows
            historyTable.innerHTML = '';

            if (history.length === 0) {
                historyTable.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data available</td></tr>';
                this.clearOccupationHistoryChart();

                // Reset title
                const titleElement = document.getElementById('occupation-history-title');
                if (titleElement) {
                    titleElement.textContent = '📊 Occupation History - No Data';
                }
                return;
            }

            // Populate table
            history.forEach(entry => {
                const row = document.createElement('tr');

                // Format date/time - handle both date-only and date+time formats
                let displayDate = entry.date;

                row.innerHTML = '<td>' + displayDate + '</td>' +
                               '<td>' + entry.occupancyRate.toFixed(1) + '%</td>';
                historyTable.appendChild(row);
            });

            // Update title with actual period
            this.updateOccupationHistoryTitle(history);

            // Render the occupation history chart
            this.renderOccupationHistoryChart(history);

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Occupation history request was cancelled');
                return;
            }

            console.error('Error updating occupation history:', error);
            historyTable.innerHTML = '<tr><td colspan="2" style="text-align: center; color: red;">Error loading history</td></tr>';
            this.clearOccupationHistoryChart();
        } finally {
            this.activeRequests.occupationHistory.active = false;
            this.activeRequests.occupationHistory.controller = null;
            this.hideGlobalLoading();
        }
    }

    renderOccupationHistoryChart(history) {
        console.log('=== Rendering Occupation History Chart ===');

        const chartElement = document.getElementById('chart-historical-bar');
        if (!chartElement) {
            console.warn('Chart element not found: chart-historical-bar');
            return;
        }

        // Destroy existing chart
        if (this.charts.historicalBar) {
            this.charts.historicalBar.destroy();
            this.charts.historicalBar = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        // Reverse history to show oldest to newest
        const sortedHistory = [...history].reverse();

        // Prepare data - split into used and free
        const dates = sortedHistory.map(entry => entry.date);
        const usedData = sortedHistory.map(entry => entry.occupancyRate);
        const freeData = sortedHistory.map(entry => 100 - entry.occupancyRate);

        // Create stacked bar chart
        this.charts.historicalBar = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Occupied',
                        data: usedData,
                        backgroundColor: '#ef4444',
                        borderRadius: 4,
                        barPercentage: 0.8
                    },
                    {
                        label: 'Free',
                        data: freeData,
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                        barPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#64748b',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: { top: 10 }
                        },
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 15,
                            color: '#64748b',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Occupancy Rate (%)',
                            color: '#64748b',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: { bottom: 10 }
                        },
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)',
                            lineWidth: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            color: '#64748b'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });

        // Update chart title using consistent period calculation
        const chartTitle = document.getElementById('histogram-chart-title');
        if (chartTitle) {
            const periodInfo = this.calculateHistoryPeriod(history);
            if (periodInfo) {
                chartTitle.textContent = `📊 Occupation History - ${periodInfo.titleText}`;
            }
        }

        // Update summary with occupation history stats
        const avgOccupancy = sortedHistory.reduce((sum, entry) => sum + entry.occupancyRate, 0) / sortedHistory.length;
        const minOccupancy = Math.min(...sortedHistory.map(entry => entry.occupancyRate));
        const maxOccupancy = Math.max(...sortedHistory.map(entry => entry.occupancyRate));

        this.updateHistogramSummary({
            totalSensors: this.sensorSelection.selectedSensors.length,
            activeSensors: this.sensorSelection.selectedSensors.length,
            avgValue: avgOccupancy / 100, // Convert to decimal
            minValue: minOccupancy / 100,
            maxValue: maxOccupancy / 100
        });

        console.log('Occupation history chart rendered successfully');
    }

    clearOccupationHistoryChart() {
        const chartElement = document.getElementById('chart-historical-bar');
        if (!chartElement) return;

        // Destroy existing chart
        if (this.charts.historicalBar) {
            this.charts.historicalBar.destroy();
            this.charts.historicalBar = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        // Reset chart title
        const chartTitle = document.getElementById('histogram-chart-title');
        if (chartTitle) {
            chartTitle.textContent = '📊 Sensor Data Trends - Occupancy';
        }

        // Clear summary
        document.getElementById('summary-total-sensors').textContent = '--';
        document.getElementById('summary-active-sensors').textContent = '--';
        document.getElementById('summary-avg-value').textContent = '--';
        document.getElementById('summary-min-value').textContent = '--';
        document.getElementById('summary-max-value').textContent = '--';

        // Reset occupation history title
        const occupationTitle = document.getElementById('occupation-history-title');
        if (occupationTitle) {
            occupationTitle.textContent = '📊 Occupation History - Last 30 Days';
        }
    }

    /**
     * Parse date string - handles both "yyyy-MM-dd" and "dd/MM/yyyy" formats
     * @param {string} dateStr - Date string to parse
     * @returns {Date} Parsed date object
     */
    parseHistoryDate(dateStr) {
        if (dateStr.includes('-')) {
            // ISO format: yyyy-MM-dd or yyyy-MM-dd HH:mm
            return new Date(dateStr);
        } else if (dateStr.includes('/')) {
            // European format: dd/MM/yyyy
            const [day, month, year] = dateStr.split('/');
            return new Date(year, month - 1, day);
        }
        return new Date(dateStr);
    }

    /**
     * Format date for display in European format
     * @param {Date} date - Date object to format
     * @returns {string} Formatted date string (dd/MM/yyyy)
     */
    formatHistoryDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Calculate period information from history data
     * @param {Array} history - Array of occupation history entries with dates
     * @returns {Object} Object with firstDate, lastDate, daysDiff, and titleText
     */
    calculateHistoryPeriod(history) {
        if (!history || history.length === 0) {
            return null;
        }

        // Parse first and last dates from the data
        const oldestDateStr = history[0].date; // Oldest date
        const newestDateStr = history[history.length - 1].date; // Most recent date

        const oldestDate = this.parseHistoryDate(oldestDateStr);
        const newestDate = this.parseHistoryDate(newestDateStr);

        // Calculate actual number of days between dates
        const daysDiff = Math.round((newestDate - oldestDate) / (1000 * 60 * 60 * 24)) + 1;

        // Generate title based on the period - show newest to oldest (reverse chronological)
        let titleText;
        if (daysDiff === 1) {
            titleText = `${this.formatHistoryDate(newestDate)}`;
        } else {
            // Show date range from newest to oldest
            titleText = `${this.formatHistoryDate(newestDate)} to ${this.formatHistoryDate(oldestDate)}`;
        }

        return {
            firstDate: oldestDate,
            lastDate: newestDate,
            daysDiff,
            titleText
        };
    }

    /**
     * Update the occupation history title with the actual period covered by the data
     * @param {Array} history - Array of occupation history entries with dates
     */
    updateOccupationHistoryTitle(history) {
        const titleElement = document.getElementById('occupation-history-title');
        if (!titleElement || !history || history.length === 0) return;

        const periodInfo = this.calculateHistoryPeriod(history);
        if (!periodInfo) return;

        const fullTitle = `📊 Occupation History - ${periodInfo.titleText}`;
        titleElement.textContent = fullTitle;
        console.log(`Updated occupation history title: ${fullTitle} (${periodInfo.daysDiff} days)`);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Dashboard Manager...');
    window.dashboardManager = new DashboardManager();
});

// Export for external use
window.DashboardManager = DashboardManager;
