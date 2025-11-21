// ===== ALERTS & MONITORING DASHBOARD - JAVASCRIPT =====

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
    
    // Sample desk configurations for each floor
    const floorDesks = {
        0: [
            { id: 'D1', status: 'free' },
            { id: 'D2', status: 'used' },
            { id: 'D3', status: 'free' },
            { id: 'D4', status: 'free' },
            { id: 'D5', status: 'used' },
            { id: 'D6', status: 'free' },
            { id: 'D7', status: 'free' },
            { id: 'D8', status: 'used' }
        ],
        1: [
            { id: 'D1', status: 'free' },
            { id: 'D2', status: 'used' },
            { id: 'D3', status: 'free' },
            { id: 'D4', status: 'invalid' },
            { id: 'D5', status: 'free' },
            { id: 'D6', status: 'used' },
            { id: 'D7', status: 'free' },
            { id: 'D8', status: 'free' },
            { id: 'D9', status: 'used' },
            { id: 'D10', status: 'free' },
            { id: 'D11', status: 'used' },
            { id: 'D12', status: 'free' }
        ],
        2: [
            { id: 'D1', status: 'free' },
            { id: 'D2', status: 'free' },
            { id: 'D3', status: 'used' },
            { id: 'D4', status: 'free' },
            { id: 'D5', status: 'used' },
            { id: 'D6', status: 'free' },
            { id: 'D7', status: 'free' },
            { id: 'D8', status: 'used' },
            { id: 'D9', status: 'free' },
            { id: 'D10', status: 'used' },
            { id: 'D11', status: 'free' },
            { id: 'D12', status: 'free' },
            { id: 'D13', status: 'used' },
            { id: 'D14', status: 'free' },
            { id: 'D15', status: 'free' },
            { id: 'D16', status: 'used' }
        ],
        3: [
            { id: 'D1', status: 'free' },
            { id: 'D2', status: 'free' },
            { id: 'D3', status: 'free' },
            { id: 'D4', status: 'used' },
            { id: 'D5', status: 'free' },
            { id: 'D6', status: 'free' },
            { id: 'D7', status: 'used' },
            { id: 'D8', status: 'free' },
            { id: 'D9', status: 'free' },
            { id: 'D10', status: 'used' },
            { id: 'D11', status: 'free' },
            { id: 'D12', status: 'used' }
        ]
    };
    
    const desks = floorDesks[floorNumber] || floorDesks[1];
    
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

// Initialize charts
function initCharts() {
    // Chart.js default options
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    Chart.defaults.color = '#64748b';
    
    // Office 1 Donut Chart
    const ctx1 = document.getElementById('chart-office-1');
    if (ctx1) {
        new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [57.14, 42, 0.86],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Office 2 Donut Chart
    const ctx2 = document.getElementById('chart-office-2');
    if (ctx2) {
        new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [75, 25, 0],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // Meeting Room A Donut chart
    const ctxMeetingA = document.getElementById('chart-meeting-a');
    if (ctxMeetingA) {
        new Chart(ctxMeetingA, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [66.67, 33.33, 0],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Meeting Room B Donut chart
    const ctxMeetingB = document.getElementById('chart-meeting-b');
    if (ctxMeetingB) {
        new Chart(ctxMeetingB, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [50, 45, 5],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Meeting Room C Donut chart
    const ctxMeetingC = document.getElementById('chart-meeting-c');
    if (ctxMeetingC) {
        new Chart(ctxMeetingC, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [80, 20, 0],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Total Occupancy Donut Chart
    const ctx3 = document.getElementById('chart-total');
    if (ctx3) {
        new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: ['Free', 'Used', 'Invalid'],
                datasets: [{
                    data: [63.64, 36.36, 0],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Historical Bar Chart
    const ctxBar = document.getElementById('chart-historical-bar');
    if (ctxBar) {
        const dates = [];
        const usedData = [];
        const freeData = [];
        
        // Generate sample data for the last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
            
            // Random data for demonstration
            const used = Math.floor(Math.random() * 40) + 20;
            const free = 100 - used;
            usedData.push(used);
            freeData.push(free);
        }
        
        new Chart(ctxBar, {
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
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: { top: 10 }
                        },
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15,
                            color: '#64748b',
                            font: {
                                size: 10
                            }
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
                            padding: { bottom: 10 }
                        },
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)',
                            lineWidth: 1
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Global Occupation Donut Chart
    const ctxGlobal = document.getElementById('chart-global');
    if (ctxGlobal) {
        new Chart(ctxGlobal, {
            type: 'doughnut',
            data: {
                labels: ['Occupied', 'Free'],
                datasets: [{
                    data: [32.93, 67.07],
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed.toFixed(2) + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Sensor Cost Line Chart
    const ctxCost = document.getElementById('chart-sensor-cost');
    if (ctxCost) {
        const costDates = [];
        const costData = [];
        
        // Generate realistic cost data for last 30 days
        const baselineCost = 28; // €28 baseline
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            costDates.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
            
            // Add variation (±20%) to make it realistic
            const variation = (Math.random() - 0.5) * 2 * 0.2; // ±20%
            const dailyCost = baselineCost * (1 + variation);
            costData.push(parseFloat(dailyCost.toFixed(2)));
        }
        
        new Chart(ctxCost, {
            type: 'line',
            data: {
                labels: costDates,
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
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#662179',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
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
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: { top: 10 }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                            color: '#64748b',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cost (€)',
                            color: '#64748b',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: { bottom: 10 }
                        },
                        beginAtZero: false,
                        min: 20,
                        max: 36,
                        ticks: {
                            stepSize: 2,
                            color: '#64748b',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return '€' + value;
                            }
                        },
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)',
                            drawBorder: false,
                            lineWidth: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        padding: 12,
                        borderColor: '#662179',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return 'Date: ' + context[0].label;
                            },
                            label: function(context) {
                                return 'Cost: €' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }
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
            name: 'Desk Occupancy',
            liveTitle: 'Live Desk Occupancy',
            historicalTitle: 'Historical Occupancy Data',
            chartTitle: 'Desk Occupation Rate (08:00 - 19:00)',
            globalTitle: 'Global Desk Occupation'
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
