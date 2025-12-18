class DashboardManager {
    constructor() {
        this.buildings = [];
        this.currentBuilding = null;

        this.filters = {
            year: '2025',
            month: '11',
            building: "CHATEAUDUN",
            floor: '1',
            sensorType: 'DESK',
            timeSlot: 'afternoon'
        };

        this.currentData = null;
        this.selectedSensor = null;

        this.sensorCosts = {
            DESK: 0.12,
            CO2: 0.15,
            TEMP: 0.08,
            LIGHT: 0.10,
            MOTION: 0.11,
            NOISE: 0.13,
            HUMIDITY: 0.09,
            TEMPEX: 0.18,
            PR: 0.14,
            SECURITY: 0.20
        };

        this.charts = {
            historicalBar: null,
            globalDonut: null,
            sensorCost: null,
            histogram: null
        };

        this.histogramConfig = {
            timeRange: 'LAST_7_DAYS',
            granularity: 'DAILY',
            metricType: 'OCCUPANCY'
        };

        this.init();
    }

    init() {
        console.log('=== Dashboard Manager Initialized ===');
        this.initializeFilters();
        this.initializeHistogramControls();
        this.loadBuildings();
        this.loadDashboardData();
        setInterval(() => this.refreshData(), 30000);
    }

    // ===== FILTERS =====

    initializeFilters() {
        const filterIds = ['year', 'month', 'building', 'floor', 'sensor-type', 'time'];

        filterIds.forEach(filterId => {
            const element = document.getElementById(`filter-${filterId}`);
            if (!element) {
                console.warn(`Filter element not found: filter-${filterId}`);
                return;
            }

            const filterKey = filterId.replace('-', '');
            const mappedKey =
                filterKey === 'sensortype' ? 'sensorType' :
                filterKey === 'time' ? 'timeSlot' :
                filterKey;

            if (this.filters[mappedKey]) {
                element.value = this.filters[mappedKey];
            }

            element.addEventListener('change', (e) =>
                this.handleFilterChange(filterId, e.target.value)
            );
        });
    }

    async loadBuildings() {
        console.log('=== Loading buildings list ===');
        const select = document.getElementById('filter-building');
        if (!select) {
            console.warn('filter-building select not found');
            return;
        }

        try {
            const resp = await fetch('/api/buildings');
            if (!resp.ok) {
                throw new Error('HTTP ' + resp.status);
            }

            const buildings = await resp.json();
            this.buildings = buildings;

            // On ajoute les options API SANS toucher à la sélection actuelle HTML
            buildings.forEach(b => {
                const opt = document.createElement('option');
                opt.value = String(b.id);
                opt.textContent = b.name;
                select.appendChild(opt);
            });

            if (buildings.length > 0) {
                const currentKey = this.filters.building; // "CHATEAUDUN" au démarrage

                let current =
                    buildings.find(b => String(b.id) === String(currentKey)) ||
                    buildings.find(b => b.code === currentKey) ||
                    buildings.find(b => b.name === currentKey) ||
                    null;

                if (!current) {
                    current = buildings[0];
                }

                this.currentBuilding = current;

                this.updateSensorTypeUI(this.filters.sensorType);
                this.updateBuildingTitle();

                if (current && window.building3D?.loadBuilding) {
                    window.building3D.loadBuilding(current);
                }
            } else {
                select.innerHTML = `<option value="">No buildings found</option>`;
            }
        } catch (e) {
            console.error('Error loading buildings', e);
            select.innerHTML = `<option value="">Error loading buildings</option>`;
        }
    }

    handleFilterChange(filterId, value) {
        console.log(`=== Filter Change: ${filterId} ===`, value);

        const filterKey = filterId.replace('filter-', '').replace('-', '');
        const mappedKey =
            filterKey === 'sensortype' ? 'sensorType' :
            filterKey === 'time' ? 'timeSlot' :
            filterKey;

        this.filters[mappedKey] = value;

        // 🔁 Cas particulier : changement de bâtiment
        if (filterId === 'building') {
            const building = this.buildings.find(
                b => String(b.id) === String(value) || b.code === value
            );
            this.currentBuilding = building || null;

            // Ce qu'on garde dans filters.building = le code symbolique si dispo
            if (building?.code) {
                this.filters.building = building.code; // CHATEAUDUN / LEVALLOIS / LILLE
            } else {
                this.filters.building = value; // fallback
            }

            this.updateSensorTypeUI(this.filters.sensorType);
            this.updateBuildingTitle();

            if (building && window.building3D?.loadBuilding) {
                window.building3D.loadBuilding(building);
            }

            this.loadDashboardData();
            return; // éviter un 2e loadDashboardData plus bas
        }

        if (filterId === 'sensor-type') {
            this.updateSensorTypeUI(value);
            if (window.building3D?.setSensorMode) {
                window.building3D.setSensorMode(value);
            }
        }

        this.loadDashboardData();
    }

    updateSensorTypeUI(sensorType) {
        const sensorInfo = {
            DESK: { icon: '📊', name: 'Desk Occupancy' },
            CO2: { icon: '🌫️', name: 'CO₂ Air Quality' },
            TEMP: { icon: '🌡️', name: 'Temperature' },
            LIGHT: { icon: '💡', name: 'Light Levels' },
            MOTION: { icon: '👁️', name: 'Motion Detection' },
            NOISE: { icon: '🔉', name: 'Noise Levels' },
            HUMIDITY: { icon: '💧', name: 'Humidity' },
            TEMPEX: { icon: '🌀', name: 'HVAC Flow (TEMPex)' },
            PR: { icon: '👤', name: 'Presence & Light' },
            SECURITY: { icon: '🚨', name: 'Security Alerts' }
        };

        const info = sensorInfo[sensorType] || sensorInfo.DESK;
        const buildingName = this.getBuildingName();

        const liveTitle = document.getElementById('live-section-title');
        if (liveTitle) {
            liveTitle.textContent = `${info.icon} Live ${info.name} - ${buildingName}`;
        }

        const historicalTitle = document.getElementById('historical-section-title');
        if (historicalTitle) {
            historicalTitle.textContent = `📈 Historical ${info.name} Data - ${buildingName}`;
        }

        this.updateBuildingTitle();
    }

    updateBuildingTitle() {
        const el = document.getElementById('building-title');
        if (el) {
            el.textContent = `🏢 ${this.getBuildingName()} Building`;
        }
    }

    getBuildingName() {
        const key = this.filters.building;

        const legacyLabels = {
            'rpi-mantu-appli': 'Châteaudun Office',
            'lil-rpi-mantu-appli': 'Levallois Office',
            'lorawan-network-mantu': 'Lille Office'
        };

        const staticLabels = {
            CHATEAUDUN: 'Châteaudun Office',
            LEVALLOIS: 'Levallois Office',
            LILLE: 'Lille Office'
        };

        if (key && (legacyLabels[key] || staticLabels[key])) {
            return legacyLabels[key] || staticLabels[key];
        }

        // 2️⃣ Sinon : on utilise le vrai nom du building DB
        if (this.currentBuilding?.name) {
            return this.currentBuilding.name;
        }

        // 3️⃣ Fallback
        return 'Office';
    }

    // ===== DATA LOADING =====

    async loadDashboardData() {
        console.log('=== Loading Dashboard Data ===');
        try {
            this.showLoading();

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

            const response = await fetch(apiUrl);
            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Dashboard data:', data);

            this.currentData = data;

            // Update all visualizations
            console.log('Updating dashboard visualizations...');
            this.updateDashboard(data);
            this.updateRefreshTime();
        } catch (error) {
            console.error('Error Loading Dashboard Data', error);
            this.showError('Failed to load dashboard data. Using sample data.');
            this.loadSampleData();
        }
    }

    async refreshData() {
        console.log('Auto-refreshing dashboard data...');
        await this.loadDashboardData();
    }

    loadSampleData() {
        const days = 30;
        const historicalData = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            historicalData.push({
                date: date.toISOString().split('T')[0],
                occupancyRate: Math.random() * 40 + 20,
                sensorCount: Math.floor(Math.random() * 50) + 100,
                avgValue: Math.random() * 100
            });
        }

        return {
            alerts: this.generateSampleAlerts(),
            liveSensorData: this.generateSampleLiveData(),
            historicalData: {
                dataPoints: historicalData,
                globalOccupancy: 0,
                totalSensors: 0,
                activeSensors: 0,
            }
        };

        this.updateDashboard(this.currentData);
        this.updateRefreshTime();
    }

    generateSampleAlerts() {
        return [
            {
                level: 'critical',
                icon: '⚠️',
                title: 'Critical CO2 Level',
                message: 'Sensor CO2-B2 detected 1200 ppm',
                time: '2 minutes ago'
            },
            {
                level: 'warning',
                icon: '🔔',
                title: 'High Temperature',
                message: 'Room A-103 temperature at 28°C',
                time: '15 minutes ago'
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
        console.log('=== Updating Alerts ===');
        if (!alerts) {
            console.log('No alerts data provided');
            return;
        } else {
            const loadingEl = document.getElementById('alerts-loading');
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
        console.log('Alerts received:', alerts?.length || 0);

        const alertsGrid = document.querySelector('.alerts-grid');
        if (!alertsGrid) {
            console.warn('Alerts grid not found');
            return;
        }

        if (!alerts || alerts.length === 0) {
            // Show no alerts message
            alertsGrid.innerHTML = `
                <div class="alert-card info">
                    <div class="alert-icon">ℹ️</div>
                    <div class="alert-content">
                        <h4>No Active Alerts</h4>
                        <p>All systems are operating normally</p>
                        <span class="alert-time">Just now</span>
                    </div>
                </div>
            `;
            return;
        }

        // Clear existing alerts
        alertsGrid.innerHTML = '';

        // Add new alerts
        alerts.forEach((alert, index) => {
            const alertCard = document.createElement('div');
            alertCard.className = `alert-card ${alert.level}`;
            alertCard.innerHTML = `
                <div class="alert-icon">${alert.icon}</div>
                <div class="alert-content">
                    <h4>${alert.title}</h4>
                    <p>${alert.message}</p>
                    <span class="alert-time">${alert.time}</span>
                </div>
            `;

            alertsGrid.appendChild(alertCard);
        });

        console.log(`Rendered ${alerts.length} alerts`);
    }

    updateLiveData(liveData) {
        console.log('Updating Live Data');
        if (!liveData || liveData.length === 0) {
            console.warn('No live data available');
            return;
        }

        liveData.forEach((location, index) => {
            this.updateLocationChart(location, index);
        });

        this.updateTotalChart(liveData);
    }

    updateLocationChart(location, index) {
        const statCard = document.querySelector(`.stat-card[data-chart-index="${index}"]`);
        if (!statCard) {
            console.warn(`Stat card not found for index: ${index}`);
            return;
        }

        window.ChartUtils.updateStatCard(statCard, location);
    }

    updateTotalChart(liveData) {
        const totalFree = liveData.reduce((sum, loc) => sum + loc.freeCount, 0);
        const totalUsed = liveData.reduce((sum, loc) => sum + loc.usedCount, 0);
        const totalInvalid = liveData.reduce((sum, loc) => sum + loc.invalidCount, 0);

        const totalStatCard = document.querySelector('.stat-card[data-chart-type="total"]');
        if (!totalStatCard) {
            console.warn('Total stat card not found');
            return;
        }

        window.ChartUtils.updateStatCard(totalStatCard, {
            freeCount: totalFree,
            usedCount: totalUsed,
            invalidCount: totalInvalid,
            location: 'Total Live Data'
        });
    }

    updateHistoricalData(historicalData) {
        console.log('Updating Historical Data Chart');
        if (!historicalData?.dataPoints) {
            console.warn('No historical data available');
            return;
        }

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

        if (this.charts.historicalBar) {
            this.charts.historicalBar.destroy();
            this.charts.historicalBar = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

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
                            callback: value => value + '%'
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

    updateOccupationHistory(historicalData) {
        if (!historicalData?.dataPoints) return;

        const tableBody = document.querySelector('.history-table tbody');
        if (!tableBody) return;

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
        console.log('Updating Cost Analysis');
        if (!historicalData?.dataPoints) {
            console.warn('No historical data for cost analysis');
            return;
        }

        const sensorType = this.filters.sensorType;
        const hourlyRate = this.sensorCosts[sensorType] || 0.10;

        const costData = historicalData.dataPoints.map(d => {
            const activityFactor = d.occupancyRate / 100;
            const baseCost = hourlyRate * 24;
            return baseCost * (0.5 + activityFactor * 0.5);
        });

        const totalMonthlyCost = costData.reduce((sum, cost) => sum + cost, 0);
        const averageDailyCost = totalMonthlyCost / costData.length;

        const costValues = document.querySelectorAll('.cost-card .cost-value');
        if (costValues[0]) costValues[0].textContent = `€${totalMonthlyCost.toFixed(2)}`;
        if (costValues[1]) costValues[1].textContent = `€${averageDailyCost.toFixed(2)}`;

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

        if (this.charts.sensorCost) {
            this.charts.sensorCost.destroy();
            this.charts.sensorCost = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

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
                            font: { size: 14, weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: 8,
                            font: { size: 11 },
                            maxRotation: 45,
                            minRotation: 45 / 2
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Cost (€)',
                            font: { size: 14, weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: 6,
                            font: { size: 11 },
                            callback: value => '€' + value.toFixed(2)
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderColor: color,
                        borderWidth: 1,
                        callbacks: {
                            title: context => 'Date: ' + context[0].label,
                            label: context => 'Cost: €' + context.parsed.y.toFixed(2)
                        }
                    }
                }
            }
        });
    }

    // ===== GLOBAL STATS =====

    updateGlobalStatistics(historicalData) {
        console.log('Updating Global Statistics');
        if (!historicalData) {
            console.warn('No historical data for global statistics');
            return;
        }

        const globalOccupancy = historicalData.globalOccupancy || 0;
        const chartElement = document.getElementById('chart-global');
        if (!chartElement) {
            console.warn('Chart element not found: chart-global');
            return;
        }

        const occupied = globalOccupancy;
        const free = 100 - globalOccupancy;

        if (this.charts.globalDonut) {
            this.charts.globalDonut.destroy();
            this.charts.globalDonut = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

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
                            label: context => `${context.label}: ${context.parsed.toFixed(2)}%`
                        }
                    }
                }
            }
        });

        const percentageElement = document.getElementById('global-percentage-value');
        if (percentageElement) {
            percentageElement.textContent = globalOccupancy.toFixed(2) + '%';
        }

        const legendElement = document.getElementById('global-legend');
        if (legendElement) {
            legendElement.innerHTML = `
                <div class="custom-label"><span class="dot free"></span> Free (${free.toFixed(2)}%)</div>
                <div class="custom-label"><span class="dot used"></span> Occupied (${occupied.toFixed(2)}%)</div>
            `;
        }
    }

    // ===== UTILS =====

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
    }

    hideLoading() {
        console.log('✅ Data loaded');
    }

    showError(message) {
        console.error('❌ Error:', message);
    }

    // ===== HISTOGRAM =====

    initializeHistogramControls() {
        console.log('=== Initializing Histogram Controls ===');

        const timeRangeEl = document.getElementById('histogram-time-range');
        const granularityEl = document.getElementById('histogram-granularity');
        const metricTypeEl = document.getElementById('histogram-metric-type');
        const refreshBtn = document.getElementById('histogram-refresh-btn');

        if (timeRangeEl) {
            timeRangeEl.addEventListener('change', (e) => {
                this.histogramConfig.timeRange = e.target.value;
            });
        }

        if (granularityEl) {
            granularityEl.addEventListener('change', (e) => {
                this.histogramConfig.granularity = e.target.value;
            });
        }

        if (metricTypeEl) {
            metricTypeEl.addEventListener('change', (e) => {
                this.histogramConfig.metricType = e.target.value;
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadHistogramData());
        }

        this.loadHistogramData();
    }

    async loadHistogramData() {
        console.log('=== Loading Histogram Data ===', this.histogramConfig);

        const loadingEl = document.getElementById('histogram-loading');
        if (loadingEl) loadingEl.style.display = 'block';

        try {
            const params = new URLSearchParams({
                building: this.filters.building !== 'all' && this.filters.building ? this.filters.building : '',
                floor: this.filters.floor !== 'all' ? this.filters.floor : '',
                sensorType: this.filters.sensorType,
                metricType: this.histogramConfig.metricType,
                timeRange: this.histogramConfig.timeRange,
                granularity: this.histogramConfig.granularity,
                timeSlot: this.filters.timeSlot.toUpperCase()
            });

            for (const [key, value] of [...params]) {
                if (!value) params.delete(key);
            }

            const url = `/api/dashboard/histogram?${params.toString()}`;
            console.log('Fetching histogram:', url);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Histogram data received:', data);

            this.renderHistogramChart(data);
            this.updateHistogramSummary(data.summary);
            this.updateHistogramTitle(data);
        } catch (error) {
            console.error('Error loading histogram data:', error);
            this.showError('Failed to load histogram data: ' + error.message);
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    renderHistogramChart(data) {
        console.log('Rendering Histogram Chart');

        const chartElement = document.getElementById('chart-historical-bar');
        if (!chartElement) {
            console.warn('Histogram chart element not found');
            return;
        }

        if (this.charts.histogram) {
            this.charts.histogram.destroy();
            this.charts.histogram = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

        const labels = data.dataPoints.map(dp => {
            const date = new Date(dp.timestamp);
            if (data.granularity === 'HOURLY') {
                return date.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            });
        });

        const values = data.dataPoints.map(dp => dp.value);

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

        this.charts.histogram = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: this.getMetricLabel(data.metricType),
                    data: values,
                    backgroundColor: barColor,
                    borderColor,
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
                            text: data.granularity === 'HOURLY' ? 'Date & Time' : 'Date',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 11 }
                        },
                        grid: { display: false },
                        stacked: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.getMetricUnit(data.metricType, data.aggregationType),
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        beginAtZero: true,
                        ticks: { font: { size: 11 } },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
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
                            title: context => 'Time: ' + context[0].label,
                            label: context => {
                                const value = context.parsed.y.toFixed(2);
                                const unit = this.getMetricUnit(data.metricType, data.aggregationType);
                                return `${context.dataset.label}: ${value} ${unit}`;
                            },
                            afterLabel: context => {
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
        console.log('Updating Histogram Summary', summary);

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
        if (!titleEl) return;

        const metricLabel = this.getMetricLabel(data.metricType);
        const timeRangeLabel = this.getTimeRangeLabel(data.timeRange);
        const granularityLabel = data.granularity === 'DAILY' ? 'Daily' : 'Hourly';

        titleEl.textContent = `📊 Histogram - ${metricLabel} (${timeRangeLabel}, ${granularityLabel})`;
    }

    getMetricLabel(metricType) {
        const labels = {
            OCCUPANCY: 'Occupancy',
            TEMPERATURE: 'Temperature',
            CO2: 'CO₂ Level',
            HUMIDITY: 'Humidity',
            ILLUMINANCE: 'Light Level',
            LAEQ: 'Noise Level',
            MOTION: 'Motion Events'
        };
        return labels[metricType] || metricType;
    }

    getMetricUnit(metricType, aggregationType) {
        const units = {
            OCCUPANCY: 'count',
            TEMPERATURE: '°C',
            CO2: 'ppm',
            HUMIDITY: '%',
            ILLUMINANCE: 'lux',
            LAEQ: 'dB',
            MOTION: 'events'
        };

        if (aggregationType === 'COUNT') {
            return 'count';
        }

        return units[metricType] || '';
    }

    getTimeRangeLabel(timeRange) {
        const labels = {
            LAST_7_DAYS: 'Last 7 Days',
            LAST_30_DAYS: 'Last 30 Days',
            THIS_MONTH: 'This Month',
            LAST_MONTH: 'Last Month'
        };
        return labels[timeRange] || timeRange;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Dashboard Manager...');
    window.dashboardManager = new DashboardManager();
});

window.DashboardManager = DashboardManager;
