// ===== DESK-SENSOR MAPPING CONFIGURATION =====
// Single source of truth for desk to sensor mapping across all floors and buildings

// Ceci est la source de vérité en attendant la configuration dynamique
const DeskSensorConfig = {
    // Desk-to-sensor mapping for each building and floor
    mappings: {
        CHATEAUDUN: {
            0: [
            ],
            1: [
                { id: 'D01', sensor: null }
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
                { id: 'D15', sensor: null }
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
                { id: 'D12', sensor: null },
                { id: 'D13', sensor: null },
                { id: 'D14', sensor: null },
                { id: 'D15', sensor: null }
            ],
            4: [
                { id: 'D01', sensor: null },
                { id: 'D02', sensor: null },
                { id: 'D03', sensor: null },
                { id: 'D04', sensor: null },
                { id: 'D05', sensor: null },
                { id: 'D06', sensor: null },
                { id: 'D07', sensor: null },
                { id: 'D08', sensor: null }
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
                { id: 'D12', sensor: null },
                { id: 'D13', sensor: null },
                { id: 'D14', sensor: null },
                { id: 'D15', sensor: null },
                { id: 'D16', sensor: null },
                { id: 'D17', sensor: null },
                { id: 'D18', sensor: null },
                { id: 'D19', sensor: null },
                { id: 'D20', sensor: null },
                { id: 'D21', sensor: null },
                { id: 'D22', sensor: null },
                { id: 'D23', sensor: null },
                { id: 'D24', sensor: null },
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
                { id: 'D12', sensor: null },
                { id: 'D13', sensor: null },
                { id: 'D14', sensor: null },
                { id: 'D15', sensor: null },
                { id: 'D16', sensor: null }
            ]
        },
        LEVALLOIS: {
            // Add mappings for Levallois here
            3: [
                { id: 'D01', sensor: 'desk-03-01' },
                { id: 'D02', sensor: 'desk-03-02' },
                { id: 'D03', sensor: 'desk-03-03' },
                { id: 'D04', sensor: 'desk-03-04' },
                { id: 'D05', sensor: 'desk-03-05' },
                { id: 'D06', sensor: 'desk-03-06' },
                { id: 'D07', sensor: 'desk-03-07' },
                { id: 'D08', sensor: 'desk-03-08' },
                { id: 'D09', sensor: 'desk-03-09' },
                { id: 'D10', sensor: 'desk-03-10' },
                { id: 'D11', sensor: 'desk-03-11' },
                { id: 'D12', sensor: 'desk-03-12' },
                { id: 'D13', sensor: 'desk-03-13' },
                { id: 'D14', sensor: 'desk-03-14' },
                { id: 'D15', sensor: 'desk-03-15' },
                { id: 'D16', sensor: 'desk-03-16' },
                { id: 'D17', sensor: 'desk-03-17' },
                { id: 'D18', sensor: 'desk-03-18' },
                { id: 'D19', sensor: 'desk-03-19' },
                { id: 'D20', sensor: 'desk-03-20' },
                { id: 'D21', sensor: 'desk-03-21' },
                { id: 'D22', sensor: 'desk-03-22' },
                { id: 'D23', sensor: 'desk-03-23' },
                { id: 'D24', sensor: 'desk-03-24' },
                { id: 'D25', sensor: 'desk-03-25' },
                { id: 'D26', sensor: 'desk-03-26' },
                { id: 'D27', sensor: 'desk-03-27' },
                { id: 'D28', sensor: 'desk-03-28' },
                { id: 'D29', sensor: 'desk-03-29' },
                { id: 'D30', sensor: 'desk-03-30' },
                { id: 'D31', sensor: 'desk-03-31' },
                { id: 'D32', sensor: 'desk-03-32' },
                { id: 'D33', sensor: 'desk-03-33' },
                { id: 'D34', sensor: 'desk-03-34' },
                { id: 'D35', sensor: 'desk-03-35' },
                { id: 'D36', sensor: 'desk-03-36' },
                { id: 'D37', sensor: 'desk-03-37' },
                { id: 'D38', sensor: 'desk-03-38' },
                { id: 'D39', sensor: 'desk-03-39' },
                { id: 'D40', sensor: 'desk-03-40' },
                { id: 'D41', sensor: 'desk-03-41' },
                { id: 'D42', sensor: 'desk-03-42' },
                { id: 'D43', sensor: 'desk-03-43' },
                { id: 'D44', sensor: 'desk-03-44' },
                { id: 'D45', sensor: 'desk-03-45' },
                { id: 'D46', sensor: 'desk-03-46' },
                { id: 'D47', sensor: 'desk-03-47' },
                { id: 'D48', sensor: 'desk-03-48' },
                { id: 'D49', sensor: 'desk-03-49' },
                { id: 'D50', sensor: 'desk-03-50' },
                { id: 'D51', sensor: 'desk-03-51' },
                { id: 'D52', sensor: 'desk-03-52' },
                { id: 'D53', sensor: 'desk-03-53' },
                { id: 'D54', sensor: 'desk-03-54' },
                { id: 'D55', sensor: 'desk-03-55' },
                { id: 'D56', sensor: 'desk-03-56' },
                { id: 'D57', sensor: 'desk-03-57' },
                { id: 'D58', sensor: 'desk-03-58' },
                { id: 'D59', sensor: 'desk-03-59' },
                { id: 'D60', sensor: 'desk-03-60' },
                { id: 'D61', sensor: 'desk-03-61' },
                { id: 'D62', sensor: 'desk-03-62' },
                { id: 'D63', sensor: 'desk-03-63' },
                { id: 'D64', sensor: 'desk-03-64' },
                { id: 'D65', sensor: 'desk-03-65' },
                { id: 'D66', sensor: 'desk-03-66' },
                { id: 'D67', sensor: 'desk-03-67' },
                { id: 'D68', sensor: 'desk-03-68' },
                { id: 'D69', sensor: 'desk-03-69' },
                { id: 'D70', sensor: 'desk-03-70' },
                { id: 'D71', sensor: 'desk-03-71' },
                { id: 'D72', sensor: 'desk-03-72' },
                { id: 'D73', sensor: 'desk-03-73' },
                { id: 'D74', sensor: 'desk-03-74' },
                { id: 'D75', sensor: 'desk-03-75' },
                { id: 'D76', sensor: 'desk-03-76' },
                { id: 'D77', sensor: 'desk-03-77' },
                { id: 'D78', sensor: 'desk-03-78' },
                { id: 'D79', sensor: 'desk-03-79' },
                { id: 'D80', sensor: 'desk-03-80' },
                { id: 'D81', sensor: 'desk-03-81' },
                { id: 'D82', sensor: 'desk-03-82' },

                { id: 'V01', sensor: 'desk-03-83' },
                { id: 'V02', sensor: 'desk-03-84' },
                { id: 'V03', sensor: 'desk-03-85' },
                { id: 'V04', sensor: 'desk-03-86' },
                { id: 'V05', sensor: 'desk-03-87' },
                { id: 'V06', sensor: 'desk-03-88' },
                { id: 'V07', sensor: 'desk-03-89' },
                { id: 'V08', sensor: 'desk-03-90' },
                { id: 'V09', sensor: 'desk-03-91' },
                { id: 'V10', sensor: 'desk-03-92' },
                { id: 'PB5', sensor: 'desk-vs40-03-01' },
                { id: 'IR1', sensor: 'desk-vs41-03-01' },
                { id: 'IR2', sensor: 'desk-vs41-03-02' },
                { id: 'PB1', sensor: 'desk-vs41-03-03' },
                { id: 'PB2', sensor: 'desk-vs41-03-04' },

                { id: 'PB3', sensor: 'occup-vs30-03-01' },
                { id: 'PB4', sensor: 'occup-vs30-03-02' },
                { id: 'SR1', sensor: 'occup-vs70-03-01' },
                { id: 'SR2', sensor: 'occup-vs70-03-02' },
                { id: 'PB6', sensor: 'occup-vs70-03-03' },
                { id: 'PB7', sensor: 'occup-vs70-03-04' }
            ],
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
