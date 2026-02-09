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
        this.tfoot = document.getElementById(`${this.sectionType}-table-foot`);
        
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
        
        // Calculate low usage average (ONLY for desk section)
        if (this.sectionType === 'desk') {
            this.updateLowUsageAverage();
        }
    }
    
    updateLowUsageAverage() {
        // Only for desk section
        if (this.sectionType !== 'desk') return;
        
        if (!this.data || !this.data.sensorStats || !this.data.dateRange) return;
        
        // Calculate daily low usage counts for ALL days in the period
        const allDays = this.data.dateRange;
        let totalLowUsageCount = 0;
        
        allDays.forEach(date => {
            let dailyLowCount = 0;
            this.data.sensorStats.forEach(sensor => {
                const dayData = sensor.dailyData.find(d => d.date === date);
                if (dayData && dayData.totalIntervals > 0 && dayData.occupancyRate <= 12.5) {
                    dailyLowCount++;
                }
            });
            totalLowUsageCount += dailyLowCount;
        });
        
        const workingDays = allDays.length;
        
        const lowUsageAvgEl = document.getElementById('desk-low-usage-avg');
        if (lowUsageAvgEl) {
            if (workingDays > 0) {
                const avgDesksPerDay = totalLowUsageCount / workingDays;
                lowUsageAvgEl.innerHTML = `${avgDesksPerDay.toFixed(1)} <span style="font-size: 1.2rem; color: #dc2626; font-weight: 600;">desks/day</span>`;
                lowUsageAvgEl.style.color = '#f59e0b';
            } else {
                lowUsageAvgEl.textContent = 'N/A';
                lowUsageAvgEl.style.color = '#9ca3af';
            }
        }
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
            visibleDays.forEach((date, dayIndex) => {
                const dayData = sensor.dailyData.find(d => d.date === date);
                
                // Intervals cell
                const intervalCell = document.createElement('td');
                intervalCell.className = 'interval-info';
                if (dayIndex > 0) {
                    intervalCell.style.borderLeft = '2px solid #d1d5db';
                }
                
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
        
        // Add summary row to tfoot: Low Usage Count per day (ONLY for desk section)
        if (this.sectionType === 'desk') {
            this.addLowUsageCountRow(visibleDays);
        }
    }
    
    addLowUsageCountRow(visibleDays) {
        if (!this.tfoot) return;
        
        const summaryRow = document.createElement('tr');
        summaryRow.style.background = 'linear-gradient(135deg, #ede9fe, #ddd6fe)';
        summaryRow.style.fontWeight = '600';
        summaryRow.style.borderTop = '3px solid #8b5cf6';
        summaryRow.style.height = '28px';
        
        const labelCell = document.createElement('td');
        labelCell.textContent = '⚠️ Low Usage Count (≤12.5%)';
        labelCell.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
        labelCell.style.color = 'white';
        labelCell.style.padding = '4px 8px';
        labelCell.style.fontSize = '0.85rem';
        labelCell.style.lineHeight = '1';
        labelCell.style.height = '28px';
        labelCell.style.position = 'sticky';
        labelCell.style.left = '0';
        labelCell.style.zIndex = '2';
        summaryRow.appendChild(labelCell);
        
        visibleDays.forEach((date, index) => {
            let lowCount = 0;
            this.data.sensorStats.forEach(sensor => {
                const dayData = sensor.dailyData.find(d => d.date === date);
                if (dayData && dayData.totalIntervals > 0 && dayData.occupancyRate <= 12.5) {
                    lowCount++;
                }
            });
            
            const cell = document.createElement('td');
            cell.colSpan = 2;
            cell.style.textAlign = 'center';
            cell.style.fontSize = '0.9rem';
            cell.style.color = lowCount > 0 ? '#dc2626' : '#10b981';
            cell.style.fontWeight = 'bold';
            cell.style.borderLeft = index > 0 ? '2px solid #d1d5db' : 'none';
            cell.style.borderRight = index < visibleDays.length - 1 ? '2px solid #d1d5db' : 'none';
            cell.style.padding = '4px';
            cell.style.lineHeight = '1';
            cell.style.height = '28px';
            cell.textContent = lowCount;
            summaryRow.appendChild(cell);
        });
        
        this.tfoot.innerHTML = '';
        this.tfoot.appendChild(summaryRow);
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
    
    async loadAllSections() {
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
        
        // Load all sections in parallel and wait for all to complete
        const loadPromises = Object.values(this.sections).map(section => 
            section.loadData(startDate, endDate)
        );
        
        await Promise.all(loadPromises);
        console.log('✅ All 4 sections loaded successfully');
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
