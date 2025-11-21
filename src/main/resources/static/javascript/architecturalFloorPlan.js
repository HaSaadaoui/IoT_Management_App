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
        }
        
        // Add sensor overlay if not DESK mode
        if (this.sensorMode !== 'DESK' && window.SensorOverlayManager) {
            this.overlayManager = new SensorOverlayManager(this.svg);
            const sensors = this.generateSensorData(this.sensorMode, this.floorData.floorNumber);
            this.overlayManager.setSensorMode(this.sensorMode, sensors);
        }
    }
    
    generateSensorData(mode, floor) {
        const positions = [
            {x: 200, y: 150}, {x: 400, y: 150}, {x: 600, y: 150},
            {x: 200, y: 300}, {x: 400, y: 300}, {x: 600, y: 300},
            {x: 200, y: 450}, {x: 400, y: 450}, {x: 600, y: 450}
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
        
        // Same building outline as Floor 2
        const mainOutline = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, mainOutline, true);
        
        // Entrance area (bottom center)
        const entrancePath = [
            { x: 350, y: 550 },
            { x: 350, y: 520 },
            { x: 450, y: 520 },
            { x: 450, y: 550 }
        ];
        this.drawWall(g, entrancePath, false);
        
        // Main corridor (vertical - center)
        const corridorLeft = [
            { x: 380, y: 520 },
            { x: 380, y: 80 }
        ];
        this.drawLine(g, corridorLeft, this.colors.interiorLine, 2);
        
        const corridorRight = [
            { x: 420, y: 520 },
            { x: 420, y: 80 }
        ];
        this.drawLine(g, corridorRight, this.colors.interiorLine, 2);
        
        // Left wing - Open space
        const leftWingWall = [
            { x: 100, y: 200 },
            { x: 380, y: 200 }
        ];
        this.drawLine(g, leftWingWall, this.colors.interiorLine, 2);
        
        // Right wing - Open space
        const rightWingWall = [
            { x: 420, y: 200 },
            { x: 700, y: 200 }
        ];
        this.drawLine(g, rightWingWall, this.colors.interiorLine, 2);
        
        // Meeting room (top left)
        const meetingRoom = [
            { x: 100, y: 50 },
            { x: 280, y: 50 },
            { x: 280, y: 200 },
            { x: 100, y: 200 }
        ];
        this.drawWall(g, meetingRoom, false);
        
        // Meeting room door
        this.drawDoor(g, 280, 125, 'vertical');
        
        // Server room (top right)
        const serverRoom = [
            { x: 520, y: 50 },
            { x: 700, y: 50 },
            { x: 700, y: 200 },
            { x: 520, y: 200 }
        ];
        this.drawWall(g, serverRoom, false);
        
        // Server room door
        this.drawDoor(g, 520, 125, 'vertical');
        
        // Windows (top wall)
        this.drawWindow(g, 320, 50, 60, 'horizontal');
        this.drawWindow(g, 440, 50, 60, 'horizontal');
        
        // Windows (left wall)
        this.drawWindow(g, 100, 300, 80, 'vertical');
        this.drawWindow(g, 100, 420, 80, 'vertical');
        
        // Windows (right wall)
        this.drawWindow(g, 700, 300, 80, 'vertical');
        this.drawWindow(g, 700, 420, 80, 'vertical');
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // DESKS - Left open space (4 desks in 2x2 grid)
            const leftDesks = [
                { id: 'D1', x: 150, y: 250, status: 'free' },
                { id: 'D2', x: 240, y: 250, status: 'used' },
                { id: 'D3', x: 150, y: 350, status: 'free' },
                { id: 'D4', x: 240, y: 350, status: 'free' }
            ];
            
            leftDesks.forEach(desk => {
                this.drawDesk(g, desk.x, desk.y, 60, 40, desk.status, desk.id);
            });
            
            // DESKS - Right open space (4 desks in 2x2 grid)
            const rightDesks = [
                { id: 'D5', x: 500, y: 250, status: 'used' },
                { id: 'D6', x: 590, y: 250, status: 'free' },
                { id: 'D7', x: 500, y: 350, status: 'free' },
                { id: 'D8', x: 590, y: 350, status: 'used' }
            ];
            
            rightDesks.forEach(desk => {
                this.drawDesk(g, desk.x, desk.y, 60, 40, desk.status, desk.id);
            });
        }
        
        // Labels
        this.drawLabel(g, 190, 120, 'Meeting Room', 12);
        this.drawLabel(g, 610, 120, 'Server Room', 12);
        this.drawLabel(g, 220, 220, 'Open Space', 14, 'bold');
        this.drawLabel(g, 560, 220, 'Open Space', 14, 'bold');
        this.drawLabel(g, 400, 300, 'Corridor', 12);
        
        this.svg.appendChild(g);
    }
    
    drawFloor1() {
        const g = this.createGroup('floor-1');
        
        // Same building outline as Floor 2
        const mainOutline = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 }
        ];
        this.drawWall(g, mainOutline, true);
        
        // Horizontal corridor
        const corridorTop = [
            { x: 100, y: 280 },
            { x: 700, y: 280 }
        ];
        this.drawLine(g, corridorTop, this.colors.interiorLine, 2);
        
        const corridorBottom = [
            { x: 100, y: 320 },
            { x: 700, y: 320 }
        ];
        this.drawLine(g, corridorBottom, this.colors.interiorLine, 2);
        
        // Vertical dividers
        this.drawLine(g, [{ x: 400, y: 50 }, { x: 400, y: 280 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 400, y: 320 }, { x: 400, y: 550 }], this.colors.interiorLine, 2);
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // Top left section - 3 desks
            const topLeftDesks = [
                { id: 'D1', x: 150, y: 100, status: 'free' },
                { id: 'D2', x: 250, y: 100, status: 'used' },
                { id: 'D3', x: 150, y: 180, status: 'free' }
            ];
            topLeftDesks.forEach(desk => {
                this.drawDesk(g, desk.x, desk.y, 60, 40, desk.status, desk.id);
            });
            
            // Top right section - 3 desks
            const topRightDesks = [
                { id: 'D4', x: 500, y: 100, status: 'invalid' },
                { id: 'D5', x: 600, y: 100, status: 'free' },
                { id: 'D6', x: 500, y: 180, status: 'used' }
            ];
            topRightDesks.forEach(desk => {
                this.drawDesk(g, desk.x, desk.y, 60, 40, desk.status, desk.id);
            });
            
            // Bottom left section - 3 desks
            const bottomLeftDesks = [
                { id: 'D7', x: 150, y: 370, status: 'free' },
                { id: 'D8', x: 250, y: 370, status: 'free' },
                { id: 'D9', x: 150, y: 470, status: 'used' }
            ];
            bottomLeftDesks.forEach(desk => {
                this.drawDesk(g, desk.x, desk.y, 60, 40, desk.status, desk.id);
            });
            
            // Bottom right section - 3 desks
            const bottomRightDesks = [
                { id: 'D10', x: 500, y: 370, status: 'free' },
                { id: 'D11', x: 600, y: 370, status: 'used' },
                { id: 'D12', x: 500, y: 470, status: 'free' }
            ];
            bottomRightDesks.forEach(desk => {
                this.drawDesk(g, desk.x, desk.y, 60, 40, desk.status, desk.id);
            });
        }
        
        // Windows
        this.drawWindow(g, 200, 50, 80, 'horizontal');
        this.drawWindow(g, 500, 50, 80, 'horizontal');
        this.drawWindow(g, 100, 150, 60, 'vertical');
        this.drawWindow(g, 700, 150, 60, 'vertical');
        
        // Labels
        this.drawLabel(g, 250, 230, 'Work Area A', 14, 'bold');
        this.drawLabel(g, 550, 230, 'Work Area B', 14, 'bold');
        this.drawLabel(g, 400, 300, 'Main Corridor', 12);
        
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
        
        // Desks will be added later per your instruction
        
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
        this.drawWindow(g, 120, 50, 80, 'horizontal');  // rect x=80
        this.drawWindow(g, 290, 50, 80, 'horizontal');  // rect x=250
        this.drawWindow(g, 430, 50, 80, 'horizontal');  // rect x=390
        this.drawWindow(g, 550, 50, 80, 'horizontal');  // rect x=510
        this.drawWindow(g, 650, 50, 80, 'horizontal');  // rect x=610
        this.drawWindow(g, 820, 50, 80, 'horizontal');  // rect x=780
        this.drawWindow(g, 980, 50, 80, 'horizontal');  // rect x=940
        
        // Desks will be added later per your instruction
        
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
        this.drawWindow(g, 120, 50, 80, 'horizontal');  // rect x=80
        this.drawWindow(g, 290, 50, 80, 'horizontal');  // rect x=250
        this.drawWindow(g, 430, 50, 80, 'horizontal');  // rect x=390
        this.drawWindow(g, 550, 50, 80, 'horizontal');  // rect x=510
        this.drawWindow(g, 650, 50, 80, 'horizontal');  // rect x=610
        this.drawWindow(g, 820, 50, 80, 'horizontal');  // rect x=780
        this.drawWindow(g, 980, 50, 80, 'horizontal');  // rect x=940
        
        // Desks will be added later per your instruction
        
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
            const desks = [
                // Top row - vertical desks (width=30, height=50)
                { id: 'D05', x: 300, y: 60, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D06', x: 330, y: 60, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D07', x: 460, y: 60, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D09', x: 490, y: 60, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D11', x: 620, y: 60, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D14', x: 650, y: 60, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D17', x: 790, y: 60, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D19', x: 820, y: 60, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D21', x: 950, y: 60, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D23', x: 980, y: 60, width: 30, height: 50, chair: 'right', status: 'free' },
                
                // Left cluster - horizontal desks (width=50, height=30)
                { id: 'D01', x: 110, y: 90, width: 50, height: 30, chair: 'top', status: 'free' },
                { id: 'D03', x: 160, y: 90, width: 50, height: 30, chair: 'top', status: 'free' },
                { id: 'D02', x: 110, y: 120, width: 50, height: 30, chair: 'bottom', status: 'free' },
                { id: 'D04', x: 160, y: 120, width: 50, height: 30, chair: 'bottom', status: 'free' },
                
                // Middle row - vertical desks
                { id: 'D08', x: 460, y: 110, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D10', x: 490, y: 110, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D12', x: 620, y: 110, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D15', x: 650, y: 110, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D18', x: 790, y: 110, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D20', x: 820, y: 110, width: 30, height: 50, chair: 'right', status: 'free' },
                { id: 'D22', x: 950, y: 110, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D24', x: 980, y: 110, width: 30, height: 50, chair: 'right', status: 'free' },
                
                // Bottom row - vertical desks
                { id: 'D13', x: 620, y: 160, width: 30, height: 50, chair: 'left', status: 'free' },
                { id: 'D16', x: 650, y: 160, width: 30, height: 50, chair: 'right', status: 'free' }
            ];
            
            desks.forEach(desk => {
                this.drawWorkstation(g, desk.x, desk.y, desk.status, desk.id, desk.width, desk.height, desk.chair);
            });
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
        if (status === 'used') {
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
    
    drawWorkstation(parent, x, y, status, id, width = 45, height = 35, chairPosition = 'top') {
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
        
        // Calculate center for text
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        // Desk ID label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", centerX);
        text.setAttribute("y", centerY + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.setAttribute("font-size", "12");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#ffffff");
        text.textContent = id;
        
        // Chair position based on direction
        let chairX, chairY;
        switch(chairPosition) {
            case 'left':
                chairX = x - 10;
                chairY = centerY;
                break;
            case 'right':
                chairX = x + width + 10;
                chairY = centerY;
                break;
            case 'top':
                chairX = centerX;
                chairY = y - 10;
                break;
            case 'bottom':
                chairX = centerX;
                chairY = y + height + 10;
                break;
            default:
                chairX = centerX;
                chairY = y - 10;
        }
        
        // Chair indicator (small circle)
        const chair = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        chair.setAttribute("cx", chairX);
        chair.setAttribute("cy", chairY);
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
