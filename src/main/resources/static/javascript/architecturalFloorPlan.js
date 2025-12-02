// ===== ARCHITECTURAL FLOOR PLAN - CEILING VIEW =====
// Professional architectural drawing system matching "Occupation Live" style

class ArchitecturalFloorPlan {
    constructor(containerId, floorData, sensorMode = 'DESK') {
        this.container = document.getElementById(containerId);
        this.floorData = floorData;
        this.sensorMode = sensorMode;
        this.svg = null;
        this.scale = 40; // pixels per meter
        this.strokeWidth = 2;
        this.wallThickness = 0.2; // meters
        this.overlayManager = null;
        this.deskOccupancy = {
            // Example: {'D1':'free'}
        }
        
        // Colors matching screenshot
        this.colors = {
            wallStroke: '#000000',
            wallFill: '#ffffff',
            interiorLine: '#d1d5db',
            free: '#10b981',
            used: '#ef4444',
            invalid: '#94a3b8',
            background: '#ffffff',
            text: '#374151'
        };
        
        this.init();
    }
    
    init() {
        this.createSVG();
        this.drawFloorPlan();
    }
    
    createSVG() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create SVG element
        const svgNS = "http://www.w3.org/2000/svg";
        this.svg = document.createElementNS(svgNS, "svg");
        this.svg.setAttribute("width", "100%");
        this.svg.setAttribute("height", "100%");
        this.svg.setAttribute("viewBox", "0 0 1200 650");
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        this.svg.style.background = this.colors.background;
        
        this.container.appendChild(this.svg);
    }
    
    drawFloorPlan() {
        // Draw based on floor number
        switch(this.floorData.floorNumber) {
            case 0:
                this.drawGroundFloor();
                break;
            case 1:
                this.drawFloor1();
                break;
            case 2:
                this.drawFloor2();
                break;
            case 3:
                this.drawFloor3();
                break;
            case 4:
                this.drawFloor4();
                break;
            case 5:
                this.drawFloor5();
                break;
            case 6:
                this.drawFloor6();
                break;
        }
        
        // Add sensor overlay if not DESK mode
        if (this.sensorMode !== 'DESK' && window.SensorOverlayManager) {
            this.overlayManager = new SensorOverlayManager(this.svg);
            const sensors = this.generateSensorData(this.sensorMode, this.floorData.floorNumber);
            this.overlayManager.setSensorMode(this.sensorMode, sensors);
        }
    }
    
    generateSensorData(mode, floor) {
        // Updated positions to match new building schema
        // Building spans: x: 50-1050, y: 50-450 (with angular shape)
        const positions = [
            // Top row
            //{x: 150, y: 100}, {x: 350, y: 100}, {x: 550, y: 100}, {x: 950, y: 100},
            // Middle row
            {x: 150, y: 130}, {x: 400, y: 130}, {x: 600, y: 130}, {x: 900, y: 130},
            // Bottom row (adjusted for angular shape)
            //{x: 350, y: 300}, {x: 550, y: 300},
        ];
        
        return positions.map((pos, i) => ({
            id: `${mode}-${floor}-${i}`,
            type: mode,
            floor: floor,
            x: pos.x,
            y: pos.y,
            value: this.getRandomSensorValue(mode),
            status: Math.random() > 0.7 ? 'active' : 'normal',
            presence: Math.random() > 0.5,
            alert: Math.random() > 0.8,
            direction: Math.floor(Math.random() * 360),
            intensity: Math.random() * 2 + 0.5,
            message: 'OK',
            timestamp: new Date().toISOString()
        }));
    }
    
    getRandomSensorValue(mode) {
        switch(mode) {
            case 'CO2': return Math.floor(Math.random() * 1000) + 400;
            case 'TEMP': return Math.floor(Math.random() * 10) + 18;
            case 'LIGHT': return Math.floor(Math.random() * 1000) + 100;
            case 'NOISE': return Math.floor(Math.random() * 40) + 30;
            case 'HUMIDITY': return Math.floor(Math.random() * 40) + 30;
            case 'TEMPEX': return Math.floor(Math.random() * 8) + 19;
            default: return 0;
        }
    }
    
    drawGroundFloor() {
        const g = this.createGroup('ground-floor');
        
        // Main building outline - Same as Floor 2
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines (same as Floor 2)
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');
        this.drawWindow(g, 290, 50, 80, 'horizontal');
        this.drawWindow(g, 430, 50, 80, 'horizontal');
        this.drawWindow(g, 550, 50, 80, 'horizontal');
        this.drawWindow(g, 650, 50, 80, 'horizontal');
        this.drawWindow(g, 820, 50, 80, 'horizontal');
        this.drawWindow(g, 980, 50, 80, 'horizontal');
        
        // ONLY DRAW DESKS IF IN DESK MODE
       /* if (this.sensorMode === 'DESK') {
            // Ground floor desks - similar layout to Floor 2
            this.drawWorkstation(g, 120, 60, 'invalid', 'D01', 30, 50, 'left');
            this.drawWorkstation(g, 90, 60, 'invalid', 'D02', 30, 50, 'right');
            this.drawWorkstation(g, 260, 60, 'invalid', 'D03', 30, 50, 'left');
            this.drawWorkstation(g, 290, 60, 'invalid', 'D04', 30, 50, 'right');
            this.drawWorkstation(g, 790, 60, 'invalid', 'D05', 30, 50, 'left');
            this.drawWorkstation(g, 820, 60, 'invalid', 'D06', 30, 50, 'right');
        }*/
        
        this.svg.appendChild(g);
    }
    
    drawFloor1() {
        const g = this.createGroup('floor-1');
        
        // Main building outline - Same as Floor 2
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines (same as Floor 2)
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');
        this.drawWindow(g, 290, 50, 80, 'horizontal');
        this.drawWindow(g, 430, 50, 80, 'horizontal');
        this.drawWindow(g, 550, 50, 80, 'horizontal');
        this.drawWindow(g, 650, 50, 80, 'horizontal');
        this.drawWindow(g, 820, 50, 80, 'horizontal');
        this.drawWindow(g, 980, 50, 80, 'horizontal');
        
        // Geneva Room
        const genevaRoom = [
            { x: 760, y: 52 },
            { x: 1050, y: 52 },
            { x: 1050, y: 200 },
            { x: 760, y: 200 },
            { x: 760, y: 52 }
        ];
        this.drawWall(g, genevaRoom, false);
        this.drawLabel(g, 900, 140, 'Geneva', 16, 'bold');
        
        // Geneva Door
        const genevaDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        genevaDoor.setAttribute("x", 780);
        genevaDoor.setAttribute("y", 195);
        genevaDoor.setAttribute("width", 40);
        genevaDoor.setAttribute("height", 4);
        genevaDoor.setAttribute("fill", "#ffffff");
        genevaDoor.setAttribute("stroke", "#000000");
        genevaDoor.setAttribute("stroke-width", 2);
        g.appendChild(genevaDoor);
        
        // Additional separation lines
        this.drawLine(g, [{ x: 200, y: 50 }, { x: 200, y: 280 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 500, y: 50 }, { x: 500, y: 335 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 500, y: 170 }, { x: 715, y: 170 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 715, y: 50 }, { x: 715, y: 170 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 600, y: 50 }, { x: 600, y: 170 }], this.colors.wallStroke, 2);
        
        // Doors for separation lines
        const door1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        door1.setAttribute("x", 200);
        door1.setAttribute("y", 200);
        door1.setAttribute("width", 4);
        door1.setAttribute("height", 40);
        door1.setAttribute("fill", "#ffffff");
        door1.setAttribute("stroke", "#000000");
        door1.setAttribute("stroke-width", 2);
        g.appendChild(door1);
        
        const door2 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        door2.setAttribute("x", 500);
        door2.setAttribute("y", 250);
        door2.setAttribute("width", 4);
        door2.setAttribute("height", 40);
        door2.setAttribute("fill", "#ffffff");
        door2.setAttribute("stroke", "#000000");
        door2.setAttribute("stroke-width", 2);
        g.appendChild(door2);
        
        const door3 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        door3.setAttribute("x", 660);
        door3.setAttribute("y", 170);
        door3.setAttribute("width", 40);
        door3.setAttribute("height", 4);
        door3.setAttribute("fill", "#ffffff");
        door3.setAttribute("stroke", "#000000");
        door3.setAttribute("stroke-width", 2);
        g.appendChild(door3);
        
        const door4 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        door4.setAttribute("x", 500);
        door4.setAttribute("y", 70);
        door4.setAttribute("width", 4);
        door4.setAttribute("height", 40);
        door4.setAttribute("fill", "#ffffff");
        door4.setAttribute("stroke", "#000000");
        door4.setAttribute("stroke-width", 2);
        g.appendChild(door4);
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // D01 - Horizontal desk
            this.drawWorkstation(g, 650, 200, 'invalid', 'D01', 60, 30, 'top', null, 680, 190, 680, 215);
        }
        
        this.svg.appendChild(g);
    }
    
    drawFloor2() {
        const g = this.createGroup('floor-2');
        
        // Main building outline - EXACT from your Chrome DevTools
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // ATLANTIC Room - EXACT coordinates
        const atlanticRoom = [
            { x: 380, y: 170 },
            { x: 380, y: 50 },
            { x: 490, y: 50 },
            { x: 490, y: 220 },
            { x: 380, y: 170 }  // ← this closes the shape (equivalent to "Z"
        ];
        this.drawWall(g, atlanticRoom, false);
        this.drawLabel(g, 430, 140, 'Atlantic', 16, 'bold');
        
        // Atlantic Door (rotated)
        const atlanticDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        atlanticDoor.setAttribute("x", 395);
        atlanticDoor.setAttribute("y", 230);
        atlanticDoor.setAttribute("width", 40);
        atlanticDoor.setAttribute("height", 4);
        atlanticDoor.setAttribute("fill", "#ffffff");
        atlanticDoor.setAttribute("stroke", "#000000");
        atlanticDoor.setAttribute("stroke-width", 2);
        atlanticDoor.setAttribute("transform", "rotate(25, 520, 222)");
        g.appendChild(atlanticDoor);
        
        // PACIFIC Room - EXACT coordinates
        const pacificRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 490, y: 50 },
            { x: 490, y: 220 },
            { x: 710, y: 220 }  // ← this closes the shape (equivalent to "Z")
        ];
        this.drawWall(g, pacificRoom, false);
        this.drawLabel(g, 600, 140, 'Pacific', 16, 'bold');
        
        // Pacific Door
        const pacificDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        pacificDoor.setAttribute("x", 520);
        pacificDoor.setAttribute("y", 215);
        pacificDoor.setAttribute("width", 40);
        pacificDoor.setAttribute("height", 4);
        pacificDoor.setAttribute("fill", "#ffffff");
        pacificDoor.setAttribute("stroke", "#000000");
        pacificDoor.setAttribute("stroke-width", 2);
        g.appendChild(pacificDoor);
        
        // Windows - EXACT positions (centered: x + width/2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');  // rect x=80
        this.drawWindow(g, 290, 50, 80, 'horizontal');  // rect x=250
        this.drawWindow(g, 430, 50, 80, 'horizontal');  // rect x=390
        this.drawWindow(g, 550, 50, 80, 'horizontal');  // rect x=510
        this.drawWindow(g, 650, 50, 80, 'horizontal');  // rect x=610
        this.drawWindow(g, 820, 50, 80, 'horizontal');  // rect x=780
        this.drawWindow(g, 980, 50, 80, 'horizontal');  // rect x=940
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // D01 - rect x=120, chair cx=80 (left side)
            this.drawWorkstation(g, 120, 60, 'invalid', 'D01', 30, 50, 'left', null, 80, 85, 135, 85);
            
            // D02 - rect x=90, chair cx=160 (right side)
            this.drawWorkstation(g, 90, 60, 'invalid', 'D02', 30, 50, 'right', null, 160, 85, 105, 85);
            
            // D03 - horizontal desk
            this.drawWorkstation(g, 90, 110, 'invalid', 'D03', 60, 30, 'bottom', null, 120, 150, 120, 125);
            
            // D04 & D05 - Center-left cluster
            this.drawWorkstation(g, 260, 60, 'invalid', 'D04', 30, 50, 'left', null, 250, 85, 275, 85);
            this.drawWorkstation(g, 290, 60, 'invalid', 'D05', 30, 50, 'right', null, 330, 85, 305, 85);
            
            // D06 - With rotation 190°
            this.drawWorkstation(g, 260, 240, 'invalid', 'D06', 30, 50, 'custom', 'rotate(190, 275, 265)', 250, 260, 275, 265);
            
            // D07 - With rotation 190°
            this.drawWorkstation(g, 230, 240, 'invalid', 'D07', 30, 50, 'custom', 'rotate(190, 275, 265)', 330, 275, 305, 270);
            
            // Right cluster 1
            this.drawWorkstation(g, 790, 60, 'invalid', 'D08', 30, 50, 'left', null, 780, 85, 805, 85);
            this.drawWorkstation(g, 790, 110, 'invalid', 'D09', 30, 50, 'left', null, 780, 135, 805, 135);
            this.drawWorkstation(g, 820, 60, 'invalid', 'D10', 30, 50, 'right', null, 860, 85, 835, 85);
            this.drawWorkstation(g, 820, 110, 'invalid', 'D11', 30, 50, 'right', null, 860, 135, 835, 135);
            
            // Right cluster 2
            this.drawWorkstation(g, 950, 60, 'invalid', 'D12', 30, 50, 'left', null, 940, 85, 965, 85);
            this.drawWorkstation(g, 950, 110, 'invalid', 'D13', 30, 50, 'left', null, 940, 135, 965, 135);
            this.drawWorkstation(g, 980, 60, 'invalid', 'D14', 30, 50, 'right', null, 1020, 85, 995, 85);
            this.drawWorkstation(g, 980, 110, 'invalid', 'D15', 30, 50, 'right', null, 1020, 135, 995, 135);
        }
        
        this.svg.appendChild(g);
    }
    
    drawFloor3() {
        const g = this.createGroup('floor-3');
        
        // Same building outline as Floor 2
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines (same as Floor 2)
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');
        this.drawWindow(g, 290, 50, 80, 'horizontal');
        this.drawWindow(g, 430, 50, 80, 'horizontal');
        this.drawWindow(g, 550, 50, 80, 'horizontal');
        this.drawWindow(g, 650, 50, 80, 'horizontal');
        this.drawWindow(g, 820, 50, 80, 'horizontal');
        this.drawWindow(g, 980, 50, 80, 'horizontal');
        
        // Sequoia Room
        const sequoiaRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 170 },
            { x: 490, y: 220 },
            { x: 710, y: 220 }
        ];
        this.drawWall(g, sequoiaRoom, false);
        
        // Sequoia Room divider
        this.drawLine(g, [{ x: 600, y: 135 }, { x: 710, y: 135 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 600, y: 50 }, { x: 600, y: 220 }], this.colors.wallStroke, 2);
        
        this.drawLabel(g, 490, 130, 'Sequoia', 16, 'bold');
        this.drawLabel(g, 650, 180, 'Santa', 16, 'bold');
        
        // Sequoia Door (rotated)
        const sequoiaDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        sequoiaDoor.setAttribute("x", 395);
        sequoiaDoor.setAttribute("y", 230);
        sequoiaDoor.setAttribute("width", 40);
        sequoiaDoor.setAttribute("height", 4);
        sequoiaDoor.setAttribute("fill", "#ffffff");
        sequoiaDoor.setAttribute("stroke", "#000000");
        sequoiaDoor.setAttribute("stroke-width", 2);
        sequoiaDoor.setAttribute("transform", "rotate(25, 520, 222)");
        g.appendChild(sequoiaDoor);
        
        // Santa Door
        const santaDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        santaDoor.setAttribute("x", 635);
        santaDoor.setAttribute("y", 215);
        santaDoor.setAttribute("width", 40);
        santaDoor.setAttribute("height", 4);
        santaDoor.setAttribute("fill", "#ffffff");
        santaDoor.setAttribute("stroke", "#000000");
        santaDoor.setAttribute("stroke-width", 2);
        g.appendChild(santaDoor);
        
        // Sequoia side door
        const sequoiaSideDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        sequoiaSideDoor.setAttribute("x", 705);
        sequoiaSideDoor.setAttribute("y", 60);
        sequoiaSideDoor.setAttribute("width", 4);
        sequoiaSideDoor.setAttribute("height", 40);
        sequoiaSideDoor.setAttribute("fill", "#ffffff");
        sequoiaSideDoor.setAttribute("stroke", "#000000");
        sequoiaSideDoor.setAttribute("stroke-width", 2);
        g.appendChild(sequoiaSideDoor);
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // D01
            this.drawWorkstation(g, 120, 60, this.deskOccupancy['D01'] || 'invalid', 'D01', 30, 50, 'left', null, 80, 85, 135, 90);
            // D02
            this.drawWorkstation(g, 90, 60, this.deskOccupancy['D02'] || 'invalid', 'D02', 30, 50, 'right', null, 160, 85, 105, 90);
            // D03 - horizontal desk
            this.drawWorkstation(g, 90, 110, this.deskOccupancy['D03'] || 'invalid', 'D03', 60, 30, 'bottom', null, 120, 150, 120, 125);
            // D04
            this.drawWorkstation(g, 260, 60, this.deskOccupancy['D04'] || 'invalid', 'D04', 30, 50, 'left', null, 250, 85, 275, 90);
            // D05
            this.drawWorkstation(g, 260, 110, this.deskOccupancy['D05'] || 'invalid', 'D05', 30, 50, 'left', null, 250, 135, 275, 140);
            // D06
            this.drawWorkstation(g, 290, 60, this.deskOccupancy['D06'] || 'invalid', 'D06', 30, 50, 'right', null, 330, 85, 305, 90);
            // D07
            this.drawWorkstation(g, 290, 110, this.deskOccupancy['D07'] || 'invalid', 'D07', 30, 50, 'right', null, 330, 135, 305, 140);
            // D08
            this.drawWorkstation(g, 790, 60, this.deskOccupancy['D08'] || 'invalid', 'D08', 30, 50, 'left', null, 780, 85, 805, 90);
            // D09
            this.drawWorkstation(g, 790, 110, this.deskOccupancy['D09'] || 'invalid', 'D09', 30, 50, 'left', null, 780, 135, 805, 140);
            // D10
            this.drawWorkstation(g, 820, 60, this.deskOccupancy['D10'] || 'invalid', 'D10', 30, 50, 'right', null, 860, 85, 835, 90);
            // D11
            this.drawWorkstation(g, 820, 110, this.deskOccupancy['D11'] || 'invalid', 'D11', 30, 50, 'right', null, 860, 135, 835, 140);
            // D12
            this.drawWorkstation(g, 950, 60, this.deskOccupancy['D12'] || 'invalid', 'D12', 30, 50, 'left', null, 940, 85, 965, 90);
            // D13
            this.drawWorkstation(g, 950, 110, this.deskOccupancy['D13'] || 'invalid', 'D13', 30, 50, 'left', null, 940, 135, 965, 140);
            // D14
            this.drawWorkstation(g, 980, 60, this.deskOccupancy['D14'] || 'invalid', 'D14', 30, 50, 'right', null, 1020, 85, 995, 90);
            // D15
            this.drawWorkstation(g, 980, 110, this.deskOccupancy['D15'] || 'invalid', 'D15', 30, 50, 'right', null, 1020, 135, 995, 140);
        }
        
        this.svg.appendChild(g);
    }
    
    drawFloor4() {
        const g = this.createGroup('floor-4');
        
        // Same building outline as Floor 2
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines (same as Floor 2)
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');
        this.drawWindow(g, 290, 50, 80, 'horizontal');
        this.drawWindow(g, 430, 50, 80, 'horizontal');
        this.drawWindow(g, 550, 50, 80, 'horizontal');
        this.drawWindow(g, 650, 50, 80, 'horizontal');
        this.drawWindow(g, 820, 50, 80, 'horizontal');
        this.drawWindow(g, 980, 50, 80, 'horizontal');
        
        // Miami Room
        const miamiRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 170 },
            { x: 490, y: 220 },
            { x: 710, y: 220 }
        ];
        this.drawWall(g, miamiRoom, false);
        this.drawLabel(g, 550, 140, 'Miami', 16, 'bold');
        
        // Miami Door (rotated)
        const miamiDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        miamiDoor.setAttribute("x", 395);
        miamiDoor.setAttribute("y", 230);
        miamiDoor.setAttribute("width", 40);
        miamiDoor.setAttribute("height", 4);
        miamiDoor.setAttribute("fill", "#ffffff");
        miamiDoor.setAttribute("stroke", "#000000");
        miamiDoor.setAttribute("stroke-width", 2);
        miamiDoor.setAttribute("transform", "rotate(25, 520, 222)");
        g.appendChild(miamiDoor);
        
        // Oregan Room
        const oreganRoom = [
            { x: 200, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 150 },
            { x: 200, y: 150 },
            { x: 200, y: 50 }
        ];
        this.drawWall(g, oreganRoom, false);
        this.drawLabel(g, 290, 110, 'Oregan', 16, 'bold');
        
        // Oregan Door
        const oreganDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        oreganDoor.setAttribute("x", 320);
        oreganDoor.setAttribute("y", 147);
        oreganDoor.setAttribute("width", 40);
        oreganDoor.setAttribute("height", 4);
        oreganDoor.setAttribute("fill", "#ffffff");
        oreganDoor.setAttribute("stroke", "#000000");
        oreganDoor.setAttribute("stroke-width", 2);
        g.appendChild(oreganDoor);
        
        // New York Room (vertical extension)
        this.drawLine(g, [{ x: 200, y: 150 }, { x: 200, y: 280 }], this.colors.wallStroke, 2);
        
        // New York Door
        const newYorkDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        newYorkDoor.setAttribute("x", 200);
        newYorkDoor.setAttribute("y", 160);
        newYorkDoor.setAttribute("width", 4);
        newYorkDoor.setAttribute("height", 40);
        newYorkDoor.setAttribute("fill", "#ffffff");
        newYorkDoor.setAttribute("stroke", "#000000");
        newYorkDoor.setAttribute("stroke-width", 2);
        g.appendChild(newYorkDoor);
        
        // New York Label (rotated)
        const newYorkLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        newYorkLabel.setAttribute("x", 260);
        newYorkLabel.setAttribute("y", -50);
        newYorkLabel.setAttribute("text-anchor", "middle");
        newYorkLabel.setAttribute("font-family", "Arial, sans-serif");
        newYorkLabel.setAttribute("font-size", 16);
        newYorkLabel.setAttribute("font-weight", "bold");
        newYorkLabel.setAttribute("fill", "#374151");
        newYorkLabel.setAttribute("transform", "rotate(-90 290,110)");
        newYorkLabel.textContent = "New York";
        g.appendChild(newYorkLabel);
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // D01
            this.drawWorkstation(g, 790, 60, 'invalid', 'D01', 30, 50, 'left', null, 780, 85, 805, 90);
            // D02
            this.drawWorkstation(g, 790, 110, 'invalid', 'D02', 30, 50, 'left', null, 780, 135, 805, 140);
            // D03
            this.drawWorkstation(g, 820, 60, 'invalid', 'D03', 30, 50, 'right', null, 860, 85, 835, 90);
            // D04
            this.drawWorkstation(g, 820, 110, 'invalid', 'D04', 30, 50, 'right', null, 860, 135, 835, 140);
            // D05
            this.drawWorkstation(g, 950, 60, 'invalid', 'D05', 30, 50, 'left', null, 940, 85, 965, 90);
            // D06
            this.drawWorkstation(g, 950, 110, 'invalid', 'D06', 30, 50, 'left', null, 940, 135, 965, 140);
            // D07
            this.drawWorkstation(g, 980, 60, 'invalid', 'D07', 30, 50, 'right', null, 1020, 85, 995, 90);
            // D08
            this.drawWorkstation(g, 980, 110, 'invalid', 'D08', 30, 50, 'right', null, 1020, 135, 995, 140);
        }
        
        this.svg.appendChild(g);
    }
    
    drawFloor5() {
        const g = this.createGroup('floor-5');
        
        // Same building outline as Floor 2
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines (same as Floor 2)
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');  // rect x=80
        this.drawWindow(g, 290, 50, 80, 'horizontal');  // rect x=250
        this.drawWindow(g, 430, 50, 80, 'horizontal');  // rect x=390
        this.drawWindow(g, 550, 50, 80, 'horizontal');  // rect x=510
        this.drawWindow(g, 650, 50, 80, 'horizontal');  // rect x=610
        this.drawWindow(g, 820, 50, 80, 'horizontal');  // rect x=780
        this.drawWindow(g, 980, 50, 80, 'horizontal');  // rect x=940
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // Left cluster - horizontal desks
            this.drawWorkstation(g, 110, 90, 'invalid', 'D01', 50, 30, 'top');
            this.drawWorkstation(g, 160, 90, 'invalid', 'D03', 50, 30, 'top');
            this.drawWorkstation(g, 110, 120, 'invalid', 'D02', 50, 30, 'bottom');
            this.drawWorkstation(g, 160, 120, 'invalid', 'D04', 50, 30, 'bottom');
            
            // Top row - vertical desks
            this.drawWorkstation(g, 300, 60, 'invalid', 'D05', 30, 50, 'left');
            this.drawWorkstation(g, 330, 60, 'invalid', 'D06', 30, 50, 'right');
            this.drawWorkstation(g, 460, 60, 'invalid', 'D07', 30, 50, 'left');
            this.drawWorkstation(g, 490, 60, 'invalid', 'D09', 30, 50, 'right');
            this.drawWorkstation(g, 620, 60, 'invalid', 'D11', 30, 50, 'left');
            this.drawWorkstation(g, 650, 60, 'invalid', 'D14', 30, 50, 'right');
            this.drawWorkstation(g, 790, 60, 'invalid', 'D17', 30, 50, 'left');
            this.drawWorkstation(g, 820, 60, 'invalid', 'D19', 30, 50, 'right');
            this.drawWorkstation(g, 950, 60, 'invalid', 'D21', 30, 50, 'left');
            this.drawWorkstation(g, 980, 60, 'invalid', 'D23', 30, 50, 'right');
            
            // Middle row - vertical desks
            this.drawWorkstation(g, 460, 110, 'invalid', 'D08', 30, 50, 'left');
            this.drawWorkstation(g, 490, 110, 'invalid', 'D10', 30, 50, 'right');
            this.drawWorkstation(g, 620, 110, 'invalid', 'D12', 30, 50, 'left');
            this.drawWorkstation(g, 650, 110, 'invalid', 'D15', 30, 50, 'right');
            this.drawWorkstation(g, 790, 110, 'invalid', 'D18', 30, 50, 'left');
            this.drawWorkstation(g, 820, 110, 'invalid', 'D20', 30, 50, 'right');
            this.drawWorkstation(g, 950, 110, 'invalid', 'D22', 30, 50, 'left');
            this.drawWorkstation(g, 980, 110, 'invalid', 'D24', 30, 50, 'right');
            
            // Bottom row - vertical desks
            this.drawWorkstation(g, 620, 160, 'invalid', 'D13', 30, 50, 'left');
            this.drawWorkstation(g, 650, 160, 'invalid', 'D16', 30, 50, 'right');
        }
        
        this.svg.appendChild(g);
    }
    
    drawFloor6() {
        const g = this.createGroup('floor-6');
        
        // Main building outline - Same as Floor 2
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, outerWall, true);
        
        // Internal separator lines (same as Floor 2)
        this.drawLine(g, [{ x: 750, y: 55 }, { x: 750, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 55 }, { x: 720, y: 240 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 720, y: 240 }, { x: 750, y: 240 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 200 }, { x: 850, y: 200 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 1050, y: 210 }, { x: 850, y: 210 }], this.colors.interiorLine, 1.5);
        this.drawLine(g, [{ x: 850, y: 200 }, { x: 850, y: 210 }], this.colors.interiorLine, 2);
        
        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, 'horizontal');
        this.drawWindow(g, 290, 50, 80, 'horizontal');
        this.drawWindow(g, 430, 50, 80, 'horizontal');
        this.drawWindow(g, 550, 50, 80, 'horizontal');
        this.drawWindow(g, 650, 50, 80, 'horizontal');
        this.drawWindow(g, 820, 50, 80, 'horizontal');
        this.drawWindow(g, 980, 50, 80, 'horizontal');
        
        // Paris Room
        const parisRoom = [
            { x: 480, y: 50 },
            { x: 710, y: 50 },
            { x: 710, y: 220 },
            { x: 480, y: 220 },
            { x: 480, y: 50 }
        ];
        this.drawWall(g, parisRoom, false);
        this.drawLabel(g, 590, 140, 'Paris', 16, 'bold');
        
        // Paris Door
        const parisDoor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        parisDoor.setAttribute("x", 500);
        parisDoor.setAttribute("y", 215);
        parisDoor.setAttribute("width", 40);
        parisDoor.setAttribute("height", 4);
        parisDoor.setAttribute("fill", "#ffffff");
        parisDoor.setAttribute("stroke", "#000000");
        parisDoor.setAttribute("stroke-width", 2);
        g.appendChild(parisDoor);
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // D01-D04: Horizontal desks (60x30) - Left cluster
            this.drawWorkstation(g, 90, 110, 'invalid', 'D01', 60, 30, 'top', null, 120, 100, 120, 125);
            this.drawWorkstation(g, 150, 110, 'invalid', 'D02', 60, 30, 'top', null, 180, 100, 180, 125);
            this.drawWorkstation(g, 90, 140, 'invalid', 'D03', 60, 30, 'bottom', null, 120, 180, 120, 155);
            this.drawWorkstation(g, 150, 140, 'invalid', 'D04', 60, 30, 'bottom', null, 180, 180, 180, 155);
            
            // D05-D08: Horizontal desks (60x30) - Center cluster
            this.drawWorkstation(g, 350, 110, 'invalid', 'D05', 60, 30, 'top', null, 380, 100, 380, 125);
            this.drawWorkstation(g, 410, 110, 'invalid', 'D06', 60, 30, 'top', null, 440, 100, 440, 125);
            this.drawWorkstation(g, 350, 140, 'invalid', 'D07', 60, 30, 'bottom', null, 380, 180, 380, 155);
            this.drawWorkstation(g, 410, 140, 'invalid', 'D08', 60, 30, 'bottom', null, 440, 180, 440, 155);
            
            // D09-D16: Vertical desks (30x50) - Right clusters
            this.drawWorkstation(g, 790, 60, 'invalid', 'D09', 30, 50, 'left', null, 780, 85, 805, 90);
            this.drawWorkstation(g, 790, 110, 'invalid', 'D10', 30, 50, 'left', null, 780, 135, 805, 140);
            this.drawWorkstation(g, 820, 60, 'invalid', 'D11', 30, 50, 'right', null, 860, 85, 835, 90);
            this.drawWorkstation(g, 820, 110, 'invalid', 'D12', 30, 50, 'right', null, 860, 135, 835, 140);
            this.drawWorkstation(g, 950, 60, 'invalid', 'D13', 30, 50, 'left', null, 940, 85, 965, 90);
            this.drawWorkstation(g, 950, 110, 'invalid', 'D14', 30, 50, 'left', null, 940, 135, 965, 140);
            this.drawWorkstation(g, 980, 60, 'invalid', 'D15', 30, 50, 'right', null, 1020, 85, 995, 90);
            this.drawWorkstation(g, 980, 110, 'invalid', 'D16', 30, 50, 'right', null, 1020, 135, 995, 140);
        }
        
        this.svg.appendChild(g);
    }
    
    // ===== DRAWING UTILITIES =====
    
    createGroup(id) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", id);
        return g;
    }
    
    drawWall(parent, points, isOutline) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        if (isOutline) {
            d += ' Z';
        }
        
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.colors.wallStroke);
        path.setAttribute("stroke-width", isOutline ? 4 : 2);
        path.setAttribute("stroke-linecap", "square");
        path.setAttribute("stroke-linejoin", "miter");
        
        parent.appendChild(path);
    }
    
    drawLine(parent, points, color, width) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", points[0].x);
        line.setAttribute("y1", points[0].y);
        line.setAttribute("x2", points[1].x);
        line.setAttribute("y2", points[1].y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", width);
        line.setAttribute("stroke-linecap", "square");
        
        parent.appendChild(line);
    }
    
    drawDesk(parent, x, y, width, height, status, id) {
        console.log({id, status})
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "desk");
        g.setAttribute("data-desk-id", id);
        
        // Desk rectangle
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x - width/2);
        rect.setAttribute("y", y - height/2);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", this.colors[status]);
        rect.setAttribute("stroke", this.colors.wallStroke);
        rect.setAttribute("stroke-width", 1.5);
        rect.setAttribute("rx", 2);
        
        // Desk ID label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#ffffff");
        text.textContent = id;
        
        g.appendChild(rect);
        g.appendChild(text);
        
        // Add visual marker for occupied desks
        if (status === 'invalid') {
            const occupiedIcon = document.createElementNS("http://www.w3.org/2000/svg", "text");
            occupiedIcon.setAttribute("x", x - width/2 - 12);
            occupiedIcon.setAttribute("y", y + 6);
            occupiedIcon.setAttribute("font-size", "16");
            occupiedIcon.setAttribute("text-anchor", "middle");
            occupiedIcon.textContent = "🧑‍💼";
            g.appendChild(occupiedIcon);
        }
        
        parent.appendChild(g);
    }
    
    drawDoor(parent, x, y, orientation) {
        const doorWidth = orientation === 'horizontal' ? 40 : 4;
        const doorHeight = orientation === 'horizontal' ? 4 : 40;
        
        const door = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        door.setAttribute("x", x - doorWidth/2);
        door.setAttribute("y", y - doorHeight/2);
        door.setAttribute("width", doorWidth);
        door.setAttribute("height", doorHeight);
        door.setAttribute("fill", "#ffffff");
        door.setAttribute("stroke", this.colors.wallStroke);
        door.setAttribute("stroke-width", 2);
        
        // Door arc
        const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
        if (orientation === 'horizontal') {
            arc.setAttribute("d", `M ${x - 20} ${y} Q ${x} ${y - 20} ${x + 20} ${y}`);
        } else {
            arc.setAttribute("d", `M ${x} ${y - 20} Q ${x + 20} ${y} ${x} ${y + 20}`);
        }
        arc.setAttribute("fill", "none");
        arc.setAttribute("stroke", this.colors.interiorLine);
        arc.setAttribute("stroke-width", 1);
        arc.setAttribute("stroke-dasharray", "2,2");
        
        parent.appendChild(door);
        parent.appendChild(arc);
    }
    
    drawWindow(parent, x, y, length, orientation) {
        const windowWidth = orientation === 'horizontal' ? length : 6;
        const windowHeight = orientation === 'horizontal' ? 6 : length;
        
        const window = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        window.setAttribute("x", x - windowWidth/2);
        window.setAttribute("y", y - windowHeight/2);
        window.setAttribute("width", windowWidth);
        window.setAttribute("height", windowHeight);
        window.setAttribute("fill", "#e0f2fe");
        window.setAttribute("stroke", this.colors.wallStroke);
        window.setAttribute("stroke-width", 2);
        
        // Window panes
        if (orientation === 'horizontal') {
            const divider = document.createElementNS("http://www.w3.org/2000/svg", "line");
            divider.setAttribute("x1", x);
            divider.setAttribute("y1", y - 3);
            divider.setAttribute("x2", x);
            divider.setAttribute("y2", y + 3);
            divider.setAttribute("stroke", this.colors.wallStroke);
            divider.setAttribute("stroke-width", 1);
            parent.appendChild(divider);
        } else {
            const divider = document.createElementNS("http://www.w3.org/2000/svg", "line");
            divider.setAttribute("x1", x - 3);
            divider.setAttribute("y1", y);
            divider.setAttribute("x2", x + 3);
            divider.setAttribute("y2", y);
            divider.setAttribute("stroke", this.colors.wallStroke);
            divider.setAttribute("stroke-width", 1);
            parent.appendChild(divider);
        }
        
        parent.appendChild(window);
    }
    
    drawLabel(parent, x, y, text, fontSize = 12, fontWeight = 'normal') {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x);
        label.setAttribute("y", y);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-family", "Arial, sans-serif");
        label.setAttribute("font-size", fontSize);
        label.setAttribute("font-weight", fontWeight);
        label.setAttribute("fill", this.colors.text);
        label.textContent = text;
        
        parent.appendChild(label);
    }
    
    drawWorkstation(parent, x, y, status, id, width = 45, height = 35, chairPosition = 'top', rotation = null, chairX = null, chairY = null, textX = null, textY = null) {
        console.log({id, status})
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "workstation");
        g.setAttribute("data-desk-id", id);
        
        // Main desk rectangle (x, y is top-left corner, NOT center)
        const desk = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        desk.setAttribute("x", x);
        desk.setAttribute("y", y);
        desk.setAttribute("width", width);
        desk.setAttribute("height", height);
        desk.setAttribute("fill", this.colors[status]);
        desk.setAttribute("stroke", this.colors.wallStroke);
        desk.setAttribute("stroke-width", 2);
        desk.setAttribute("rx", 3);
        
        // Add rotation if specified
        if (rotation) {
            desk.setAttribute("transform", rotation);
        }
        
        // Calculate center for text
        const centerX = textX !== null ? textX : (x + width / 2);
        const centerY = textY !== null ? textY : (y + height / 2);
        
        // Desk ID label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", centerX);
        text.setAttribute("y", centerY + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.setAttribute("font-size", "12");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#ffffff");
        text.textContent = id.replace('D', '');
        
        // Chair position
        let finalChairX, finalChairY;
        
        if (chairX !== null && chairY !== null) {
            // Custom chair position provided
            finalChairX = chairX;
            finalChairY = chairY;
        } else {
            // Calculate chair position based on direction
            switch(chairPosition) {
                case 'left':
                    finalChairX = x - 10;
                    finalChairY = y + height / 2;
                    break;
                case 'right':
                    finalChairX = x + width + 10;
                    finalChairY = y + height / 2;
                    break;
                case 'top':
                    finalChairX = x + width / 2;
                    finalChairY = y - 10;
                    break;
                case 'bottom':
                    finalChairX = x + width / 2;
                    finalChairY = y + height + 10;
                    break;
                default:
                    finalChairX = x + width / 2;
                    finalChairY = y - 10;
            }
        }
        
        // Chair indicator (small circle)
        const chair = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        chair.setAttribute("cx", finalChairX);
        chair.setAttribute("cy", finalChairY);
        chair.setAttribute("r", 4);
        chair.setAttribute("fill", '#94a3b8');
        chair.setAttribute("stroke", this.colors.wallStroke);
        chair.setAttribute("stroke-width", 1);
        
        g.appendChild(desk);
        g.appendChild(chair);
        g.appendChild(text);
        
        parent.appendChild(g);
    }
    
    drawStaircase(parent, x, y, width, height) {
        // Staircase outline
        const stairsOutline = [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height }
        ];
        this.drawWall(parent, stairsOutline, false);
        
        // Draw individual steps
        const numSteps = 7;
        for(let i = 0; i < numSteps; i++) {
            const stepY = y + 10 + (i * (height - 20) / numSteps);
            this.drawLine(parent, 
                [{x: x + 5, y: stepY}, {x: x + width - 5, y: stepY}], 
                this.colors.interiorLine, 1.5);
        }
        
        // Stair direction arrow
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "text");
        arrow.setAttribute("x", x + width/2);
        arrow.setAttribute("y", y + height/2 + 8);
        arrow.setAttribute("text-anchor", "middle");
        arrow.setAttribute("font-size", "24");
        arrow.textContent = "⬇️";
        parent.appendChild(arrow);
        
        // Label
        this.drawLabel(parent, x + width/2, y - 8, 'Stairs', 10, 'bold');
    }
    
    // Public method to export SVG
    exportSVG() {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.svg);
        return svgString;
    }
    
    // Public method to download SVG
    downloadSVG(filename = 'floor-plan.svg') {
        const svgData = this.exportSVG();
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Global reference
window.ArchitecturalFloorPlan = ArchitecturalFloorPlan;
