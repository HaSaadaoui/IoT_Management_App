// ===== DESK-SENSOR MAPPING CONFIGURATION =====
// Single source of truth for desk to sensor mapping across all floors

const DeskSensorConfig = {
    // Desk-to-sensor mapping for each floor
    floorSensorMapping: {
        0: [
            { id: 'D01', sensor: 'desk-01-01' },
            { id: 'D02', sensor: 'desk-01-02' },
            { id: 'D03', sensor: 'desk-01-03' },
            { id: 'D04', sensor: 'desk-01-04' },
            { id: 'D05', sensor: 'desk-01-01' },
            { id: 'D06', sensor: 'desk-01-06' },
            { id: 'D07', sensor: 'desk-01-07' },
            { id: 'D08', sensor: 'desk-01-08' }
        ],
        1: [
            { id: 'D01', sensor: 'desk-01-01' },
            { id: 'D02', sensor: 'desk-01-02' },
            { id: 'D03', sensor: 'desk-01-03' },
            { id: 'D04', sensor: 'desk-01-04' },
            { id: 'D05', sensor: 'desk-01-01' },
            { id: 'D06', sensor: 'desk-01-06' },
            { id: 'D07', sensor: 'desk-01-07' },
            { id: 'D08', sensor: 'desk-01-08' },
            { id: 'D09', sensor: 'desk-01-09' },
            { id: 'D10', sensor: 'desk-01-10' },
            { id: 'D11', sensor: 'desk-01-11' },
            { id: 'D12', sensor: 'desk-01-12' }
        ],
        2: [
            { id: 'D01', sensor: 'desk-01-05' },
            { id: 'D02', sensor: 'desk-01-02' },
            { id: 'D03', sensor: 'desk-01-03' },
            { id: 'D04', sensor: 'desk-01-04' },
            { id: 'D05', sensor: 'desk-01-01' },
            { id: 'D06', sensor: 'desk-01-06' },
            { id: 'D07', sensor: 'desk-01-07' },
            { id: 'D08', sensor: 'desk-01-08' },
            { id: 'D09', sensor: 'desk-01-09' },
            { id: 'D10', sensor: 'desk-01-10' },
            { id: 'D11', sensor: 'desk-01-11' },
            { id: 'D12', sensor: 'desk-01-12' },
            { id: 'D13', sensor: 'desk-01-13' },
            { id: 'D14', sensor: 'desk-01-14' },
            { id: 'D15', sensor: 'desk-01-15' },
            { id: 'D16', sensor: 'desk-01-16' }
        ],
        3: [
            { id: 'D01', sensor: 'desk-03-01' },
            { id: 'D02', sensor: 'desk-03-02' },
            { id: 'D03', sensor: 'desk-03-03' },
            { id: 'D04', sensor: 'desk-03-04' },
            { id: 'D05', sensor: 'desk-03-01' },
            { id: 'D06', sensor: 'desk-03-06' },
            { id: 'D07', sensor: 'desk-03-07' },
            { id: 'D08', sensor: 'desk-03-08' },
            { id: 'D09', sensor: 'desk-03-09' },
            { id: 'D10', sensor: 'desk-03-10' },
            { id: 'D11', sensor: 'desk-03-11' },
            { id: 'D12', sensor: 'desk-03-12' }
        ]
    },

    // Get sensor ID for a specific desk on a floor
    getSensor: function(floorNumber, deskId) {
        const floorDesks = this.floorSensorMapping[floorNumber];
        if (!floorDesks) return null;

        const deskConfig = floorDesks.find(d => d.id === deskId);
        return deskConfig ? deskConfig.sensor : null;
    },

    // Get all desks with sensor mappings for a floor
    getFloorDesks: function(floorNumber, defaultStatus = 'invalid') {
        const mapping = this.floorSensorMapping[floorNumber];
        if (!mapping) return [];

        return mapping.map(desk => ({
            id: desk.id,
            sensor: desk.sensor,
            status: defaultStatus
        }));
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.DeskSensorConfig = DeskSensorConfig;
}
