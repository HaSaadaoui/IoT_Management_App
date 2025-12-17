// ===== DESK-SENSOR MAPPING CONFIGURATION =====
// Single source of truth for desk to sensor mapping across all floors and buildings

// Ceci est la source de vérité en attendant la configuration dynamique
const DeskSensorConfig = {
    // Desk-to-sensor mapping for each building and floor
    mappings: {
        CHATEAUDUN: {
            0: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null }
            ],
            1: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null },
                { id: 'D09', sensor: null },
                { id: 'D10', sensor: null },
                { id: 'D11', sensor: null },
                { id: 'D12', sensor: null }
            ],
            2: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: 'desk-01-02' },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: 'desk-01-01' },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null },
                { id: 'D09', sensor: null },
                { id: 'D10', sensor: null },
                { id: 'D11', sensor: null },
                { id: 'D12', sensor: null },
                { id: 'D13', sensor: null },
                { id: 'D14', sensor: null },
                { id: 'D15', sensor: null },
                { id: 'D16', sensor: null }
            ],
            3: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null },
                { id: 'D09', sensor: null },
                { id: 'D10', sensor: null },
                { id: 'D11', sensor: null },
                { id: 'D12', sensor: null }
            ],
            4: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null },
                { id: 'D09', sensor: null },
                { id: 'D10', sensor: null },
                { id: 'D11', sensor: null },
                { id: 'D12', sensor: null }
            ],
            5: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null },
                { id: 'D09', sensor: null },
                { id: 'D10', sensor: null },
                { id: 'D11', sensor: null },
                { id: 'D12', sensor: null }
            ],
            6: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null },
                { id: 'D09', sensor: null },
                { id: 'D10', sensor: null },
                { id: 'D11', sensor: null },
                { id: 'D12', sensor: null }
            ]
        },
        LEVALLOIS: {
            // Add mappings for Levallois here
            0: [
                { id: '01', sensor: 'desk-03-01' }, // TODO: compléter l'association
                { id: '02', sensor: 'desk-03-02' },
                { id: '03', sensor: 'desk-03-03' },
                { id: '04', sensor: 'desk-03-04' },
                { id: '05', sensor: 'desk-03-05' },
                { id: '06', sensor: 'desk-03-06' },
                { id: '07', sensor: 'desk-03-07' },
                { id: '08', sensor: 'desk-03-08' },
                { id: '09', sensor: 'desk-03-09' },
                { id: 'D10', sensor: 'desk-03-10' },
                { id: '05', sensor: 'desk-03-05' },
                { id: '05', sensor: 'desk-03-05' },
                { id: '05', sensor: 'desk-03-05' },
                { id: 'D70', sensor: 'desk-03-01' },
                { id: 'D07', sensor: 'desk-03-01' },
                { id: 'D08', sensor: 'desk-03-01' },
                { id: 'D81', sensor: 'desk-03-01' },
                { id: 'D82', sensor: 'desk-03-01' }
            ]
        },
        LILLE: {
            // Add mappings for Lille here
            0: []
        }
    },

    // Get sensor ID for a specific desk on a floor
    getSensor: function(floorNumber, deskId, buildingId = 'CHATEAUDUN') {
        const buildingKey = (buildingId || 'CHATEAUDUN').toUpperCase();
        const buildingDesks = this.mappings[buildingKey];
        if (!buildingDesks) return null;

        const floorDesks = buildingDesks[floorNumber];
        if (!floorDesks) return null;

        const deskConfig = floorDesks.find(d => d.id === deskId);
        return deskConfig ? deskConfig.sensor : null;
    },

    // Get all desks with sensor mappings for a floor
    getFloorDesks: function(floorNumber, defaultStatus = 'invalid', buildingId = 'CHATEAUDUN') {
        const buildingKey = (buildingId || 'CHATEAUDUN').toUpperCase();
        const buildingDesks = this.mappings[buildingKey];
        if (!buildingDesks) return [];

        const mapping = buildingDesks[floorNumber];
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
