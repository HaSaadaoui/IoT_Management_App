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
        console.log('Dashboard Manager initialized');
        this.initializeFilters();
        this.loadDashboardData();

        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshData(), 30000);
    }

    // ===== FILTER MANAGEMENT =====

    initializeFilters() {
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
                }

                // Add change listener
                element.addEventListener('change', (e) => this.handleFilterChange(filterId, e.target.value));
            }
        });
    }

    handleFilterChange(filterId, value) {
        console.log(`Filter ${filterId} changed to:`, value);

        // Update filters state
        const filterKey = filterId.replace('filter-', '').replace('-', '');
        const mappedKey = filterKey === 'sensortype' ? 'sensorType' :
                         filterKey === 'time' ? 'timeSlot' : filterKey;

        this.filters[mappedKey] = value;

        // Handle sensor type change - update UI
        if (filterId === 'sensor-type') {
            this.updateSensorTypeUI(value);

            // Update 3D building if available
            if (window.building3D) {
                window.building3D.setSensorMode(value);
            }
        }

        // Refresh data with new filters
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

            const response = await fetch(`/api/dashboard?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            const data = await response.json();
            this.currentData = data;

            // Update all visualizations
            this.updateDashboard(data);

            // Update last refresh time
            this.updateRefreshTime();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data. Using sample data.');

            // Fall back to sample data
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
        this.updateAlerts(data.alerts);
        this.updateLiveData(data.liveSensorData);
        this.updateHistoricalData(data.historicalData);
        this.updateOccupationHistory(data.historicalData);
        this.updateCostAnalysis(data.historicalData);
        this.updateGlobalStatistics(data.historicalData);

        this.hideLoading();
    }

    updateAlerts(alerts) {
        // Alerts are static in HTML, could be made dynamic here
        console.log('Alerts updated:', alerts?.length || 0);
    }

    updateLiveData(liveData) {
        if (!liveData || liveData.length === 0) return;

        // Update donut charts for each location
        liveData.forEach((location, index) => {
            this.updateLocationChart(location, index);
        });

        // Calculate and update total
        this.updateTotalChart(liveData);
    }

    updateLocationChart(location, index) {
        const chartId = `chart-office-${index + 1}`;
        const chartElement = document.getElementById(chartId);

        if (!chartElement) return;

        const total = location.freeCount + location.usedCount + location.invalidCount;
        const freePercent = (location.freeCount / total * 100).toFixed(2);
        const usedPercent = (location.usedCount / total * 100).toFixed(2);
        const invalidPercent = (location.invalidCount / total * 100).toFixed(2);

        // Update chart (if already exists, destroy and recreate)
        const existingChart = Chart.getChart(chartId);
        if (existingChart) {
            existingChart.destroy();
        }

        new Chart(chartElement, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [freePercent, usedPercent, invalidPercent],
                    backgroundColor: ['#10b981', '#ef4444', '#94a3b8'],
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
                }
            }
        });

        // Update legend
        const legendId = `stat-legend-${index + 1}`;
        const legendElement = document.getElementById(legendId);
        if (legendElement) {
            legendElement.innerHTML = `
                <div><span class="dot free"></span> Free (${freePercent}%)</div>
                <div><span class="dot used"></span> Used (${usedPercent}%)</div>
                <div><span class="dot invalid"></span> Invalid (${invalidPercent}%)</div>
            `;
        }

        // Update title
        const titleId = `stat-card-${index + 1}-title`;
        const titleElement = document.getElementById(titleId);
        if (titleElement) {
            titleElement.textContent = location.location;
        }
    }

    updateTotalChart(liveData) {
        const totalFree = liveData.reduce((sum, loc) => sum + loc.freeCount, 0);
        const totalUsed = liveData.reduce((sum, loc) => sum + loc.usedCount, 0);
        const totalInvalid = liveData.reduce((sum, loc) => sum + loc.invalidCount, 0);
        const total = totalFree + totalUsed + totalInvalid;

        const freePercent = (totalFree / total * 100).toFixed(2);
        const usedPercent = (totalUsed / total * 100).toFixed(2);
        const invalidPercent = (totalInvalid / total * 100).toFixed(2);

        const chartElement = document.getElementById('chart-total');
        if (!chartElement) return;

        const existingChart = Chart.getChart('chart-total');
        if (existingChart) {
            existingChart.destroy();
        }

        new Chart(chartElement, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [freePercent, usedPercent, invalidPercent],
                    backgroundColor: ['#10b981', '#ef4444', '#94a3b8'],
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
                }
            }
        });

        // Update legend
        const legendElement = document.getElementById('stat-legend-6');
        if (legendElement) {
            legendElement.innerHTML = `
                <div><span class="dot free"></span> Free (${freePercent}%)</div>
                <div><span class="dot used"></span> Used (${usedPercent}%)</div>
                <div><span class="dot invalid"></span> Invalid (${invalidPercent}%)</div>
            `;
        }
    }

    updateHistoricalData(historicalData) {
        if (!historicalData || !historicalData.dataPoints) return;

        const chartElement = document.getElementById('chart-historical-bar');
        if (!chartElement) return;

        const dates = historicalData.dataPoints.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        });

        const usedData = historicalData.dataPoints.map(d => d.occupancyRate);
        const freeData = historicalData.dataPoints.map(d => 100 - d.occupancyRate);

        // Destroy existing chart
        if (this.charts.historicalBar) {
            this.charts.historicalBar.destroy();
        }

        this.charts.historicalBar = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Used',
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
        if (!historicalData || !historicalData.dataPoints) return;

        const sensorType = this.filters.sensorType;
        const hourlyRate = this.sensorCosts[sensorType] || 0.10;

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
        if (!chartElement) return;

        const dates = dataPoints.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        });

        // Destroy existing chart
        if (this.charts.sensorCost) {
            this.charts.sensorCost.destroy();
        }

        this.charts.sensorCost = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily Cost',
                    data: costData,
                    borderColor: '#662179',
                    backgroundColor: 'rgba(102, 33, 121, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#662179',
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
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date (day)',
                            color: '#64748b',
                            font: { size: 14, weight: '600' },
                            padding: { top: 10 }
                        },
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cost (€)',
                            color: '#64748b',
                            font: { size: 14, weight: '600' },
                            padding: { bottom: 10 }
                        },
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => '€' + value.toFixed(2)
                        }
                    }
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
        if (!historicalData) return;

        const globalOccupancy = historicalData.globalOccupancy || 0;

        // Update global donut chart
        const chartElement = document.getElementById('chart-global');
        if (!chartElement) return;

        const occupied = globalOccupancy;
        const free = 100 - globalOccupancy;

        // Destroy existing chart
        if (this.charts.globalDonut) {
            this.charts.globalDonut.destroy();
        }

        this.charts.globalDonut = new Chart(chartElement, {
            type: 'doughnut',
            data: {
                labels: ['Occupied', 'Free'],
                datasets: [{
                    data: [occupied, free],
                    backgroundColor: ['#ef4444', '#10b981'],
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

        // Update percentage display
        const percentageElement = document.getElementById('global-percentage-value');
        if (percentageElement) {
            percentageElement.textContent = globalOccupancy.toFixed(2) + '%';
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
        // Could add a loading spinner
        console.log('Loading data...');
    }

    hideLoading() {
        console.log('Data loaded');
    }

    showError(message) {
        console.error(message);
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
