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


		// Bâtiments "hors base"
		this.virtualBuildings = {
			CHATEAUDUN: {
				id: 'CHATEAUDUN',
				code: 'CHATEAUDUN',
				name: 'Châteaudun',
				floors: 7
			},
			LEVALLOIS: {
				id: 'LEVALLOIS',
				code: 'LEVALLOIS',
				name: 'Levallois',
				floors: 1
			}
		};

		this.filters = {
			year: '2025',
			month: '11',
			building: 'CHATEAUDUN',
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

		this.loadBuildings();
		this.loadDashboardData();
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
		return building?.code || String(building?.id || '');
	}

	// =========================
	// ===== FILTERS =====
	// =========================

	initializeFilters() {
		const filterIds = ['building', 'floor', 'sensor-type'];

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

			if (this.filters[mappedKey] !== undefined && this.filters[mappedKey] !== null) {
				element.value = this.filters[mappedKey];
			}

			element.addEventListener('change', (e) =>
				this.handleFilterChange(filterId, e.target.value)
			);
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
      }

      const kwh = (payload.todayEnergykWh != null)
        ? Number(payload.todayEnergykWh)
        : (payload.todayEnergyWh != null ? Number(payload.todayEnergyWh) / 1000 : null);

      if (kwh != null && !Number.isNaN(kwh)) {
        this.updateMetricValue('live-daily-energy', kwh.toFixed(2));
      }
    } catch (e) {
      console.warn('[CONSO SSE] parse error', e);
    }
  });

  es.addEventListener('keepalive', () => {});
  es.onerror = (err) => console.warn('[CONSO SSE] error', err);
}


stopConsoAggregateSse() {
  if (this.consoSse) {
    console.log('[CONSO SSE] stopping');
    try { this.consoSse.close(); } catch {}
    this.consoSse = null;
  }
}

	async fetchDeskSensors(building, floor) {
		const params = new URLSearchParams({
			building,
			sensorType: 'DESK',
			metricType: 'OCCUPANCY'
		});
		if (floor) params.set('floor', floor);

		const r = await fetch(`/api/dashboard/sensors?${params.toString()}`);
		if (!r.ok) return [];
		const data = await r.json();
		return Array.isArray(data) ? data : [];
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

	/**
	 * Suppose lastValue:
	 * - occupied: 1 / true
	 * - free: 0 / false
	 * - invalid: null/undefined or explicit invalid flags if you have them
	 */
	computeDeskStates(sensors) {
		let occupied = 0;
		let free = 0;
		let invalid = 0;

		sensors.forEach(s => {
			const st = this.computeState(s, 60);
			if (st === "used") occupied++;
			else if (st === "free") free++;
			else invalid++;
		});

		const totalValid = occupied + free;

		return {
			occupied, // X
			free,
			invalid,
			totalValid, // Y
			ratioLabel: `${occupied}/${totalValid}`, // "X/Y"
			occupancyRatio: totalValid > 0 ? occupied / totalValid : 0 // optionnel si besoin graphique
		};
	}


	renderDeskStateAverages(allFloorsStats) {
		// allFloorsStats: [{ floor: 1, stats: {...}}, ...] + total computed
		const section = document.getElementById('desk-state-averages-section');
		const grid = document.getElementById('desk-avg-cards');
		if (!section || !grid) return;

		if (!allFloorsStats || allFloorsStats.length === 0) {
			section.style.display = 'none';
			return;
		}

		section.style.display = 'block';

		// Total
		const totalAgg = allFloorsStats.reduce((acc, it) => {
			acc.total += it.stats.total;
			acc.used += it.stats.used;
			acc.free += it.stats.free;
			acc.invalid += it.stats.invalid;
			return acc;
		}, {
			total: 0,
			used: 0,
			free: 0,
			invalid: 0
		});

		const totalPct = (x) => totalAgg.total > 0 ? (x / totalAgg.total) * 100 : 0;

		const cards = [];

		cards.push(this.renderDeskAvgCardHtml('All Floors', {
			total: totalAgg.total,
			usedPct: totalPct(totalAgg.used),
			freePct: totalPct(totalAgg.free),
			invalidPct: totalPct(totalAgg.invalid),
			used: totalAgg.used,
			free: totalAgg.free,
			invalid: totalAgg.invalid
		}, true));

		// Per floor
		allFloorsStats.forEach(({
			floor,
			stats
		}) => {
			cards.push(this.renderDeskAvgCardHtml(`Floor ${floor}`, stats, false));
		});

		grid.innerHTML = cards.join('');
	}

	renderDeskAvgCardHtml(title, stats, highlight) {
		const cls = highlight ? 'chart-card metric-card--highlight' : 'chart-card';
		return `
          <div class="${cls}">
              <h4>${title}</h4>
              <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px;">
                  <div><strong>Used</strong>: ${stats.usedPct.toFixed(1)}% <span style="color:#64748b;">(${stats.used})</span></div>
                  <div><strong>Free</strong>: ${stats.freePct.toFixed(1)}% <span style="color:#64748b;">(${stats.free})</span></div>
                  <div><strong>Invalid</strong>: ${stats.invalidPct.toFixed(1)}% <span style="color:#64748b;">(${stats.invalid})</span></div>
                  <div style="margin-left:auto;"><strong>Total</strong>: ${stats.total}</div>
              </div>
          </div>
      `;
	}

    applyBuildingStatVisibility() {
        const building = String(this.filters.building || '').toUpperCase();

        const lev = document.getElementById("stats-levallois");
        const cha = document.getElementById("stats-chateaudun");

        if (!lev || !cha) return;

        if (building === "CHATEAUDUN") {
            // Châteaudun = affichage du bloc unique
            lev.style.display = "none";
            cha.style.display = "";
        } else {
            // Levallois ou autre = affichage normal
            lev.style.display = "";
            cha.style.display = "none";
        }
    }

	async loadBuildings() {
		const select = document.getElementById('filter-building');
		if (!select) return;

		try {
			const resp = await fetch('/api/buildings');
			let buildings = resp.ok ? await resp.json() : [];

			// Injecter CHATEAUDUN & LEVALLOIS si absents
			Object.keys(this.virtualBuildings).forEach(key => {
				const exists = buildings.find(b => b.code === key || String(b.id) === String(key));
				if (!exists) buildings.push(this.virtualBuildings[key]);
			});

			this.buildings = buildings;

			// Remplissage du select
			select.innerHTML = '';
			buildings.forEach(b => {
				const opt = document.createElement('option');
				opt.value = b.code || b.id; // valeur "brute" émise par le select
				opt.textContent = b.name;
				if (opt.value === this.filters.building) opt.selected = true;
				select.appendChild(opt);
			});

			// Définir le bâtiment actuel (robuste code/id)
			const current =
				buildings.find(b => (b.code && b.code === this.filters.building) || String(b.id) === String(this.filters.building)) ||
				buildings[0];

			this.currentBuilding = current;
			this.filters.building = this.getBuildingKey(current); // normalisation filtre
            this.startConsoAggregateSse();

			// Charger les étages
			const floorsLookupId = current.code ? current.code : current.id;
			await this.loadBuildingFloors(floorsLookupId);

			this.updateBuildingTitle();
			await this.loadDashboardData();
		} catch (e) {
			console.error('Error loading buildings', e);
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
    const building = this.buildings.find(
      b => String(b.id) === String(value) || b.code === value
    );

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
    this.updateBuildingTitle();
    this.updateSensorTypeUI(this.filters.sensorType);

    // 6) 3D
    if (window.building3D?.loadBuilding) {
      console.log('Mise à jour du modèle 3D pour:', building.name);
      window.building3D.loadBuilding(building);
    }

    // ✅ 7) Restart CONSO SSE (building + floor='')
			this.startConsoAggregateSse();

			// ✅ 8) Update alert filters locally (instant, no API call)
			this.updateAlertFilters();

			// 9) Reload data
			await this.loadDashboardData();
			this.applyBuildingStatVisibility();
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
			this.startConsoAggregateSse();
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

		if (this.currentBuilding?.name) {
			return this.currentBuilding.name;
		}

		return 'Office';
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

	generateSampleAlerts() {
		return [{
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

	async fetchDeskSensorsAllFloors(building) {
		const params = new URLSearchParams({
			building,
			sensorType: 'DESK',
			metricType: 'OCCUPANCY'
		});

		const r = await fetch(`/api/dashboard/sensors?${params.toString()}`);
		if (!r.ok) return [];
		const data = await r.json();
		return Array.isArray(data) ? data : [];
	}


async updateLiveBuildingMetrics() {
  try {
    // --- Desk usage ratio ---
    try {
      const floor = this.getEffectiveFloorParam();
      const occItems = await this.fetchOccupancy(floor);

      const filtered = (occItems || []).filter(x => {
        const id = String(x?.id || '').toLowerCase();
        return /^desk-\d{2}-\d{2}$/.test(id);
      });

      const occ = this.computeOccupancyFromStatuses(filtered);
      this.updateMetricValue('live-desk-usage', occ.label);
    } catch (e) {
      console.warn('Desk occupancy ratio failed', e);
    }

    const building = this.filters.building;
    const floor = this.getEffectiveFloorParam();
    const timeSlot = this.filters.timeSlot;

    const safeSet = (elId, val, fmt) => {
      if (val == null || Number.isNaN(Number(val))) return;
      this.updateMetricValue(elId, fmt(Number(val)));
    };

    const getAvg = async ({
      sensorType,
      metricType,
      excludeSensorType
    }) => {
      const { avg } = await this.fetchHistogramAvg({
        building,
        floor,
        sensorType,
        metricType,
        timeRange: 'LAST_7_DAYS',
        granularity: 'DAILY',
        timeSlot,
        excludeSensorType
      });
      return avg;
    };

    // =========================================================
    // TEMP / HUM : EXT = TEMPEX ; INT = ALL (sauf TEMPEX)
    // =========================================================

    // EXT (TEMPEX)
    try {
      const tempExt = await getAvg({ sensorType: 'TEMPEX', metricType: 'TEMPERATURE' });
      safeSet('live-avg-temperature-ext', tempExt, v => v.toFixed(1));
    } catch (e) {
      console.warn('Temperature EXT (TEMPEX) failed', e?.message || e);
    }



    try {
      const humExt = await getAvg({ sensorType: 'TEMPEX', metricType: 'HUMIDITY' });
      safeSet('live-avg-humidity-ext', humExt, v => v.toFixed(1));
    } catch (e) {
      console.warn('Humidity EXT (TEMPEX) failed', e?.message || e);
    }

    // INT (tous capteurs sauf TEMPEX)
    // IMPORTANT: ton backend doit accepter sensorType=ALL (ou l’absence de sensorType).
    // Ici je garde ALL car tu l’utilises déjà.
    try {
      const tempInt = await getAvg({
        sensorType: 'ALL',
        metricType: 'TEMPERATURE',
        excludeSensorType: 'TEMPEX'
      });
      safeSet('live-avg-temperature-int', tempInt, v => v.toFixed(1));
    } catch (e) {
      console.warn('Temperature INT (ALL - TEMPEX) failed', e?.message || e);
    }

    try {
      const humInt = await getAvg({
        sensorType: 'ALL',
        metricType: 'HUMIDITY',
        excludeSensorType: 'TEMPEX'
      });
      safeSet('live-avg-humidity-int', humInt, v => v.toFixed(1));
    } catch (e) {
      console.warn('Humidity INT (ALL - TEMPEX) failed', e?.message || e);
    }

    // =========================================================
    // AUTRES METRICS (moyenne bâtiment "normale")
    // =========================================================

    const mappings = [
      { metric: 'CO2', el: 'live-avg-co2', format: v => Math.round(v) },
      { metric: 'LAEQ', el: 'live-avg-sound', format: v => v.toFixed(1) },
      { metric: 'LIGHT', el: 'live-avg-light', format: v => Math.round(v) }
    ];

    for (const { metric, el, format } of mappings) {
      try {
        const avg = await this.fetchLiveMetric(metric); // utilise metricSources
        safeSet(el, avg, format);
      } catch (e) {
        console.warn(`Live metric ${metric} failed`, e?.message || e);
      }
    }
  } catch (e) {
    console.error('Error updating live building metrics:', e);
  }
}

async calculateTodaysEnergy() {
  try {
    const params = new URLSearchParams({
      building: this.filters.building,
      floor: this.getEffectiveFloorParam(),
      sensorType: 'CONSO',
      metricType: 'ENERGY_TOTAL',
      timeRange: 'TODAY',
      granularity: 'HOURLY', // optionnel (le backend le forcera)
      timeSlot: String(this.filters.timeSlot || '').toUpperCase()
    });

    // nettoie les params vides
    for (const [k, v] of [...params]) if (!v) params.delete(k);

    const response = await fetch(`/api/dashboard/histogram?${params.toString()}`);
    if (!response.ok) return;

    const data = await response.json();
    const points = data?.dataPoints || data?.data || [];

    // Ici "value" dépend de ce que tu stockes :
    // - si tes ENERGY_CHANNEL_X sont en Wh => ENERGY_TOTAL sera en Wh sur le bucket (selon ton backend)
    // - si c’est déjà en kWh => ne divise pas.
    const totalWh = Array.isArray(points)
      ? points.reduce((sum, p) => sum + (Number(p?.value) || 0), 0)
      : 0;

    const totalKWh = totalWh / 1000; // si valeur en Wh
    this.updateMetricValue('live-daily-energy', totalKWh.toFixed(2));
  } catch (error) {
    console.warn("Failed to calculate today's energy:", error);
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
		console.log('⏳ Loading data...');
	}

	hideLoading() {
		console.log('✅ Data loaded');
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

		const idUpper = String(buildingId).toUpperCase();
		let floorsCount = 1;

		// Priorité au virtuel
		if (this.virtualBuildings[idUpper]) {
			console.log(`🛠️ Forçage virtuel pour ${idUpper}: ${this.virtualBuildings[idUpper].floors} étages`);
			floorsCount = this.virtualBuildings[idUpper].floors;
		} else {
			try {
				const resp = await fetch(`/api/buildings/${buildingId}`);
				if (!resp.ok) {
                	throw new Error(`HTTP ${resp.status}`);
            	}
				const b = await resp.json();
            	floorsCount = b.floorsCount || 1;
			} catch (e) {
				floorsCount = 1;
			}
		}

		floorSelect.innerHTML = '<option value="">All Floors</option>';
		for (let i = 0; i < floorsCount; i++) {
			const opt = document.createElement('option');
			opt.value = String(i);
			if (i === 0){
				opt.textContent = `Ground Floor`;
			} else {
				opt.textContent = `Floor ${i}`;
			}
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


	computeState(sensorInfo, staleMinutes = 60) {
		const ts = this.parseIsoToDateSafe(sensorInfo?.lastTimestamp);
		if (!ts) return "invalid";

		const ageMs = Date.now() - ts.getTime();
		if (ageMs > staleMinutes * 60 * 1000) return "invalid";

		const v = sensorInfo?.lastValue;
		if (typeof v !== "number" || Number.isNaN(v)) return "invalid";

		return v > 0 ? "used" : "free";
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

document.addEventListener('DOMContentLoaded', () => {
	console.log('Initializing Dashboard Manager...');
	window.dashboardManager = new DashboardManager();
});

window.DashboardManager = DashboardManager;