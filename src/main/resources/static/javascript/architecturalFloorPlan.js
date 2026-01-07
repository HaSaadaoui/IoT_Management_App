// ===== ARCHITECTURAL FLOOR PLAN - CEILING VIEW =====
// Professional architectural drawing system matching "Occupation Live" style
async function fetchLiveSensorValues(buildingKey, floor, mode) {
      const params = new URLSearchParams({
        building: buildingKey,     // "LEVALLOIS"
        floor: String(floor),      // "3"
        sensorType: mode           // "CO2", "TEMP", "NOISE", ...
      });

      const resp = await fetch(`/api/sensors/live?${params.toString()}`);
      if (!resp.ok) throw new Error("dashboard error");

      const data = await resp.json(); // DashboardData
      const map = new Map();



      if (!Array.isArray(data)) {
        console.warn("Unexpected live sensors payload", data);
        return map;
      }

      data.forEach(sensor => {
        if (sensor.sensorId && sensor.value != null) {
          map.set(sensor.sensorId, Number(sensor.value)); // conversion string → number
        }
      });

  return map;
}


class ArchitecturalFloorPlan {
    constructor(
        containerId,
        floorData,
        sensorMode = "DESK",
        buildingKey = "CHATEAUDUN",
        svgPath
    ) {
        this.container = document.getElementById(containerId);
        this.floorData = floorData;
        this.sensorMode = sensorMode;
        this.svg = null;
        this.scale = 40; // pixels per meter
        this.strokeWidth = 2;
        this.wallThickness = 0.2; // meters
        this.overlayManager = null;
        this.buildingKey = buildingKey;
        this.svgPath = svgPath;

        // Colors matching screenshot
        this.colors = {
            wallStroke: "#000000",
            wallFill: "#ffffff",
            interiorLine: "#d1d5db",
            free: okColor,
            used: notOkColor,
            invalid: otherColor,
            background: "#ffffff",
            text: "#374151",
        };

        // Dans constructor(...)
        this.es = null;
        this.liveValueMap = new Map();
        this.isLive = false;

        this.floorEs = null;
        this.liveValueMap = new Map();



        this.init();
    }

    init() {
        this.createSVG();
    }












    stopFloorSSE() {
      if (this.floorEs) {
        this.floorEs.close();
        this.floorEs = null;
      }
    }

    /*
    startFloorSSE() {
      this.stopFloorSSE();

      const params = new URLSearchParams({
        building: this.buildingKey,
        floor: String(this.floorData.floorNumber),
        sensorType: this.sensorMode
      });

      this.floorEs = new EventSource(`/api/sensors/live/stream?${params.toString()}`);

      this.floorEs.onmessage = (evt) => {
        try {
          console.log("onmessage evt data: " + evt.data);
          const msg = JSON.parse(evt.data);
          console.log("msg JSON: " + msg);
          if (!msg.sensorId) return;

          const v = (typeof msg.value === "number") ? msg.value : Number(msg.value);
          if (Number.isNaN(v)) return;

          this.liveValueMap.set(msg.sensorId, v);
          console.log("liveValueMap: " + this.liveValueMap);

          const sensors = this.generateSensorData(this.sensorMode, this.floorData.floorNumber, this.liveValueMap);
          this.overlayManager?.setSensorMode(this.sensorMode, sensors);
        } catch (e) {
          console.warn("Floor SSE parse error", e);
        }
      };

      this.floorEs.onerror = (e) => {
        console.warn("Floor SSE error", e);
        // EventSource va auto-retry
      };
    }*/

    startFloorSSE() {
      this.stopFloorSSE();

      const params = new URLSearchParams({
        building: this.buildingKey,
        floor: String(this.floorData.floorNumber),
        sensorType: this.sensorMode
      });

      this.floorEs = new EventSource(`/api/sensors/live/stream?${params}`);

      this.floorEs.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          console.log("onmessage: " + msg);


          if (!msg.sensorId) return;

          const value = Number(msg.value);
          console.log("value: " + value);
          if (Number.isNaN(value)) return;

          // 1️⃣ Mise à jour Map
          this.liveValueMap.set(msg.sensorId, value);
          console.log("liveValueMap: " +this.liveValueMap);

          // 2️⃣ Regénérer les capteurs à partir de la Map
          const sensors = this.generateSensorData(
            this.sensorMode,
            this.floorData.floorNumber,
            this.liveValueMap
          );

          // 3️⃣ Rafraîchir l’overlay
          this.overlayManager?.setSensorMode(this.sensorMode, sensors);

        } catch (e) {
          console.warn("Floor SSE parse error", e);
        }
      };

      this.floorEs.onerror = (e) => {
        console.warn("Floor SSE error", e);
      };
    }







    createSVG() {
        // Clear container
        this.container.innerHTML = "";

        // Create SVG element
        const svgNS = "http://www.w3.org/2000/svg";
        this.svg = document.createElementNS(svgNS, "svg");
        this.svg.setAttribute("width", "100%");
        this.svg.setAttribute("height", "100%");
        this.svg.setAttribute("viewBox", "0 0 1200 1200");
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        this.svg.style.background = this.colors.background;

        this.container.appendChild(this.svg);
    }

    async drawFloorPlan(deskOccupancy = {}) {
        // Clear any existing floor plan before drawing a new one
        this.init();

        // Draw based on floor number
        switch (this.buildingKey) {
            case "CHATEAUDUN":
                switch (this.floorData.floorNumber) {
                    case 0:
                        this.drawGroundFloorChateaudun(deskOccupancy);
                        break;
                    case 1:
                        this.drawFloor1(deskOccupancy);
                        break;
                    case 2:
                        this.drawFloor2(deskOccupancy);
                        break;
                    case 3:
                        this.drawFloor3(deskOccupancy);
                        break;
                    case 4:
                        this.drawFloor4(deskOccupancy);
                        break;
                    case 5:
                        this.drawFloor5(deskOccupancy);
                        break;
                    case 6:
                        this.drawFloor6(deskOccupancy);
                        break;
                }
                break;
            case "LEVALLOIS":
                switch (this.floorData.floorNumber) {
                    case 3:
                        this.drawFloorLevallois(deskOccupancy);
                        break;
                }
                break;
            default:
                await this.drawGroundFloorSVG(deskOccupancy);
                break;
        }

        // Add sensor overlay if not DESK mode
        /*
        if (this.sensorMode !== "DESK" && window.SensorOverlayManager) {
            this.overlayManager = new SensorOverlayManager(this.svg);
            const sensors = this.generateSensorData(
                this.sensorMode,
                this.floorData.floorNumber,
            );
            this.overlayManager.setSensorMode(this.sensorMode, sensors);
        }*/

        if (this.sensorMode !== "DESK" && window.SensorOverlayManager) {
          /*let valueMap = null;
          try {
            valueMap = await fetchLiveSensorValues(
              this.buildingKey,
              this.floorData.floorNumber,
              this.sensorMode
            );
          } catch (e) {
            console.warn("Live values error, fallback random", e);
          }

          const sensors = this.generateSensorData(
            this.sensorMode,
            this.floorData.floorNumber,
            valueMap
          );

          this.overlayManager = new SensorOverlayManager(this.svg);
          this.overlayManager.setSensorMode(this.sensorMode, sensors);*/


          // 1️⃣ Créer l’overlay UNE FOIS
          this.overlayManager = new SensorOverlayManager(this.svg);

          // 2️⃣ Dessin initial (valeurs fallback)
          const sensors = this.generateSensorData(
            this.sensorMode,
            this.floorData.floorNumber,
            this.liveValueMap
          );
          this.overlayManager.setSensorMode(this.sensorMode, sensors);

          // 3️⃣ Démarrer le SSE
          this.startFloorSSE();
        }
        // On modifie le SVG pour le centrer sur l'écran
        this.centerSVGContent({ targetWidth: 1200, targetHeight: 1200, padding: 20, fit: true });

    }

    generateSensorData(mode, floor, valueMap = null) {
        const LEVALLOIS_F3_SENSOR_POSITIONS = {
          CO2: [
                { id: "co2-03-01", x: 690, y: 290 }, // au-dessus de D01–D06
                { id: "co2-03-02",   x: 190, y: 350 }, // proche du bloc suivant
                { id: "co2-03-03",  x: 630, y: 425 }, // bloc encore à gauche
          ],
          TEMP: [
                 { id: "tempex-03-01", x: 320, y: 180 },
          ],
          LIGHT: [
                  { id: "eye-03-01", x: 500, y: 210 }, // au-dessus de D07–D09
                  { id: "eye-03-03", x: 90, y: 420 }, // au-dessus de D41
                  { id: "eye-03-03", x: 490, y: 465 }, // au-dessus de D72
          ],
          NOISE: [
                  { id: "son-03-01", x: 70, y: 315 }, // au-dessus de D36
                  { id: "son-03-02", x: 700, y: 250 }, // bloc milieu
                  { id: "son-03-03", x: 630, y: 440 }, // au-dessus de D81–D82
                  { id: "son-03-04", x: 920, y: 205 }, // côté OM
          ]
          // TODO add other sensors
        };

          // Positions spécifiques Levallois, étage 3


          console.log("LIVE MAP:", Array.from(valueMap?.entries() ?? []));

          if (this.buildingKey === "LEVALLOIS" && floor === 3) {
            const floorConfig = LEVALLOIS_F3_SENSOR_POSITIONS[mode];

            if (floorConfig && floorConfig.length) {
              return floorConfig.map((pos) => {
                console.log("Pos: " + pos);
                console.log("valueMap: " + valueMap);
                const live =
                  valueMap?.get(pos.id) ??
                  valueMap?.get("*ALL*") ??
                  this.getRandomSensorValue(mode);

                return {
                  id: pos.id,
                  type: mode,
                  floor,
                  x: pos.x,
                  y: pos.y,
                  value: live,
                  status: "normal",
                  presence: false,
                  alert: false,
                  direction: 0,
                  intensity: 1,
                  message: "OK",
                  timestamp: new Date().toISOString(),
                };
              });
            }
          }

        // Updated positions to match new building schema
        // Building spans: x: 50-1050, y: 50-450 (with angular shape)
        const positions = [
            // Top row
            //{x: 150, y: 100}, {x: 350, y: 100}, {x: 550, y: 100}, {x: 950, y: 100},
            // Middle row
            { x: 150, y: 130 },
            { x: 400, y: 130 },
            { x: 600, y: 130 },
           // { x: 900, y: 130 },
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
            status: Math.random() > 0.7 ? "active" : "normal",
            presence: Math.random() > 0.5,
            alert: Math.random() > 0.8,
            direction: Math.floor(Math.random() * 360),
            intensity: Math.random() * 2 + 0.5,
            message: "OK",
            timestamp: new Date().toISOString(),
        }));
    }

    getRandomSensorValue(mode) {
        switch (mode) {
            case "CO2":
                return Math.floor(Math.random() * 1000) + 400;
            case "TEMP":
                return Math.floor(Math.random() * 10) + 18;
            case "LIGHT":
                return Math.floor(Math.random() * 1000) + 100;
            case "NOISE":
                return Math.floor(Math.random() * 40) + 30;
            case "HUMIDITY":
                return Math.floor(Math.random() * 40) + 30;
            case "TEMPEX":
                return Math.floor(Math.random() * 8) + 19;
            default:
                return 0;
        }
    }





    async drawGroundFloorSVG(deskOccupancy = {}) {

        const g = this.createGroup("content-root");
        
        if (!this.svgPath) {
            console.warn('Aucun svgPath fourni');
            return;
        }

        // Charger le SVG externe
        let raw;
        try {
            const resp = await fetch(this.svgPath);
            raw = await resp.text();
        } catch (e) {
            console.error('Erreur de chargement du SVG', e);
            return;
        }

        // Parser le contenu
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "image/svg+xml");

        const graphicSelector = [
            'path',
            'rect',
            'circle',
            'ellipse',
            'line',
            'polyline',
            'polygon',
            'text',
            'use'
        ].join(', ');

        const elements = Array.from(doc.querySelectorAll(graphicSelector));
        if (!elements.length) {
            console.warn('SVG sans éléments graphiques');
            return;
        }

        elements.forEach(el => {
            const importedEl = document.importNode(el, true);
            importedEl.setAttribute('fill', 'none');
            importedEl.setAttribute('stroke', this.colors.wallStroke);
            importedEl.setAttribute('stroke-width', 4);
            importedEl.setAttribute('stroke-linecap', 'square');
            importedEl.setAttribute('stroke-linejoin', 'miter');
            importedEl.setAttribute('vector-effect', 'non-scaling-stroke');
            g.appendChild(importedEl);
        });

        this.svg.appendChild(g);
    }

    drawFloorLevallois(deskOccupancy = {}) {
        const g = this.createGroup('content-root');
        
        // Main building outline
        const outerWall = [
            { x: 200, y: 200 },
            { x: 900, y: 200 },
            { x: 900, y: 50 },
            { x: 1150, y: 50 },
            { x: 1150, y: 500 },
            { x: 200, y: 500 }
        ]

        this.drawWall(g, outerWall, true);
        this.drawCircle(g, 200, 200, 150, 150, 0, 0, 0, 200, 500, true);
        
        // Internal separator lines (stairs, technical rooms)
        // To respect exterior wall width, we offset lines by 4px
        this.drawLine(g, [{ x: 1000, y: 54 }, { x: 1000, y: 370 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 1000, y: 370 }, { x: 1154, y: 370 }], this.colors.interiorLine, 2);

        this.drawLine(g, [{ x: 950, y: 370 }, { x: 950, y: 320 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 950, y: 320 }, { x: 1000, y: 320 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 1000, y: 370 }, { x: 950, y: 370 }], this.colors.interiorLine, 2);

        // Left Staircase
        this.drawLine(g, [{ x: 200, y: 310 }, { x: 450, y: 310 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 450, y: 310 }, { x: 450, y: 380 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 450, y: 380 }, { x: 200, y: 380 }], this.colors.interiorLine, 2);
        this.drawLine(g, [{ x: 200, y: 380 }, { x: 200, y: 310 }], this.colors.interiorLine, 2);

        // Meeting rooms, offices 
        // Bottom side rooms
        this.drawLine(g, [{ x: 1150, y: 400 }, { x: 650, y: 400 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 1100, y: 400 }, { x: 1100, y: 500 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 1050, y: 400 }, { x: 1050, y: 500 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 1000, y: 400 }, { x: 1000, y: 500 }], this.colors.wallStroke, 2);       
        this.drawLine(g, [{ x: 950, y: 400 }, { x: 950, y: 500 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 875, y: 400 }, { x: 875, y: 500 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 800, y: 400 }, { x: 800, y: 500 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 650, y: 400 }, { x: 650, y: 500 }], this.colors.wallStroke, 2);

        // Meeting room 20 seats
        this.drawLine(g, [{ x: 1000, y: 150 }, { x: 900, y: 150 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 1000, y: 50 }, { x: 1000, y: 150 }], this.colors.wallStroke, 2);

        // Top side rooms
        this.drawLine(g, [{ x: 700, y: 300 }, { x: 950, y: 300 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 850, y: 300 }, { x: 850, y: 200 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 800, y: 300 }, { x: 800, y: 200 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 750, y: 300 }, { x: 750, y: 200 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 700, y: 300 }, { x: 700, y: 200 }], this.colors.wallStroke, 2);

        // Middle rooms
        this.drawLine(g, [{ x: 920, y: 320 }, { x: 500, y: 320 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 920, y: 370 }, { x: 500, y: 370 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 920, y: 320 }, { x: 920, y: 370 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 500, y: 320 }, { x: 500, y: 370 }], this.colors.wallStroke, 2);

        this.drawLine(g, [{ x: 265, y: 290 }, { x: 325, y: 290 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 265, y: 310 }, { x: 325, y: 310 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 265, y: 290 }, { x: 265, y: 310 }], this.colors.wallStroke, 2);
        this.drawLine(g, [{ x: 325, y: 290 }, { x: 325, y: 310 }], this.colors.wallStroke, 2);

        // Windows 
        this.drawWindow(g, 1100, 500, 50, 'horizontal');

        // Doors
        this.drawDoor(g, 1000, 200, 40, 4, 'vertical'); // Main entrance
        this.drawDoor(g, 985, 150, 30, 4, 'horizontal');
        this.drawDoor(g, 1140, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 1060, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 1040, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 960, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 940, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 810, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 660, 400, 20, 4, 'horizontal');
        this.drawDoor(g, 740, 300, 20, 4, 'horizontal');
        this.drawDoor(g, 760, 300, 20, 4, 'horizontal');
        this.drawDoor(g, 655, 320, 20, 4, 'horizontal');
        this.drawDoor(g, 705, 370, 20, 4, 'horizontal');
        this.drawDoor(g, 605, 320, 20, 4, 'horizontal');
        this.drawDoor(g, 280, 290, 20, 4, 'horizontal');
        this.drawDoor(g, 310, 290, 20, 4, 'horizontal');
        
        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === 'DESK') {
            // Interview room 1
            this.drawWorkstation(g, 1110, 425, deskOccupancy["IR2"] || "invalid", 'IR2', 30, 50, 'bottom');
            // Interview room 2
            this.drawWorkstation(g, 1060, 425, deskOccupancy["IR1"] || "invalid", 'IR1', 30, 50, 'bottom');
            // Director Office 1
            this.drawWorkstation(g, 1010, 425, deskOccupancy["B4"] || "invalid", 'B4', 30, 50, 'bottom');
            // Director Office 2
            this.drawWorkstation(g, 960, 425, deskOccupancy["B3"] || "invalid", 'B3', 30, 50, 'bottom');
            // Meeting Room 6 seats 1
            this.drawWorkstation(g, 885, 435, deskOccupancy["SR2"] || "invalid", 'SR2', 50, 30, 'none');
            this.drawChair(g, 900, 420);
            this.drawChair(g, 920, 420);
            this.drawChair(g, 900, 480);
            this.drawChair(g, 920, 480);
            // Meeting Room 6 seats 2
            this.drawWorkstation(g, 810, 435, deskOccupancy["SR1"] || "invalid", 'SR1', 50, 30, 'none');
            this.drawChair(g, 825, 420);
            this.drawChair(g, 845, 420);
            this.drawChair(g, 825, 480);
            this.drawChair(g, 845, 480);
            // Valuement OS
            // Block 1
            this.drawWorkstation(g, 735, 435, deskOccupancy["V07"] || "invalid", '07', 20, 30, 'left');
            this.drawWorkstation(g, 735, 465, deskOccupancy["V06"] || "invalid", '06', 20, 30, 'left');
            this.drawWorkstation(g, 755, 435, deskOccupancy["V09"] || "invalid", '09', 20, 30, 'right');
            this.drawWorkstation(g, 755, 465, deskOccupancy["V10"] || "invalid", '10', 20, 30, 'right');
            this.drawWorkstation(g, 740, 415, deskOccupancy["V08"] || "invalid", '08', 30, 20, 'top');
            // Block 2
            this.drawWorkstation(g, 675, 435, deskOccupancy["V02"] || "invalid", '02', 20, 30, 'left');
            this.drawWorkstation(g, 675, 465, deskOccupancy["V01"] || "invalid", '01', 20, 30, 'left');
            this.drawWorkstation(g, 695, 435, deskOccupancy["V04"] || "invalid", '04', 20, 30, 'right');
            this.drawWorkstation(g, 695, 465, deskOccupancy["V05"] || "invalid", '05', 20, 30, 'right');
            this.drawWorkstation(g, 680, 415, deskOccupancy["V03"] || "invalid", '03', 30, 20, 'top');
            // Open Space 
            // Against the Valuement wall
            this.drawWorkstation(g, 630, 425, deskOccupancy["D82"] || "invalid", 'D82', 20, 30, 'left');
            this.drawWorkstation(g, 630, 455, deskOccupancy["D81"] || "invalid", 'D81', 20, 30, 'left');
            // Bottom Side
            // Block 1
            this.drawWorkstation(g, 570, 405, deskOccupancy["D80"] || "invalid", 'D80', 20, 30, 'right');
            this.drawWorkstation(g, 570, 435, deskOccupancy["D79"] || "invalid", 'D79', 20, 30, 'right');
            this.drawWorkstation(g, 570, 465, deskOccupancy["D78"] || "invalid", 'D78', 20, 30, 'right');
            this.drawWorkstation(g, 550, 405, deskOccupancy["D75"] || "invalid", 'D75', 20, 30, 'left');
            this.drawWorkstation(g, 550, 435, deskOccupancy["D76"] || "invalid", 'D76', 20, 30, 'left');
            this.drawWorkstation(g, 550, 465, deskOccupancy["D77"] || "invalid", 'D77', 20, 30, 'left');
            // Block 2
            this.drawWorkstation(g, 490, 405, deskOccupancy["D74"] || "invalid", 'D74', 20, 30, 'right');
            this.drawWorkstation(g, 490, 435, deskOccupancy["D73"] || "invalid", 'D73', 20, 30, 'right');
            this.drawWorkstation(g, 490, 465, deskOccupancy["D72"] || "invalid", 'D72', 20, 30, 'right');
            this.drawWorkstation(g, 470, 405, deskOccupancy["D69"] || "invalid", 'D69', 20, 30, 'left');
            this.drawWorkstation(g, 470, 435, deskOccupancy["D70"] || "invalid", 'D70', 20, 30, 'left');
            this.drawWorkstation(g, 470, 465, deskOccupancy["D71"] || "invalid", 'D71', 20, 30, 'left');
            // Block 3
            this.drawWorkstation(g, 410, 405, deskOccupancy["D68"] || "invalid", 'D68', 20, 30, 'right');
            this.drawWorkstation(g, 410, 435, deskOccupancy["D67"] || "invalid", 'D67', 20, 30, 'right');
            this.drawWorkstation(g, 410, 465, deskOccupancy["D66"] || "invalid", 'D66', 20, 30, 'right');
            this.drawWorkstation(g, 390, 405, deskOccupancy["D63"] || "invalid", 'D63', 20, 30, 'left');
            this.drawWorkstation(g, 390, 435, deskOccupancy["D64"] || "invalid", 'D64', 20, 30, 'left');
            this.drawWorkstation(g, 390, 465, deskOccupancy["D65"] || "invalid", 'D65', 20, 30, 'left');
            // Block 4
            this.drawWorkstation(g, 330, 405, deskOccupancy["D62"] || "invalid", 'D62', 20, 30, 'right');
            this.drawWorkstation(g, 330, 435, deskOccupancy["D61"] || "invalid", 'D61', 20, 30, 'right');
            this.drawWorkstation(g, 330, 465, deskOccupancy["D60"] || "invalid", 'D60', 20, 30, 'right');
            this.drawWorkstation(g, 310, 405, deskOccupancy["D57"] || "invalid", 'D57', 20, 30, 'left');
            this.drawWorkstation(g, 310, 435, deskOccupancy["D58"] || "invalid", 'D58', 20, 30, 'left');
            this.drawWorkstation(g, 310, 465, deskOccupancy["D59"] || "invalid", 'D59', 20, 30, 'left');
            // Block 5
            this.drawWorkstation(g, 250, 405, deskOccupancy["D56"] || "invalid", 'D56', 20, 30, 'right');
            this.drawWorkstation(g, 250, 435, deskOccupancy["D55"] || "invalid", 'D55', 20, 30, 'right');
            this.drawWorkstation(g, 250, 465, deskOccupancy["D54"] || "invalid", 'D54', 20, 30, 'right');
            this.drawWorkstation(g, 230, 405, deskOccupancy["D51"] || "invalid", 'D51', 20, 30, 'left');
            this.drawWorkstation(g, 230, 435, deskOccupancy["D52"] || "invalid", 'D52', 20, 30, 'left');
            this.drawWorkstation(g, 230, 465, deskOccupancy["D53"] || "invalid", 'D53', 20, 30, 'left');
            // Block 6 
            this.drawWorkstation(g, 170, 400, deskOccupancy["D50"] || "invalid", 'D50', 20, 30, 'right','rotate(25 170 455)',215,435,195,420);
            this.drawWorkstation(g, 170, 430, deskOccupancy["D49"] || "invalid", 'D49', 20, 30, 'right','rotate(25 170 455)',205,455,185,450);
            this.drawWorkstation(g, 170, 460, deskOccupancy["D48"] || "invalid", 'D48', 20, 30, 'right','rotate(25 170 455)',195,480,172,480);
            this.drawWorkstation(g, 150, 400, deskOccupancy["D45"] || "invalid", 'D45', 20, 30, 'left','rotate(25 170 455)',160,410,180,410);
            this.drawWorkstation(g, 150, 430, deskOccupancy["D46"] || "invalid", 'D46', 20, 30, 'left','rotate(25 170 455)',150,435,165,440);
            this.drawWorkstation(g, 150, 460, deskOccupancy["D47"] || "invalid", 'D47', 20, 30, 'left','rotate(25 170 455)',140,460,155,470);
            // Block 7 
            this.drawWorkstation(g, 105, 350, deskOccupancy["D44"] || "invalid", 'D44', 20, 30, 'right','rotate(65 105 405)',155,415,145,400);
            this.drawWorkstation(g, 105, 380, deskOccupancy["D43"] || "invalid", 'D43', 20, 30, 'right','rotate(65 105 405)',125,425,120,410);
            this.drawWorkstation(g, 105, 410, deskOccupancy["D42"] || "invalid", 'D42', 20, 30, 'right','rotate(65 105 405)',100,440,95,420);
            this.drawWorkstation(g, 85, 350, deskOccupancy["D39"] || "invalid", 'D39', 20, 30, 'left','rotate(65 105 405)',130,360,140,375);
            this.drawWorkstation(g, 85, 380, deskOccupancy["D40"] || "invalid", 'D40', 20, 30, 'left','rotate(65 105 405)',95,375,110,390);
            this.drawWorkstation(g, 85, 410, deskOccupancy["D41"] || "invalid", 'D41', 20, 30, 'left','rotate(65 105 405)',80,385,80,405);
            // Open Space left side
            this.drawWorkstation(g, 60, 320, deskOccupancy["D36"] || "invalid", 'D36', 30, 20, 'top');
            this.drawWorkstation(g, 90, 320, deskOccupancy["D35"] || "invalid", 'D35', 30, 20, 'top');
            this.drawWorkstation(g, 60, 340, deskOccupancy["D37"] || "invalid", 'D37', 30, 20, 'bottom');
            this.drawWorkstation(g, 90, 340, deskOccupancy["D38"] || "invalid", 'D38', 30, 20, 'bottom');

            this.drawWorkstation(g, 115, 280, deskOccupancy["D33"] || "invalid", 'D33', 20, 30, 'right','rotate(135 115 275)',80,285,95,270);
            this.drawWorkstation(g, 115, 250, deskOccupancy["D34"] || "invalid", 'D34', 20, 30, 'right','rotate(135 115 275)',100,300,115,290);
            this.drawWorkstation(g, 95, 280, deskOccupancy["D32"] || "invalid", 'D32', 20, 30, 'left','rotate(135 115 275)',120,235,105,250);
            this.drawWorkstation(g, 95, 250, deskOccupancy["D31"] || "invalid", 'D31', 20, 30, 'left','rotate(135 115 275)',135,255,130,270);

            this.drawWorkstation(g, 180, 210, deskOccupancy["D28"] || "invalid", 'D28', 20, 30, 'right');
            this.drawWorkstation(g, 180, 240, deskOccupancy["D27"] || "invalid", 'D27', 20, 30, 'right');
            this.drawWorkstation(g, 160, 210, deskOccupancy["D29"] || "invalid", 'D29', 20, 30, 'left');
            this.drawWorkstation(g, 160, 240, deskOccupancy["D30"] || "invalid", 'D30', 20, 30, 'left');

            this.drawWorkstation(g, 260, 210, deskOccupancy["D24"] || "invalid", 'D24', 20, 30, 'right');
            this.drawWorkstation(g, 260, 240, deskOccupancy["D23"] || "invalid", 'D23', 20, 30, 'right');
            this.drawWorkstation(g, 240, 210, deskOccupancy["D25"] || "invalid", 'D25', 20, 30, 'left');
            this.drawWorkstation(g, 240, 240, deskOccupancy["D26"] || "invalid", 'D26', 20, 30, 'left');

            this.drawWorkstation(g, 340, 210, deskOccupancy["D20"] || "invalid", 'D20', 20, 30, 'right');
            this.drawWorkstation(g, 340, 240, deskOccupancy["D19"] || "invalid", 'D19', 20, 30, 'right');
            this.drawWorkstation(g, 320, 210, deskOccupancy["D21"] || "invalid", 'D21', 20, 30, 'left');
            this.drawWorkstation(g, 320, 240, deskOccupancy["D22"] || "invalid", 'D22', 20, 30, 'left');
            // Open Space top side
            this.drawWorkstation(g, 420, 210, deskOccupancy["D15"] || "invalid", 'D15', 20, 30, 'right');
            this.drawWorkstation(g, 420, 240, deskOccupancy["D14"] || "invalid", 'D14', 20, 30, 'right');
            this.drawWorkstation(g, 420, 270, deskOccupancy["D13"] || "invalid", 'D13', 20, 30, 'right');
            this.drawWorkstation(g, 400, 210, deskOccupancy["D20"] || "invalid", 'D16', 20, 30, 'left');
            this.drawWorkstation(g, 400, 240, deskOccupancy["D19"] || "invalid", 'D17', 20, 30, 'left');
            this.drawWorkstation(g, 400, 270, deskOccupancy["D18"] || "invalid", 'D18', 20, 30, 'left');

            this.drawWorkstation(g, 500, 210, deskOccupancy["D09"] || "invalid", 'D09', 20, 30, 'right');
            this.drawWorkstation(g, 500, 240, deskOccupancy["D08"] || "invalid", 'D08', 20, 30, 'right');
            this.drawWorkstation(g, 500, 270, deskOccupancy["D07"] || "invalid", 'D07', 20, 30, 'right');
            this.drawWorkstation(g, 480, 210, deskOccupancy["D10"] || "invalid", 'D10', 20, 30, 'left');
            this.drawWorkstation(g, 480, 240, deskOccupancy["D11"] || "invalid", 'D11', 20, 30, 'left');
            this.drawWorkstation(g, 480, 270, deskOccupancy["D12"] || "invalid", 'D12', 20, 30, 'left');

            this.drawWorkstation(g, 600, 210, deskOccupancy["D03"] || "invalid", 'D03', 20, 30, 'right');
            this.drawWorkstation(g, 600, 240, deskOccupancy["D02"] || "invalid", 'D02', 20, 30, 'right');
            this.drawWorkstation(g, 600, 270, deskOccupancy["D01"] || "invalid", 'D01', 20, 30, 'right');
            this.drawWorkstation(g, 580, 210, deskOccupancy["D04"] || "invalid", 'D04', 20, 30, 'left');
            this.drawWorkstation(g, 580, 240, deskOccupancy["D05"] || "invalid", 'D05', 20, 30, 'left');
            this.drawWorkstation(g, 580, 270, deskOccupancy["D06"] || "invalid", 'D06', 20, 30, 'left');
            // Desks against the staircase
            this.drawWorkstation(g, 265, 290, deskOccupancy["PB7"] || "invalid", 'PB7', 30, 20, 'none');
            this.drawWorkstation(g, 295, 290, deskOccupancy["PB6"] || "invalid", 'PB6', 30, 20, 'none');
            // Offices
            this.drawWorkstation(g, 760, 230, deskOccupancy["B2"] || "invalid", 'B2', 30, 50, 'top');
            this.drawWorkstation(g, 710, 230, deskOccupancy["B1"] || "invalid", 'B1', 30, 50, 'top');
            // Reception
            this.drawWorkstation(g, 935, 160, deskOccupancy["OM"] || "invalid", 'OM', 30, 60, 'left');
            // Meeting Room 20 seats
            this.drawWorkstation(g, 925, 75, deskOccupancy["SR3"] || "invalid", 'SR3', 50, 50, 'none');
            this.drawChair(g, 930, 60);
            this.drawChair(g, 950, 60);
            this.drawChair(g, 970, 60);

            this.drawChair(g, 910, 85);
            this.drawChair(g, 910, 105);
            this.drawChair(g, 990, 85);
            this.drawChair(g, 990, 105);

            this.drawChair(g, 930, 140);
            this.drawChair(g, 950, 140);
            this.drawChair(g, 970, 140);
            // Desks in the middle
            this.drawWorkstation(g, 500, 320, deskOccupancy["PB5"] || "invalid", 'PB5', 25, 50, 'none');
            this.drawWorkstation(g, 580, 320, deskOccupancy["PB4"] || "invalid", 'PB4', 50, 25, 'none');
            this.drawWorkstation(g, 580, 345, deskOccupancy["PB3"] || "invalid", 'PB3', 50, 25, 'none');
            this.drawWorkstation(g, 630, 320, deskOccupancy["PB2"] || "invalid", 'PB2', 50, 50, 'none');
            this.drawWorkstation(g, 680, 320, deskOccupancy["PB1"] || "invalid", 'PB1', 50, 50, 'none');

        }
        
        this.svg.appendChild(g);
    }

    drawGroundFloorChateaudun(deskOccupancy = {}) {
        const g = this.createGroup("content-root");

        // Main building outline
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, "horizontal");
        this.drawWindow(g, 290, 50, 80, "horizontal");
        this.drawWindow(g, 430, 50, 80, "horizontal");
        this.drawWindow(g, 550, 50, 80, "horizontal");
        this.drawWindow(g, 650, 50, 80, "horizontal");
        this.drawWindow(g, 820, 50, 80, "horizontal");
        this.drawWindow(g, 980, 50, 80, "horizontal");

        this.svg.appendChild(g);
    }

    drawFloor1(deskOccupancy = {}) {
        const g = this.createGroup("floor-1");

        // Main building outline
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, "horizontal");
        this.drawWindow(g, 290, 50, 80, "horizontal");
        this.drawWindow(g, 430, 50, 80, "horizontal");
        this.drawWindow(g, 550, 50, 80, "horizontal");
        this.drawWindow(g, 650, 50, 80, "horizontal");
        this.drawWindow(g, 820, 50, 80, "horizontal");
        this.drawWindow(g, 980, 50, 80, "horizontal");

        // Geneva Room
        const genevaRoom = [
            { x: 760, y: 52 },
            { x: 1050, y: 52 },
            { x: 1050, y: 200 },
            { x: 760, y: 200 },
            { x: 760, y: 52 },
        ];
        this.drawWall(g, genevaRoom, false);
        this.drawLabel(g, 900, 140, "Geneva", 16, "bold");

        // Geneva Door
        const genevaDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        genevaDoor.setAttribute("x", 780);
        genevaDoor.setAttribute("y", 195);
        genevaDoor.setAttribute("width", 40);
        genevaDoor.setAttribute("height", 4);
        genevaDoor.setAttribute("fill", "#ffffff");
        genevaDoor.setAttribute("stroke", "#000000");
        genevaDoor.setAttribute("stroke-width", 2);
        g.appendChild(genevaDoor);

        // Additional separation lines
        this.drawLine(
            g,
            [
                { x: 200, y: 50 },
                { x: 200, y: 280 },
            ],
            this.colors.wallStroke,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 500, y: 50 },
                { x: 500, y: 335 },
            ],
            this.colors.wallStroke,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 500, y: 170 },
                { x: 715, y: 170 },
            ],
            this.colors.wallStroke,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 715, y: 50 },
                { x: 715, y: 170 },
            ],
            this.colors.wallStroke,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 600, y: 50 },
                { x: 600, y: 170 },
            ],
            this.colors.wallStroke,
            2,
        );

        // Doors for separation lines
        const door1 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        door1.setAttribute("x", 200);
        door1.setAttribute("y", 200);
        door1.setAttribute("width", 4);
        door1.setAttribute("height", 40);
        door1.setAttribute("fill", "#ffffff");
        door1.setAttribute("stroke", "#000000");
        door1.setAttribute("stroke-width", 2);
        g.appendChild(door1);

        const door2 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        door2.setAttribute("x", 500);
        door2.setAttribute("y", 250);
        door2.setAttribute("width", 4);
        door2.setAttribute("height", 40);
        door2.setAttribute("fill", "#ffffff");
        door2.setAttribute("stroke", "#000000");
        door2.setAttribute("stroke-width", 2);
        g.appendChild(door2);

        const door3 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        door3.setAttribute("x", 660);
        door3.setAttribute("y", 170);
        door3.setAttribute("width", 40);
        door3.setAttribute("height", 4);
        door3.setAttribute("fill", "#ffffff");
        door3.setAttribute("stroke", "#000000");
        door3.setAttribute("stroke-width", 2);
        g.appendChild(door3);

        const door4 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        door4.setAttribute("x", 500);
        door4.setAttribute("y", 70);
        door4.setAttribute("width", 4);
        door4.setAttribute("height", 40);
        door4.setAttribute("fill", "#ffffff");
        door4.setAttribute("stroke", "#000000");
        door4.setAttribute("stroke-width", 2);
        g.appendChild(door4);

        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === "DESK") {
            // D01 - Horizontal desk
            this.drawWorkstation(
                g,
                650,
                200,
                deskOccupancy["D01"] || "invalid",
                "D01",
                60,
                30,
                "top",
                null,
                680,
                190,
                680,
                215,
            );
        }

        this.svg.appendChild(g);
    }

    drawFloor2(deskOccupancy = {}) {
        const g = this.createGroup("floor-2");

        // Main building outline - EXACT from your Chrome DevTools
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // ATLANTIC Room - EXACT coordinates
        const atlanticRoom = [
            { x: 380, y: 170 },
            { x: 380, y: 50 },
            { x: 490, y: 50 },
            { x: 490, y: 220 },
            { x: 380, y: 170 }
        ];
        this.drawWall(g, atlanticRoom, false);
        this.drawLabel(g, 430, 140, "Atlantic", 16, "bold");

        // Atlantic Door (rotated)
        const atlanticDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
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
            { x: 710, y: 220 }
        ];
        this.drawWall(g, pacificRoom, false);
        this.drawLabel(g, 600, 140, "Pacific", 16, "bold");

        // Pacific Door
        const pacificDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        pacificDoor.setAttribute("x", 520);
        pacificDoor.setAttribute("y", 215);
        pacificDoor.setAttribute("width", 40);
        pacificDoor.setAttribute("height", 4);
        pacificDoor.setAttribute("fill", "#ffffff");
        pacificDoor.setAttribute("stroke", "#000000");
        pacificDoor.setAttribute("stroke-width", 2);
        g.appendChild(pacificDoor);

        // Windows - EXACT positions (centered: x + width/2)
        this.drawWindow(g, 120, 50, 80, "horizontal"); // rect x=80
        this.drawWindow(g, 290, 50, 80, "horizontal"); // rect x=250
        this.drawWindow(g, 430, 50, 80, "horizontal"); // rect x=390
        this.drawWindow(g, 550, 50, 80, "horizontal"); // rect x=510
        this.drawWindow(g, 650, 50, 80, "horizontal"); // rect x=610
        this.drawWindow(g, 820, 50, 80, "horizontal"); // rect x=780
        this.drawWindow(g, 980, 50, 80, "horizontal"); // rect x=940

        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === "DESK") {
            // D01 - rect x=120, chair cx=80 (left side)
            this.drawWorkstation(
                g,
                120,
                60,
                deskOccupancy["D01"] || "invalid",
                "D01",
                30,
                50,
                "left",
                null,
                80,
                85,
                135,
                85,
            );

            // D02 - rect x=90, chair cx=160 (right side)
            this.drawWorkstation(
                g,
                90,
                60,
                deskOccupancy["D02"] || "invalid",
                "D02",
                30,
                50,
                "right",
                null,
                160,
                85,
                105,
                85,
            );

            // D03 - horizontal desk
            this.drawWorkstation(
                g,
                90,
                110,
                deskOccupancy["D03"] || "invalid",
                "D03",
                60,
                30,
                "bottom",
                null,
                120,
                150,
                120,
                125,
            );

            // D04 & D05 - Center-left cluster
            this.drawWorkstation(
                g,
                260,
                60,
                deskOccupancy["D04"] || "invalid",
                "D04",
                30,
                50,
                "left",
                null,
                250,
                85,
                275,
                85,
            );
            this.drawWorkstation(
                g,
                290,
                60,
                deskOccupancy["D05"] || "invalid",
                "D05",
                30,
                50,
                "right",
                null,
                330,
                85,
                305,
                85,
            );

            // D06 - With rotation 190°
            this.drawWorkstation(
                g,
                260,
                240,
                deskOccupancy["D06"] || "invalid",
                "D06",
                30,
                50,
                "custom",
                "rotate(190, 275, 265)",
                250,
                260,
                275,
                265,
            );

            // D07 - With rotation 190°
            this.drawWorkstation(
                g,
                230,
                240,
                deskOccupancy["D07"] || "invalid",
                "D07",
                30,
                50,
                "custom",
                "rotate(190, 275, 265)",
                330,
                275,
                305,
                270,
            );

            // Right cluster 1
            this.drawWorkstation(
                g,
                790,
                60,
                deskOccupancy["D08"] || "invalid",
                "D08",
                30,
                50,
                "left",
                null,
                780,
                85,
                805,
                85,
            );
            this.drawWorkstation(
                g,
                790,
                110,
                deskOccupancy["D09"] || "invalid",
                "D09",
                30,
                50,
                "left",
                null,
                780,
                135,
                805,
                135,
            );
            this.drawWorkstation(
                g,
                820,
                60,
                deskOccupancy["D10"] || "invalid",
                "D10",
                30,
                50,
                "right",
                null,
                860,
                85,
                835,
                85,
            );
            this.drawWorkstation(
                g,
                820,
                110,
                deskOccupancy["D11"] || "invalid",
                "D11",
                30,
                50,
                "right",
                null,
                860,
                135,
                835,
                135,
            );

            // Right cluster 2
            this.drawWorkstation(
                g,
                950,
                60,
                deskOccupancy["D12"] || "invalid",
                "D12",
                30,
                50,
                "left",
                null,
                940,
                85,
                965,
                85,
            );
            this.drawWorkstation(
                g,
                950,
                110,
                deskOccupancy["D13"] || "invalid",
                "D13",
                30,
                50,
                "left",
                null,
                940,
                135,
                965,
                135,
            );
            this.drawWorkstation(
                g,
                980,
                60,
                deskOccupancy["D14"] || "invalid",
                "D14",
                30,
                50,
                "right",
                null,
                1020,
                85,
                995,
                85,
            );
            this.drawWorkstation(
                g,
                980,
                110,
                deskOccupancy["D15"] || "invalid",
                "D15",
                30,
                50,
                "right",
                null,
                1020,
                135,
                995,
                135,
            );
        }

        this.svg.appendChild(g);
    }

    drawFloor3(deskOccupancy = {}) {
        const g = this.createGroup("floor-3");

        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // Windows (same positions as Floor 2)
        this.drawWindow(g, 120, 50, 80, "horizontal");
        this.drawWindow(g, 290, 50, 80, "horizontal");
        this.drawWindow(g, 430, 50, 80, "horizontal");
        this.drawWindow(g, 550, 50, 80, "horizontal");
        this.drawWindow(g, 650, 50, 80, "horizontal");
        this.drawWindow(g, 820, 50, 80, "horizontal");
        this.drawWindow(g, 980, 50, 80, "horizontal");

        // Sequoia Room
        const sequoiaRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 170 },
            { x: 490, y: 220 },
            { x: 710, y: 220 },
        ];
        this.drawWall(g, sequoiaRoom, false);

        // Sequoia Room divider
        this.drawLine(
            g,
            [
                { x: 600, y: 135 },
                { x: 710, y: 135 },
            ],
            this.colors.wallStroke,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 600, y: 50 },
                { x: 600, y: 220 },
            ],
            this.colors.wallStroke,
            2,
        );

        this.drawLabel(g, 490, 130, "Sequoia", 16, "bold");
        this.drawLabel(g, 650, 180, "Santa", 16, "bold");

        // Sequoia Door (rotated)
        const sequoiaDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
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
        const santaDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        santaDoor.setAttribute("x", 635);
        santaDoor.setAttribute("y", 215);
        santaDoor.setAttribute("width", 40);
        santaDoor.setAttribute("height", 4);
        santaDoor.setAttribute("fill", "#ffffff");
        santaDoor.setAttribute("stroke", "#000000");
        santaDoor.setAttribute("stroke-width", 2);
        g.appendChild(santaDoor);

        // Sequoia side door
        const sequoiaSideDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        sequoiaSideDoor.setAttribute("x", 705);
        sequoiaSideDoor.setAttribute("y", 60);
        sequoiaSideDoor.setAttribute("width", 4);
        sequoiaSideDoor.setAttribute("height", 40);
        sequoiaSideDoor.setAttribute("fill", "#ffffff");
        sequoiaSideDoor.setAttribute("stroke", "#000000");
        sequoiaSideDoor.setAttribute("stroke-width", 2);
        g.appendChild(sequoiaSideDoor);

        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === "DESK") {
            // D01
            this.drawWorkstation(
                g,
                120,
                60,
                deskOccupancy["D01"] || "invalid",
                "D01",
                30,
                50,
                "left",
                null,
                80,
                85,
                135,
                90,
            );
            // D02
            this.drawWorkstation(
                g,
                90,
                60,
                deskOccupancy["D02"] || "invalid",
                "D02",
                30,
                50,
                "right",
                null,
                160,
                85,
                105,
                90,
            );
            // D03 - horizontal desk
            this.drawWorkstation(
                g,
                90,
                110,
                deskOccupancy["D03"] || "invalid",
                "D03",
                60,
                30,
                "bottom",
                null,
                120,
                150,
                120,
                125,
            );
            // D04
            this.drawWorkstation(
                g,
                260,
                60,
                deskOccupancy["D04"] || "invalid",
                "D04",
                30,
                50,
                "left",
                null,
                250,
                85,
                275,
                90,
            );
            // D05
            this.drawWorkstation(
                g,
                260,
                110,
                deskOccupancy["D05"] || "invalid",
                "D05",
                30,
                50,
                "left",
                null,
                250,
                135,
                275,
                140,
            );
            // D06
            this.drawWorkstation(
                g,
                290,
                60,
                deskOccupancy["D06"] || "invalid",
                "D06",
                30,
                50,
                "right",
                null,
                330,
                85,
                305,
                90,
            );
            // D07
            this.drawWorkstation(
                g,
                290,
                110,
                deskOccupancy["D07"] || "invalid",
                "D07",
                30,
                50,
                "right",
                null,
                330,
                135,
                305,
                140,
            );
            // D08
            this.drawWorkstation(
                g,
                790,
                60,
                deskOccupancy["D08"] || "invalid",
                "D08",
                30,
                50,
                "left",
                null,
                780,
                85,
                805,
                90,
            );
            // D09
            this.drawWorkstation(
                g,
                790,
                110,
                deskOccupancy["D09"] || "invalid",
                "D09",
                30,
                50,
                "left",
                null,
                780,
                135,
                805,
                140,
            );
            // D10
            this.drawWorkstation(
                g,
                820,
                60,
                deskOccupancy["D10"] || "invalid",
                "D10",
                30,
                50,
                "right",
                null,
                860,
                85,
                835,
                90,
            );
            // D11
            this.drawWorkstation(
                g,
                820,
                110,
                deskOccupancy["D11"] || "invalid",
                "D11",
                30,
                50,
                "right",
                null,
                860,
                135,
                835,
                140,
            );
            // D12
            this.drawWorkstation(
                g,
                950,
                60,
                deskOccupancy["D12"] || "invalid",
                "D12",
                30,
                50,
                "left",
                null,
                940,
                85,
                965,
                90,
            );
            // D13
            this.drawWorkstation(
                g,
                950,
                110,
                deskOccupancy["D13"] || "invalid",
                "D13",
                30,
                50,
                "left",
                null,
                940,
                135,
                965,
                140,
            );
            // D14
            this.drawWorkstation(
                g,
                980,
                60,
                deskOccupancy["D14"] || "invalid",
                "D14",
                30,
                50,
                "right",
                null,
                1020,
                85,
                995,
                90,
            );
            // D15
            this.drawWorkstation(
                g,
                980,
                110,
                deskOccupancy["D15"] || "invalid",
                "D15",
                30,
                50,
                "right",
                null,
                1020,
                135,
                995,
                140,
            );
        }

        this.svg.appendChild(g);
    }

    drawFloor4(deskOccupancy = {}) {
        const g = this.createGroup("floor-4");

        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // Windows
        this.drawWindow(g, 120, 50, 80, "horizontal");
        this.drawWindow(g, 290, 50, 80, "horizontal");
        this.drawWindow(g, 430, 50, 80, "horizontal");
        this.drawWindow(g, 550, 50, 80, "horizontal");
        this.drawWindow(g, 650, 50, 80, "horizontal");
        this.drawWindow(g, 820, 50, 80, "horizontal");
        this.drawWindow(g, 980, 50, 80, "horizontal");

        // Miami Room
        const miamiRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 170 },
            { x: 490, y: 220 },
            { x: 710, y: 220 },
        ];
        this.drawWall(g, miamiRoom, false);
        this.drawLabel(g, 550, 140, "Miami", 16, "bold");

        // Miami Door (rotated)
        const miamiDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
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
            { x: 200, y: 50 },
        ];
        this.drawWall(g, oreganRoom, false);
        this.drawLabel(g, 290, 110, "Oregan", 16, "bold");

        // Oregan Door
        const oreganDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        oreganDoor.setAttribute("x", 320);
        oreganDoor.setAttribute("y", 147);
        oreganDoor.setAttribute("width", 40);
        oreganDoor.setAttribute("height", 4);
        oreganDoor.setAttribute("fill", "#ffffff");
        oreganDoor.setAttribute("stroke", "#000000");
        oreganDoor.setAttribute("stroke-width", 2);
        g.appendChild(oreganDoor);

        // New York Room (vertical extension)
        this.drawLine(
            g,
            [
                { x: 200, y: 150 },
                { x: 200, y: 280 },
            ],
            this.colors.wallStroke,
            2,
        );

        // New York Door
        const newYorkDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        newYorkDoor.setAttribute("x", 200);
        newYorkDoor.setAttribute("y", 160);
        newYorkDoor.setAttribute("width", 4);
        newYorkDoor.setAttribute("height", 40);
        newYorkDoor.setAttribute("fill", "#ffffff");
        newYorkDoor.setAttribute("stroke", "#000000");
        newYorkDoor.setAttribute("stroke-width", 2);
        g.appendChild(newYorkDoor);

        // New York Label (rotated)
        const newYorkLabel = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
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
        if (this.sensorMode === "DESK") {
            // D01
            this.drawWorkstation(
                g,
                790,
                60,
                deskOccupancy["D01"] || "invalid",
                "D01",
                30,
                50,
                "left",
                null,
                780,
                85,
                805,
                90,
            );
            // D02
            this.drawWorkstation(
                g,
                790,
                110,
                deskOccupancy["D02"] || "invalid",
                "D02",
                30,
                50,
                "left",
                null,
                780,
                135,
                805,
                140,
            );
            // D03
            this.drawWorkstation(
                g,
                820,
                60,
                deskOccupancy["D03"] || "invalid",
                "D03",
                30,
                50,
                "right",
                null,
                860,
                85,
                835,
                90,
            );
            // D04
            this.drawWorkstation(
                g,
                820,
                110,
                deskOccupancy["D04"] || "invalid",
                "D04",
                30,
                50,
                "right",
                null,
                860,
                135,
                835,
                140,
            );
            // D05
            this.drawWorkstation(
                g,
                950,
                60,
                deskOccupancy["D05"] || "invalid",
                "D05",
                30,
                50,
                "left",
                null,
                940,
                85,
                965,
                90,
            );
            // D06
            this.drawWorkstation(
                g,
                950,
                110,
                deskOccupancy["D06"] || "invalid",
                "D06",
                30,
                50,
                "left",
                null,
                940,
                135,
                965,
                140,
            );
            // D07
            this.drawWorkstation(
                g,
                980,
                60,
                deskOccupancy["D07"] || "invalid",
                "D07",
                30,
                50,
                "right",
                null,
                1020,
                85,
                995,
                90,
            );
            // D08
            this.drawWorkstation(
                g,
                980,
                110,
                deskOccupancy["D08"] || "invalid",
                "D08",
                30,
                50,
                "right",
                null,
                1020,
                135,
                995,
                140,
            );
        }

        this.svg.appendChild(g);
    }

    drawFloor5(deskOccupancy = {}) {
        const g = this.createGroup("floor-5");

        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // Windows
        this.drawWindow(g, 120, 50, 80, "horizontal"); // rect x=80
        this.drawWindow(g, 290, 50, 80, "horizontal"); // rect x=250
        this.drawWindow(g, 430, 50, 80, "horizontal"); // rect x=390
        this.drawWindow(g, 550, 50, 80, "horizontal"); // rect x=510
        this.drawWindow(g, 650, 50, 80, "horizontal"); // rect x=610
        this.drawWindow(g, 820, 50, 80, "horizontal"); // rect x=780
        this.drawWindow(g, 980, 50, 80, "horizontal"); // rect x=940

        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === "DESK") {
            // Left cluster - horizontal desks
            this.drawWorkstation(
                g,
                110,
                90,
                deskOccupancy["D01"] || "invalid",
                "D01",
                50,
                30,
                "top",
            );
            this.drawWorkstation(
                g,
                160,
                90,
                deskOccupancy["D03"] || "invalid",
                "D03",
                50,
                30,
                "top",
            );
            this.drawWorkstation(
                g,
                110,
                120,
                deskOccupancy["D02"] || "invalid",
                "D02",
                50,
                30,
                "bottom",
            );
            this.drawWorkstation(
                g,
                160,
                120,
                deskOccupancy["D04"] || "invalid",
                "D04",
                50,
                30,
                "bottom",
            );

            // Top row - vertical desks
            this.drawWorkstation(
                g,
                300,
                60,
                deskOccupancy["D05"] || "invalid",
                "D05",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                330,
                60,
                deskOccupancy["D06"] || "invalid",
                "D06",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                460,
                60,
                deskOccupancy["D07"] || "invalid",
                "D07",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                490,
                60,
                deskOccupancy["D09"] || "invalid",
                "D09",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                620,
                60,
                deskOccupancy["D11"] || "invalid",
                "D11",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                650,
                60,
                deskOccupancy["D14"] || "invalid",
                "D14",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                790,
                60,
                deskOccupancy["D17"] || "invalid",
                "D17",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                820,
                60,
                deskOccupancy["D19"] || "invalid",
                "D19",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                950,
                60,
                deskOccupancy["D21"] || "invalid",
                "D21",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                980,
                60,
                deskOccupancy["D23"] || "invalid",
                "D23",
                30,
                50,
                "right",
            );

            // Middle row - vertical desks
            this.drawWorkstation(
                g,
                460,
                110,
                deskOccupancy["D08"] || "invalid",
                "D08",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                490,
                110,
                deskOccupancy["D10"] || "invalid",
                "D10",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                620,
                110,
                deskOccupancy["D12"] || "invalid",
                "D12",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                650,
                110,
                deskOccupancy["D15"] || "invalid",
                "D15",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                790,
                110,
                deskOccupancy["D18"] || "invalid",
                "D18",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                820,
                110,
                deskOccupancy["D20"] || "invalid",
                "D20",
                30,
                50,
                "right",
            );
            this.drawWorkstation(
                g,
                950,
                110,
                deskOccupancy["D22"] || "invalid",
                "D22",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                980,
                110,
                deskOccupancy["D24"] || "invalid",
                "D24",
                30,
                50,
                "right",
            );

            // Bottom row - vertical desks
            this.drawWorkstation(
                g,
                620,
                160,
                deskOccupancy["D13"] || "invalid",
                "D13",
                30,
                50,
                "left",
            );
            this.drawWorkstation(
                g,
                650,
                160,
                deskOccupancy["D16"] || "invalid",
                "D16",
                30,
                50,
                "right",
            );
        }

        this.svg.appendChild(g);
    }

    drawFloor6(deskOccupancy = {}) {
        const g = this.createGroup("floor-6");

        // Main building outline
        const outerWall = [
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 1050, y: 50 },
            { x: 1050, y: 450 },
            { x: 200, y: 280 },
            { x: 200, y: 280 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
        ];
        this.drawWall(g, outerWall, true);

        // Internal separator lines
        this.drawLine(
            g,
            [
                { x: 750, y: 55 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 55 },
                { x: 720, y: 240 },
            ],
            this.colors.interiorLine,
            2,
        );
        this.drawLine(
            g,
            [
                { x: 720, y: 240 },
                { x: 750, y: 240 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 200 },
                { x: 850, y: 200 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 1050, y: 210 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            1.5,
        );
        this.drawLine(
            g,
            [
                { x: 850, y: 200 },
                { x: 850, y: 210 },
            ],
            this.colors.interiorLine,
            2,
        );

        // Windows
        this.drawWindow(g, 120, 50, 80, "horizontal");
        this.drawWindow(g, 290, 50, 80, "horizontal");
        this.drawWindow(g, 430, 50, 80, "horizontal");
        this.drawWindow(g, 550, 50, 80, "horizontal");
        this.drawWindow(g, 650, 50, 80, "horizontal");
        this.drawWindow(g, 820, 50, 80, "horizontal");
        this.drawWindow(g, 980, 50, 80, "horizontal");

        // Paris Room
        const parisRoom = [
            { x: 480, y: 50 },
            { x: 710, y: 50 },
            { x: 710, y: 220 },
            { x: 480, y: 220 },
            { x: 480, y: 50 },
        ];
        this.drawWall(g, parisRoom, false);
        this.drawLabel(g, 590, 140, "Paris", 16, "bold");

        // Paris Door
        const parisDoor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        parisDoor.setAttribute("x", 500);
        parisDoor.setAttribute("y", 215);
        parisDoor.setAttribute("width", 40);
        parisDoor.setAttribute("height", 4);
        parisDoor.setAttribute("fill", "#ffffff");
        parisDoor.setAttribute("stroke", "#000000");
        parisDoor.setAttribute("stroke-width", 2);
        g.appendChild(parisDoor);

        // ONLY DRAW DESKS IF IN DESK MODE
        if (this.sensorMode === "DESK") {
            // D01-D04: Horizontal desks (60x30) - Left cluster
            this.drawWorkstation(
                g,
                90,
                110,
                deskOccupancy["D01"] || "invalid",
                "D01",
                60,
                30,
                "top",
                null,
                120,
                100,
                120,
                125,
            );
            this.drawWorkstation(
                g,
                150,
                110,
                deskOccupancy["D02"] || "invalid",
                "D02",
                60,
                30,
                "top",
                null,
                180,
                100,
                180,
                125,
            );
            this.drawWorkstation(
                g,
                90,
                140,
                deskOccupancy["D03"] || "invalid",
                "D03",
                60,
                30,
                "bottom",
                null,
                120,
                180,
                120,
                155,
            );
            this.drawWorkstation(
                g,
                150,
                140,
                deskOccupancy["D04"] || "invalid",
                "D04",
                60,
                30,
                "bottom",
                null,
                180,
                180,
                180,
                155,
            );

            // D05-D08: Horizontal desks (60x30) - Center cluster
            this.drawWorkstation(
                g,
                350,
                110,
                deskOccupancy["D05"] || "invalid",
                "D05",
                60,
                30,
                "top",
                null,
                380,
                100,
                380,
                125,
            );
            this.drawWorkstation(
                g,
                410,
                110,
                deskOccupancy["D06"] || "invalid",
                "D06",
                60,
                30,
                "top",
                null,
                440,
                100,
                440,
                125,
            );
            this.drawWorkstation(
                g,
                350,
                140,
                deskOccupancy["D07"] || "invalid",
                "D07",
                60,
                30,
                "bottom",
                null,
                380,
                180,
                380,
                155,
            );
            this.drawWorkstation(
                g,
                410,
                140,
                deskOccupancy["D08"] || "invalid",
                "D08",
                60,
                30,
                "bottom",
                null,
                440,
                180,
                440,
                155,
            );

            // D09-D16: Vertical desks (30x50) - Right clusters
            this.drawWorkstation(
                g,
                790,
                60,
                deskOccupancy["D09"] || "invalid",
                "D09",
                30,
                50,
                "left",
                null,
                780,
                85,
                805,
                90,
            );
            this.drawWorkstation(
                g,
                790,
                110,
                deskOccupancy["D10"] || "invalid",
                "D10",
                30,
                50,
                "left",
                null,
                780,
                135,
                805,
                140,
            );
            this.drawWorkstation(
                g,
                820,
                60,
                deskOccupancy["D11"] || "invalid",
                "D11",
                30,
                50,
                "right",
                null,
                860,
                85,
                835,
                90,
            );
            this.drawWorkstation(
                g,
                820,
                110,
                deskOccupancy["D12"] || "invalid",
                "D12",
                30,
                50,
                "right",
                null,
                860,
                135,
                835,
                140,
            );
            this.drawWorkstation(
                g,
                950,
                60,
                deskOccupancy["D13"] || "invalid",
                "D13",
                30,
                50,
                "left",
                null,
                940,
                85,
                965,
                90,
            );
            this.drawWorkstation(
                g,
                950,
                110,
                deskOccupancy["D14"] || "invalid",
                "D14",
                30,
                50,
                "left",
                null,
                940,
                135,
                965,
                140,
            );
            this.drawWorkstation(
                g,
                980,
                60,
                deskOccupancy["D15"] || "invalid",
                "D15",
                30,
                50,
                "right",
                null,
                1020,
                85,
                995,
                90,
            );
            this.drawWorkstation(
                g,
                980,
                110,
                deskOccupancy["D16"] || "invalid",
                "D16",
                30,
                50,
                "right",
                null,
                1020,
                135,
                995,
                140,
            );
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
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
        );
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }

        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.colors.wallStroke);
        path.setAttribute("stroke-width", isOutline ? 4 : 2);
        path.setAttribute("stroke-linecap", "square");
        path.setAttribute("stroke-linejoin", "miter");

        parent.appendChild(path);
    }

    drawCircle(
        parent,
        xStart,
        yStart,
        xRadii,
        yRadii,
        xAxisRotation,
        largeArcFlag,
        sweepFlag,
        xEnd,
        yEnd,
        isOutline,
    ) {
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
        );

        let d = `M ${xStart} ${yStart} A ${xRadii} ${yRadii} ${xAxisRotation} ${largeArcFlag} ${sweepFlag} ${xEnd} ${yEnd}`;

        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.colors.wallStroke);
        path.setAttribute("stroke-width", isOutline ? 4 : 2);
        path.setAttribute("stroke-linecap", "square");
        path.setAttribute("stroke-linejoin", "miter");

        parent.appendChild(path);
    }

    drawLine(parent, points, color, width) {
        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
        );
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
        console.log({ id, status });
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "desk");
        g.setAttribute("data-desk-id", id);

        // Desk rectangle
        const rect = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        rect.setAttribute("x", x - width / 2);
        rect.setAttribute("y", y - height / 2);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", this.colors[status]);
        rect.setAttribute("stroke", this.colors.wallStroke);
        rect.setAttribute("stroke-width", 1.5);
        rect.setAttribute("rx", 2);

        // Desk ID label
        const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
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
        if (status === "invalid") {
            const occupiedIcon = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "text",
            );
            occupiedIcon.setAttribute("x", x - width / 2 - 12);
            occupiedIcon.setAttribute("y", y + 6);
            occupiedIcon.setAttribute("font-size", "16");
            occupiedIcon.setAttribute("text-anchor", "middle");
            occupiedIcon.textContent = "🧑‍💼";
            g.appendChild(occupiedIcon);
        }

        parent.appendChild(g);
    }

    drawDoor(parent, x, y, width, height, orientation, arc = false) {
        const doorWidth = orientation === "horizontal" ? width : height;
        const doorHeight = orientation === "horizontal" ? height : width;

        const door = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        door.setAttribute("x", x - doorWidth / 2);
        door.setAttribute("y", y - doorHeight / 2);
        door.setAttribute("width", doorWidth);
        door.setAttribute("height", doorHeight);
        door.setAttribute("fill", "#ffffff");
        door.setAttribute("stroke", this.colors.wallStroke);
        door.setAttribute("stroke-width", 2);

        parent.appendChild(door);
        // Door arc
        if (arc) {
            const arc = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path",
            );
            if (orientation === "horizontal") {
                arc.setAttribute(
                    "d",
                    `M ${x - 20} ${y} Q ${x} ${y - 20} ${x + 20} ${y}`,
                );
            } else {
                arc.setAttribute(
                    "d",
                    `M ${x} ${y - 20} Q ${x + 20} ${y} ${x} ${y + 20}`,
                );
            }
            arc.setAttribute("fill", "none");
            arc.setAttribute("stroke", this.colors.interiorLine);
            arc.setAttribute("stroke-width", 1);
            arc.setAttribute("stroke-dasharray", "2,2");
            parent.appendChild(arc);
        }
        
    }

    drawWindow(parent, x, y, length, orientation) {
        const windowWidth = orientation === "horizontal" ? length : 6;
        const windowHeight = orientation === "horizontal" ? 6 : length;

        const window = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        window.setAttribute("x", x - windowWidth / 2);
        window.setAttribute("y", y - windowHeight / 2);
        window.setAttribute("width", windowWidth);
        window.setAttribute("height", windowHeight);
        window.setAttribute("fill", "#e0f2fe");
        window.setAttribute("stroke", this.colors.wallStroke);
        window.setAttribute("stroke-width", 2);

        // Window panes
        if (orientation === "horizontal") {
            const divider = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line",
            );
            divider.setAttribute("x1", x);
            divider.setAttribute("y1", y - 3);
            divider.setAttribute("x2", x);
            divider.setAttribute("y2", y + 3);
            divider.setAttribute("stroke", this.colors.wallStroke);
            divider.setAttribute("stroke-width", 1);
            parent.appendChild(divider);
        } else {
            const divider = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line",
            );
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

    drawLabel(parent, x, y, text, fontSize = 12, fontWeight = "normal") {
        const label = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
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

    drawWorkstation(
        parent,
        x,
        y,
        status,
        id,
        width = 45,
        height = 35,
        chairPosition = "top",
        rotation = null,
        chairX = null,
        chairY = null,
        textX = null,
        textY = null,
    ) {
        console.log({ id, status });
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "workstation");
        g.setAttribute("data-desk-id", id);

        // Main desk rectangle (x, y is top-left corner, NOT center)
        const desk = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
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
        const centerX = textX !== null ? textX : x + width / 2;
        const centerY = textY !== null ? textY : y + height / 2;

        // Desk ID label
        const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        text.setAttribute("x", centerX);
        text.setAttribute("y", centerY + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.setAttribute("font-size", "12");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#ffffff");
        text.textContent = id.replace("D", "");

        // Chair position
        let finalChairX, finalChairY;

        if (chairX !== null && chairY !== null) {
            // Custom chair position provided
            finalChairX = chairX;
            finalChairY = chairY;
        } else {
            // Calculate chair position based on direction
            switch (chairPosition) {
                case "left":
                    finalChairX = x - 10;
                    finalChairY = y + height / 2;
                    break;
                case "right":
                    finalChairX = x + width + 10;
                    finalChairY = y + height / 2;
                    break;
                case "top":
                    finalChairX = x + width / 2;
                    finalChairY = y - 10;
                    break;
                case "bottom":
                    finalChairX = x + width / 2;
                    finalChairY = y + height + 10;
                    break;
                default:
                    finalChairX = x + width / 2;
                    finalChairY = y - 10;
            }
        }

        g.appendChild(desk);
        const validPositions = ["bottom", "top", "left", "right"];
        if (validPositions.includes(chairPosition)) {
            this.drawChair(g, finalChairX, finalChairY);
        }
        g.appendChild(text);

        parent.appendChild(g);
    }

    drawChair(parent, x, y) {
        // Chair indicator (small circle)
        const chair = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        chair.setAttribute("cx", x);
        chair.setAttribute("cy", y);
        chair.setAttribute("r", 4);
        chair.setAttribute("fill", "#94a3b8");
        chair.setAttribute("stroke", this.colors.wallStroke);
        chair.setAttribute("stroke-width", 1);

        parent.appendChild(chair);
    }

    drawStaircase(parent, x, y, width, height) {
        // Staircase outline
        const stairsOutline = [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height },
        ];
        this.drawWall(parent, stairsOutline, false);

        // Draw individual steps
        const numSteps = 7;
        for (let i = 0; i < numSteps; i++) {
            const stepY = y + 10 + (i * (height - 20)) / numSteps;
            this.drawLine(
                parent,
                [
                    { x: x + 5, y: stepY },
                    { x: x + width - 5, y: stepY },
                ],
                this.colors.interiorLine,
                1.5,
            );
        }

        // Stair direction arrow
        const arrow = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        arrow.setAttribute("x", x + width / 2);
        arrow.setAttribute("y", y + height / 2 + 8);
        arrow.setAttribute("text-anchor", "middle");
        arrow.setAttribute("font-size", "24");
        arrow.textContent = "⬇️";
        parent.appendChild(arrow);

        // Label
        this.drawLabel(parent, x + width / 2, y - 8, "Stairs", 10, "bold");
    }

    // Public method to load desk occupancy data from API
    async loadDeskOccupancy() {
        if (this.sensorMode !== "DESK") {
            console.log("Not in DESK mode, skipping desk occupancy load");
            return;
        }

        try {
            const response = await fetch(
                `/api/desks?floor=${this.floorData.floorNumber}`,
            );
            if (!response.ok) {
                console.error("Failed to fetch desk occupancy data");
                return;
            }

            const desks = await response.json();
            console.log("Loaded desk occupancy data:", desks);

            // Create deskOccupancy map
            const deskOccupancy = {};
            desks.forEach((desk) => {
                deskOccupancy[desk.id] = desk.status;
            });
            
        } catch (error) {
            console.error("Error loading desk occupancy:", error);
        }
    }

    // Public method to export SVG
    exportSVG() {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.svg);
        return svgString;
    }

    // Public method to download SVG
    downloadSVG(filename = "floor-plan.svg") {
        const svgData = this.exportSVG();
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Centre et adapte le contenu courant dans une surface
     * @param {Object} options
     * @param {number} options.targetWidth - largeur cible
     * @param {number} options.targetHeight - hauteur cible
     * @param {number} options.padding - marge intérieure
     * @param {boolean} options.fit - si true, scale pour faire rentrer le contenu,
     *                                si false, ne fait que centrer sans changer l'échelle
     */
    centerSVGContent({targetWidth = 1200, targetHeight = 1200, padding = 20, fit = true} = {}) {
        if (!this.svg) return;

        let root = this.svg.querySelector("content-root");
        if (!root) {
            root = document.createElementNS("http://www.w3.org/2000/svg", "g");
            root.setAttribute("id", "content-root");
            const children = Array.from(this.svg.childNodes);
            children.forEach(n => { if (n.nodeType === 1 && n.tagName !== "defs") root.appendChild(n); });
            this.svg.appendChild(root);
        }
        root.removeAttribute("transform");

        // Bounding box du contenu
        const bbox = root.getBBox(); // x, y, width, height

        // Si bbox est vide, rien à centrer
        if (bbox.width === 0 || bbox.height === 0) return;

        // Calcul de l'échelle
        const availW = Math.max(0, targetWidth - 2 * padding);
        const availH = Math.max(0, targetHeight - 2 * padding);

        let scale = 1;
        if (fit) {
            scale = Math.min(availW / bbox.width, availH / bbox.height);
        }

        // On veut que la bounding box (scalée) soit centrée dans la cible
        const scaledW = bbox.width * scale;
        const scaledH = bbox.height * scale;

        // On ajoute le décalage pour que la bbox soit centrée avec padding
        const tx = padding + (availW - scaledW) / 2 - bbox.x * scale;
        const ty = padding + (availH - scaledH) / 2 - bbox.y * scale;

        // Appliquer la transform
        root.setAttribute("transform", `translate(${tx}, ${ty}) scale(${scale})`);
    }

}

// Global reference
window.ArchitecturalFloorPlan = ArchitecturalFloorPlan;