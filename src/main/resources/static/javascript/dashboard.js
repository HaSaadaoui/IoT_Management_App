// ===== DASHBOARD MAIN FUNCTIONALITY =====
// Handles sensor search, filtering, visualization, and cost calculations


class DashboardManager {
    constructor() {
        // Current filter state
        this.filters = {
            year: '2025',
            month: '11',
            building: 'chateaudun',
            floor: '1',
            sensorType: 'DESK',
            timeSlot: 'afternoon'
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

        this.init();
    }

    init() {
        console.log('=== Dashboard Manager Initialized ===');
        console.log('Initial filters:', this.filters);
        this.initializeFilters();
        this.loadSampleData();
        this.loadDashboardData();

        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshData(), 30000);
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

        // Refresh data with new filters
        console.log('Refreshing dashboard data with new filters...');
        this.loadDashboardData();
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
            'chateaudun': 'Châteaudun Office',
            'levallois': 'Levallois Office',
            'lille': 'Lille Office'
        };
        return buildingNames[this.filters.building] || 'Office';
    }

    // ===== DATA LOADING =====

    async loadDashboardData() {
        console.log('=== Loading Dashboard Data ===');
        try {
            // Show loading state
            this.showLoading();

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

            const response = await fetch(apiUrl);
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
            throw "TODO: updateDashboard(data)";
            this.updateDashboard(data);

            // Update last refresh time
            this.updateRefreshTime();
            console.log('Dashboard data loaded successfully!');

        } catch (error) {
            console.error('=== Error Loading Dashboard Data ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            this.showError('Failed to load dashboard data. Using sample data.');

            // Fall back to sample data
            console.log('Falling back to sample data...');
            this.loadSampleData();
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

        console.log('Updating historical data...');
        this.updateHistoricalData(data.historicalData);

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

    // Generic doughnut chart creation function
    createDoughnutChart(chartElement, data) {
        // Destroy existing chart if present
        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }

        return new Chart(chartElement, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: data,
                    backgroundColor: [successColor, usedColor, invalidColor],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => context.label + ': ' + context.parsed + '%'
                        }
                    }
                },
            animation: {        
            duration: 0
            }
            }
        });
    }

    updateLocationChart(location, index) {
        // Find the stat-card with matching data-chart-index
        const statCard = document.querySelector(`.stat-card[data-chart-index="${index}"]`);
        if (!statCard) {
            console.warn(`Stat card not found for index: ${index}`);
            return;
        }

        const chartElement = statCard.querySelector('.chart-office');
        if (!chartElement) {
            console.warn(`Chart element not found for index: ${index}`);
            return;
        }

        const total = location.freeCount + location.usedCount + location.invalidCount;
        if (total === 0) {
            console.warn(`No data for chart at index ${index}`);
            return;
        }

        const freePercent = (location.freeCount / total * 100).toFixed(2);
        const usedPercent = (location.usedCount / total * 100).toFixed(2);
        const invalidPercent = (location.invalidCount / total * 100).toFixed(2);

        // Create chart using generic function
        this.createDoughnutChart(chartElement, [freePercent, usedPercent, invalidPercent]);

        // Update legend
        const legendElement = statCard.querySelector('.stat-legend');
        if (legendElement) {
            legendElement.innerHTML = `
                <div class="custom-label"><span class="dot free"></span> Free (${freePercent}%)</div>
                <div class="custom-label"><span class="dot used"></span> Used (${usedPercent}%)</div>
                <div class="custom-label"><span class="dot invalid"></span> Invalid (${invalidPercent}%)</div>
            `;
        }

        // Update title
        const titleElement = statCard.querySelector('.stat-card-title');
        if (titleElement) {
            titleElement.textContent = location.location;
        }
    }

    updateTotalChart(liveData) {
        const totalFree = liveData.reduce((sum, loc) => sum + loc.freeCount, 0);
        const totalUsed = liveData.reduce((sum, loc) => sum + loc.usedCount, 0);
        const totalInvalid = liveData.reduce((sum, loc) => sum + loc.invalidCount, 0);
        const total = totalFree + totalUsed + totalInvalid;

        if (total === 0) {
            console.warn('No total data available for chart');
            return;
        }

        const freePercent = (totalFree / total * 100).toFixed(2);
        const usedPercent = (totalUsed / total * 100).toFixed(2);
        const invalidPercent = (totalInvalid / total * 100).toFixed(2);

        const chartElement = document.getElementById('chart-total');
        if (!chartElement) {
            console.warn('Chart element not found: chart-total');
            return;
        }

        // Create chart using generic function
        this.createDoughnutChart(chartElement, [freePercent, usedPercent, invalidPercent]);

        // Update legend - find by data-chart-type="total"
        const totalStatCard = document.querySelector('.stat-card[data-chart-type="total"]');
        if (totalStatCard) {
            const legendElement = totalStatCard.querySelector('.stat-legend');
            if (legendElement) {
                legendElement.innerHTML = `
                    <div class="custom-label"><span class="dot free"></span> Free (${freePercent}%)</div>
                    <div class="custom-label"><span class="dot used"></span> Used (${usedPercent}%)</div>
                    <div class="custom-label"><span class="dot invalid"></span> Invalid (${invalidPercent}%)</div>
                `;
            }
        }
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
                        backgroundColor: usedColor,
                        borderRadius: 4,
                        barPercentage: 0.8
                    },
                    {
                        label: 'Free',
                        data: freeData,
                        backgroundColor: successColor,
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
                    backgroundColor: [successColor, usedColor],
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
        // Could add a loading spinner
    }

    hideLoading() {
        console.log('✅ Data loaded successfully');
    }

    showError(message) {
        console.error('❌ Error:', message);
        // Could show a toast notification
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Dashboard Manager...');
    window.dashboardManager = new DashboardManager();
});

// Export for external use
window.DashboardManager = DashboardManager;
