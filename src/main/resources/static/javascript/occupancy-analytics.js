/**
 * Occupancy Analytics Module
 * Handles data loading and visualization for 4 sections:
 * - Desk-Bureau-Standard (90 sensors)
 * - Salle de Réunion (3 sensors)
 * - Phone Booth (7 sensors)
 * - Interview Room (2 sensors)
 */

class OccupancyAnalytics {
    constructor() {
        this.charts = {
            desk: null,
            meeting: null,
            phone: null,
            interview: null
        };
        this.refreshInterval = null;
    }

    /**
     * Initialize analytics
     */
    init() {
        console.log('=== Initializing Occupancy Analytics ===');
        this.loadAllSections();
        
        // Auto-refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadAllSections();
        }, 5 * 60 * 1000);
    }

    /**
     * Load data for all sections
     */
    async loadAllSections() {
        await Promise.all([
            this.loadSection('desk'),
            this.loadSection('meeting'),
            this.loadSection('phone'),
            this.loadSection('interview')
        ]);
    }

    /**
     * Load data for a specific section
     */
    async loadSection(sectionType) {
        console.log(`🔄 Loading analytics for section: ${sectionType}`);
        
        // Show loading state
        this.showLoading(sectionType);
        
        // Get date filters if available
        const startDateInput = document.getElementById('hist-from');
        const endDateInput = document.getElementById('hist-to');
        
        let url = `/api/analytics/occupancy/${sectionType}`;
        
        // Add date parameters if available
        if (startDateInput?.value && endDateInput?.value) {
            const params = new URLSearchParams({
                startDate: startDateInput.value,
                endDate: endDateInput.value
            });
            url += `?${params.toString()}`;
        }
        
        console.log(`📡 Fetching: ${url}`);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(180000) // 180 second timeout (3 minutes) for large sections
            });
            
            console.log(`📥 Response status for ${sectionType}: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ ${sectionType} data loaded:`, data);
            
            // Update global stats
            this.updateGlobalStats(sectionType, data.globalStats);
            
            // Update table
            this.updateTable(sectionType, data.sensorStats);
            
            // Update chart
            this.updateChart(sectionType, data.sensorStats);
            
        } catch (error) {
            console.error(`❌ Error loading ${sectionType} analytics:`, error);
            this.showError(sectionType);
        }
    }

    /**
     * Update global statistics cards
     */
    updateGlobalStats(sectionType, stats) {
        const dailyEl = document.getElementById(`${sectionType}-global-daily`);
        const weeklyEl = document.getElementById(`${sectionType}-global-weekly`);
        const monthlyEl = document.getElementById(`${sectionType}-global-monthly`);
        
        if (dailyEl) {
            dailyEl.textContent = `${stats.dailyOccupancyRate.toFixed(2)}%`;
            dailyEl.style.color = this.getRateColor(stats.dailyOccupancyRate);
        }
        
        if (weeklyEl) {
            weeklyEl.textContent = `${stats.weeklyOccupancyRate.toFixed(2)}%`;
            weeklyEl.style.color = this.getRateColor(stats.weeklyOccupancyRate);
        }
        
        if (monthlyEl) {
            monthlyEl.textContent = `${stats.monthlyOccupancyRate.toFixed(2)}%`;
            monthlyEl.style.color = this.getRateColor(stats.monthlyOccupancyRate);
        }
    }

    /**
     * Update data table
     */
    updateTable(sectionType, sensorStats) {
        const tbody = document.getElementById(`${sectionType}-analytics-tbody`);
        
        if (!tbody) {
            console.warn(`Table body not found for ${sectionType}`);
            return;
        }
        
        // Clear existing rows
        tbody.innerHTML = '';
        
        // Add rows for each sensor
        sensorStats.forEach(sensor => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${sensor.sensorName}</strong></td>
                <td>${this.formatRate(sensor.dailyOccupancyRate)}</td>
                <td class="interval-info">${sensor.dailyOccupiedIntervals}/${sensor.dailyTotalIntervals}</td>
                <td>${this.formatRate(sensor.weeklyOccupancyRate)}</td>
                <td class="interval-info">${sensor.weeklyOccupiedIntervals}/${sensor.weeklyTotalIntervals}</td>
                <td>${this.formatRate(sensor.monthlyOccupancyRate)}</td>
                <td class="interval-info">${sensor.monthlyOccupiedIntervals}/${sensor.monthlyTotalIntervals}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    /**
     * Update chart visualization
     */
    updateChart(sectionType, sensorStats) {
        const canvasId = `chart-${sectionType}-analytics`;
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.warn(`Canvas not found: ${canvasId}`);
            return;
        }
        
        // Destroy existing chart
        if (this.charts[sectionType]) {
            this.charts[sectionType].destroy();
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare data
        const labels = sensorStats.map(s => s.sensorName);
        const dailyData = sensorStats.map(s => s.dailyOccupancyRate);
        const weeklyData = sensorStats.map(s => s.weeklyOccupancyRate);
        const monthlyData = sensorStats.map(s => s.monthlyOccupancyRate);
        
        // Create chart
        this.charts[sectionType] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Aujourd\'hui',
                        data: dailyData,
                        backgroundColor: 'rgba(139, 92, 246, 0.7)',
                        borderColor: 'rgba(139, 92, 246, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Cette Semaine',
                        data: weeklyData,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Ce Mois',
                        data: monthlyData,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Taux d'Occupation (%) - ${this.getSectionTitle(sectionType)}`,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Taux d\'Occupation (%)'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                }
            }
        });
    }

    /**
     * Format occupancy rate with color coding
     */
    formatRate(rate) {
        const rateClass = this.getRateClass(rate);
        return `<span class="rate-cell ${rateClass}">${rate.toFixed(2)}%</span>`;
    }

    /**
     * Get rate class for color coding
     */
    getRateClass(rate) {
        if (rate >= 70) return 'rate-high';
        if (rate >= 40) return 'rate-medium';
        return 'rate-low';
    }

    /**
     * Get rate color
     */
    getRateColor(rate) {
        if (rate >= 70) return '#166534'; // Green
        if (rate >= 40) return '#92400e'; // Orange
        return '#991b1b'; // Red
    }

    /**
     * Get section display title
     */
    getSectionTitle(sectionType) {
        const titles = {
            desk: 'Desk-Bureau-Standard',
            meeting: 'Salle de Réunion',
            phone: 'Phone Booth',
            interview: 'Interview Room'
        };
        return titles[sectionType] || sectionType;
    }

    /**
     * Show loading state
     */
    showLoading(sectionType) {
        const tbody = document.getElementById(`${sectionType}-analytics-tbody`);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <div class="analytics-loading">⏳ Chargement en cours...</div>
                    </td>
                </tr>
            `;
        }
        
        // Update global stats to show loading
        ['daily', 'weekly', 'monthly'].forEach(period => {
            const el = document.getElementById(`${sectionType}-global-${period}`);
            if (el) {
                el.textContent = '...';
                el.style.color = '#6b7280';
            }
        });
    }

    /**
     * Show error message
     */
    showError(sectionType) {
        const tbody = document.getElementById(`${sectionType}-analytics-tbody`);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">
                        ❌ Erreur lors du chargement des données. Veuillez réessayer.
                    </td>
                </tr>
            `;
        }
        
        // Update global stats to show error
        ['daily', 'weekly', 'monthly'].forEach(period => {
            const el = document.getElementById(`${sectionType}-global-${period}`);
            if (el) {
                el.textContent = 'N/A';
                el.style.color = '#ef4444';
            }
        });
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Occupancy Analytics: DOM Ready ===');
    window.analyticsManager = new OccupancyAnalytics();
    window.analyticsManager.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.analyticsManager) {
        window.analyticsManager.destroy();
    }
});
