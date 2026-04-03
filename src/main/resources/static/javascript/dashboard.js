class DashboardManager {
	constructor() {
		this.buildings = [];
		this.currentBuilding = null;
		this.consoSse = null;
		// power par device (en W typiquement)
		this.consoPowerByDevice = new Map();
		// last-seen par device pour purge (anti “valeur figée”)
		this.consoLastSeenByDevice = new Map();
		// TTL (ms) : si un device ne remonte plus, on l’enlève du total
		this.consoTtlMs = 2 * 60 * 1000; // 2 minutes

		this.filters = {
			year: new Date().getFullYear(),
			month: new Date().getMonth() + 1,
			building: null,   // sera défini après loadBuildings()
			floor: '',
			sensorType: 'DESK',
			timeSlot: 'afternoon'
		};
		this.metricSources = {
			TEMPERATURE_INT: { sensorType: 'ALL', excludeSensorType: 'TEMPEX', unit: '°C' },
			TEMPERATURE_EXT: { sensorType: 'TEMPEX', unit: '°C' },

			HUMIDITY_INT:    { sensorType: 'ALL', excludeSensorType: 'TEMPEX', unit: '%' },
			HUMIDITY_EXT:    { sensorType: 'TEMPEX', unit: '%' },

			CO2:       { sensorType: 'CO2', unit: 'ppm' },
			OCCUPANCY: { sensorType: 'DESK', unit: '%' },
			LIGHT:     { sensorType: 'EYE', unit: 'lux' },
			LAEQ:      { sensorType: ['SON', 'NOISE'], unit: 'dB' },
			CURRENT_POWER: { sensorType: 'CONSO', metricType: 'POWER_TOTAL', unit: 'kW' },
			DAILY_ENERGY:   { sensorType: 'CONSO', metricType: 'ENERGY_TOTAL', unit: 'kWh' },
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
			histogram: null,
			costArea: null,
			costScatter: null
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

		// Initialize alert cache for instant filtering
		this.initAlertCache();

		this.loadBuildings().then(() => {
			this.scheduleNextRefresh();
		});
		this.scheduleNextRefresh();
	}

	async initAlertCache() {
		if (!window.AlertCacheManager) {
			console.warn('AlertCacheManager not loaded');
			return;
		}

		try {
			// Initialize cache with current building
			await window.AlertCacheManager.init({
				building: this.filters.building,
				useSSE: true,
				backgroundRefresh: true
			});

			// Subscribe to real-time alert updates
			this.alertUnsubscribe = window.AlertCacheManager.subscribe((alerts) => {
				console.log('🔔 [Dashboard] Alert update received:', alerts.length, 'alerts');
				this.updateAlerts(alerts);
			});

			console.log('✅ [Dashboard] AlertCacheManager initialized');
		} catch (e) {
			console.error('Failed to init AlertCacheManager:', e);
		}
	}

	// =========================
	// ===== BUILDING UTILS =====
	// =========================

	getBuildingKey(building) {
		if (!building?.id) return null;
		return String(building.id);
	}

	// =========================
	// ===== FILTERS =====
	// =========================

	initializeFilters() {
		const filterIds = ['building', 'floor', 'sensor-type'];
		filterIds.forEach(filterId => {
			const element = document.getElementById(`filter-${filterId}`);
			if (!element) return;

			const filterKey = filterId.replace('-', '');
			const mappedKey = filterKey === 'sensortype' ? 'sensorType'
				: filterKey === 'time'       ? 'timeSlot'
					: filterKey;

			if (this.filters[mappedKey] !== undefined && this.filters[mappedKey] !== null) {
				element.value = this.filters[mappedKey];
			}

			element.addEventListener('change', e => this.handleFilterChange(filterId, e.target.value));
		});
	}

	// =========================
	// ===== CONSO SSE (aggregate)
	// =========================

	startConsoAggregateSse() {
		const building = this.filters.building;
		if (!building) return;

		// Stop ancien SSE si existant
		this.stopConsoAggregateSse();
		this.resetConsoMetrics();   // toujours reset au switch

		const floor = this.getEffectiveFloorParam(); // '' si All Floors
		const qs = new URLSearchParams({ building });
		if (floor) qs.set('floor', String(floor));   // ✅ floor conditionnel

		const url = `/api/dashboard/conso/live/aggregate/stream?${qs.toString()}`;
		console.log('[CONSO SSE] starting', url);

		const es = new EventSource(url);
		this.consoSse = es;

		es.addEventListener('conso_aggregate', (ev) => {
			try {
				const payload = JSON.parse(ev.data);

				const kw = (payload.powerTotalkW != null)
					? Number(payload.powerTotalkW)
					: (payload.powerTotalW != null ? Number(payload.powerTotalW) / 1000 : null);

				if (kw != null && !Number.isNaN(kw)) {
					this.updateMetricValue('live-current-power', kw.toFixed(2));
				} else{
					this.updateMetricValue('live-current-power', '--');
				}

				const kwh = (payload.todayEnergykWh != null)
					? Number(payload.todayEnergykWh)
					: (payload.todayEnergyWh != null ? Number(payload.todayEnergyWh) / 1000 : null);

				if (kwh != null && !Number.isNaN(kwh)) {
					this.updateMetricValue('live-daily-energy', kwh.toFixed(2));
				} else{
					this.updateMetricValue('live-daily-energy', '--');
				}
			} catch (e) {
				console.warn('[CONSO SSE] parse error', e);
				this.resetConsoMetrics();
			}
		});

		es.addEventListener('keepalive', () => {});
		es.onerror = (err) => {
			console.warn('[CONSO SSE] error', err);
			this.resetConsoMetrics();
		};
	}

	resetConsoMetrics() {
		this.updateMetricValue('live-current-power', '--');
		this.updateMetricValue('live-daily-energy', '--');
	}

	stopConsoAggregateSse() {
		if (this.consoSse) {
			console.log('[CONSO SSE] stopping');
			try { this.consoSse.close(); } catch {}
			this.consoSse = null;
		}
	}

	async fetchOccupancy(floorNumber) {
		const qs = new URLSearchParams();

		// IMPORTANT : toujours passer building
		const building = this.filters.building;
		if (building) qs.set('building', String(building));

		// floor optionnel
		if (floorNumber !== undefined && floorNumber !== null && String(floorNumber) !== '') {
			qs.set('floor', String(floorNumber));
		}

		const r = await fetch(`/api/dashboard/occupancy?${qs.toString()}`);
		if (!r.ok) return [];
		const data = await r.json();
		return Array.isArray(data) ? data : [];
	}

	computeOccupancyFromStatuses(items) {
		const total = Array.isArray(items) ? items.length : 0;
		const used = (items || []).filter(x => String(x?.status).toLowerCase() === 'used').length;
		const free = (items || []).filter(x => String(x?.status).toLowerCase() === 'free').length;
		const invalid = total - used - free;

		return {
			total,
			used,
			free,
			invalid,
			label: `${used}/${total}`
		};
	}

	applyBuildingStatVisibility() {
		const cards = document.querySelectorAll('.office-stats .stat-card');
		if (!cards.length) return;

		cards.forEach(card => {
			card.style.display = '';
		});
	}

	async loadBuildings() {
		const select = document.getElementById('filter-building');
		const selectHist = document.getElementById('hist-filter-building'); // ✅ ajout
		if (!select) return;

		try {
			const resp = await fetch('/api/buildings');
			const buildings = resp.ok ? await resp.json() : [];
			this.buildings = buildings;

			if (!buildings.length) {
				select.innerHTML = '<option value="" disabled selected>No building found</option>';
				if (selectHist) selectHist.innerHTML = '<option value="" disabled selected>No building found</option>';
				return;
			}

			// Remplir les deux selects
			const buildOptions = buildings.map(b => {
				const opt = document.createElement('option');
				opt.value = b.id;
				opt.textContent = b.name;
				return opt;
			});

			select.innerHTML = '';
			buildOptions.forEach(opt => select.appendChild(opt.cloneNode(true)));

			// ✅ Remplir aussi le select History
			if (selectHist) {
				selectHist.innerHTML = '';
				buildOptions.forEach(opt => selectHist.appendChild(opt.cloneNode(true)));
			}

			const current = buildings[0];
			select.value = String(current.id);
			if (selectHist) selectHist.value = String(current.id);

			this.currentBuilding = current;
			this.filters.building = String(current.id);

			this.startConsoAggregateSse();
			await this.loadBuildingFloors(current.id);
			await this.loadDashboardData();

		} catch (e) {
			console.error('Error loading buildings', e);
			select.innerHTML = '<option value="" disabled selected>Error loading</option>';
			if (selectHist) selectHist.innerHTML = '<option value="" disabled selected>Error loading</option>';
		}
	}

	async handleFilterChange(filterId, value) {
		console.log(`=== Filter Change: ${filterId} ===`, value);

		const filterKey = filterId.replace('filter-', '').replace('-', '');
		const mappedKey =
			filterKey === 'sensortype' ? 'sensorType' :
				filterKey === 'time' ? 'timeSlot' :
					filterKey;

		// =========================
		// ✅ Cas spécial BUILDING
		// =========================
		if (filterId === 'building') {
			const building = this.buildings.find(b => String(b.id) === String(value));

			if (!building) {
				console.warn('Building not found for value:', value);
				return;
			}

			// 1) Normaliser la clé building (code si dispo, sinon id)
			this.filters.building = this.getBuildingKey(building);

			// 2) Mettre à jour currentBuilding
			this.currentBuilding = building;

			// 3) Charger les floors (virtuel => code ok, DB => id)
			const floorsLookupId = building.code ? building.code : building.id;
			await this.loadBuildingFloors(floorsLookupId);

			// 4) Reset floor après reload floors
			this.filters.floor = '';
			const floorSelect = document.getElementById('filter-floor');
			if (floorSelect) floorSelect.value = '';

			// 5) UI titles
			this.updateSensorTypeUI(this.filters.sensorType);

			// 6) 3D
			if (window.building3D?.loadBuilding) {
				console.log('Mise à jour du modèle 3D pour:', building.name);
				window.building3D.loadBuilding(building);
			}

			// 6.5) Regenerate stat cards for the new building
			if (window.ChartUtils?.generateStatCardsForBuilding) {
				window.ChartUtils.generateStatCardsForBuilding(this.filters.building);
			}

			// ✅ 7) Restart CONSO SSE (building + floor='')
			this.startConsoAggregateSse();

			// ✅ 8) Update alert filters locally (instant, no API call)
			this.updateAlertFilters();

			// 9) Reload data
			await this.loadDashboardData();
			this.applyBuildingStatVisibility();

			//10 Others metrics stats
			updateEnvironmentChartsVisibility(this.filters.building);
			startEnvironmentSSE(this.filters.building, this.filters.floor);

			return;
		}

		// =========================
		// ✅ Cas général (floor, sensor-type)
		// =========================
		this.filters[mappedKey] = value;

		// UI pour sensor-type
		if (filterId === 'sensor-type') {
			this.updateSensorTypeUI(value);
		}

		// ✅ Si on change d'étage : restart SSE (building + floor)
		if (filterId === 'floor') {
			const building = this.filters.building;
			//const floor = value || null;

			const floor = value ? parseInt(value, 10) : null;

			if (window.building3D) {
				if (floor !== null) {
					window.building3D.enterFloor(floor); // déclenche 2D + animation
				} else {
					window.building3D.return3DView();
				}
			}

			if (window.ChartUtils?.generateStatCardsForBuilding) {
				// Génère uniquement les cartes du floor choisi
				window.ChartUtils.generateStatCardsForBuilding(building, floor);
			}

			// Redémarre SSE avec le floor
			this.startConsoAggregateSse();

			// Mettre à jour alert filters
			this.updateAlertFilters();

			// Reload data
			await this.loadDashboardData();
			this.applyBuildingStatVisibility();

			return; // important : on ne continue pas le reste
		}

		// ✅ INSTANT ALERT FILTERING - no API call, uses cached data
		this.updateAlertFilters();

		await this.loadDashboardData();
		this.applyBuildingStatVisibility();
	}

	updateAlertFilters() {
		if (window.AlertCacheManager?.setFilters) {
			window.AlertCacheManager.setFilters({
				building: this.filters.building,
				floor: this.filters.floor,
				sensorType: this.filters.sensorType
			});
			console.log('⚡ [Dashboard] Alert filters updated locally');
		}
	}

	// =========================
	// ===== UI TITLES =====
	// =========================

	updateSensorTypeUI(sensorType) {
		const sensorInfo = {
			DESK: {
				icon: '📊',
				name: 'Desk Occupancy'
			},
			CO2: {
				icon: '🌫️',
				name: 'CO₂ Air Quality'
			},
			TEMP: {
				icon: '🌡️',
				name: 'Temperature'
			},
			LIGHT: {
				icon: '💡',
				name: 'Light Levels'
			},
			MOTION: {
				icon: '👁️',
				name: 'Motion Detection'
			},
			NOISE: {
				icon: '🔉',
				name: 'Noise Levels'
			},
			HUMIDITY: {
				icon: '💧',
				name: 'Humidity'
			},
			TEMPEX: {
				icon: '🌀',
				name: 'HVAC Flow (TEMPex)'
			},
			PR: {
				icon: '👤',
				name: 'Presence & Light'
			},
			SECURITY: {
				icon: '🚨',
				name: 'Security Alerts'
			}
		};

		const info = sensorInfo[sensorType] || sensorInfo.DESK;
		const buildingSelect = document.getElementById('filter-building');
		let buildingName = "Châteaudun";
		if (buildingSelect) {
			buildingName = buildingSelect.selectedOptions[0].text;
		}

		const liveTitle = document.getElementById('live-section-title');
		if (liveTitle) {
			liveTitle.textContent = `${info.icon} Live ${info.name} - ${buildingName}`;
		}

		const historicalTitle = document.getElementById('historical-section-title');
		if (historicalTitle) {
			historicalTitle.textContent = `📈 Historical ${info.name} Data - ${buildingName}`;
		}
	}

	// =========================
	// ===== DATA LOADING =====
	// =========================

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

			console.log('Updating dashboard visualizations...');
			await this.updateDashboard(data);   // ✅ important
			this.updateRefreshTime();
		} catch (error) {
			console.error('Error Loading Dashboard Data', error);
			this.showError('Failed to load dashboard data. Using sample data.');
		}
		finally {
			this.hideLoading(); // ✅ toujours appelé, succès ou erreur
		}
	}

	scheduleNextRefresh() {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);

		this.refreshTimer = setTimeout(() => {
			this.refreshData();
		}, this.currentRefreshInterval);

		console.log(`Next refresh scheduled in ${this.currentRefreshInterval / 1000} seconds`);
	}

	async refreshData() {
		console.log('Auto-refreshing LIVE metrics only...');
		try {
			await this.updateLiveBuildingMetrics();
			this.updateRefreshTime();
			this.errorCount = 0;
			this.currentRefreshInterval = this.baseRefreshInterval;
			this.scheduleNextRefresh();
		} catch (error) {
			this.handleRefreshError(error);
		}
	}

	handleRefreshError(error) {
		this.errorCount++;
		console.warn(`Refresh error #${this.errorCount}:`, error?.message || error);

		if (this.errorCount >= this.maxRetries) {
			console.error('Max retries reached. Stopping auto-refresh to prevent server overload.');
			this.showError('Server temporarily unavailable. Auto-refresh paused. Please refresh manually.');
			return;
		}

		this.currentRefreshInterval = Math.min(
			this.baseRefreshInterval * Math.pow(2, this.errorCount),
			300000
		);

		console.log(`Backing off. Next retry in ${this.currentRefreshInterval / 1000} seconds`);
		this.scheduleNextRefresh();
	}

	// =========================
	// ===== DASHBOARD UPDATE =====
	// =========================

	async updateDashboard(data) {
		this.updateAlerts(data?.alerts);
		this.updateLiveData(data?.liveSensorData);
		this.updateLiveBuildingMetrics();
		this.updateHistoricalData(data?.historicalData);
		this.updateOccupationHistory(data?.historicalData);
		this.updateCostAnalysis(data?.historicalData);
		this.updateGlobalStatistics(data?.historicalData);
		this.applyBuildingStatVisibility();

		this.hideLoading();
	}

	updateAlerts(alerts) {
		console.log('=== Updating Alerts ===');
		if (!alerts) {
			console.log('No alerts data provided');
			return;
		} else {
			const loadingEl = document.getElementById('alerts-loading');
			if (loadingEl) loadingEl.style.display = 'none';
		}

		const alertsGrid = document.querySelector('.alerts-grid');
		if (!alertsGrid) {
			console.warn('Alerts grid not found');
			return;
		}

		if (!alerts || alerts.length === 0) {
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

		alertsGrid.innerHTML = '';

		alerts.forEach(alert => {
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
		try {
			const building = this.filters.building;
			const floor = this.getEffectiveFloorParam();
			const timeSlot = this.filters.timeSlot;

			const safeSet = (elId, val, fmt) => {
				if (val == null || Number.isNaN(Number(val))) return;
				this.updateMetricValue(elId, fmt(Number(val)));
			};

			const getAvg = async ({ sensorType, metricType, excludeSensorType }) => {
				const { avg } = await this.fetchHistogramAvg({
					building, floor, sensorType, metricType,
					timeRange: 'LAST_7_DAYS', granularity: 'DAILY', timeSlot, excludeSensorType
				});
				return avg;
			};

			const [
				occItems,
				tempExt, humExt,
				tempInt, humInt,
				co2Avg, laeqAvg, lightAvg
			] = await Promise.allSettled([
				this.fetchOccupancy(floor),
				getAvg({ sensorType: 'TEMPEX', metricType: 'TEMPERATURE' }),
				getAvg({ sensorType: 'TEMPEX', metricType: 'HUMIDITY' }),
				getAvg({ sensorType: 'ALL', metricType: 'TEMPERATURE', excludeSensorType: 'TEMPEX' }),
				getAvg({ sensorType: 'ALL', metricType: 'HUMIDITY', excludeSensorType: 'TEMPEX' }),
				this.fetchLiveMetric('CO2'),
				this.fetchLiveMetric('LAEQ'),
				this.fetchLiveMetric('LIGHT')
			]);

			if (occItems.status === 'fulfilled') {
				const filtered = (occItems.value || []).filter(x =>
					/^desk-\d{2}-\d{2}$/.test(String(x?.id || '').toLowerCase())
				);
				this.updateMetricValue('live-desk-usage', this.computeOccupancyFromStatuses(filtered).label);
			} else {
				console.warn('Desk occupancy ratio failed', occItems.reason);
			}

			if (tempExt.status === 'fulfilled') safeSet('live-avg-temperature-ext', tempExt.value, v => v.toFixed(1));
			else console.warn('Temperature EXT failed', tempExt.reason?.message);

			if (humExt.status === 'fulfilled') safeSet('live-avg-humidity-ext', humExt.value, v => v.toFixed(1));
			else console.warn('Humidity EXT failed', humExt.reason?.message);

			if (tempInt.status === 'fulfilled') safeSet('live-avg-temperature-int', tempInt.value, v => v.toFixed(1));
			else console.warn('Temperature INT failed', tempInt.reason?.message);

			if (humInt.status === 'fulfilled') safeSet('live-avg-humidity-int', humInt.value, v => v.toFixed(1));
			else console.warn('Humidity INT failed', humInt.reason?.message);

			if (co2Avg.status === 'fulfilled') safeSet('live-avg-co2', co2Avg.value, v => Math.round(v));
			if (laeqAvg.status === 'fulfilled') safeSet('live-avg-sound', laeqAvg.value, v => v.toFixed(1));
			if (lightAvg.status === 'fulfilled') safeSet('live-avg-light', lightAvg.value, v => Math.round(v));

		} catch (e) {
			console.error('Error updating live building metrics:', e);
		}
	}
	updateMetricValue(elementId, value) {
		const element = document.getElementById(elementId);
		if (element) element.textContent = value;
	}

	updateLocationChart(location, index) {
		const statCard = document.querySelector(`.stat-card[data-chart-index="${index}"]`);
		if (!statCard) {
			console.warn(`Stat card not found for index: ${index}`);
			return;
		}
		window.ChartUtils?.updateStatCard?.(statCard, location);
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

		window.ChartUtils?.updateStatCard?.(totalStatCard, {
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

		const chartElement = document.getElementById('chart-historical'); // <-- mets le bon ID
		if (!chartElement) {
			console.warn('Chart element not found: chart-historical');
			return;
		}

		const dates = historicalData.dataPoints.map(d => {
			const date = new Date(d.date);
			return date.toLocaleDateString('en-CA', {
				day: '2-digit',
				month: '2-digit'
			});
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
				datasets: [{
					label: 'Used',
					data: usedData,
					backgroundColor: typeof notOkColor !== 'undefined' ? notOkColor : '#ef4444',
					borderRadius: 4,
					barPercentage: 0.8
				},
					{
						label: 'Free',
						data: freeData,
						backgroundColor: typeof okColor !== 'undefined' ? okColor : '#10b981',
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
							font: {
								size: 12,
								weight: '600'
							},
							padding: {
								top: 10
							}
						},
						stacked: true,
						grid: {
							display: false
						},
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
							font: {
								size: 12,
								weight: '600'
							},
							padding: {
								bottom: 10
							}
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
			const occ = Number(d.occupancyRate);
			const formattedOcc = isFinite(occ) ? `${occ.toFixed(0)}%` : '--';
			const date = new Date(d.date);
			const formattedDate = date.toLocaleDateString('fr-FR', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});

			return `
        <tr>
          <td>${formattedDate}</td>
          <td>${formattedOcc}</td>
        </tr>
      `;
		}).join('');
	}

	// =========================
	// ===== COST ANALYSIS =====
	// =========================

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
			return date.toLocaleDateString('fr-FR', {
				day: '2-digit',
				month: '2-digit'
			});
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
							minRotation: 22
						}
					},
					y: {
						display: true,
						title: {
							display: true,
							text: 'Cost (€)',
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
							callback: v => '€' + Number(v).toFixed(2)
						}
					}
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						padding: 12,
						borderColor: color,
						borderWidth: 1,
						callbacks: {
							title: ctx => 'Date: ' + ctx[0].label,
							label: ctx => 'Cost: €' + ctx.parsed.y.toFixed(2)
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
			return date.toLocaleDateString('fr-FR', {
				day: '2-digit',
				month: '2-digit'
			});
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
							font: {
								size: 14,
								weight: '600'
							}
						},
						grid: {
							display: false
						},
						ticks: {
							maxRotation: 45,
							minRotation: 45,
							font: {
								size: 11
							}
						}
					},
					y: {
						display: true,
						title: {
							display: true,
							text: 'Cost (€)',
							color: '#64748b',
							font: {
								size: 14,
								weight: '600'
							}
						},
						beginAtZero: true,
						ticks: {
							font: {
								size: 11
							},
							callback: v => '€' + Number(v).toFixed(2)
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
							font: {
								size: 12
							},
							color: '#64748b'
						}
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						padding: 12,
						borderColor: '#10b981',
						borderWidth: 2,
						callbacks: {
							label: ctx => 'Cost: €' + ctx.parsed.y.toFixed(2)
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

		const scatterData = dataPoints.map((d, index) => ({
			x: d.occupancyRate,
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
							font: {
								size: 14,
								weight: '600'
							}
						},
						ticks: {
							font: {
								size: 11
							},
							callback: v => Number(v).toFixed(0) + '%'
						},
						grid: {
							color: 'rgba(0, 0, 0, 0.05)'
						}
					},
					y: {
						title: {
							display: true,
							text: 'Cost (€)',
							color: '#64748b',
							font: {
								size: 14,
								weight: '600'
							}
						},
						beginAtZero: true,
						ticks: {
							font: {
								size: 11
							},
							callback: v => '€' + Number(v).toFixed(2)
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
							font: {
								size: 12
							},
							color: '#64748b'
						}
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						padding: 12,
						borderColor: '#8b5cf6',
						borderWidth: 2,
						callbacks: {
							label: ctx => `Consumption: ${ctx.parsed.x.toFixed(1)}% | Cost: €${ctx.parsed.y.toFixed(2)}`
						}
					}
				}
			}
		});
	}

	// =========================
	// ===== GLOBAL STATS =====
	// =========================

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
					backgroundColor: [
						typeof okColor !== 'undefined' ? okColor : '#10b981',
						typeof notOkColor !== 'undefined' ? notOkColor : '#ef4444'
					],
					borderWidth: 0,
					hoverOffset: 10
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				cutout: '75%',
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: context => `${context.label}: ${context.parsed.toFixed(2)}%`
						}
					}
				}
			}
		});

		const percentageElement = document.getElementById('global-percentage-value');
		if (percentageElement) percentageElement.textContent = globalOccupancy.toFixed(2) + '%';

		const legendElement = document.getElementById('global-legend');
		if (legendElement) {
			legendElement.innerHTML = `
        <div class="custom-label"><span class="dot free"></span> Free (${free.toFixed(2)}%)</div>
        <div class="custom-label"><span class="dot used"></span> Occupied (${occupied.toFixed(2)}%)</div>
      `;
		}
	}

	// =========================
	// ===== UTILS =====
	// =========================

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
		if (element) element.textContent = formatted;
	}

	showLoading() {
		const el = document.getElementById('global-loading-indicator');
		if (el) el.style.display = 'flex';
	}

	hideLoading() {
		const el = document.getElementById('global-loading-indicator');
		if (el) el.style.display = 'none';
	}

	showError(message) {
		console.error('❌ Error:', message);
	}

	// =========================
	// ===== HISTOGRAM =====
	// =========================

	initializeHistogramControls() {
		console.log('=== Initializing Histogram Controls ===');

		const timeRangeEl = document.getElementById('histogram-time-range');
		const granularityEl = document.getElementById('histogram-granularity');
		const metricTypeEl = document.getElementById('histogram-metric-type');
		//const refreshBtn = document.getElementById('histogram-refresh-btn');

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
				timeSlot: String(this.filters.timeSlot || '').toUpperCase()
			});

			for (const [key, val] of [...params]) {
				if (!val) params.delete(key);
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
			this.showError('Failed to load histogram data: ' + (error?.message || error));
		} finally {
			if (loadingEl) loadingEl.style.display = 'none';
		}
	}

	async fetchHistogramAvg({
								building,
								floor,
								sensorType,
								metricType,
								timeRange,
								granularity,
								timeSlot,
								excludeSensorType // <= AJOUT
							}) {
		if (!building) throw new Error('fetchHistogramAvg: "building" is required');
		if (!sensorType) throw new Error('fetchHistogramAvg: "sensorType" is required');
		if (!metricType) throw new Error('fetchHistogramAvg: "metricType" is required');

		const params = new URLSearchParams({
			building,
			sensorType: String(sensorType).toUpperCase(),
			metricType: String(metricType).toUpperCase(),
			timeRange: String(timeRange).toUpperCase(),
			granularity: String(granularity).toUpperCase(),
			timeSlot: String(timeSlot || this.filters.timeSlot || '').toUpperCase()
		});

		if (floor) params.set('floor', String(floor));
		if (excludeSensorType) params.set('excludeSensorType', String(excludeSensorType).toUpperCase()); // <= AJOUT

		const r = await fetch(`/api/dashboard/histogram?${params.toString()}`);
		if (!r.ok) throw new Error(`Histogram fetch failed (${r.status})`);

		const data = await r.json();

		const avgFromSummary = data?.summary?.avgValue;
		if (avgFromSummary !== null && avgFromSummary !== undefined) {
			return { avg: avgFromSummary, data };
		}

		const pts = data?.dataPoints || data?.data || [];
		const last = Array.isArray(pts) && pts.length ? (pts[pts.length - 1]?.value ?? null) : null;
		return { avg: last, data };
	}

	renderHistogramChart(data) {
		console.log('Rendering Histogram Chart');
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

		const dataPoints = data?.dataPoints || data?.data || [];
		const deskLabels = dataPoints.map((_, index) => `Desk ${index + 1}`);
		const deskValues = dataPoints.map(dp => dp.value);

		const backgroundColors = deskValues.map(value => {
			if (value === 0 || value < 0.5) return '#10b981';
			if (value === 1 || value >= 0.5) return '#ef4444';
			return '#94a3b8';
		});

		this.charts.histogram = new Chart(chartElement, {
			type: 'bar',
			data: {
				labels: deskLabels,
				datasets: [{
					label: 'Occupancy Status',
					data: deskValues,
					backgroundColor: backgroundColors,
					borderColor: backgroundColors,
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
							font: {
								size: 14,
								weight: '600'
							}
						},
						ticks: {
							maxRotation: 90,
							minRotation: 45,
							font: {
								size: 9
							},
							autoSkip: false
						},
						grid: {
							display: false
						}
					},
					y: {
						title: {
							display: true,
							text: 'Status (0=Free, 1=Occupied)',
							color: '#64748b',
							font: {
								size: 14,
								weight: '600'
							}
						},
						beginAtZero: true,
						ticks: {
							font: {
								size: 11
							}
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
							font: {
								size: 12,
								weight: '600'
							},
							color: '#34495e'
						}
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						padding: 12,
						borderColor: typeof barColor !== 'undefined' ? barColor : '#662179',
						borderWidth: 2,
						callbacks: {
							title: context => 'Desk: ' + context[0].label,
							label: context => {
								const value = context.parsed.y.toFixed(2);
								const unit = this.getMetricUnit(data.metricType, data.aggregationType);
								return `${context.dataset.label}: ${value} ${unit}`;
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

		if (totalEl) totalEl.textContent = summary?.totalSensors || '--';
		if (activeEl) activeEl.textContent = summary?.activeSensors || '--';
		if (avgEl) avgEl.textContent = summary?.avgValue != null ? summary.avgValue.toFixed(2) : '--';
		if (minEl) minEl.textContent = summary?.minValue != null ? summary.minValue.toFixed(2) : '--';
		if (maxEl) maxEl.textContent = summary?.maxValue != null ? summary.maxValue.toFixed(2) : '--';
	}

	updateHistogramTitle(data) {
		const titleEl = document.getElementById('histogram-chart-title');
		if (!titleEl) return;

		const metricLabel = this.getMetricLabel(data.metricType);
		const timeRangeLabel = this.getTimeRangeLabel(data.timeRange);
		const granularityLabel = data.granularity === 'DAILY' ? 'Daily' : 'Hourly';

		titleEl.textContent = `📊 Histogram - ${metricLabel} (${timeRangeLabel}, ${granularityLabel})`;
	}

	// =========================
	// ===== FLOORS =====
	// =========================


	async loadBuildingFloors(buildingId) {
		const floorSelect = document.getElementById('filter-floor');

		if (!floorSelect) {
			console.warn('Floor select not found (#filter-floor). Skipping floors update.');
			return;
		}

		let floorsCount = 1;
		let excludedFloors = [];

		try {
			const resp = await fetch(`/api/buildings/${buildingId}`);
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const b = await resp.json();
			floorsCount = b.floorsCount ?? 1;
			excludedFloors = b.excludedFloors ?? [];
		} catch (e) {
			console.warn(`loadBuildingFloors: failed to fetch floors for building ${buildingId}`, e);
			floorsCount = 1;
		}

		floorSelect.innerHTML = '<option value="">All Floors</option>';
		for (let i = 0; i < floorsCount; i++) {
			if (excludedFloors.includes(i)) continue;
			const opt = document.createElement('option');
			opt.value = String(i);
			opt.textContent = i === 0 ? 'Ground Floor' : `Floor ${i}`;
			floorSelect.appendChild(opt);
		}

		this.filters.floor = '';
	}

	getEffectiveFloorParam() {
		const f = this.filters.floor;
		if (!f || f === 'all') return ''; // means: omit
		return String(f);
	}

	parseIsoToDateSafe(isoStr) {
		if (!isoStr) return null;
		const d = new Date(isoStr);
		return isNaN(d.getTime()) ? null : d;
	}

	avg(values) {
		const arr = (values || []).filter(v => typeof v === 'number' && !Number.isNaN(v));
		if (!arr.length) return null;
		return arr.reduce((a, b) => a + b, 0) / arr.length;
	}

	async fetchLiveMetric(metricKey) {
		const src = this.metricSources[metricKey];
		if (!src) return null;

		const building = this.filters.building;
		const floor = this.getEffectiveFloorParam();

		const sensorTypes = Array.isArray(src.sensorType) ? src.sensorType : [src.sensorType];
		const effectiveMetricType = (src.metricType || metricKey); // ✅

		for (const sensorType of sensorTypes) {
			try {
				const { avg, data } = await this.fetchHistogramAvg({
					building,
					floor,
					sensorType,
					metricType: effectiveMetricType,          // ✅
					timeRange: 'LAST_7_DAYS',
					granularity: 'DAILY',
					timeSlot: this.filters.timeSlot,
					excludeSensorType: src.excludeSensorType  // ✅ si tu veux supporter ça partout
				});

				if (avg !== null && avg !== undefined) return avg;
			} catch (e) {
				console.warn(`fetchLiveMetric(${metricKey}) failed for sensorType=${sensorType}`, e?.message || e);
			}
		}

		return null;
	}

	// =========================
	// ===== LABELS / UNITS =====
	// =========================

	getMetricLabel(metricType) {
		const labels = {
			OCCUPANCY: 'Occupancy',
			TEMPERATURE: 'Temperature',
			CO2: 'CO₂ Level',
			HUMIDITY: 'Humidity',
			LIGHT: 'Light Level',
			LAEQ: 'Noise Level',
			MOTION: 'Motion Events',
			POWER_TOTAL: 'Current Power',
			ENERGY_TOTAL: 'Energy'
		};
		return labels[metricType] || metricType;
	}

	getMetricUnit(metricType, aggregationType) {
		const units = {
			OCCUPANCY: 'count',
			TEMPERATURE: '°C',
			CO2: 'ppm',
			HUMIDITY: '%',
			LIGHT: 'lux',
			LAEQ: 'dB',
			MOTION: 'events',
			POWER_TOTAL: 'kW',
			ENERGY_TOTAL: 'Wh'
		};
		if (aggregationType === 'COUNT') return 'count';
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

// =============================
// ENVIRONMENT REALTIME CHARTS
// =============================

const envRealtimeCharts = {};
const ENV_MAX_POINTS = 50;
const metricUnits = {
	temperature: "°C",
	humidity: "%",
	co2: "ppm",
	sound: "dB"
};

const rtEnvChartColors = {
	temperature: { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgb(239, 68, 68)' },
	humidity: { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' },
	co2: { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgb(16, 185, 129)' },
	sound: { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgb(245, 158, 11)' }
};

const ENV_CONFIG = {
	temperature: {
		canvas: "rt-temperature-chart",
		color: "#ef4444",
		unit: "°C"
	},
	humidity: {
		canvas: "rt-humidity-chart",
		color: "#3b82f6",
		unit: "%"
	},
	co2: {
		canvas: "rt-co2-chart",
		color: "#10b981",
		unit: "ppm"
	},
	sound: {
		canvas: "rt-sound-chart",
		color: "#f59e0b",
		unit: "dB"
	}
};

const BUILDING_ENV_CONFIG = {
	23: {
		deviceIds: ["desk-01-02"],
		metrics: ["temperature", "humidity", "co2"] // pas de sound
	},
	21: {
		deviceIds: ["co2-03-02", "son-03-03"],
		metrics: ["temperature", "humidity", "co2", "sound"]
	}
};

function initEnvironmentCharts() {
	Object.entries(ENV_CONFIG).forEach(([key, cfg]) => {
		const canvas = document.getElementById(cfg.canvas);
		if (!canvas) return;

		const ctx = canvas.getContext("2d");

		envRealtimeCharts[key] = new Chart(ctx, {
			type: "line",
			data: {
				labels: [],
				datasets: [{
					label: key,
					data: [],
					backgroundColor: rtEnvChartColors[key].bg,
					borderColor: rtEnvChartColors[key].border,
					borderWidth: 2,
					fill: true,
					tension: 0.4
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: ctx => `${ctx.parsed.y.toFixed(1)} ${metricUnits[key]}`
						}
					}
				},
				scales: {
					x: {
						ticks: { maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 12 }
						//display: true
					},
					y: {
						beginAtZero: false,
						title: {
							display: true,
							text: metricUnits[key] || ""
						}
					}
				}
			}
		});

	});

	initEnvChartToggles();
}

function initEnvChartToggles() {

	document.querySelectorAll(".env-chart-btn").forEach(btn => {

		btn.addEventListener("click", () => {

			const container = btn.closest(".env-chart-toggle");
			const chartKey = container.dataset.chart;
			const type = btn.dataset.type;

			container.querySelectorAll(".env-chart-btn")
				.forEach(b => b.classList.remove("active"));

			btn.classList.add("active");

			const chart = envRealtimeCharts[chartKey];
			if (!chart) return;

			chart.config.type = type;
			chart.update();

		});
	});
}

function updateEnvChart(metric, value) {

	const chart = envRealtimeCharts[metric];
	if (!chart) return;

	const now = new Date().toLocaleTimeString();

	chart.data.labels.push(now);
	chart.data.datasets[0].data.push(value);

	if (chart.data.labels.length > ENV_MAX_POINTS) {
		chart.data.labels.shift();
		chart.data.datasets[0].data.shift();
	}

	chart.update("none");
}

const envMaxValues = {};

function updateEnvStats(metric) {

	const chart = envCharts[metric];
	if (!chart) return;

	const data = chart.data.datasets[0].data;

	if (!data.length) return;

	const avg = data.reduce((a,b)=>a+b,0) / data.length;
	const max = Math.max(...data);

	const avgEl = document.getElementById(`env-${metric}-avg`);
	const maxEl = document.getElementById(`env-${metric}-max`);

	if (avgEl) avgEl.textContent = avg.toFixed(2);
	if (maxEl) maxEl.textContent = max.toFixed(2);

}

function updateEnvAverage(metric) {

	const chart = envRealtimeCharts[metric];
	if (!chart) return;

	const values = chart.data.datasets[0].data;

	if (values.length < 2) {
		return; // pas assez de données
	}

	const sum = values.reduce((a, b) => a + b, 0);
	const avg = sum / values.length;

	const map = {
		temperature: "env-temp-avg",
		humidity: "env-humidity-avg",
		co2: "env-co2-avg",
		sound: "env-sound-avg"
	};

	const el = document.getElementById(map[metric]);
	if (el) el.textContent = avg.toFixed(2);
}

function updateEnvMax(metric) {

	const chart = envRealtimeCharts[metric];
	if (!chart) return;

	const data = chart.data.datasets[0].data;

	if (!data || data.length === 0) return;

	const max = Math.max(...data);

	const map = {
		temperature: "env-temp-max",
		humidity: "env-humidity-max",
		co2: "env-co2-max",
		sound: "env-sound-max"
	};

	const el = document.getElementById(map[metric]);
	if (el) el.textContent = max.toFixed(2);
}

let environmentUnsub = null;
const environmentState = {};
const envZoneState = {};




async function startEnvironmentSSE(building, floor = "") {
	console.log("🌡️ startEnvironmentSSE:", building, floor);

	// 🔁 stop ancien SSE
	if (environmentUnsub) {
		environmentUnsub();
		environmentUnsub = null;
	}

	// reset UI
	resetEnvironmentCharts();
	resetEnvironmentStats();
	normalFloor = normalizeFloor(building, floor);

	//récupérer config dynamique
	const params = new URLSearchParams({ building });
	params.set("floor", normalFloor);

	const res = await fetch(`/api/config/environment?${params}`);
	const config = await res.json();

	renderZones(config.zones, config.metrics);

	initZoneCharts(config.zones, config.metrics);

	const deviceIds = config.zones.flatMap(z => z.deviceIds);
	const metrics = config.metrics;

	console.log("✅ devices:", deviceIds);
	console.log("✅ metrics:", metrics);


	const deviceToZone = {};

	config.zones.forEach(zone => {
		zone.deviceIds.forEach(id => {
			deviceToZone[id] = zone.name;
		});
	});

	console.log("🗺️ deviceToZone:", deviceToZone);

	// gérer affichage dynamique
	updateEnvironmentChartsVisibilityDynamic(metrics);

	if (!window.SSEManager?.subscribeEnvironment) {
		console.warn("❌ SSEManager.subscribeEnvironment not available");
		return;
	}

	environmentUnsub = window.SSEManager.subscribeEnvironment(
		building,
		deviceIds.join(","),
		(msg) => {

			const decoded =
				msg?.uplink_message?.decoded_payload ??
				msg?.decoded_payload ??
				msg?.payload ??
				{};

			const deviceId =
				msg?.end_device_ids?.device_id ||
				msg?.device_id;

			// 🔥 trouver la zone
			const zone = config.zones.find(z => z.deviceIds.includes(deviceId));
			if (!zone) return;

			const zoneName = zone.name;

			updateMetric(zoneName, "temperature", decoded.temperature);
			updateMetric(zoneName, "humidity", decoded.humidity);
			updateMetric(zoneName, "co2", decoded.co2);
			updateMetric(zoneName, "sound", decoded.LAeq);
		}
	);
}


function updateMetric(zone, metric, value) {
	if (value == null) return;

	const safeZone = zone.replace(/\s+/g, "_");

	const avgEl = document.getElementById(`${safeZone}-${metric}-avg`);
	const maxEl = document.getElementById(`${safeZone}-${metric}-max`);

	if (!environmentState[zone]) environmentState[zone] = {};
	if (!environmentState[zone][metric]) environmentState[zone][metric] = [];

	const arr = environmentState[zone][metric];
	arr.push(value);

	if (arr.length > 20) arr.shift(); // limiter la taille

	const avg = arr.reduce((a,b) => a+b,0)/arr.length;
	const max = Math.max(...arr);

	if (avgEl) avgEl.textContent = avg.toFixed(1);
	if (maxEl) maxEl.textContent = max.toFixed(1);

	const chart = zoneCharts[safeZone]?.[metric];

	if (chart) {
		const now = new Date().toLocaleTimeString();

		chart.data.labels.push(now);
		chart.data.datasets[0].data.push(value);

		if (chart.data.labels.length > 20) {
			chart.data.labels.shift();
			chart.data.datasets[0].data.shift();
		}

		chart.update("none");
	}
}

function updateZoneStats(zone) {

	const data = envZoneState[zone];

	if (!data) return;

	function avg(arr) {
		if (!arr.length) return "--";
		return (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1);
	}

	function max(arr) {
		if (!arr.length) return "--";
		return Math.max(...arr);
	}

	updateZoneUI(zone, {
		temperature: { avg: avg(data.temperature), max: max(data.temperature) },
		humidity: { avg: avg(data.humidity), max: max(data.humidity) },
		co2: { avg: avg(data.co2), max: max(data.co2) },
		sound: { avg: avg(data.sound), max: max(data.sound) }
	});
}

function updateZoneUI(zone, stats) {
	const safeZone = zone.replace(/\s+/g, "_");
	const container = document.getElementById(`zone-${safeZone}`);
	if (!container) return;

	container.querySelector(".temp-avg").textContent = stats.temperature.avg;
	container.querySelector(".temp-max").textContent = stats.temperature.max;

	container.querySelector(".co2-avg").textContent = stats.co2.avg;
	container.querySelector(".co2-max").textContent = stats.co2.max;

	container.querySelector(".hum-avg").textContent = stats.humidity.avg;
	container.querySelector(".hum-max").textContent = stats.humidity.max;

	container.querySelector(".sound-avg").textContent = stats.sound.avg;
	container.querySelector(".sound-max").textContent = stats.sound.max;
}


// Normalise un nom de zone de la même façon que generateStatCardsForBuilding dans chartUtils.js
// (uppercase + espaces/tirets → underscore) pour garantir le matching entre les deux sources.
function normalizeZoneKey(name) {
	return name.toUpperCase().replace(/[\s\-]+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

function renderZones(zones, metrics) {
	const container = document.getElementById("zones-container");
	container.innerHTML = "";

	zones.forEach(zone => {
		// safeZone : utilisé pour les IDs DOM (inchangé)
		const safeZone = zone.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
		// zoneKey : clé normalisée pour matcher data-zone des stat-cards (même convention que chartUtils)
		const zoneKey = normalizeZoneKey(zone.name);

		const zoneDiv = document.createElement("div");
		zoneDiv.className = "zone-block";
		zoneDiv.id = `zone-${safeZone}`;

		const hasCharts = ["co2", "temperature", "humidity", "sound"].some(m => metrics.includes(m));

		zoneDiv.innerHTML = `
            <h3 style="margin: 10px 0;">📍 ${zone.name}</h3>

            <div class="charts-grid charts-grid--2col">
                <!-- Slot occupancy : rempli par occupancyStatCardsReady après génération des stat-cards -->
                <div class="zone-stat-card-slot" data-zone-key="${zoneKey}"></div>

                ${hasCharts ? `
                ${metrics.includes("co2")         ? createChartCard("co2",         zone.name) : ""}
                ${metrics.includes("temperature") ? createChartCard("temperature", zone.name) : ""}
                ${metrics.includes("humidity")    ? createChartCard("humidity",    zone.name) : ""}
                ${metrics.includes("sound")       ? createChartCard("sound",       zone.name) : ""}
                ` : ""}
            </div>
        `;

		container.appendChild(zoneDiv);
	});

	// Pas d'absorption ici : les stat-cards sont générées par generateStatCardsForBuilding
	// (chartUtils.js) qui est appelé APRÈS renderZones. L'absorption est déclenchée
	// par l'événement "occupancyStatCardsReady" dispatché par chartUtils.

	initZoneChartToggles();
}


function createChartCard(metric, zoneName) {
	const config = {
		co2: {
			label: "CO₂",
			icon: "💨",
			color: "#10b981",
			gradient: "linear-gradient(135deg, #10b981, #059669)",
			unit: "ppm"
		},
		temperature: {
			label: "Temperature",
			icon: "🌡️",
			color: "#ef4444",
			gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
			unit: "°C"
		},
		humidity: {
			label: "Humidity",
			icon: "💧",
			color: "#3b82f6",
			gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
			unit: "%"
		},
		sound: {
			label: "Sound Level",
			icon: "🔊",
			color: "#f59e0b",
			gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
			unit: "dB"
		}
	};

	const cfg = config[metric];

	const safeZone = zoneName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");


	return `
        <div class="chart-card">
            <div class="rt-chart-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    
                    <div class="chart-title">
                        <span class="chart-icon" style="background: ${cfg.gradient};">${cfg.icon}</span>
                        <span>${cfg.label}</span>
                    </div>

                    <div class="chart-info" style="font-size: 0.85rem; color: #6b7280;">
                        Avg: 
                        <span class="kpi-value" id="${safeZone}-${metric}-avg" 
                              style="font-weight: 600; color: ${cfg.color};">--</span> ${cfg.unit}
                    </div>

                    <div class="chart-info" style="font-size: 0.85rem; color: #6b7280;">
                        Max: 
                        <span id="${safeZone}-${metric}-max" 
                              class="kpi-value" 
                              style="font-weight: 600; color: ${cfg.color};">--</span> ${cfg.unit}
                    </div>

                </div>

                <!-- TOGGLE PAR ZONE -->
                <!--<div class="env-chart-toggle" data-zone="${safeZone}" data-metric="${metric}"
                     style="display: flex; gap: 0.25rem; background: #f3f4f6; padding: 0.2rem; border-radius: 6px;">

                    <button class="env-chart-btn active" data-type="line">📈</button>
                    <button class="env-chart-btn" data-type="bar">📊</button>
                    <button class="env-chart-btn" data-type="doughnut">🍩</button>

                </div>-->
				
				<div class="env-chart-toggle" 
					 data-zone="${safeZone}" 
					 data-metric="${metric}"
					 style="display: flex; gap: 0.25rem; background: #f3f4f6; padding: 0.2rem; border-radius: 6px;">

					<button class="env-chart-btn active" data-type="line"
						style="padding: 0.35rem 0.6rem; border: none; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.75rem;">
						📈 Line
					</button>

					<button class="env-chart-btn" data-type="bar"
						style="padding: 0.35rem 0.6rem; border: none; background: transparent; color: #6b7280; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.75rem;">
						📊 Bar
					</button>

					<button class="env-chart-btn" data-type="doughnut"
						style="padding: 0.35rem 0.6rem; border: none; background: transparent; color: #6b7280; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.75rem;">
						🍩 Donut
					</button>

				</div>

            </div>

            <div class="rt-chart-container" style="height: auto; position: relative;">
                <canvas id="chart-${safeZone}-${metric}"></canvas>
            </div>
        </div>
    `;
}


function initZoneChartToggles() {
	document.querySelectorAll(".env-chart-btn").forEach(btn => {

		btn.addEventListener("click", () => {

			const toggle = btn.closest(".env-chart-toggle");

			const zone = toggle.dataset.zone;
			const metric = toggle.dataset.metric;
			const type = btn.dataset.type;

			toggle.querySelectorAll(".env-chart-btn")
				.forEach(b => b.classList.remove("active"));

			btn.classList.add("active");

			const chart = zoneCharts[zone]?.[metric];
			if (!chart) return;

			chart.config.type = type;
			chart.update();
		});

	});
}


// ============================================
// ABSORPTION DES STAT-CARDS ORPHELINES
// Pour chaque stat-card restée dans #sensor-stats-container (pas de zone env
// correspondante), on crée un zone-block minimal et on l'ajoute à zones-container.
// Un zone-block orphelin porte l'attribut data-orphan pour pouvoir le retrouver
// et le supprimer lors d'un rechargement.
// ============================================
function absorbOrphanStatCards(zonesContainer) {
	// Supprimer les anciens blocs orphelins créés lors d'un appel précédent
	zonesContainer.querySelectorAll(".zone-block[data-orphan]").forEach(b => b.remove());

	document.querySelectorAll("#sensor-stats-container .stat-card[data-zone]").forEach(statCard => {
		const zoneKey = statCard.dataset.zone;

		// Titre lisible : remplacer les underscores par des espaces, Title Case
		const zoneName = zoneKey
			.replace(/_/g, " ")
			.replace(/\b\w/g, c => c.toUpperCase());

		const orphanBlock = document.createElement("div");
		orphanBlock.className = "zone-block";
		orphanBlock.setAttribute("data-orphan", zoneKey);
		orphanBlock.id = `zone-orphan-${zoneKey}`;

		// Layout : stat-card (50%) + message "no env data" (50%), alignés
		orphanBlock.innerHTML = `
			<h3 style="margin: 10px 0;">📍 ${zoneName}</h3>
			<div style="display: flex; gap: 1rem; align-items: stretch; min-height: 260px;">
				<div class="zone-stat-card-slot" data-zone-key="${zoneKey}" style="flex: 0 0 60%; max-width: 60%;"></div>
				<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
				            gap: 0.5rem; color: #9ca3af; text-align: center; padding: 1rem;">
					<span style="font-size: 2rem;">📡</span>
					<span style="font-size: 0.9rem; font-weight: 500;">No data found</span>
					<span style="font-size: 0.78rem;">No metric CO₂, Humidity, Temperature or sound configured<br>for this zone</span>
				</div>
			</div>
		`;

		zonesContainer.appendChild(orphanBlock);

		const slot = orphanBlock.querySelector(`.zone-stat-card-slot[data-zone-key="${zoneKey}"]`);
		slot.appendChild(statCard);
	});
}


// ============================================
// RE-ABSORPTION DES STAT-CARDS APRÈS REGÉNÉRATION
// Quand chartUtils.js recrée les stat-cards dans #sensor-stats-container
// (ex: changement de building/floor), on les déplace à nouveau dans leurs slots,
// puis on crée les blocs orphelins pour les restantes.
// ============================================
document.addEventListener("occupancyStatCardsReady", () => {
	const zonesContainer = document.getElementById("zones-container");

	// 1. Remplir les slots des zones avec chart-block (créés par renderZones)
	//    Les slots vides (pas de stat-card correspondante) sont supprimés après la boucle.
	const emptySlots = [];
	zonesContainer.querySelectorAll(".zone-stat-card-slot[data-zone-key]").forEach(slot => {
		// Ne traiter que les slots des zone-blocks env (pas les orphelins déjà créés)
		if (slot.closest("[data-orphan]")) return;

		const zoneKey = slot.dataset.zoneKey;
		const statCard = document.querySelector(
			`#sensor-stats-container .stat-card[data-zone="${zoneKey}"]`
		);
		if (statCard) {
			slot.innerHTML = "";
			slot.appendChild(statCard);
		} else {
			emptySlots.push(slot);
		}
	});
	emptySlots.forEach(s => s.remove());

	// 2. Créer les blocs orphelins pour les stat-cards encore dans #sensor-stats-container
	absorbOrphanStatCards(zonesContainer);
});

function safeZoneId(zoneName) {
	return zoneName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
}

const zoneCharts = {};

function initZoneCharts(zones, metrics) {

	zones.forEach(zone => {

		const safeZone = safeZoneId(zone.name);

		zoneCharts[safeZone] = {};

		metrics.forEach(metric => {

			const canvas = document.getElementById(`chart-${safeZone}-${metric}`);
			if (!canvas) return;

			const ctx = canvas.getContext("2d");

			zoneCharts[safeZone][metric] = new Chart(ctx, {
				type: "line",
				data: {
					labels: [],
					datasets: [{
						label: metric,
						data: [],
						backgroundColor: rtEnvChartColors[metric].bg,
						borderColor: rtEnvChartColors[metric].border,
						borderWidth: 2,
						fill: true,
						tension: 0.4
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: false,
					plugins: {
						legend: { display: false }
					},
					scales: {
						x: {
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								autoSkip: true,
								maxTicksLimit: 10
							},
							grid: {
								color: "rgba(0,0,0,0.05)"
							}
						},
						y: {
							beginAtZero: false,
							title: {
								display: true,
								text: metricUnits[metric] || ""
							},
							grid: {
								color: "rgba(0,0,0,0.05)"
							}
						}
					}
				}
			});

		});
	});
}


function updateEnvironmentChartsVisibilityDynamic(metrics) {

	const all = ["temperature", "humidity", "co2", "sound"];

	all.forEach(metric => {
		const card = document.querySelector(`[data-chart="${metric}"]`)?.closest(".chart-card");

		if (!card) return;

		card.style.display = metrics.includes(metric) ? "block" : "none";
	});
}


function normalizeFloor(building, floor) {

	if (building === "21" && (!floor || floor === "" || floor === "all")) {
		return "3";
	}

	if (building === "23" && (!floor || floor === "" || floor === "all")) {
		return "2";
	}

	return floor;
}

let envConfigCache = {};

async function getEnvConfig(building, floor) {
	const key = `${building}-${floor}`;
	if (envConfigCache[key]) return envConfigCache[key];

	const res = await fetch(`/api/config/environment?building=${building}&floor=${floor}`);
	const data = await res.json();

	envConfigCache[key] = data;
	return data;
}


function closeEnvironmentSSE() {
	if (environmentUnsub) {
		console.log("🔒 Unsubscribe environment SSE");
		environmentUnsub();
		environmentUnsub = null;
	}
}

function updateEnvironmentChartsVisibility(building) {
	const cfg = BUILDING_ENV_CONFIG[building];
	if (!cfg) return;

	const metrics = ["temperature", "humidity", "co2", "sound"];

	metrics.forEach(metric => {
		const card = document.querySelector(`[data-chart="${metric}"]`)?.closest(".chart-card");

		if (!card) return;

		if (cfg.metrics.includes(metric)) {
			card.style.display = "block";
		} else {
			card.style.display = "none";
		}
	});
}

function updateTitles(buildingName) {

	const buildingTitle = document.getElementById('building-title');
	if (buildingTitle) buildingTitle.textContent = `🏢 ${buildingName} Office Building`;

	const sensorSelect = document.getElementById('filter-sensor-type');
	if (sensorSelect) {
		const sensorType = sensorSelect.value;

		const sensorInfo = {
			DESK: {icon: '📊', name: 'Desk Occupancy'},
			CO2: {icon: '🌫️', name: 'CO₂ Air Quality'},
			TEMP: {icon: '🌡️', name: 'Temperature'},
			LIGHT: {icon: '💡', name: 'Light Levels'},
			MOTION: {icon: '👁️',name: 'Motion Detection'},
			NOISE: { icon: '🔉',name: 'Noise Levels'},
			HUMIDITY: {icon: '💧', name: 'Humidity'},
			TEMPEX: {icon: '🌀', name: 'HVAC Flow (TEMPex)'},
			PR: {icon: '👤',name: 'Presence & Light'},
			SECURITY: {icon: '🚨',name: 'Security Alerts'}
		};

		const info = sensorInfo[sensorType] || sensorInfo.DESK;
		const liveTitle     = document.getElementById('live-section-title');
		const histTitle     = document.getElementById('historical-section-title');
		if (liveTitle)     liveTitle.textContent     = `${info.icon} Live Data - ${buildingName} Office`;
		if (histTitle)     histTitle.textContent     = `📈 Historical ${info.name} Data - ${buildingName} Office`;
	}
}

async function update3DConfig(buildingId) {
	if (window.building3D?.loadConfig) {
		window.building3D.buildingKey = buildingId;
		await window.building3D.loadConfig();
		window.building3D.setBuilding();
	}
}

function resetEnvironmentCharts() {
	Object.values(envRealtimeCharts).forEach(chart => {

		chart.data.labels = [];
		chart.data.datasets[0].data = [];
		chart.update();
	});
}

function resetEnvironmentStats() {
	const metrics = ["temperature","humidity","co2","sound"];
	metrics.forEach(metric => {
		const avg = document.getElementById(`env-${metric}-avg`);
		const max = document.getElementById(`env-${metric}-max`);

		if (avg) avg.textContent = "--";
		if (max) max.textContent = "--";

	});
}

const filters = {
	building: "",
	floor: ""
};

window.addEventListener("beforeunload", () => {
	closeOccupancySSE();
	closeEnvironmentSSE();
});

document.addEventListener('DOMContentLoaded', () => {
	console.log('Initializing Dashboard Manager...');
	filters.building = document.getElementById('filter-building')?.value;
	filters.floor = document.getElementById('filter-floor')?.value;

	// ✅ 1. Initialiser les instances Chart.js sur les canvas dès le départ
	initEnvironmentCharts();

	// ✅ 2. Initialiser les boutons Line/Bar/Donut
	initEnvChartToggles();

	window.dashboardManager = new DashboardManager();
	window.DashboardManager = DashboardManager;

	// ✅ 3. Démarrer le SSE après que le DashboardManager a chargé le bâtiment par défaut
	//    On attend que loadBuildings() soit terminé pour avoir le bon building ID
	window.dashboardManager._buildingsLoaded = window.dashboardManager._buildingsLoaded
		?? new Promise(resolve => {
			const original = window.dashboardManager.loadBuildings.bind(window.dashboardManager);
			// Alternative simple : attendre un court délai post-init
		});

	// Délai court pour laisser loadBuildings() finir et définir filters.building
	setTimeout(() => {
		const buildingId = document.getElementById('filter-building')?.value;
		const floorId = document.getElementById('filter-floor')?.value;
		const buildingName = document.getElementById('filter-building')?.selectedOptions[0].text;
		if (buildingId) {
			update3DConfig(buildingId);
			updateTitles(buildingName);
			updateEnvironmentChartsVisibility(buildingId);
			startEnvironmentSSE(buildingId, floorId);
		}
	}, 1500);
});

window.DashboardManager = DashboardManager;