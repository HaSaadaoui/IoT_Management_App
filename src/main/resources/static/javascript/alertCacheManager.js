// ===== ALERT CACHE MANAGER =====
// Real-time alert caching system with local filtering
// Synchronized with 2D Plan system patterns

(function() {
    'use strict';

    // Singleton guard
    if (typeof window === 'undefined') return;
    if (window.AlertCacheManager) return;

    // ===============================
    // INTERNAL STATE
    // ===============================
    
    const state = {
        // All alerts from backend (unfiltered)
        allAlerts: [],
        
        // Indexed by building for O(1) lookup
        alertsByBuilding: new Map(),
        
        // Indexed by sensorType for fast filtering
        alertsBySensorType: new Map(),
        
        // Current filters
        filters: {
            building: null,
            floor: null,
            sensorType: null
        },
        
        // SSE connection
        eventSource: null,
        
        // Listeners for alert updates
        listeners: new Set(),
        
        // Cache metadata
        lastFetchTime: null,
        isInitialized: false,
        
        // TTL for cache refresh (5 minutes)
        cacheTTL: 5 * 60 * 1000,
        
        // Background refresh interval
        refreshInterval: null
    };

    // ===============================
    // INDEXING FUNCTIONS
    // ===============================
    
    function buildIndexes(alerts) {
        state.alertsByBuilding.clear();
        state.alertsBySensorType.clear();
        
        alerts.forEach(alert => {
            // Index by building
            const building = extractBuildingFromAlert(alert);
            if (!state.alertsByBuilding.has(building)) {
                state.alertsByBuilding.set(building, []);
            }
            state.alertsByBuilding.get(building).push(alert);
            
            // Index by sensor type
            const sensorType = extractSensorTypeFromAlert(alert);
            if (!state.alertsBySensorType.has(sensorType)) {
                state.alertsBySensorType.set(sensorType, []);
            }
            state.alertsBySensorType.get(sensorType).push(alert);
        });
        
        console.log('📊 [AlertCache] Indexes built:', {
            buildings: Array.from(state.alertsByBuilding.keys()),
            sensorTypes: Array.from(state.alertsBySensorType.keys()),
            totalAlerts: alerts.length
        });
    }
    
    function extractBuildingFromAlert(alert) {
        // Extract building from alert message or title
        const msg = (alert.message || '').toLowerCase();
        const title = (alert.title || '').toLowerCase();
        const combined = msg + ' ' + title;
        
        if (combined.includes('châteaudun') || combined.includes('chateaudun')) {
            return 'CHATEAUDUN';
        }
        if (combined.includes('levallois')) {
            return 'LEVALLOIS';
        }
        if (combined.includes('lille')) {
            return 'LILLE';
        }
        
        // Default: extract from sensor ID patterns
        if (alert.sensorId) {
            const id = alert.sensorId.toUpperCase();
            if (id.includes('CHT') || id.includes('CHAT')) return 'CHATEAUDUN';
            if (id.includes('LEV')) return 'LEVALLOIS';
            if (id.includes('LIL')) return 'LILLE';
        }
        
        return 'ALL'; // Unknown building
    }
    
    function extractSensorTypeFromAlert(alert) {
        const title = (alert.title || '').toLowerCase();
        const msg = (alert.message || '').toLowerCase();
        
        if (title.includes('co2') || msg.includes('ppm')) return 'CO2';
        if (title.includes('temperature') || msg.includes('°c')) return 'TEMP';
        if (title.includes('humidity') || msg.includes('%')) return 'HUMIDITY';
        if (title.includes('noise') || msg.includes('db')) return 'NOISE';
        if (title.includes('offline') || title.includes('sensor')) return 'OFFLINE';
        if (title.includes('gateway')) return 'GATEWAY';
        
        return 'OTHER';
    }

    // ===============================
    // FILTERING FUNCTIONS (LOCAL - NO API CALL)
    // ===============================
    
    function filterAlerts(alerts, filters) {
        let filtered = [...alerts];
        
        // Filter by building
        if (filters.building && filters.building !== 'all' && filters.building !== '') {
            const buildingKey = filters.building.toUpperCase();
            filtered = filtered.filter(alert => {
                const alertBuilding = extractBuildingFromAlert(alert);
                return alertBuilding === 'ALL' || alertBuilding === buildingKey;
            });
        }
        
        // Filter by floor (if alert has floor info)
        if (filters.floor && filters.floor !== 'all' && filters.floor !== '') {
            filtered = filtered.filter(alert => {
                // Check if alert contains floor info
                const msg = (alert.message || '').toLowerCase();
                const floorStr = String(filters.floor);
                return !msg.includes('floor') || msg.includes(`floor ${floorStr}`) || msg.includes(`f${floorStr}`);
            });
        }
        
        // Filter by sensor type
        if (filters.sensorType && filters.sensorType !== 'all' && filters.sensorType !== '') {
            const typeKey = filters.sensorType.toUpperCase();
            filtered = filtered.filter(alert => {
                const alertType = extractSensorTypeFromAlert(alert);
                // Show OFFLINE alerts for all sensor types
                if (alertType === 'OFFLINE') return true;
                return alertType === typeKey || alertType === 'OTHER';
            });
        }
        
        return filtered;
    }
    
    function getFilteredAlerts() {
        return filterAlerts(state.allAlerts, state.filters);
    }

    // ===============================
    // FETCH & CACHE FUNCTIONS
    // ===============================
    
    async function fetchAllAlerts(building = '') {
        try {
            console.log('🔄 [AlertCache] Fetching alerts...');
            
            const params = new URLSearchParams();
            if (building && building !== 'all') {
                params.set('building', building);
            }
            
            const url = `/api/alerts${params.toString() ? '?' + params.toString() : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch alerts: ${response.status}`);
            }
            
            const alerts = await response.json();
            
            // Update cache
            state.allAlerts = Array.isArray(alerts) ? alerts : [];
            state.lastFetchTime = Date.now();
            state.isInitialized = true;
            
            // Build indexes for fast filtering
            buildIndexes(state.allAlerts);
            
            console.log(`✅ [AlertCache] Cached ${state.allAlerts.length} alerts`);
            
            // Notify listeners
            notifyListeners();
            
            return state.allAlerts;
        } catch (error) {
            console.error('❌ [AlertCache] Fetch error:', error);
            return state.allAlerts; // Return cached data on error
        }
    }
    
    function isCacheStale() {
        if (!state.lastFetchTime) return true;
        return (Date.now() - state.lastFetchTime) > state.cacheTTL;
    }

    // ===============================
    // SSE REAL-TIME UPDATES
    // ===============================
    
    function startSSE(building = '') {
        stopSSE(); // Close existing connection
        
        const params = new URLSearchParams();
        if (building && building !== 'all') {
            params.set('building', building);
        }
        
        const url = `/api/alerts/stream${params.toString() ? '?' + params.toString() : ''}`;
        
        console.log('🔗 [AlertCache] Starting SSE:', url);
        
        state.eventSource = new EventSource(url);
        
        state.eventSource.addEventListener('alert', (event) => {
            try {
                const alert = JSON.parse(event.data);
                handleNewAlert(alert);
            } catch (e) {
                console.warn('[AlertCache] SSE parse error:', e);
            }
        });
        
        state.eventSource.addEventListener('alert_update', (event) => {
            try {
                const alerts = JSON.parse(event.data);
                handleAlertsUpdate(alerts);
            } catch (e) {
                console.warn('[AlertCache] SSE update parse error:', e);
            }
        });
        
        state.eventSource.addEventListener('keepalive', () => {
            // Heartbeat - connection is alive
        });
        
        state.eventSource.onopen = () => {
            console.log('✅ [AlertCache] SSE connected');
        };
        
        state.eventSource.onerror = (e) => {
            console.warn('⚠️ [AlertCache] SSE error, will retry...', e);
        };
    }
    
    function stopSSE() {
        if (state.eventSource) {
            console.log('🔒 [AlertCache] Closing SSE');
            state.eventSource.close();
            state.eventSource = null;
        }
    }
    
    function handleNewAlert(alert) {
        // Add to cache
        state.allAlerts.unshift(alert);
        
        // Update indexes
        const building = extractBuildingFromAlert(alert);
        if (!state.alertsByBuilding.has(building)) {
            state.alertsByBuilding.set(building, []);
        }
        state.alertsByBuilding.get(building).unshift(alert);
        
        const sensorType = extractSensorTypeFromAlert(alert);
        if (!state.alertsBySensorType.has(sensorType)) {
            state.alertsBySensorType.set(sensorType, []);
        }
        state.alertsBySensorType.get(sensorType).unshift(alert);
        
        console.log('🔔 [AlertCache] New alert:', alert.title);
        
        // Notify listeners
        notifyListeners();
    }
    
    function handleAlertsUpdate(alerts) {
        state.allAlerts = Array.isArray(alerts) ? alerts : [];
        buildIndexes(state.allAlerts);
        notifyListeners();
    }

    // ===============================
    // LISTENER MANAGEMENT
    // ===============================
    
    function subscribe(callback) {
        state.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            state.listeners.delete(callback);
        };
    }
    
    function notifyListeners() {
        const filtered = getFilteredAlerts();
        state.listeners.forEach(callback => {
            try {
                callback(filtered);
            } catch (e) {
                console.warn('[AlertCache] Listener error:', e);
            }
        });
    }

    // ===============================
    // FILTER MANAGEMENT
    // ===============================
    
    function setFilters(filters) {
        let changed = false;
        
        if (filters.building !== undefined && filters.building !== state.filters.building) {
            state.filters.building = filters.building;
            changed = true;
        }
        
        if (filters.floor !== undefined && filters.floor !== state.filters.floor) {
            state.filters.floor = filters.floor;
            changed = true;
        }
        
        if (filters.sensorType !== undefined && filters.sensorType !== state.filters.sensorType) {
            state.filters.sensorType = filters.sensorType;
            changed = true;
        }
        
        if (changed) {
            console.log('🔧 [AlertCache] Filters updated:', state.filters);
            // LOCAL filtering - no API call!
            notifyListeners();
        }
        
        return changed;
    }
    
    function getFilters() {
        return { ...state.filters };
    }

    // ===============================
    // BACKGROUND REFRESH
    // ===============================
    
    function startBackgroundRefresh(intervalMs = 120000) {
        stopBackgroundRefresh();
        
        state.refreshInterval = setInterval(async () => {
            if (isCacheStale()) {
                console.log('🔄 [AlertCache] Background refresh...');
                await fetchAllAlerts(state.filters.building);
            }
        }, intervalMs);
        
        console.log(`⏰ [AlertCache] Background refresh every ${intervalMs/1000}s`);
    }
    
    function stopBackgroundRefresh() {
        if (state.refreshInterval) {
            clearInterval(state.refreshInterval);
            state.refreshInterval = null;
        }
    }

    // ===============================
    // INITIALIZATION
    // ===============================
    
    async function init(options = {}) {
        const { building = '', useSSE = true, backgroundRefresh = true } = options;
        
        console.log('🚀 [AlertCache] Initializing...', options);
        
        // Initial fetch
        await fetchAllAlerts(building);
        
        // Start SSE for real-time updates
        if (useSSE) {
            startSSE(building);
        }
        
        // Start background refresh
        if (backgroundRefresh) {
            startBackgroundRefresh();
        }
        
        state.filters.building = building;
        
        return state.allAlerts;
    }
    
    function destroy() {
        stopSSE();
        stopBackgroundRefresh();
        state.listeners.clear();
        state.allAlerts = [];
        state.alertsByBuilding.clear();
        state.alertsBySensorType.clear();
        state.isInitialized = false;
        console.log('🔒 [AlertCache] Destroyed');
    }

    // ===============================
    // PUBLIC API
    // ===============================
    
    window.AlertCacheManager = {
        // Initialization
        init,
        destroy,
        
        // Get alerts (uses cache + local filtering)
        getAlerts: getFilteredAlerts,
        getAllAlerts: () => [...state.allAlerts],
        
        // Filter management (LOCAL - instant, no API call)
        setFilters,
        getFilters,
        
        // Manual refresh
        refresh: fetchAllAlerts,
        
        // Subscriptions for real-time updates
        subscribe,
        
        // SSE control
        startSSE,
        stopSSE,
        
        // State inspection
        isInitialized: () => state.isInitialized,
        isCacheStale,
        getCacheAge: () => state.lastFetchTime ? Date.now() - state.lastFetchTime : null,
        
        // Stats
        getStats: () => ({
            totalAlerts: state.allAlerts.length,
            buildings: Array.from(state.alertsByBuilding.keys()),
            sensorTypes: Array.from(state.alertsBySensorType.keys()),
            lastFetch: state.lastFetchTime,
            isStale: isCacheStale()
        })
    };
    
    console.log('✅ [AlertCacheManager] Loaded');
    
})();
