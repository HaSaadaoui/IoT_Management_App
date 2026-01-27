/**
 * Occupancy Analytics - Daily View with Pagination
 * Displays day-by-day occupancy data (excluding weekends) with 5 days per page
 */

class DailyOccupancyAnalytics {
    constructor(sectionType) {
        this.sectionType = sectionType;
        this.data = null;
        this.currentPage = 0;
        this.daysPerPage = 5;
        this.chart = null;
        
        this.initializeElements();
        this.initializePagination();
    }
    
    initializeElements() {
        // Stats elements
        this.globalRateEl = document.getElementById(`${this.sectionType}-global-rate`);
        this.globalPeriodEl = document.getElementById(`${this.sectionType}-global-period`);
        this.totalSensorsEl = document.getElementById(`${this.sectionType}-total-sensors`);
        
        // Table elements
        this.tableHead = document.getElementById(`${this.sectionType}-table-head`);
        this.tbody = document.getElementById(`${this.sectionType}-analytics-tbody`);
        
        // Chart
        this.chartCanvas = document.getElementById(`${this.sectionType}-chart-overall`);
    }
    
    initializePagination() {
        this.prevBtn = document.getElementById(`${this.sectionType}-prev-btn`);
        this.nextBtn = document.getElementById(`${this.sectionType}-next-btn`);
        this.pageInfo = document.getElementById(`${this.sectionType}-page-info`);
        
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.previousPage());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextPage());
        }
    }
    
    async loadData(startDate, endDate) {
        try {
            console.log(`📊 Loading daily occupancy for ${this.sectionType}: ${startDate} to ${endDate}`);
            
            const response = await fetch(
                `/api/analytics/occupancy-daily/${this.sectionType}?startDate=${startDate}&endDate=${endDate}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.data = await response.json();
            console.log(`✅ Loaded ${this.data.sensorStats.length} sensors, ${this.data.dateRange.length} working days`);
            
            this.currentPage = 0;
            this.updateGlobalStats();
            this.renderTable();
            this.updatePaginationControls();
            this.renderChart();
            
        } catch (error) {
            console.error(`❌ Error loading ${this.sectionType} analytics:`, error);
            this.showError();
        }
    }
    
    updateGlobalStats() {
        if (!this.data) return;
        
        const rate = this.data.globalOccupancyRate;
        const rateStr = rate.toFixed(2);
        const startDate = this.data.dateRange[0];
        const endDate = this.data.dateRange[this.data.dateRange.length - 1];
        
        if (this.globalRateEl) {
            this.globalRateEl.textContent = `${rateStr}%`;
            
            // Apply color coding based on rate
            const color = this.getRateColor(rate);
            this.globalRateEl.style.background = 'none';
            this.globalRateEl.style.webkitBackgroundClip = 'unset';
            this.globalRateEl.style.webkitTextFillColor = 'unset';
            this.globalRateEl.style.color = color;
        }
        if (this.globalPeriodEl) {
            this.globalPeriodEl.textContent = `${startDate} → ${endDate}`;
        }
        if (this.totalSensorsEl) {
            // Nombre de Capteurs est DYNAMIQUE - vient de l'API
            this.totalSensorsEl.textContent = this.data.totalSensors;
        }
        
        // Calculate performance distribution (NEW)
        this.updatePerformanceDistribution();
    }
    
    updatePerformanceDistribution() {
        if (!this.data || !this.data.sensorStats) return;
        
        let excellent = 0;  // >= 70%
        let good = 0;       // 30-69%
        let poor = 0;       // < 30%
        
        // Count sensors by performance level using overall occupancy rate
        this.data.sensorStats.forEach(sensor => {
            const rate = sensor.overallOccupancyRate;
            if (rate >= 70) {
                excellent++;
            } else if (rate >= 30) {
                good++;
            } else {
                poor++;
            }
        });
        
        // Update UI elements
        const perfExcellentEl = document.getElementById(`${this.sectionType}-perf-excellent`);
        const perfGoodEl = document.getElementById(`${this.sectionType}-perf-good`);
        const perfPoorEl = document.getElementById(`${this.sectionType}-perf-poor`);
        
        if (perfExcellentEl) perfExcellentEl.textContent = excellent;
        if (perfGoodEl) perfGoodEl.textContent = good;
        if (perfPoorEl) perfPoorEl.textContent = poor;
    }
    
    renderTable() {
        if (!this.data || !this.tbody || !this.tableHead) return;
        
        const workingDays = this.data.dateRange;
        const startIdx = this.currentPage * this.daysPerPage;
        const endIdx = Math.min(startIdx + this.daysPerPage, workingDays.length);
        const visibleDays = workingDays.slice(startIdx, endIdx);
        
        // Build table header with modern styling
        let headerHtml = '<tr><th>Sensor</th>';
        
        visibleDays.forEach(date => {
            const dateObj = new Date(date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            
            headerHtml += `
                <th colspan="2" style="text-align: center;">
                    📅 ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}. ${dateStr}
                </th>
            `;
        });
        headerHtml += '</tr><tr><th></th>';
        
        visibleDays.forEach(() => {
            headerHtml += `
                <th>Intervals</th>
                <th>Rate (%)</th>
            `;
        });
        headerHtml += '</tr>';
        
        this.tableHead.innerHTML = headerHtml;
        
        // Build table body with color-coded rates
        this.tbody.innerHTML = '';
        
        this.data.sensorStats.forEach(sensor => {
            const row = document.createElement('tr');
            
            // Sensor name (sticky column)
            const sensorCell = document.createElement('td');
            sensorCell.textContent = sensor.sensorName;
            row.appendChild(sensorCell);
            
            // Data for each visible day
            visibleDays.forEach(date => {
                const dayData = sensor.dailyData.find(d => d.date === date);
                
                // Intervals cell
                const intervalCell = document.createElement('td');
                intervalCell.className = 'interval-info';
                
                // Rate cell
                const rateCell = document.createElement('td');
                
                if (dayData && dayData.totalIntervals > 0) {
                    const rate = dayData.occupancyRate;
                    const rateStr = rate.toFixed(1);
                    const intervals = `${dayData.occupiedIntervals}/${dayData.totalIntervals}`;
                    
                    intervalCell.textContent = intervals;
                    rateCell.textContent = `${rateStr}%`;
                    
                    // Apply color class based on rate
                    if (rate >= 70) {
                        rateCell.style.color = '#10b981';
                        rateCell.className = 'rate-excellent';
                    } else if (rate >= 30) {
                        rateCell.style.color = '#f59e0b';
                        rateCell.className = 'rate-good';
                    } else {
                        rateCell.style.color = '#ef4444';
                        rateCell.className = 'rate-poor';
                    }
                } else {
                    intervalCell.textContent = '0/0';
                    rateCell.textContent = '0.0%';
                    rateCell.style.color = '#9ca3af';
                }
                
                row.appendChild(intervalCell);
                row.appendChild(rateCell);
            });
            
            this.tbody.appendChild(row);
        });
    }
    
    renderChart() {
        if (!this.data || !this.chartCanvas) return;
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }
        
        const ctx = this.chartCanvas.getContext('2d');
        
        // Prepare data: overall occupancy rate per sensor
        const labels = this.data.sensorStats.map(s => s.sensorName);
        const rates = this.data.sensorStats.map(s => s.overallOccupancyRate);
        const colors = rates.map(r => this.getRateColor(r));
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Taux d\'Occupation Moyen (%)',
                    data: rates,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: `Occupancy Rate per Sensor (Full Period)`,
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `Rate: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Rate (%)'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }
    
    updatePaginationControls() {
        if (!this.data) return;
        
        const totalDays = this.data.dateRange.length;
        const totalPages = Math.ceil(totalDays / this.daysPerPage);
        
        if (this.pageInfo) {
            this.pageInfo.textContent = `Page ${this.currentPage + 1}/${totalPages} (${totalDays} working days)`;
        }
        
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentPage === 0;
        }
        
        if (this.nextBtn) {
            this.nextBtn.disabled = this.currentPage >= totalPages - 1;
        }
    }
    
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderTable();
            this.updatePaginationControls();
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.data.dateRange.length / this.daysPerPage);
        if (this.currentPage < totalPages - 1) {
            this.currentPage++;
            this.renderTable();
            this.updatePaginationControls();
        }
    }
    
    getRateColor(rate) {
        if (rate >= 70) return '#10b981'; // Green
        if (rate >= 30) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    }
    
    showError() {
        if (this.tbody) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; color: #ef4444; padding: 2rem;">
                        ❌ Erreur lors du chargement des données
                    </td>
                </tr>
            `;
        }
    }
    
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Global manager
class OccupancyAnalyticsManager {
    constructor() {
        this.sections = {
            desk: new DailyOccupancyAnalytics('desk'),
            meeting: new DailyOccupancyAnalytics('meeting'),
            phone: new DailyOccupancyAnalytics('phone'),
            interview: new DailyOccupancyAnalytics('interview')
        };
        
        console.log('📊 Daily Occupancy Analytics Manager initialized');
    }
    
    loadAllSections() {
        const startDateEl = document.getElementById('hist-from');
        const endDateEl = document.getElementById('hist-to');
        
        if (!startDateEl || !endDateEl) {
            console.error('❌ Date inputs not found');
            return;
        }
        
        let startDate = startDateEl.value;
        let endDate = endDateEl.value;
        
        if (!startDate || !endDate) {
            alert('Veuillez sélectionner une période (dates de début et de fin)');
            return;
        }
        
        // Extract date only (YYYY-MM-DD) from datetime-local input
        if (startDate.includes('T')) {
            startDate = startDate.split('T')[0];
        }
        if (endDate.includes('T')) {
            endDate = endDate.split('T')[0];
        }
        
        console.log(`🔄 Loading all sections: ${startDate} → ${endDate}`);
        
        Object.values(this.sections).forEach(section => {
            section.loadData(startDate, endDate);
        });
    }
    
    destroy() {
        Object.values(this.sections).forEach(section => section.destroy());
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Daily Occupancy Analytics: DOM Ready ===');
    window.analyticsManager = new OccupancyAnalyticsManager();
    console.log('💡 Ready: Select date range and click "Load Data"');
});
