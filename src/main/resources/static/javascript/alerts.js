// ===== ALERTS & MONITORING DASHBOARD - JAVASCRIPT =====
// Note: Chart utilities and color constants are loaded from chartUtils.js

// Update last refresh time
function updateRefreshTime() {
    const now = new Date();
    const formatted = now.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('last-refresh-time').textContent = formatted;
}

// Building and Floor View Navigation
function showFloorPlan(floorNumber) {
    const buildingView = document.getElementById('building-view');
    const floorPlanView = document.getElementById('floor-plan-view');
    const floorTitle = document.getElementById('current-floor-title');
    
    // Hide building view, show floor plan
    buildingView.style.display = 'none';
    floorPlanView.style.display = 'block';
    
    // Update title
    const floorNames = {
        0: 'Ground Floor',
        1: 'Floor 1',
        2: 'Floor 2',
        3: 'Floor 3'
    };
    floorTitle.textContent = `${floorNames[floorNumber]} - Ceiling View`;
    
    // Load desk data for this floor (in production, fetch from API)
    loadFloorDesks(floorNumber);
}

function showBuildingView() {
    const buildingView = document.getElementById('building-view');
    const floorPlanView = document.getElementById('floor-plan-view');
    
    // Show building view, hide floor plan
    buildingView.style.display = 'flex';
    floorPlanView.style.display = 'none';
}

function loadFloorDesks(floorNumber) {
    const deskGrid = document.getElementById('desk-grid');

    // Use shared configuration for desk-sensor mapping
    const desks = window.DeskSensorConfig
        ? window.DeskSensorConfig.getFloorDesks(floorNumber, 'invalid')
        : [];
    
    // Clear and rebuild desk grid
    deskGrid.innerHTML = '';
    desks.forEach(desk => {
        const deskElement = document.createElement('div');
        deskElement.className = `desk ${desk.status}`;
        deskElement.setAttribute('data-desk', desk.id);
        deskElement.textContent = desk.id;
        deskElement.addEventListener('click', function() {
            alert(`Desk ${desk.id}\nStatus: ${desk.status}\n\nClick to view detailed information.`);
        });
        deskGrid.appendChild(deskElement);
    });
}

// Initialize charts using shared utility functions
function initCharts() {
    // Chart.js default options
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    Chart.defaults.color = '#64748b';

    // Initialize office/location charts using data-chart-index
    const chartData = [
        [57.14, 42, 0.86],  // index 0
        [75, 25, 0],        // index 1
        [66.67, 33.33, 0]   // index 2
    ];

    chartData.forEach((data, index) => {
        const statCard = document.querySelector(`.stat-card[data-chart-index="${index}"]`);
        if (statCard) {
            const chartElement = statCard.querySelector('.chart-office');
            if (chartElement) {
                // Use shared utility function
                window.ChartUtils.createDoughnutChart(chartElement, data);
            }
        }
    });

    // Initialize total chart using data-chart-type="total"
    const totalStatCard = document.querySelector('.stat-card[data-chart-type="total"]');
    if (totalStatCard) {
        const chartElement = totalStatCard.querySelector('#chart-total');
        if (chartElement) {
            // Use shared utility function
            window.ChartUtils.createDoughnutChart(chartElement, [63.64, 36.36, 0]);
        }
    }

    // Historical Bar Chart is now handled by dashboard.js
    // Removed to prevent conflicts with the real histogram implementation
    
    // Global Occupation Donut Chart
    // const ctxGlobal = document.getElementById('chart-global');
    // if (ctxGlobal) {
    //     new Chart(ctxGlobal, {
    //         type: 'doughnut',
    //         data: {
    //             labels: ['Occupied', 'Free'],
    //             datasets: [{
    //                 data: [32.93, 67.07],
    //                 backgroundColor: [usedColor, successColor],
    //                 borderWidth: 0,
    //                 hoverOffset: 10
    //             }]
    //         },
    //         options: {
    //             responsive: true,
    //             maintainAspectRatio: true,
    //             cutout: '75%',
    //             plugins: {
    //                 legend: {
    //                     display: false
    //                 },
    //                 tooltip: {
    //                     callbacks: {
    //                         label: function(context) {
    //                             return context.label + ': ' + context.parsed.toFixed(2) + '%';
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     });
    // }
    
    // Sensor Cost Line Chart
    // const ctxCost = document.getElementById('chart-sensor-cost');
    // if (ctxCost) {
    //     const costDates = [];
    //     const costData = [];
        
    //     // Generate realistic cost data for last 30 days
    //     const baselineCost = 28; // €28 baseline
    //     for (let i = 29; i >= 0; i--) {
    //         const date = new Date();
    //         date.setDate(date.getDate() - i);
    //         costDates.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
            
    //         // Add variation (±20%) to make it realistic
    //         const variation = (Math.random() - 0.5) * 2 * 0.2; // ±20%
    //         const dailyCost = baselineCost * (1 + variation);
    //         costData.push(parseFloat(dailyCost.toFixed(2)));
    //     }
        
    //     new Chart(ctxCost, {
    //         type: 'line',
    //         data: {
    //             labels: costDates,
    //             datasets: [{
    //                 label: 'Daily Cost',
    //                 data: costData,
    //                 borderColor: '#662179',
    //                 backgroundColor: 'rgba(102, 33, 121, 0.1)',
    //                 borderWidth: 3,
    //                 fill: true,
    //                 tension: 0.4,
    //                 pointRadius: 4,
    //                 pointHoverRadius: 6,
    //                 pointBackgroundColor: '#ffffff',
    //                 pointBorderColor: '#662179',
    //                 pointBorderWidth: 2,
    //                 pointHoverBackgroundColor: '#662179',
    //                 pointHoverBorderColor: '#ffffff',
    //                 pointHoverBorderWidth: 2
    //             }]
    //         },
    //         options: {
    //             responsive: true,
    //             maintainAspectRatio: false,
    //             interaction: {
    //                 mode: 'index',
    //                 intersect: false
    //             },
    //             scales: {
    //                 x: {
    //                     title: {
    //                         display: true,
    //                         text: 'Date (day)',
    //                         color: '#64748b',
    //                         font: {
    //                             size: 14,
    //                             weight: '600'
    //                         },
    //                         padding: { top: 10 }
    //                     },
    //                     grid: {
    //                         display: false
    //                     },
    //                     ticks: {
    //                         maxRotation: 0,
    //                         minRotation: 0,
    //                         autoSkip: true,
    //                         maxTicksLimit: 10,
    //                         color: '#64748b',
    //                         font: {
    //                             size: 14
    //                         }
    //                     }
    //                 },
    //                 y: {
    //                     title: {
    //                         display: true,
    //                         text: 'Cost (€)',
    //                         color: '#64748b',
    //                         font: {
    //                             size: 14,
    //                             weight: '600'
    //                         },
    //                         padding: { bottom: 10 }
    //                     },
    //                     beginAtZero: false,
    //                     min: 20,
    //                     max: 36,
    //                     ticks: {
    //                         stepSize: 2,
    //                         color: '#64748b',
    //                         font: {
    //                             size: 14
    //                         },
    //                         callback: function(value) {
    //                             return '€' + value;
    //                         }
    //                     },
    //                     grid: {
    //                         color: 'rgba(226, 232, 240, 0.5)',
    //                         drawBorder: false,
    //                         lineWidth: 1
    //                     }
    //                 }
    //             },
    //             plugins: {
    //                 legend: {
    //                     display: false
    //                 },
    //                 tooltip: {
    //                     backgroundColor: 'rgba(0, 0, 0, 0.8)',
    //                     titleColor: '#ffffff',
    //                     bodyColor: '#ffffff',
    //                     padding: 12,
    //                     borderColor: '#662179',
    //                     borderWidth: 1,
    //                     displayColors: false,
    //                     callbacks: {
    //                         title: function(context) {
    //                             return 'Date: ' + context[0].label;
    //                         },
    //                         label: function(context) {
    //                             return 'Cost: €' + context.parsed.y.toFixed(2);
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     });
    // }
}

// Desk click handler
function initDeskInteractions() {
    const desks = document.querySelectorAll('.desk');
    desks.forEach(desk => {
        desk.addEventListener('click', function() {
            const deskId = this.getAttribute('data-desk');
            const status = this.classList.contains('free') ? 'Free' : 
                          this.classList.contains('used') ? 'Used' : 'Invalid';
            
            // Show desk info (could be a modal in production)
            alert(`Desk ${deskId}\nStatus: ${status}\n\nClick to view detailed information.`);
        });
    });
}

// Update page titles based on sensor type
function updatePageTitles(sensorType) {
    const sensorInfo = {
        'DESK': {
            icon: '📊',
            name: 'Occupancy',
            liveTitle: 'Live Occupancy',
            historicalTitle: 'Historical Occupancy Data',
            chartTitle: 'Occupation Rate (08:00 - 19:00)',
            globalTitle: 'Global Occupation'
        },
        'CO2': {
            icon: '🌫️',
            name: 'CO₂ Air Quality',
            liveTitle: 'Live CO₂ Monitoring',
            historicalTitle: 'Historical CO₂ Data',
            chartTitle: 'CO₂ Levels Trend (08:00 - 19:00)',
            globalTitle: 'Average CO₂ Level'
        },
        'TEMP': {
            icon: '🌡️',
            name: 'Temperature',
            liveTitle: 'Live Temperature Monitoring',
            historicalTitle: 'Historical Temperature Data',
            chartTitle: 'Temperature Trends (08:00 - 19:00)',
            globalTitle: 'Average Temperature'
        },
        'LIGHT': {
            icon: '💡',
            name: 'Light Levels',
            liveTitle: 'Live Light Monitoring',
            historicalTitle: 'Historical Light Data',
            chartTitle: 'Light Levels Trend (08:00 - 19:00)',
            globalTitle: 'Average Light Level'
        },
        'MOTION': {
            icon: '👁️',
            name: 'Motion Detection',
            liveTitle: 'Live Motion Monitoring',
            historicalTitle: 'Historical Motion Data',
            chartTitle: 'Motion Activity (08:00 - 19:00)',
            globalTitle: 'Motion Detection Rate'
        },
        'NOISE': {
            icon: '🔉',
            name: 'Noise Levels',
            liveTitle: 'Live Noise Monitoring',
            historicalTitle: 'Historical Noise Data',
            chartTitle: 'Noise Levels Trend (08:00 - 19:00)',
            globalTitle: 'Average Noise Level'
        },
        'HUMIDITY': {
            icon: '💧',
            name: 'Humidity',
            liveTitle: 'Live Humidity Monitoring',
            historicalTitle: 'Historical Humidity Data',
            chartTitle: 'Humidity Trends (08:00 - 19:00)',
            globalTitle: 'Average Humidity'
        },
        'TEMPEX': {
            icon: '🌀',
            name: 'HVAC Flow',
            liveTitle: 'Live HVAC Monitoring',
            historicalTitle: 'Historical HVAC Data',
            chartTitle: 'HVAC Performance (08:00 - 19:00)',
            globalTitle: 'System Efficiency'
        },
        'PR': {
            icon: '👤',
            name: 'Presence & Light',
            liveTitle: 'Live Presence Monitoring',
            historicalTitle: 'Historical Presence Data',
            chartTitle: 'Presence Activity (08:00 - 19:00)',
            globalTitle: 'Presence Rate'
        },
        'SECURITY': {
            icon: '🚨',
            name: 'Security Alerts',
            liveTitle: 'Live Security Monitoring',
            historicalTitle: 'Historical Security Data',
            chartTitle: 'Security Events (08:00 - 19:00)',
            globalTitle: 'Alert Summary'
        }
    };
    
    const info = sensorInfo[sensorType] || sensorInfo['DESK'];
    
    // Update section titles
    const liveTitle = document.getElementById('live-section-title');
    if (liveTitle) {
        liveTitle.textContent = `${info.icon} ${info.liveTitle} - Châteaudun Office`;
    }
    
    const historicalTitle = document.getElementById('historical-section-title');
    if (historicalTitle) {
        historicalTitle.textContent = `📈 ${info.historicalTitle} - Châteaudun Office`;
    }
    
    const chartTitle = document.getElementById('historical-chart-title');
    if (chartTitle) {
        chartTitle.textContent = info.chartTitle;
    }
    
    const globalTitle = document.getElementById('global-chart-title');
    if (globalTitle) {
        globalTitle.textContent = info.globalTitle;
    }
}

// Filter change handlers
function initFilters() {
    const filters = ['year', 'month', 'building', 'floor', 'sensor-type', 'time'];
    
    filters.forEach(filterId => {
        const element = document.getElementById(`filter-${filterId}`);
        if (element) {
            element.addEventListener('change', function() {
                console.log(`Filter ${filterId} changed to:`, this.value);
                
                // Handle sensor type filter change
                if (filterId === 'sensor-type') {
                    updatePageTitles(this.value);
                    if (window.building3D) {
                        window.building3D.setSensorMode(this.value);
                    }
                }
                
                updateRefreshTime();
                // In production, this would trigger data refresh
                // refreshDashboardData();
            });
        }
    });
}

// Simulate real-time updates
function simulateRealTimeUpdates() {
    setInterval(() => {
        // Randomly update desk statuses
        const desks = document.querySelectorAll('.desk');
        const randomDesk = desks[Math.floor(Math.random() * desks.length)];
        
        if (randomDesk) {
            const statuses = ['free', 'used', 'invalid'];
            const currentStatus = statuses.find(s => randomDesk.classList.contains(s));
            const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            if (currentStatus !== newStatus) {
                randomDesk.classList.remove(currentStatus);
                randomDesk.classList.add(newStatus);
            }
        }
        
        updateRefreshTime();
    }, 10000); // Update every 10 seconds
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Alerts Dashboard initialized');
    
    updateRefreshTime();
    initCharts();
    initDeskInteractions();
    initFilters();
    
    // Uncomment to enable real-time simulation
    // simulateRealTimeUpdates();
    
    // Auto-refresh time every minute
    setInterval(updateRefreshTime, 60000);
});

// Export functions for external use
window.AlertsDashboard = {
    updateRefreshTime,
    initCharts,
    initDeskInteractions,
    initFilters
};
