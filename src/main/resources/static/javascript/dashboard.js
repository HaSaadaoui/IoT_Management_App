class DashboardManager {
    constructor() {
        this.buildings = [];
        this.currentBuilding = null;
        this.useMockData = true;

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

        // Error handling and refresh management
        this.errorCount = 0;
        this.maxRetries = 3;
        this.baseRefreshInterval = 60000; // 60 seconds
        this.currentRefreshInterval = this.baseRefreshInterval;
        this.refreshTimer = null;

        this.init();
    }

    init() {
        console.log('=== Dashboard Manager Initialized ===');
        this.initializeFilters();
        this.initializeHistogramControls();
        
        this.loadBuildings();
        this.loadDashboardData();
        // Start adaptive refresh with error handling
        this.scheduleNextRefresh();
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
            // if (window.building3D?.setSensorMode) {
            //     window.building3D.setSensorMode(value);
            // }
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
        if (this.useMockData) {
            console.log("Loading mock data")
            this.loadSampleData();
        }
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

    scheduleNextRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.refreshTimer = setTimeout(() => {
            this.refreshData();
        }, this.currentRefreshInterval);
        
        console.log(`Next refresh scheduled in ${this.currentRefreshInterval / 1000} seconds`);
    }

    async refreshData() {
        console.log('Auto-refreshing dashboard data...');
        try {
            await this.loadDashboardData();
            // Reset error count and interval on success
            this.errorCount = 0;
            this.currentRefreshInterval = this.baseRefreshInterval;
            this.scheduleNextRefresh();
        } catch (error) {
            this.handleRefreshError(error);
        }
    }

    handleRefreshError(error) {
        this.errorCount++;
        console.warn(`Refresh error #${this.errorCount}:`, error.message);
        
        if (this.errorCount >= this.maxRetries) {
            console.error('Max retries reached. Stopping auto-refresh to prevent server overload.');
            this.showError('Server temporarily unavailable. Auto-refresh paused. Please refresh manually.');
            return;
        }
        
        // Exponential backoff: double the interval on each error
        this.currentRefreshInterval = Math.min(
            this.baseRefreshInterval * Math.pow(2, this.errorCount),
            300000 // Max 5 minutes
        );
        
        console.log(`Backing off. Next retry in ${this.currentRefreshInterval / 1000} seconds`);
        this.scheduleNextRefresh();
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

        const data = {
            ...this.currentData,
            alerts: this.generateSampleAlerts(),
            liveSensorData: this.generateSampleLiveData(),
            historicalData: {
                dataPoints: historicalData,
                globalOccupancy: 0,
                totalSensors: 0,
                activeSensors: 0,
            }
        };

        this.updateDashboard(data);
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
        this.updateAlerts(data?.alerts);
        this.updateLiveData(data?.liveSensorData);
        this.updateLiveBuildingMetrics(); // Add real-time building metrics
        this.updateHistoricalData(data?.historicalData);
        this.updateOccupationHistory(data?.historicalData);
        this.updateCostAnalysis(data?.historicalData);
        this.updateGlobalStatistics(data?.historicalData);
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

    async updateLiveBuildingMetrics() {
        console.log('Updating Live Building Metrics');
        try {
            const building = this.filters.building;
            const floor = this.filters.floor;

            // Fetch data for multiple sensor types
            const sensorTypes = ['TEMP', 'HUMIDITY', 'NOISE', 'CO2', 'ENERGY', 'DESK', 'LIGHT'];
            const metricsData = {};

            for (const sensorType of sensorTypes) {
                const params = new URLSearchParams({
                    building: building,
                    floor: floor,
                    sensorType: sensorType
                });

                try {
                    const response = await fetch(`/api/dashboard/sensors?${params}`);
                    if (response.ok) {
                        const sensors = await response.json();
                        metricsData[sensorType] = sensors;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch ${sensorType} sensors:`, error);
                }
            }

            // Calculate and update metrics
            this.calculateAndUpdateMetrics(metricsData);
        } catch (error) {
            console.error('Error updating live building metrics:', error);
        }
    }

    calculateAndUpdateMetrics(metricsData) {
        // Temperature
        if (metricsData.TEMP && metricsData.TEMP.length > 0) {
            const temps = metricsData.TEMP
                .map(s => s.lastValue)
                .filter(v => v !== null && v !== undefined);
            if (temps.length > 0) {
                const avgTemp = temps.reduce((sum, val) => sum + val, 0) / temps.length;
                this.updateMetricValue('live-avg-temperature', avgTemp.toFixed(1));
            }
        }

        // Humidity
        if (metricsData.HUMIDITY && metricsData.HUMIDITY.length > 0) {
            const humidity = metricsData.HUMIDITY
                .map(s => s.lastValue)
                .filter(v => v !== null && v !== undefined);
            if (humidity.length > 0) {
                const avgHumidity = humidity.reduce((sum, val) => sum + val, 0) / humidity.length;
                this.updateMetricValue('live-avg-humidity', avgHumidity.toFixed(1));
            }
        }

        // Sound/Noise Level
        if (metricsData.NOISE && metricsData.NOISE.length > 0) {
            const noise = metricsData.NOISE
                .map(s => s.lastValue)
                .filter(v => v !== null && v !== undefined);
            if (noise.length > 0) {
                const avgNoise = noise.reduce((sum, val) => sum + val, 0) / noise.length;
                this.updateMetricValue('live-avg-sound', avgNoise.toFixed(1));
            }
        }

        // CO2 Level
        if (metricsData.CO2 && metricsData.CO2.length > 0) {
            const co2 = metricsData.CO2
                .map(s => s.lastValue)
                .filter(v => v !== null && v !== undefined);
            if (co2.length > 0) {
                const avgCO2 = co2.reduce((sum, val) => sum + val, 0) / co2.length;
                this.updateMetricValue('live-avg-co2', Math.round(avgCO2));
            }
        }

        // Energy metrics
        if (metricsData.ENERGY && metricsData.ENERGY.length > 0) {
            const energySensors = metricsData.ENERGY;
            
            // Current Power (latest instant power value in W)
            const currentPowers = energySensors
                .map(s => s.lastValue)
                .filter(v => v !== null && v !== undefined);
            if (currentPowers.length > 0) {
                const totalPower = currentPowers.reduce((sum, val) => sum + val, 0);
                this.updateMetricValue('live-current-power', Math.round(totalPower));
            }

            // Today's Energy - calculate from sensor data timestamps for today
            this.calculateTodaysEnergy(energySensors);
        }

        // Desk Usage Percentage
        if (metricsData.DESK && metricsData.DESK.length > 0) {
            const desks = metricsData.DESK;
            const totalDesks = desks.length;
            const occupiedDesks = desks.filter(s => s.lastValue === 1 || s.lastValue === true).length;
            const usagePercentage = totalDesks > 0 ? (occupiedDesks / totalDesks) * 100 : 0;
            this.updateMetricValue('live-desk-usage', usagePercentage.toFixed(1));
        }

        // Light Level Average
        if (metricsData.LIGHT && metricsData.LIGHT.length > 0) {
            const lightLevels = metricsData.LIGHT
                .map(s => s.lastValue)
                .filter(v => v !== null && v !== undefined);
            if (lightLevels.length > 0) {
                const avgLight = lightLevels.reduce((sum, val) => sum + val, 0) / lightLevels.length;
                this.updateMetricValue('live-avg-light', Math.round(avgLight));
            }
        }
    }

    async calculateTodaysEnergy(energySensors) {
        // Fetch today's energy consumption data
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            const params = new URLSearchParams({
                building: this.filters.building,
                floor: this.filters.floor,
                sensorType: 'ENERGY',
                metricType: 'ENERGY',
                granularity: 'HOURLY'
            });

            const response = await fetch(`/api/dashboard/histogram?${params}`);
            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    // Filter for today's data and sum up
                    const todayData = data.data.filter(entry => {
                        const entryDate = new Date(entry.timestamp);
                        return entryDate >= startOfDay;
                    });

                    const totalWh = todayData.reduce((sum, entry) => sum + (entry.value || 0), 0);
                    const totalKWh = totalWh / 1000; // Convert Wh to kWh
                    this.updateMetricValue('live-daily-energy', totalKWh.toFixed(2));
                }
            }
        } catch (error) {
            console.warn('Failed to calculate today\'s energy:', error);
        }
    }

    updateMetricValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
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
        this.updateCostAreaChart(historicalData.dataPoints, costData);
        this.updateCostScatterChart(historicalData.dataPoints, costData);
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

    updateCostAreaChart(dataPoints, costData) {
        const chartElement = document.getElementById('chart-cost-area');
        if (!chartElement) {
            console.warn('Chart element not found: chart-cost-area');
            return;
        }

        const dates = dataPoints.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        });

        if (this.charts.costArea) {
            this.charts.costArea.destroy();
            this.charts.costArea = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

        this.charts.costArea = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Energy Cost Trend',
                    data: costData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
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
                        display: true,
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 11 }
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Cost (€)',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 },
                            callback: value => '€' + value.toFixed(2)
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: { size: 12 },
                            color: '#64748b'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderColor: '#10b981',
                        borderWidth: 2,
                        callbacks: {
                            label: context => 'Cost: €' + context.parsed.y.toFixed(2)
                        }
                    }
                }
            }
        });
    }

    updateCostScatterChart(dataPoints, costData) {
        const chartElement = document.getElementById('chart-cost-scatter');
        if (!chartElement) {
            console.warn('Chart element not found: chart-cost-scatter');
            return;
        }

        // Create scatter data: x = energy consumption (occupancy rate as proxy), y = cost
        const scatterData = dataPoints.map((d, index) => ({
            x: d.occupancyRate, // Using occupancy rate as proxy for energy consumption
            y: costData[index]
        }));

        if (this.charts.costScatter) {
            this.charts.costScatter.destroy();
            this.charts.costScatter = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

        this.charts.costScatter = new Chart(chartElement, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Cost vs Consumption',
                    data: scatterData,
                    backgroundColor: 'rgba(139, 92, 246, 0.6)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Energy Consumption / Occupancy (%)',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        ticks: {
                            font: { size: 11 },
                            callback: value => value.toFixed(0) + '%'
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cost (€)',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 },
                            callback: value => '€' + value.toFixed(2)
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: { size: 12 },
                            color: '#64748b'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderColor: '#8b5cf6',
                        borderWidth: 2,
                        callbacks: {
                            label: context => `Consumption: ${context.parsed.x.toFixed(1)}% | Cost: €${context.parsed.y.toFixed(2)}`
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

        // Render individual desk occupancy bars
        this.renderDeskOccupancyBars(data);
    }

    renderDeskOccupancyBars(data) {
        const chartElement = document.getElementById('chart-desk-occupancy-bar');
        if (!chartElement) {
            console.warn('Desk occupancy bar chart element not found');
            return;
        }

        if (this.charts.histogram) {
            this.charts.histogram.destroy();
            this.charts.histogram = null;
        }

        const existingChart = Chart.getChart(chartElement);
        if (existingChart) existingChart.destroy();

        // Create individual desk bars showing occupancy status
        const deskLabels = data.dataPoints.map((dp, index) => `Desk ${index + 1}`);
        const deskValues = data.dataPoints.map(dp => dp.value);
        
        // Color code based on occupancy: green for free, red for occupied
        const backgroundColors = deskValues.map(value => {
            if (value === 0 || value < 0.5) return '#10b981'; // Free - green
            if (value === 1 || value >= 0.5) return '#ef4444'; // Occupied - red
            return '#94a3b8'; // Unknown - gray
        });

        this.charts.histogram = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels: deskLabels,
                datasets: [{
                    label: 'Occupancy Status',
                    data: deskValues,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color),
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.9,
                    categoryPercentage: 0.95
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Individual Desks',
                            color: '#64748b',
                            font: { size: 14, weight: '600' }
                        },
                        ticks: {
                            maxRotation: 90,
                            minRotation: 45,
                            font: { size: 9 },
                            autoSkip: false
                        },
                        grid: { display: false }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Status (0=Free, 1=Occupied)',
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
