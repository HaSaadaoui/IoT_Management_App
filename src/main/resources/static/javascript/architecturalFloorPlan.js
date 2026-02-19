// ===== ARCHITECTURAL FLOOR PLAN - CEILING VIEW =====
// Professional architectural drawing system matching "Occupation Live" style
class ArchitecturalFloorPlan {
    constructor(
        containerId,
        floorData,
        sensorMode = "DESK",
        buildingKey = "CHATEAUDUN",
        svgPath,
        isDashboard = true,
        floorsCount = 1
    ) {
        this.container = document.getElementById(containerId);
        this.floorData = floorData;
        this.sensorMode = sensorMode;
        this.svg = null;
        this.overlayManager = null;
        this.elementsManager = null;
        this.buildingKey = buildingKey;
        this.svgPath = svgPath;
        this.isDashboard = isDashboard;
        this._positionsDirty = new Map();
        this.floorsCount = floorsCount;

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

        this.init();
    }

    init() {
        this.createSVG();
    }

    updateConfig(floorData, sensorMode, svgPath) {
        this.floorData = floorData;
        this.sensorMode = sensorMode;
        this.svgPath = svgPath;

        const existingSvg = this.container.querySelector("svg");
        if (!existingSvg) {
            this.container.appendChild(this.svg);
        }
    }

    createSVG() {
        // Clear container
        this.container.innerHTML = "";

        // Create SVG element
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", "100%");
        this.svg.setAttribute("height", "100%");
        this.svg.setAttribute("viewBox", "0 0 1200 1200");
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        this.svg.style.background = this.colors.background;

        this.container.appendChild(this.svg);
    }

    createGroup(id) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", id);
        return g;
    }

    setContentRoot() {
        let root = this.svg.querySelector("#content-root");
        if (!root) {
            root = document.createElementNS("http://www.w3.org/2000/svg", "g");
            root.setAttribute("id", "content-root");
            root.style.display = "none";
            const children = Array.from(this.svg.childNodes);
            children.forEach(n => { if (n.nodeType === 1 && n.tagName !== "defs") root.appendChild(n); });
            this.svg.appendChild(root);
        } else {
            return;
        }
    }

    displayContentRoot() {
        const root = this.svg.querySelector("#content-root");
        if (root){
            root.style.display = "block";
        }
    }

    async drawFloorPlan(deskOccupancy = {}) {
        this.elementsManager = new FloorElementsManager(this.svg, this.colors);
        // Use content root group to center and fit
        this.setContentRoot();

        // Clear every floor before redrawing
        for (let i = 0; i < this.floorsCount; i++) {
            const floorGroup = this.svg.querySelector(`#floor-${i}`);
            if (floorGroup) {
                floorGroup.remove();
            }
        }

        // Draw based on floor number
        switch (this.buildingKey) {
            case "CHATEAUDUN":
                switch (this.floorData.floorNumber) {
                    case 0:
                        this.drawGroundFloorChateaudun();
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
                // Pour Levallois on doit clear l'étage 3
                const floorGroup = this.svg.querySelector(`#floor-${this.floorData.floorNumber}`);
                if (floorGroup) {
                    floorGroup.remove();
                }
                switch (this.floorData.floorNumber) {
                    case 3:
                        this.drawFloorLevallois(deskOccupancy);
                        break;
                }
                break;
            default:
                await this.drawFloorSVG();
                break;
        }

        // Gestion des capteurs
        if (window.SensorOverlayManager) {
            let sensors = [];
            if (this.isDashboard){
                sensors = this.generateSensorData(this.sensorMode, this.floorData.floorNumber);
            } else {
                sensors = await this.populateSensorsFromSvg();
            }

            this.overlayManager = new SensorOverlayManager(this.svg);

            // Ici on charge les seuils depuis la BDD
            await this.overlayManager.loadThresholds();

            this.overlayManager.setSensorMode(this.sensorMode, sensors, this.floorData.floorNumber, this.isDashboard);

            if (this.isDashboard && this.sensorMode !== "DESK"){
                // 🔥 LIVE
                this.startLiveSensors();
            }
        } 

        // On modifie le SVG pour le centrer sur l'écran
        this.centerSVGContent({ targetWidth: 1200, targetHeight: 1200, padding: 20, fit: true });

        this.displayContentRoot();

        if (!this.isDashboard){
            this._initDragAndDrop();  
        }
    }

    generateSensorData(mode, floor, valueMap = null) {
        const CHATEAUDUN_F2_SENSOR_POSITIONS = {
            MOTION: [
                    { id: "pir-light-01-01", x: 210, y: 95 }
            ],
        };

        const LEVALLOIS_F3_SENSOR_POSITIONS = {
          CO2: [
                { id: "co2-03-01", x: 690, y: 290 }, // au-dessus de D01–D06
                { id: "co2-03-02",   x: 190, y: 350 }, // proche du bloc suivant
                { id: "co2-03-03",  x: 630, y: 425 }, // bloc encore à gauche
          ],
          TEMP: [
                 { id: "tempex-03-01", x: 320, y: 180 },
                 //Relever la temperature des capteurs co2 pour la temperature intérieure
                 { id: "co2-03-01", x: 645, y: 255 },
                 { id: "co2-03-02",   x: 150, y: 350 },
                 { id: "co2-03-03",  x: 605, y: 445 },
          ],
          LIGHT: [
                  { id: "eye-03-01", x: 500, y: 210 }, // au-dessus de D07–D09
                  { id: "eye-03-02", x: 90, y: 420 }, // au-dessus de D41
                  { id: "eye-03-03", x: 490, y: 465 }, // au-dessus de D72
          ],
          NOISE: [
                  { id: "son-03-01", x: 70, y: 315 }, // au-dessus de D36
                  { id: "son-03-02", x: 700, y: 250 }, // bloc milieu
                  { id: "son-03-03", x: 630, y: 440 }, // au-dessus de D81–D82
                  { id: "son-03-04", x: 920, y: 205 }, // côté OM
          ],
          HUMIDITY: [
                     //Même position que le capteur de la température
                     { id: "tempex-03-01", x: 320, y: 180 },
                     { id: "co2-03-01", x: 645, y: 255 },
                     { id: "co2-03-02",   x: 150, y: 350 },
                     { id: "co2-03-03",  x: 605, y: 445 },

          ],
          COUNT: [
                  { id: "count-03-01", x: 950, y: 105 } //925 75
          ],
          ENERGY:[
                  { id: "conso-squid-03-01", x: 1070, y: 100 } //925 75
          ]
          // TODO add other sensors
        };

      // Positions spécifiques Levallois, étage 3
      if (this.buildingKey === "LEVALLOIS" && floor === 3) {
        const floorConfig = LEVALLOIS_F3_SENSOR_POSITIONS[mode];

        if (floorConfig && floorConfig.length) {
          return floorConfig.map((pos) => {
            const live =
              valueMap?.get(pos.id) ?? '--';
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

      // Positions spécifiques CHATEAUDUN, étage 2
      if (this.buildingKey === "CHATEAUDUN" && floor === 2) {
        const floorConfig = CHATEAUDUN_F2_SENSOR_POSITIONS[mode];
        if (floorConfig && floorConfig.length) {
          return floorConfig.map((pos) => {
            const live =
            valueMap?.get(pos.id) ?? '--';
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

      return [];
    }

    stopLiveSensors() {
      if (this._sensorEs) {
        this._sensorEs.close();
        this._sensorEs = null;
      }
    }

    destroy() {
      this.stopLiveSensors();
    }

    startLiveSensors() {
      this.stopLiveSensors();

      const building = this.buildingKey;
      const sensors = this.overlayManager?.sensors ?? [];
      const deviceIds = sensors.map(s => s.id);

      if (!deviceIds.length) {
        console.warn("[SSE] no sensors to subscribe");
        return;
      }

      console.info("[SSE] subscribe devices", deviceIds);

      // SSE = GET + query params
      const url =
        `/api/dashboard/live/stream` +
        `?building=${encodeURIComponent(building)}` +
        `&deviceIds=${encodeURIComponent(deviceIds.join(","))}`;

      console.info("[SSE] connect", url);

      // ouverture du flux SSE
      this._sensorEs = new EventSource(url);

      // données capteurs
      this._sensorEs.addEventListener("uplink", (e) => {
        try {
          const raw = JSON.parse(e.data);
          const msg = raw?.result ?? raw;

          const sensorId =
            msg?.end_device_ids?.device_id ||
            msg?.deviceId ||
            msg?.device_id;

          if (!sensorId) return;

          const decoded =
            msg?.uplink_message?.decoded_payload ||
            msg?.decoded_payload ||
            msg?.payload ||
            {};

          //valeur utile selon le mode courant
          const value = this.extractSensorValue(this.sensorMode, decoded);
          console.log('Extracted value: ', value);

          if (value == null) return;

          // Mise à jour UI
          this.updateSensorValue(sensorId, value);

        } catch (err) {
          console.warn("[SSE sensors] parse error", err, e.data);
        }
      });

      // keepalive (silencieux)
      this._sensorEs.addEventListener("keepalive", () => {
        // no-op
      });

      // erreurs SSE
      this._sensorEs.onerror = (e) => {
        console.warn("[SSE sensors] error", e);
      };
    }

    extractSensorValue(mode, payload) {
      if (!payload) return null;

      switch (mode) {
        case "CO2":
          return payload["co2"] ?? payload["co2 (ppm)"];
        case "TEMPEX", "TEMP":
          return payload["temperature"] ?? payload["temperature (°C)"];
        case "HUMIDITY":
          return payload["humidity"] ?? payload["humidity (%)"];
        case "NOISE":
          return payload["LAeq"] ?? payload["LAeq (dB)"];
        case "LIGHT":
          return payload["light"];
        case "COUNT":
          return {
            in: payload.period_in ?? 0,
            out: payload.period_out ?? 0,
          };
        case "ENERGY":
            return "";  // la valeur sera récupérée par la suite sur Avg Power
        case "MOTION":
            return payload["pir"] ?? "Motion";
        default:
          return null;
      }
    }

    updateSensorValue(sensorId, value) {
      if (!this.overlayManager) return;

      const updated = this.overlayManager.updateSensorValue(
        sensorId,
        value,
        new Date().toISOString()
      );
      console.log('Updated sensor: ', updated);

      if (!updated) {
        // capteur hors étage affiché → ignore
      }
    }

    async drawFloorSVG() {
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

        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "image/svg+xml");
        const graphicSelector = ['rect','circle','line','text','path','ellipse','polyline','polygon','use'].join(', ');
        const nodes = Array.from(doc.querySelectorAll(graphicSelector));
        if (!nodes.length) {
            console.warn('SVG sans éléments exploitables');
            return;
        }

        const root = this.svg.querySelector("#content-root");
        // S'assurer d'avoir #all-floors
        let allFloorsGroup = this.svg.querySelector("#all-floors");
        let isNewAllFloor = false;
        if (!allFloorsGroup) {
            allFloorsGroup = this.createGroup("all-floors");
            root.appendChild(allFloorsGroup);
            isNewAllFloor = true;
        }
        // (re)créer les groups floor-x
        for (let i = 0; i < this.floorsCount; i++) {
            const old = this.svg.querySelector(`#floor-${i}`);
            if (old) old.remove();
            const g = this.createGroup(`floor-${i}`);
            if (this.floorData.floorNumber !== i) g.style.display = "none";
            root.appendChild(g);
        }

        // On trace les groupes d'éléments <g>
        const typedGroups = Array.from(doc.querySelectorAll("g[data-type]"));
        const typedGroupChildren = new Set(typedGroups.flatMap(g => Array.from(g.querySelectorAll("*"))));

        if (typedGroups.length) {
            typedGroups.forEach(srcG => {
                const floor = srcG.getAttribute("floor-number") ?? "";
                const importedG = document.importNode(srcG, true);
                importedG.setAttribute("data-draggable", importedG.getAttribute("data-draggable") ?? "true");
                if (floor === "" || floor == null) {
                    if (isNewAllFloor) allFloorsGroup.appendChild(importedG);
                } else {
                    const fg = this.svg.querySelector(`#floor-${parseInt(floor, 10)}`);
                    fg.appendChild(importedG);
                }
            });
        }

        // On trace tous les autres éléments graphiques sauf sensors
        nodes
            .filter(n => !typedGroupChildren.has(n))
            .filter(n => {
                const attr = n.getAttribute('class');
                return attr === null || attr !== "sensor";
            })
            .forEach(el => {
                const tag = el.tagName.toLowerCase();
                const child = document.importNode(el, true);
                child.setAttribute("floor-number", el.getAttribute("floor-number") ?? "");
                if (tag !== "text") {
                    child.setAttribute("fill", child.getAttribute("fill") ?? "none");
                    child.setAttribute("stroke", child.getAttribute("stroke") ?? this.colors.wallStroke);
                    child.setAttribute("stroke-width", child.getAttribute("stroke-width") ?? 4);
                    child.setAttribute('stroke-linecap', 'square');
                    child.setAttribute('stroke-linejoin', 'miter');
                    child.setAttribute("vector-effect", child.getAttribute("vector-effect") ?? "non-scaling-stroke");
                }
                child.removeAttribute("stroke-dasharray");

                const floor = child.getAttribute("floor-number");
                if (floor === "" || floor == null) {
                    if (isNewAllFloor) allFloorsGroup.appendChild(child);
                } else {
                    const fg = this.svg.querySelector(`#floor-${parseInt(floor, 10)}`);
                    fg.appendChild(child);
                }
            });
        }

    async populateSensorsFromSvg() {
        if (!this.svgPath) return [];

        let raw;
        try {
            const resp = await fetch(this.svgPath);
            raw = await resp.text();
        } catch (e) {
            console.error('[Sensors] Erreur de chargement du SVG', e);
            return [];
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'image/svg+xml');;

        // On considère capteur = tout élément portant la classe "sensor"
        const nodes = Array.from(doc.querySelectorAll('.sensor'));

        const sensors = nodes
            .map((el) => {

                function extractRotation(transform) {
                    if (!transform) return 0;
                    const match = transform.match(/rotate\(([-\d.]+)/);
                    return match ? parseFloat(match[1]) : 0;
                }

                return { id : el.getAttribute('id'),
                    mode : el.getAttribute('sensor-mode') || 'UNKNOWN',
                    floor : el.getAttribute('floor-number'),
                    x : parseFloat(el.getAttribute('x')),
                    y : parseFloat(el.getAttribute('y')),
                    size : parseInt(parseFloat(el.getAttribute('size') || el.getAttribute('font-size'))),
                    width : parseInt(parseFloat(el.getAttribute('width'))),
                    height : parseInt(parseFloat(el.getAttribute('height'))),
                    rotation : extractRotation(el.getAttribute('transform')),
                    chair : el.getAttribute('chair')
                };
            });

        return sensors;
    }

    drawFloorLevallois(deskOccupancy = {}) {
        const g = this.createGroup('floor-3');
        
        // Main building outline
        const outerWall = [
            { x: 200, y: 200 },
            { x: 900, y: 200 },
            { x: 900, y: 50 },
            { x: 1150, y: 50 },
            { x: 1150, y: 500 },
            { x: 200, y: 500 }
        ]

        this.elementsManager.drawWall(g, outerWall, true);
        this.elementsManager.drawCircleArc(g, 200, 200, 150, 150, 0, 0, 0, 200, 500, true);
        
        // Internal separator lines (stairs, technical rooms)
        this.elementsManager.drawLine(g, [{ x: 1000, y: 54 }, { x: 1000, y: 370 }], this.colors.interiorLine, 2);
        this.elementsManager.drawLine(g, [{ x: 1000, y: 370 }, { x: 1154, y: 370 }], this.colors.interiorLine, 2);

        this.elementsManager.drawLine(g, [{ x: 950, y: 370 }, { x: 950, y: 320 }], this.colors.interiorLine, 2);
        this.elementsManager.drawLine(g, [{ x: 950, y: 320 }, { x: 1000, y: 320 }], this.colors.interiorLine, 2);
        this.elementsManager.drawLine(g, [{ x: 1000, y: 370 }, { x: 950, y: 370 }], this.colors.interiorLine, 2);

        // Left Staircase
        this.elementsManager.drawLine(g, [{ x: 200, y: 310 }, { x: 450, y: 310 }], this.colors.interiorLine, 2);
        this.elementsManager.drawLine(g, [{ x: 450, y: 310 }, { x: 450, y: 380 }], this.colors.interiorLine, 2);
        this.elementsManager.drawLine(g, [{ x: 450, y: 380 }, { x: 200, y: 380 }], this.colors.interiorLine, 2);
        this.elementsManager.drawLine(g, [{ x: 200, y: 380 }, { x: 200, y: 310 }], this.colors.interiorLine, 2);

        // Meeting rooms, offices 
        // Bottom side rooms
        this.elementsManager.drawLine(g, [{ x: 1150, y: 400 }, { x: 650, y: 400 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 1100, y: 400 }, { x: 1100, y: 500 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 1050, y: 400 }, { x: 1050, y: 500 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 1000, y: 400 }, { x: 1000, y: 500 }], this.colors.wallStroke, 2);       
        this.elementsManager.drawLine(g, [{ x: 950, y: 400 }, { x: 950, y: 500 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 875, y: 400 }, { x: 875, y: 500 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 800, y: 400 }, { x: 800, y: 500 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 650, y: 400 }, { x: 650, y: 500 }], this.colors.wallStroke, 2);

        // Meeting room 20 seats
        this.elementsManager.drawLine(g, [{ x: 1000, y: 150 }, { x: 900, y: 150 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 1000, y: 50 }, { x: 1000, y: 150 }], this.colors.wallStroke, 2);

        // Top side rooms
        this.elementsManager.drawLine(g, [{ x: 700, y: 300 }, { x: 950, y: 300 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 850, y: 300 }, { x: 850, y: 200 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 800, y: 300 }, { x: 800, y: 200 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 750, y: 300 }, { x: 750, y: 200 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 700, y: 300 }, { x: 700, y: 200 }], this.colors.wallStroke, 2);

        // Middle rooms
        this.elementsManager.drawLine(g, [{ x: 920, y: 320 }, { x: 500, y: 320 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 920, y: 370 }, { x: 500, y: 370 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 920, y: 320 }, { x: 920, y: 370 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 500, y: 320 }, { x: 500, y: 370 }], this.colors.wallStroke, 2);

        this.elementsManager.drawLine(g, [{ x: 265, y: 290 }, { x: 325, y: 290 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 265, y: 310 }, { x: 325, y: 310 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 265, y: 290 }, { x: 265, y: 310 }], this.colors.wallStroke, 2);
        this.elementsManager.drawLine(g, [{ x: 325, y: 290 }, { x: 325, y: 310 }], this.colors.wallStroke, 2);

        // Windows 
        this.elementsManager.drawWindow(g, 1100, 500, 50, 'horizontal');

        // Doors
        this.elementsManager.drawDoor(g, 1000, 200, 40, 4, 'vertical'); // Main entrance
        this.elementsManager.drawDoor(g, 985, 150, 30, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 1140, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 1060, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 1040, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 960, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 940, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 810, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 660, 400, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 740, 300, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 760, 300, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 655, 320, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 705, 370, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 605, 320, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 280, 290, 20, 4, 'horizontal');
        this.elementsManager.drawDoor(g, 310, 290, 20, 4, 'horizontal');
        
        if (this.sensorMode === 'DESK') {
            // Interview room 1
            this.elementsManager.drawWorkstation(g, 1110, 425, deskOccupancy["IR2"] || "invalid", 'IR2', 30, 50, 'bottom');
            // Interview room 2
            this.elementsManager.drawWorkstation(g, 1060, 425, deskOccupancy["IR1"] || "invalid", 'IR1', 30, 50, 'bottom');
            // Director Office 1
            this.elementsManager.drawWorkstation(g, 1010, 425, deskOccupancy["B4"] || "invalid", 'B4', 30, 50, 'bottom');
            // Director Office 2
            this.elementsManager.drawWorkstation(g, 960, 425, deskOccupancy["B3"] || "invalid", 'B3', 30, 50, 'bottom');
            // Meeting Room 6 seats 1
            this.elementsManager.drawWorkstation(g, 885, 435, deskOccupancy["SR2"] || "invalid", 'SR2', 50, 30, 'none');
            this.elementsManager.drawChair(g, 900, 420);
            this.elementsManager.drawChair(g, 920, 420);
            this.elementsManager.drawChair(g, 900, 480);
            this.elementsManager.drawChair(g, 920, 480);
            // Meeting Room 6 seats 2
            this.elementsManager.drawWorkstation(g, 810, 435, deskOccupancy["SR1"] || "invalid", 'SR1', 50, 30, 'none');
            this.elementsManager.drawChair(g, 825, 420);
            this.elementsManager.drawChair(g, 845, 420);
            this.elementsManager.drawChair(g, 825, 480);
            this.elementsManager.drawChair(g, 845, 480);
            // Valuement OS
            // Block 1
            this.elementsManager.drawWorkstation(g, 735, 435, deskOccupancy["V07"] || "invalid", '07', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 735, 465, deskOccupancy["V06"] || "invalid", '06', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 755, 435, deskOccupancy["V09"] || "invalid", '09', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 755, 465, deskOccupancy["V10"] || "invalid", '10', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 740, 415, deskOccupancy["V08"] || "invalid", '08', 30, 20, 'top');
            // Block 2
            this.elementsManager.drawWorkstation(g, 675, 435, deskOccupancy["V02"] || "invalid", '02', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 675, 465, deskOccupancy["V01"] || "invalid", '01', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 695, 435, deskOccupancy["V04"] || "invalid", '04', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 695, 465, deskOccupancy["V05"] || "invalid", '05', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 680, 415, deskOccupancy["V03"] || "invalid", '03', 30, 20, 'top');
            // Open Space 
            // Against the Valuement wall
            this.elementsManager.drawWorkstation(g, 630, 425, deskOccupancy["D82"] || "invalid", 'D82', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 630, 455, deskOccupancy["D81"] || "invalid", 'D81', 20, 30, 'left');
            // Bottom Side
            // Block 1
            this.elementsManager.drawWorkstation(g, 570, 405, deskOccupancy["D80"] || "invalid", 'D80', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 570, 435, deskOccupancy["D79"] || "invalid", 'D79', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 570, 465, deskOccupancy["D78"] || "invalid", 'D78', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 550, 405, deskOccupancy["D75"] || "invalid", 'D75', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 550, 435, deskOccupancy["D76"] || "invalid", 'D76', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 550, 465, deskOccupancy["D77"] || "invalid", 'D77', 20, 30, 'left');
            // Block 2
            this.elementsManager.drawWorkstation(g, 490, 405, deskOccupancy["D74"] || "invalid", 'D74', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 490, 435, deskOccupancy["D73"] || "invalid", 'D73', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 490, 465, deskOccupancy["D72"] || "invalid", 'D72', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 470, 405, deskOccupancy["D69"] || "invalid", 'D69', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 470, 435, deskOccupancy["D70"] || "invalid", 'D70', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 470, 465, deskOccupancy["D71"] || "invalid", 'D71', 20, 30, 'left');
            // Block 3
            this.elementsManager.drawWorkstation(g, 410, 405, deskOccupancy["D68"] || "invalid", 'D68', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 410, 435, deskOccupancy["D67"] || "invalid", 'D67', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 410, 465, deskOccupancy["D66"] || "invalid", 'D66', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 390, 405, deskOccupancy["D63"] || "invalid", 'D63', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 390, 435, deskOccupancy["D64"] || "invalid", 'D64', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 390, 465, deskOccupancy["D65"] || "invalid", 'D65', 20, 30, 'left');
            // Block 4
            this.elementsManager.drawWorkstation(g, 330, 405, deskOccupancy["D62"] || "invalid", 'D62', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 330, 435, deskOccupancy["D61"] || "invalid", 'D61', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 330, 465, deskOccupancy["D60"] || "invalid", 'D60', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 310, 405, deskOccupancy["D57"] || "invalid", 'D57', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 310, 435, deskOccupancy["D58"] || "invalid", 'D58', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 310, 465, deskOccupancy["D59"] || "invalid", 'D59', 20, 30, 'left');
            // Block 5
            this.elementsManager.drawWorkstation(g, 250, 405, deskOccupancy["D56"] || "invalid", 'D56', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 250, 435, deskOccupancy["D55"] || "invalid", 'D55', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 250, 465, deskOccupancy["D54"] || "invalid", 'D54', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 230, 405, deskOccupancy["D51"] || "invalid", 'D51', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 230, 435, deskOccupancy["D52"] || "invalid", 'D52', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 230, 465, deskOccupancy["D53"] || "invalid", 'D53', 20, 30, 'left');
            // Block 6 
            this.elementsManager.drawWorkstation(g, 170, 400, deskOccupancy["D50"] || "invalid", 'D50', 20, 30, 'right','rotate(25 170 455)',215,435,195,420);
            this.elementsManager.drawWorkstation(g, 170, 430, deskOccupancy["D49"] || "invalid", 'D49', 20, 30, 'right','rotate(25 170 455)',205,455,185,450);
            this.elementsManager.drawWorkstation(g, 170, 460, deskOccupancy["D48"] || "invalid", 'D48', 20, 30, 'right','rotate(25 170 455)',195,480,172,480);
            this.elementsManager.drawWorkstation(g, 150, 400, deskOccupancy["D45"] || "invalid", 'D45', 20, 30, 'left','rotate(25 170 455)',160,410,180,410);
            this.elementsManager.drawWorkstation(g, 150, 430, deskOccupancy["D46"] || "invalid", 'D46', 20, 30, 'left','rotate(25 170 455)',150,435,165,440);
            this.elementsManager.drawWorkstation(g, 150, 460, deskOccupancy["D47"] || "invalid", 'D47', 20, 30, 'left','rotate(25 170 455)',140,460,155,470);
            // Block 7 
            this.elementsManager.drawWorkstation(g, 105, 350, deskOccupancy["D44"] || "invalid", 'D44', 20, 30, 'right','rotate(65 105 405)',155,415,145,400);
            this.elementsManager.drawWorkstation(g, 105, 380, deskOccupancy["D43"] || "invalid", 'D43', 20, 30, 'right','rotate(65 105 405)',125,425,120,410);
            this.elementsManager.drawWorkstation(g, 105, 410, deskOccupancy["D42"] || "invalid", 'D42', 20, 30, 'right','rotate(65 105 405)',100,440,95,420);
            this.elementsManager.drawWorkstation(g, 85, 350, deskOccupancy["D39"] || "invalid", 'D39', 20, 30, 'left','rotate(65 105 405)',130,360,140,375);
            this.elementsManager.drawWorkstation(g, 85, 380, deskOccupancy["D40"] || "invalid", 'D40', 20, 30, 'left','rotate(65 105 405)',95,375,110,390);
            this.elementsManager.drawWorkstation(g, 85, 410, deskOccupancy["D41"] || "invalid", 'D41', 20, 30, 'left','rotate(65 105 405)',80,385,80,405);
            // Open Space left side
            this.elementsManager.drawWorkstation(g, 60, 320, deskOccupancy["D36"] || "invalid", 'D36', 30, 20, 'top');
            this.elementsManager.drawWorkstation(g, 90, 320, deskOccupancy["D35"] || "invalid", 'D35', 30, 20, 'top');
            this.elementsManager.drawWorkstation(g, 60, 340, deskOccupancy["D37"] || "invalid", 'D37', 30, 20, 'bottom');
            this.elementsManager.drawWorkstation(g, 90, 340, deskOccupancy["D38"] || "invalid", 'D38', 30, 20, 'bottom');

            this.elementsManager.drawWorkstation(g, 115, 280, deskOccupancy["D33"] || "invalid", 'D33', 20, 30, 'right','rotate(135 115 275)',80,285,95,270);
            this.elementsManager.drawWorkstation(g, 115, 250, deskOccupancy["D34"] || "invalid", 'D34', 20, 30, 'right','rotate(135 115 275)',100,300,115,290);
            this.elementsManager.drawWorkstation(g, 95, 280, deskOccupancy["D32"] || "invalid", 'D32', 20, 30, 'left','rotate(135 115 275)',120,235,105,250);
            this.elementsManager.drawWorkstation(g, 95, 250, deskOccupancy["D31"] || "invalid", 'D31', 20, 30, 'left','rotate(135 115 275)',135,255,130,270);

            this.elementsManager.drawWorkstation(g, 180, 210, deskOccupancy["D28"] || "invalid", 'D28', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 180, 240, deskOccupancy["D27"] || "invalid", 'D27', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 160, 210, deskOccupancy["D29"] || "invalid", 'D29', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 160, 240, deskOccupancy["D30"] || "invalid", 'D30', 20, 30, 'left');

            this.elementsManager.drawWorkstation(g, 260, 210, deskOccupancy["D24"] || "invalid", 'D24', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 260, 240, deskOccupancy["D23"] || "invalid", 'D23', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 240, 210, deskOccupancy["D25"] || "invalid", 'D25', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 240, 240, deskOccupancy["D26"] || "invalid", 'D26', 20, 30, 'left');

            this.elementsManager.drawWorkstation(g, 340, 210, deskOccupancy["D20"] || "invalid", 'D20', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 340, 240, deskOccupancy["D19"] || "invalid", 'D19', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 320, 210, deskOccupancy["D21"] || "invalid", 'D21', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 320, 240, deskOccupancy["D22"] || "invalid", 'D22', 20, 30, 'left');
            // Open Space top side
            this.elementsManager.drawWorkstation(g, 420, 210, deskOccupancy["D15"] || "invalid", 'D15', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 420, 240, deskOccupancy["D14"] || "invalid", 'D14', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 420, 270, deskOccupancy["D13"] || "invalid", 'D13', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 400, 210, deskOccupancy["D20"] || "invalid", 'D16', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 400, 240, deskOccupancy["D19"] || "invalid", 'D17', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 400, 270, deskOccupancy["D18"] || "invalid", 'D18', 20, 30, 'left');

            this.elementsManager.drawWorkstation(g, 500, 210, deskOccupancy["D09"] || "invalid", 'D09', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 500, 240, deskOccupancy["D08"] || "invalid", 'D08', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 500, 270, deskOccupancy["D07"] || "invalid", 'D07', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 480, 210, deskOccupancy["D10"] || "invalid", 'D10', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 480, 240, deskOccupancy["D11"] || "invalid", 'D11', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 480, 270, deskOccupancy["D12"] || "invalid", 'D12', 20, 30, 'left');

            this.elementsManager.drawWorkstation(g, 600, 210, deskOccupancy["D03"] || "invalid", 'D03', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 600, 240, deskOccupancy["D02"] || "invalid", 'D02', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 600, 270, deskOccupancy["D01"] || "invalid", 'D01', 20, 30, 'right');
            this.elementsManager.drawWorkstation(g, 580, 210, deskOccupancy["D04"] || "invalid", 'D04', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 580, 240, deskOccupancy["D05"] || "invalid", 'D05', 20, 30, 'left');
            this.elementsManager.drawWorkstation(g, 580, 270, deskOccupancy["D06"] || "invalid", 'D06', 20, 30, 'left');
            // Desks against the staircase
            this.elementsManager.drawWorkstation(g, 265, 290, deskOccupancy["PB7"] || "invalid", 'PB7', 30, 20, 'none');
            this.elementsManager.drawWorkstation(g, 295, 290, deskOccupancy["PB6"] || "invalid", 'PB6', 30, 20, 'none');
            // Offices
            this.elementsManager.drawWorkstation(g, 760, 230, deskOccupancy["B2"] || "invalid", 'B2', 30, 50, 'top');
            this.elementsManager.drawWorkstation(g, 710, 230, deskOccupancy["B1"] || "invalid", 'B1', 30, 50, 'top');
            // Reception
            this.elementsManager.drawWorkstation(g, 935, 160, deskOccupancy["OM"] || "invalid", 'OM', 30, 60, 'left');
            // Meeting Room 20 seats
            this.elementsManager.drawWorkstation(g, 925, 75, deskOccupancy["SR3"] || "invalid", 'SR3', 50, 50, 'none');
            this.elementsManager.drawChair(g, 930, 60);
            this.elementsManager.drawChair(g, 950, 60);
            this.elementsManager.drawChair(g, 970, 60);

            this.elementsManager.drawChair(g, 910, 85);
            this.elementsManager.drawChair(g, 910, 105);
            this.elementsManager.drawChair(g, 990, 85);
            this.elementsManager.drawChair(g, 990, 105);

            this.elementsManager.drawChair(g, 930, 140);
            this.elementsManager.drawChair(g, 950, 140);
            this.elementsManager.drawChair(g, 970, 140);
            // Desks in the middle
            this.elementsManager.drawWorkstation(g, 500, 320, deskOccupancy["PB5"] || "invalid", 'PB5', 25, 50, 'none');
            this.elementsManager.drawWorkstation(g, 580, 320, deskOccupancy["PB4"] || "invalid", 'PB4', 50, 25, 'none');
            this.elementsManager.drawWorkstation(g, 580, 345, deskOccupancy["PB3"] || "invalid", 'PB3', 50, 25, 'none');
            this.elementsManager.drawWorkstation(g, 630, 320, deskOccupancy["PB2"] || "invalid", 'PB2', 50, 50, 'none');
            this.elementsManager.drawWorkstation(g, 680, 320, deskOccupancy["PB1"] || "invalid", 'PB1', 50, 50, 'none');
        }
        
        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawGroundFloorChateaudun() {
        const g = this.createGroup("floor-0");
        this.drawChateaudunAllFloors(g);
        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawFloor1(deskOccupancy = {}) {
        const g = this.createGroup("floor-1");

        this.drawChateaudunAllFloors(g);

        // Geneva Room
        const genevaRoom = [
            { x: 760, y: 52 },
            { x: 1050, y: 52 },
            { x: 1050, y: 200 },
            { x: 760, y: 200 },
            { x: 760, y: 52 },
        ];
        this.elementsManager.drawWall(g, genevaRoom, false);
        this.elementsManager.drawLabel(g, 900, 140, "Geneva", 16, "bold");
        this.elementsManager.drawDoor(g, 800, 197, 40, 4, "horizontal");

        // Additional separation lines
        this.elementsManager.drawLine( g, [ { x: 200, y: 50 }, { x: 200, y: 280 }, ], this.colors.wallStroke, 2, );
        this.elementsManager.drawLine( g, [ { x: 500, y: 50 }, { x: 500, y: 335 }, ], this.colors.wallStroke, 2, );
        this.elementsManager.drawLine( g, [ { x: 500, y: 170 }, { x: 715, y: 170 }, ], this.colors.wallStroke, 2, );
        this.elementsManager.drawLine( g, [ { x: 715, y: 50 }, { x: 715, y: 170 }, ], this.colors.wallStroke, 2, );
        this.elementsManager.drawLine( g, [ { x: 600, y: 50 }, { x: 600, y: 170 }, ], this.colors.wallStroke, 2, );

        // Doors for separation lines
        this.elementsManager.drawDoor(g, 202, 220, 40, 4, "vertical");
        this.elementsManager.drawDoor(g, 502, 270, 40, 4, "vertical");
        this.elementsManager.drawDoor(g, 680, 172, 40, 4, "horizontal");
        this.elementsManager.drawDoor(g, 502, 90, 40, 4, "vertical");

        if (this.sensorMode === "DESK") {
            this.elementsManager.drawWorkstation( g, 650, 200, deskOccupancy["D01"] || "invalid", "D01", 60, 30, "top", null, 680, 190, 680, 215, );
        }

        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawFloor2(deskOccupancy = {}) {
        const g = this.createGroup("floor-2");

        this.drawChateaudunAllFloors(g);

        // ATLANTIC Room
        const atlanticRoom = [
            { x: 380, y: 170 },
            { x: 380, y: 50 },
            { x: 490, y: 50 },
            { x: 490, y: 220 },
            { x: 380, y: 170 }
        ];
        this.elementsManager.drawWall(g, atlanticRoom, false);
        this.elementsManager.drawLabel(g, 430, 140, "Atlantic", 16, "bold");
        this.elementsManager.drawDoor(g, 415, 232, 40, 4, "horizontal", false, "rotate(25, 520, 222)");

        // PACIFIC Room
        const pacificRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 490, y: 50 },
            { x: 490, y: 220 },
            { x: 710, y: 220 }
        ];
        this.elementsManager.drawWall(g, pacificRoom, false);
        this.elementsManager.drawLabel(g, 600, 140, "Pacific", 16, "bold");
        this.elementsManager.drawDoor(g, 540, 217, 40, 4, "horizontal");

        // Windows
        this.elementsManager.drawWindow(g, 120, 50, 80, "horizontal");
        this.elementsManager.drawWindow(g, 290, 50, 80, "horizontal");
        this.elementsManager.drawWindow(g, 430, 50, 80, "horizontal");
        this.elementsManager.drawWindow(g, 550, 50, 80, "horizontal");
        this.elementsManager.drawWindow(g, 650, 50, 80, "horizontal");
        this.elementsManager.drawWindow(g, 820, 50, 80, "horizontal");
        this.elementsManager.drawWindow(g, 980, 50, 80, "horizontal");

        if (this.sensorMode === "DESK") {
            // D01 - rect x=120, chair cx=80 (left side)
            this.elementsManager.drawWorkstation( g, 120, 60, deskOccupancy["D01"] || "invalid", "D01", 30, 50, "left", null, 80, 85, 135, 85, );
            // D02 - rect x=90, chair cx=160 (right side)
            this.elementsManager.drawWorkstation( g, 90, 60, deskOccupancy["D02"] || "invalid", "D02", 30, 50, "right", null, 160, 85, 105, 85, );
            // D03 - horizontal desk
            this.elementsManager.drawWorkstation( g, 90, 110, deskOccupancy["D03"] || "invalid", "D03", 60, 30, "bottom", null, 120, 150, 120, 125, );
            // D04 & D05 - Center-left cluster
            this.elementsManager.drawWorkstation( g, 260, 60, deskOccupancy["D04"] || "invalid", "D04", 30, 50, "left", null, 250, 85, 275, 85, );
            this.elementsManager.drawWorkstation( g, 290, 60, deskOccupancy["D05"] || "invalid", "D05", 30, 50, "right", null, 330, 85, 305, 85, );
            // D06 - With rotation 190°
            this.elementsManager.drawWorkstation( g, 260, 240, deskOccupancy["D06"] || "invalid", "D06", 30, 50, "custom", "rotate(190, 275, 265)", 250, 260, 275, 265, );
            // D07 - With rotation 190°
            this.elementsManager.drawWorkstation( g, 230, 240, deskOccupancy["D07"] || "invalid", "D07", 30, 50, "custom", "rotate(190, 275, 265)", 330, 275, 305, 270, );
            // Right cluster 1
            this.elementsManager.drawWorkstation( g, 790, 60, deskOccupancy["D08"] || "invalid", "D08", 30, 50, "left", null, 780, 85, 805, 85, );
            this.elementsManager.drawWorkstation( g, 790, 110, deskOccupancy["D09"] || "invalid", "D09", 30, 50, "left", null, 780, 135, 805, 135, );
            this.elementsManager.drawWorkstation( g, 820, 60, deskOccupancy["D10"] || "invalid", "D10", 30, 50, "right", null, 860, 85, 835, 85, );
            this.elementsManager.drawWorkstation( g, 820, 110, deskOccupancy["D11"] || "invalid", "D11", 30, 50, "right", null, 860, 135, 835, 135, );
            // Right cluster 2
            this.elementsManager.drawWorkstation( g, 950, 60, deskOccupancy["D12"] || "invalid", "D12", 30, 50, "left", null, 940, 85, 965, 85, );
            this.elementsManager.drawWorkstation( g, 950, 110, deskOccupancy["D13"] || "invalid", "D13", 30, 50, "left", null, 940, 135, 965, 135, );
            this.elementsManager.drawWorkstation( g, 980, 60, deskOccupancy["D14"] || "invalid", "D14", 30, 50, "right", null, 1020, 85, 995, 85, );
            this.elementsManager.drawWorkstation( g, 980, 110, deskOccupancy["D15"] || "invalid", "D15", 30, 50, "right", null, 1020, 135, 995, 135, );
        }

        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawFloor3(deskOccupancy = {}) {
        const g = this.createGroup("floor-3");

        this.drawChateaudunAllFloors(g);

        // Sequoia Room
        const sequoiaRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 170 },
            { x: 490, y: 220 },
            { x: 710, y: 220 },
        ];
        this.elementsManager.drawWall(g, sequoiaRoom, false);

        // Sequoia Room divider
        this.elementsManager.drawLine( g, [ { x: 600, y: 135 }, { x: 710, y: 135 }, ], this.colors.wallStroke, 2, );
        this.elementsManager.drawLine( g, [ { x: 600, y: 50 }, { x: 600, y: 220 }, ], this.colors.wallStroke, 2, );

        this.elementsManager.drawLabel(g, 490, 130, "Sequoia", 16, "bold");
        this.elementsManager.drawLabel(g, 650, 180, "Santa", 16, "bold");
        this.elementsManager.drawDoor(g, 415, 232, 40, 4, "horizontal", false, "rotate(25, 520, 222)");

        // Santa Door
        this.elementsManager.drawDoor(g, 655, 217, 40, 4, "horizontal");

        // Sequoia side door
        this.elementsManager.drawDoor(g, 707, 80, 40, 4, "vertical");

        if (this.sensorMode === "DESK") {
            this.elementsManager.drawWorkstation( g, 120, 60, deskOccupancy["D01"] || "invalid", "D01", 30, 50, "left", null, 80, 85, 135, 90, );
            this.elementsManager.drawWorkstation( g, 90, 60, deskOccupancy["D02"] || "invalid", "D02", 30, 50, "right", null, 160, 85, 105, 90, );
            this.elementsManager.drawWorkstation( g, 90, 110, deskOccupancy["D03"] || "invalid", "D03", 60, 30, "bottom", null, 120, 150, 120, 125, );
            this.elementsManager.drawWorkstation( g, 260, 60, deskOccupancy["D04"] || "invalid", "D04", 30, 50, "left", null, 250, 85, 275, 90, );
            this.elementsManager.drawWorkstation( g, 260, 110, deskOccupancy["D05"] || "invalid", "D05", 30, 50, "left", null, 250, 135, 275, 140, );
            this.elementsManager.drawWorkstation( g, 290, 60, deskOccupancy["D06"] || "invalid", "D06", 30, 50, "right", null, 330, 85, 305, 90, );
            this.elementsManager.drawWorkstation( g, 290, 110, deskOccupancy["D07"] || "invalid", "D07", 30, 50, "right", null, 330, 135, 305, 140, );
            this.elementsManager.drawWorkstation( g, 790, 60, deskOccupancy["D08"] || "invalid", "D08", 30, 50, "left", null, 780, 85, 805, 90, );
            this.elementsManager.drawWorkstation( g, 790, 110, deskOccupancy["D09"] || "invalid", "D09", 30, 50, "left", null, 780, 135, 805, 140, );
            this.elementsManager.drawWorkstation( g, 820, 60, deskOccupancy["D10"] || "invalid", "D10", 30, 50, "right", null, 860, 85, 835, 90, );
            this.elementsManager.drawWorkstation( g, 820, 110, deskOccupancy["D11"] || "invalid", "D11", 30, 50, "right", null, 860, 135, 835, 140, );
            this.elementsManager.drawWorkstation( g, 950, 60, deskOccupancy["D12"] || "invalid", "D12", 30, 50, "left", null, 940, 85, 965, 90, );
            this.elementsManager.drawWorkstation( g, 950, 110, deskOccupancy["D13"] || "invalid", "D13", 30, 50, "left", null, 940, 135, 965, 140, );
            this.elementsManager.drawWorkstation( g, 980, 60, deskOccupancy["D14"] || "invalid", "D14", 30, 50, "right", null, 1020, 85, 995, 90, );
            this.elementsManager.drawWorkstation( g, 980, 110, deskOccupancy["D15"] || "invalid", "D15", 30, 50, "right", null, 1020, 135, 995, 140, );
        }

        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawFloor4(deskOccupancy = {}) {
        const g = this.createGroup("floor-4");

        this.drawChateaudunAllFloors(g);

        // Miami Room
        const miamiRoom = [
            { x: 710, y: 220 },
            { x: 710, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 170 },
            { x: 490, y: 220 },
            { x: 710, y: 220 },
        ];
        this.elementsManager.drawWall(g, miamiRoom, false);
        this.elementsManager.drawLabel(g, 550, 140, "Miami", 16, "bold");
        this.elementsManager.drawDoor(g, 415, 232, 40, 4, "horizontal", false, "rotate(25, 520, 222)");

        // Oregan Room
        const oreganRoom = [
            { x: 200, y: 50 },
            { x: 380, y: 50 },
            { x: 380, y: 150 },
            { x: 200, y: 150 },
            { x: 200, y: 50 },
        ];
        this.elementsManager.drawWall(g, oreganRoom, false);
        this.elementsManager.drawLabel(g, 290, 110, "Oregan", 16, "bold");
        this.elementsManager.drawDoor(g, 340, 149, 40, 4, "horizontal");

        // New York Room (vertical extension)
        this.elementsManager.drawLine( g, [ { x: 200, y: 150 }, { x: 200, y: 280 }, ], this.colors.wallStroke, 2, );
        this.elementsManager.drawDoor(g, 202, 180, 40, 4, "vertical");
        this.elementsManager.drawLabel(g, 260, -50, "New York", 16, "bold", "rotate(-90 290 110)");

        if (this.sensorMode === "DESK") {
            this.elementsManager.drawWorkstation( g, 790, 60, deskOccupancy["D01"] || "invalid", "D01", 30, 50, "left", null, 780, 85, 805, 90, );
            this.elementsManager.drawWorkstation( g, 790, 110, deskOccupancy["D02"] || "invalid", "D02", 30, 50, "left", null, 780, 135, 805, 140, );
            this.elementsManager.drawWorkstation( g, 820, 60, deskOccupancy["D03"] || "invalid", "D03", 30, 50, "right", null, 860, 85, 835, 90, );
            this.elementsManager.drawWorkstation( g, 820, 110, deskOccupancy["D04"] || "invalid", "D04", 30, 50, "right", null, 860, 135, 835, 140, );
            this.elementsManager.drawWorkstation( g, 950, 60, deskOccupancy["D05"] || "invalid", "D05", 30, 50, "left", null, 940, 85, 965, 90, );
            this.elementsManager.drawWorkstation( g, 950, 110, deskOccupancy["D06"] || "invalid", "D06", 30, 50, "left", null, 940, 135, 965, 140, );
            this.elementsManager.drawWorkstation( g, 980, 60, deskOccupancy["D07"] || "invalid", "D07", 30, 50, "right", null, 1020, 85, 995, 90, );
            this.elementsManager.drawWorkstation( g, 980, 110, deskOccupancy["D08"] || "invalid", "D08", 30, 50, "right", null, 1020, 135, 995, 140, );
        }

        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawFloor5(deskOccupancy = {}) {
        const g = this.createGroup("floor-5");

        this.drawChateaudunAllFloors(g);

        if (this.sensorMode === "DESK") {
            // Left cluster - horizontal desks
            this.elementsManager.drawWorkstation( g, 110, 90, deskOccupancy["D01"] || "invalid", "D01", 50, 30, "top", );
            this.elementsManager.drawWorkstation( g, 160, 90, deskOccupancy["D03"] || "invalid", "D03", 50, 30, "top", );
            this.elementsManager.drawWorkstation( g, 110, 120, deskOccupancy["D02"] || "invalid", "D02", 50, 30, "bottom", );
            this.elementsManager.drawWorkstation( g, 160, 120, deskOccupancy["D04"] || "invalid", "D04", 50, 30, "bottom", );

            // Top row - vertical desks
            this.elementsManager.drawWorkstation( g, 300, 60, deskOccupancy["D05"] || "invalid", "D05", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 330, 60, deskOccupancy["D06"] || "invalid", "D06", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 460, 60, deskOccupancy["D07"] || "invalid", "D07", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 490, 60, deskOccupancy["D09"] || "invalid", "D09", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 620, 60, deskOccupancy["D11"] || "invalid", "D11", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 650, 60, deskOccupancy["D14"] || "invalid", "D14", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 790, 60, deskOccupancy["D17"] || "invalid", "D17", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 820, 60, deskOccupancy["D19"] || "invalid", "D19", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 950, 60, deskOccupancy["D21"] || "invalid", "D21", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 980, 60, deskOccupancy["D23"] || "invalid", "D23", 30, 50, "right", );

            // Middle row - vertical desks
            this.elementsManager.drawWorkstation( g, 460, 110, deskOccupancy["D08"] || "invalid", "D08", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 490, 110, deskOccupancy["D10"] || "invalid", "D10", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 620, 110, deskOccupancy["D12"] || "invalid", "D12", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 650, 110, deskOccupancy["D15"] || "invalid", "D15", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 790, 110, deskOccupancy["D18"] || "invalid", "D18", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 820, 110, deskOccupancy["D20"] || "invalid", "D20", 30, 50, "right", );
            this.elementsManager.drawWorkstation( g, 950, 110, deskOccupancy["D22"] || "invalid", "D22", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 980, 110, deskOccupancy["D24"] || "invalid", "D24", 30, 50, "right", );

            // Bottom row - vertical desks
            this.elementsManager.drawWorkstation( g, 620, 160, deskOccupancy["D13"] || "invalid", "D13", 30, 50, "left", );
            this.elementsManager.drawWorkstation( g, 650, 160, deskOccupancy["D16"] || "invalid", "D16", 30, 50, "right", );
        }

        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawFloor6(deskOccupancy = {}) {
        const g = this.createGroup("floor-6");

        this.drawChateaudunAllFloors(g);

        // Paris Room
        const parisRoom = [
            { x: 480, y: 50 },
            { x: 710, y: 50 },
            { x: 710, y: 220 },
            { x: 480, y: 220 },
            { x: 480, y: 50 },
        ];
        this.elementsManager.drawWall(g, parisRoom, false);
        this.elementsManager.drawLabel(g, 590, 140, "Paris", 16, "bold");
        this.elementsManager.drawDoor(g, 520, 217, 40, 4, "horizontal");

        if (this.sensorMode === "DESK") {
            // D01-D04: Horizontal desks (60x30) - Left cluster
            this.elementsManager.drawWorkstation( g, 90, 110, deskOccupancy["D01"] || "invalid", "D01", 60, 30, "top", null, 120, 100, 120, 125, );
            this.elementsManager.drawWorkstation( g, 150, 110, deskOccupancy["D02"] || "invalid", "D02", 60, 30, "top", null, 180, 100, 180, 125, );
            this.elementsManager.drawWorkstation( g, 90, 140, deskOccupancy["D03"] || "invalid", "D03", 60, 30, "bottom", null, 120, 180, 120, 155, );
            this.elementsManager.drawWorkstation( g, 150, 140, deskOccupancy["D04"] || "invalid", "D04", 60, 30, "bottom", null, 180, 180, 180, 155, );

            // D05-D08: Horizontal desks (60x30) - Center cluster
            this.elementsManager.drawWorkstation( g, 350, 110, deskOccupancy["D05"] || "invalid", "D05", 60, 30, "top", null, 380, 100, 380, 125, );
            this.elementsManager.drawWorkstation( g, 410, 110, deskOccupancy["D06"] || "invalid", "D06", 60, 30, "top", null, 440, 100, 440, 125, );
            this.elementsManager.drawWorkstation( g, 350, 140, deskOccupancy["D07"] || "invalid", "D07", 60, 30, "bottom", null, 380, 180, 380, 155, );
            this.elementsManager.drawWorkstation( g, 410, 140, deskOccupancy["D08"] || "invalid", "D08", 60, 30, "bottom", null, 440, 180, 440, 155, );

            // D09-D16: Vertical desks (30x50) - Right clusters
            this.elementsManager.drawWorkstation( g, 790, 60, deskOccupancy["D09"] || "invalid", "D09", 30, 50, "left", null, 780, 85, 805, 90, );
            this.elementsManager.drawWorkstation( g, 790, 110, deskOccupancy["D10"] || "invalid", "D10", 30, 50, "left", null, 780, 135, 805, 140, );
            this.elementsManager.drawWorkstation( g, 820, 60, deskOccupancy["D11"] || "invalid", "D11", 30, 50, "right", null, 860, 85, 835, 90, );
            this.elementsManager.drawWorkstation( g, 820, 110, deskOccupancy["D12"] || "invalid", "D12", 30, 50, "right", null, 860, 135, 835, 140, );
            this.elementsManager.drawWorkstation( g, 950, 60, deskOccupancy["D13"] || "invalid", "D13", 30, 50, "left", null, 940, 85, 965, 90, );
            this.elementsManager.drawWorkstation( g, 950, 110, deskOccupancy["D14"] || "invalid", "D14", 30, 50, "left", null, 940, 135, 965, 140, );
            this.elementsManager.drawWorkstation( g, 980, 60, deskOccupancy["D15"] || "invalid", "D15", 30, 50, "right", null, 1020, 85, 995, 90, );
            this.elementsManager.drawWorkstation( g, 980, 110, deskOccupancy["D16"] || "invalid", "D16", 30, 50, "right", null, 1020, 135, 995, 140, );
        }

        let root = this.svg.querySelector("#content-root");
        root.appendChild(g);
    }

    drawChateaudunAllFloors(parent) {
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
        this.elementsManager.drawWall(parent, outerWall, true);

        // Internal separator lines
        this.elementsManager.drawLine( parent, [ { x: 750, y: 55 }, { x: 750, y: 240 }, ], this.colors.interiorLine, 2, );
        this.elementsManager.drawLine( parent, [ { x: 720, y: 55 }, { x: 720, y: 240 }, ], this.colors.interiorLine, 2, );
        this.elementsManager.drawLine( parent, [ { x: 720, y: 240 }, { x: 750, y: 240 }, ], this.colors.interiorLine, 1.5, );
        this.elementsManager.drawLine( parent, [ { x: 1050, y: 200 }, { x: 850, y: 200 }, ], this.colors.interiorLine, 1.5, );
        this.elementsManager.drawLine( parent, [ { x: 1050, y: 210 }, { x: 850, y: 210 }, ], this.colors.interiorLine, 1.5, );
        this.elementsManager.drawLine( parent, [ { x: 850, y: 200 }, { x: 850, y: 210 }, ], this.colors.interiorLine, 2, );

        // Windows
        this.elementsManager.drawWindow(parent, 120, 50, 80, "horizontal");
        this.elementsManager.drawWindow(parent, 290, 50, 80, "horizontal");
        this.elementsManager.drawWindow(parent, 430, 50, 80, "horizontal");
        this.elementsManager.drawWindow(parent, 550, 50, 80, "horizontal");
        this.elementsManager.drawWindow(parent, 650, 50, 80, "horizontal");
        this.elementsManager.drawWindow(parent, 820, 50, 80, "horizontal");
        this.elementsManager.drawWindow(parent, 980, 50, 80, "horizontal");
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
        let root = this.svg.querySelector("#content-root");
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

    _initDragAndDrop() {
        if (!this.svg) return;

        function extractRotation(transform) {
            if (!transform) return 0;
            const match = transform.match(/rotate\(([-\d.]+)/);
            return match ? parseFloat(match[1]) : 0;
        }

        const svgPoint = (evt) => {
            const pt = this.svg.createSVGPoint();
            pt.x = evt.clientX;
            pt.y = evt.clientY;
            return pt;
        };

        // --- helpers ---
        const num = (v) => (v == null ? 0 : parseFloat(v));

        const offsetRotateCenters = (transformStr, dx, dy) => {
            if (!transformStr) return transformStr;

            // rotate(angle cx cy)
            return transformStr.replace(
            /rotate\(\s*([-\d.]+)(?:[,\s]+([-\d.]+)(?:[,\s]+([-\d.]+))?)?\s*\)/g,
            (m, a, cx, cy) => {
                if (cx == null || cy == null) return `rotate(${a})`;
                const ncx = parseFloat(cx) + dx;
                const ncy = parseFloat(cy) + dy;
                return `rotate(${a} ${ncx} ${ncy})`;
            }
            );
        };

        const offsetElementAttrs = (el, dx, dy) => {
            const tag = el.tagName.toLowerCase();

            if (tag === "rect") {
                el.setAttribute("x", num(el.getAttribute("x")) + dx);
                el.setAttribute("y", num(el.getAttribute("y")) + dy);

                // si rect a une rotation, déplacer aussi son pivot
                const t = el.getAttribute("transform");
                if (t) el.setAttribute("transform", offsetRotateCenters(t, dx, dy));
                return;
            }

            if (tag === "circle") {
                el.setAttribute("cx", num(el.getAttribute("cx")) + dx);
                el.setAttribute("cy", num(el.getAttribute("cy")) + dy);

                const t = el.getAttribute("transform");
                if (t) el.setAttribute("transform", offsetRotateCenters(t, dx, dy));
                return;
            }

            if (tag === "text") {
                el.setAttribute("x", num(el.getAttribute("x")) + dx);
                el.setAttribute("y", num(el.getAttribute("y")) + dy);

                const t = el.getAttribute("transform");
                if (t) el.setAttribute("transform", offsetRotateCenters(t, dx, dy));
                return;
            }

            if (tag === "line") {
                el.setAttribute("x1", num(el.getAttribute("x1")) + dx);
                el.setAttribute("y1", num(el.getAttribute("y1")) + dy);
                el.setAttribute("x2", num(el.getAttribute("x2")) + dx);
                el.setAttribute("y2", num(el.getAttribute("y2")) + dy);

                const t = el.getAttribute("transform");
                if (t) el.setAttribute("transform", offsetRotateCenters(t, dx, dy));
                return;
            }
        };

        // Convertit un point écran en coordonnées du parent de l’élément
        const toParentCoords = (el, evt) => {
            const pt = svgPoint(evt);
            // CTM = matrice écran→élémentParent
            const parent = el.parentNode;
            const inv = parent.getScreenCTM().inverse();
            return pt.matrixTransform(inv);
        };

        const findDraggable = (target) => {
            // Draggable only if filter-element is the same type and data-draggable = "true"
            let el = target;
            while (el && el !== this.svg) {
                if (el.getAttribute?.("data-draggable") === "true") {
                    if (el.classList?.contains("sensor-marker")) {
                        return el;
                    }
                    this.populateFormFromG(el);
                    return el;
                }
                el = el.parentNode;
            }
            return null;
        };

        const drag = {
            active: false,
            el: null,
            type: null,
            startMouse: { x:0, y:0 }, // dans repère parent
            startEl:   { x:0, y:0 }, // position initiale de l'élément dans repère parent
            groupChildren: null, // [{el, snapshot: {...}}]
        };

        // helper snapshot/revert
        const snapshotChild = (child) => {
            const tag = child.tagName.toLowerCase();
            const snap = { tag };

            if (tag === "rect") {
                snap.x = num(child.getAttribute("x"));
                snap.y = num(child.getAttribute("y"));
            } else if (tag === "circle") {
                snap.cx = num(child.getAttribute("cx"));
                snap.cy = num(child.getAttribute("cy"));
            } else if (tag === "text") {
                snap.x = num(child.getAttribute("x"));
                snap.y = num(child.getAttribute("y"));
            } else if (tag === "line") {
                snap.x1 = num(child.getAttribute("x1"));
                snap.y1 = num(child.getAttribute("y1"));
                snap.x2 = num(child.getAttribute("x2"));
                snap.y2 = num(child.getAttribute("y2"));
            }

            snap.transform = child.getAttribute("transform") || "";
            return snap;
        };

        const applySnapshotWithOffset = (child, snap, dx, dy) => {
            const tag = snap.tag;

            if (tag === "rect") {
                child.setAttribute("x", snap.x + dx);
                child.setAttribute("y", snap.y + dy);
            } else if (tag === "circle") {
                child.setAttribute("cx", snap.cx + dx);
                child.setAttribute("cy", snap.cy + dy);
            } else if (tag === "text") {
                child.setAttribute("x", snap.x + dx);
                child.setAttribute("y", snap.y + dy);
            } else if (tag === "line") {
                child.setAttribute("x", snap.x + dx);
                child.setAttribute("y", snap.y + dy);
                child.setAttribute("x1", snap.x1 + dx);
                child.setAttribute("y1", snap.y1 + dy);
                child.setAttribute("x2", snap.x2 + dx);
                child.setAttribute("y2", snap.y2 + dy);
            }

            // gérer rotations/pivots
            if (snap.transform) {
                child.setAttribute("transform", offsetRotateCenters(snap.transform, dx, dy));
            }
        };

        const onDown = (evt) => {
            const target = evt.target;

            const marker = target.closest(".sensor-marker");
            if (marker) {
                const sensor = marker.querySelector(".sensor");
                if (sensor) {
                    const inputId = document.getElementById("input_id");
                    const inputSize = document.getElementById("input_size");
                    const inputWidth = document.getElementById("input_width");
                    const inputHeight = document.getElementById("input_height");
                    const inputRotation = document.getElementById("input_rotation");
                    const chairSelect = document.getElementById("chair_select");
                    const filterEl = document.getElementById('filter-element');
                    const sensorTypeSelect = document.getElementById('filter-sensor-type');
                    const mode = sensor.getAttribute("sensor-mode") || "DESK";

                    if (window.applyFormVisibility) {
                        window.applyFormVisibility("Sensor", mode);
                    }

                    if (filterEl) filterEl.value = "Sensor";
                    if (sensorTypeSelect) sensorTypeSelect.value = mode;
                    if (inputId) inputId.value = sensor.getAttribute("id");
                    if (inputSize) inputSize.value = sensor.getAttribute("size") || sensor.getAttribute("font-size");
                    if (inputWidth) inputWidth.value = sensor.getAttribute("width");
                    if (inputHeight) inputHeight.value = sensor.getAttribute("height");
                    if (inputRotation) inputRotation.value = extractRotation(sensor.getAttribute('transform'));
                    if (chairSelect) chairSelect.value = sensor.getAttribute("chair");
                }
            }

            const el = findDraggable(evt.target);
            if (!el) return;
            evt.preventDefault();
            this.svg.setPointerCapture?.(evt.pointerId);

            // point dans le repère du parent
            const p = toParentCoords(el, evt);
            drag.active = true;
            drag.el = el;
            drag.startMouse = { x: p.x, y: p.y };

            const tag = el.tagName.toLowerCase();
            // Déterminer comment on déplace
            if (tag === "g") {
                drag.type = "groupChildren";

                // OPTION: si le <g> a déjà un translate, on peut le "baker" une fois
                // sinon on risque d'accumuler des offsets invisibles.
                // Ici on choisit de nettoyer le translate du groupe si présent :
                const gt = el.getAttribute("transform") || "";
                if (gt && /translate\(/.test(gt)) {
                    // parse translate(tx,ty) (simple)
                    const m = /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/.exec(gt);
                    if (m) {
                        const tx = parseFloat(m[1]), ty = parseFloat(m[2]);
                        Array.from(el.children).forEach(child => offsetElementAttrs(child, tx, ty));
                    }
                    el.setAttribute("transform", gt.replace(/translate\([^)]+\)/, "").trim());
                }

                // Snapshot des enfants simples (rect/circle/text/line)
                drag.groupChildren = Array.from(el.children)
                    .filter(c => ["rect","circle","text","line"].includes(c.tagName.toLowerCase()))
                    .map(c => ({ el: c, snap: snapshotChild(c) }));

                drag.startEl = { x: 0, y: 0 };
                return;
            } else if (tag === "rect") {
                drag.type = "rect";
                drag.startEl = {
                    x: parseFloat(el.getAttribute("x") || "0"),
                    y: parseFloat(el.getAttribute("y") || "0"),
                };
            } else if (tag === "circle") {
                drag.type = "circle";
                drag.startEl = {
                    x: parseFloat(el.getAttribute("cx") || "0"),
                    y: parseFloat(el.getAttribute("cy") || "0"),
                };
            } else if (tag === "text") {
                drag.type = "text";
                drag.startEl = {
                    x: parseFloat(el.getAttribute("x") || "0"),
                    y: parseFloat(el.getAttribute("y") || "0"),
                };
            } else if (tag === "line") {
                drag.type = "line";
                drag.startEl = {
                    x: parseFloat(el.getAttribute("x") || "0"),
                    y: parseFloat(el.getAttribute("y") || "0"),
                };
            } else {
                // Fallback : translation via transform au niveau de l'élément
                drag.type = "transform";
                const t = el.getAttribute("transform") || "";
                const m = /translate\(\s*([\-0-9.]+)\s*,\s*([\-0-9.]+)\s*\)/.exec(t);
                drag.startEl = { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 };
            }
        };

        const onMove = (evt) => {
            if (!drag.active || !drag.el) return;
            evt.preventDefault();

            // position courante souris dans le repère du parent
            const p = toParentCoords(drag.el, evt);
            const dx = p.x - drag.startMouse.x;
            const dy = p.y - drag.startMouse.y;

            const nx = drag.startEl.x + dx;
            const ny = drag.startEl.y + dy;

            const el = drag.el;
            switch (drag.type) {
                case "groupChildren": {
                    // Appliquer dx/dy à partir du snapshot (pas cumulatif)
                    (drag.groupChildren || []).forEach(({ el:child, snap }) => {
                        applySnapshotWithOffset(child, snap, dx, dy);
                    });
                    break;
                }
                case "rect":
                    el.setAttribute("x", nx);
                    el.setAttribute("y", ny);
                    break;
                case "circle":
                    el.setAttribute("cx", nx);
                    el.setAttribute("cy", ny);
                    break;
                case "text":
                    el.setAttribute("x", nx);
                    el.setAttribute("y", ny);
                    break;
                case "line":
                    el.setAttribute("x", nx);
                    el.setAttribute("y", ny);
                    break;
                case "transform":
                default: {
                    const t = el.getAttribute("transform") || "";
                    const tNoTranslate = t.replace(/translate\([^)]+\)/, "").trim();
                    el.setAttribute(
                        "transform",
                        (tNoTranslate ? tNoTranslate + " " : "") + `translate(${nx}, ${ny})`
                    );
                    break;
                }
            }
        };

        const onUp = (evt) => {
            if (!drag.active) return;
            evt.preventDefault();
            this.svg.releasePointerCapture?.(evt.pointerId);

            const el = drag.el;
            
            const id =
                el.getAttribute("data-id") ||
                el.getAttribute("data-desk-id") ||
                el.getAttribute("id");

            if (id) {
                // mémoriser la position finale (patch)
                let pos = { x: 0, y: 0, type: drag.type };
                
                if (drag.type === "groupChildren") {
                    const deskRect = el.querySelector("rect");
                    if (deskRect) {
                        pos.type = "groupChildren";
                        pos.x = parseFloat(deskRect.getAttribute("x") || "0");
                        pos.y = parseFloat(deskRect.getAttribute("y") || "0");
                    }
                } else if (drag.type === "rect") {
                    pos.x = parseFloat(el.getAttribute("x"));
                    pos.y = parseFloat(el.getAttribute("y"));
                } else if (drag.type === "circle") {
                    pos.x = parseFloat(el.getAttribute("cx"));
                    pos.y = parseFloat(el.getAttribute("cy"));
                } else if (drag.type === "text") {
                    pos.x = parseFloat(el.getAttribute("x"));
                    pos.y = parseFloat(el.getAttribute("y"));
                } else if (drag.type === "line") {
                    pos.x = parseFloat(el.getAttribute("x"));
                    pos.y = parseFloat(el.getAttribute("y"));
                } else {
                    const t = el.getAttribute("transform") || "";
                    const m = /translate\(\s*([\-0-9.]+)\s*,\s*([\-0-9.]+)\s*\)/.exec(t);
                    pos.x = m ? parseFloat(m[1]) : 0;
                    pos.y = m ? parseFloat(m[2]) : 0;
                }
                this._positionsDirty.set(id, pos);
            }

            // reset
            drag.active = false;
            drag.el = null;
        };

        this.svg.addEventListener("pointerdown", onDown);
        this.svg.addEventListener("pointermove", onMove);
        this.svg.addEventListener("pointerup", onUp);
        this.svg.addEventListener("pointercancel", onUp);
    }

    populateFormFromG(g) {
        const id = g.getAttribute("id");
        const type = g.getAttribute("data-type");
        const floor = g.getAttribute("floor-number") ?? "";
        const size = g.getAttribute("data-size") ?? "0";
        const width = g.getAttribute("data-width") ?? "0";
        const height = g.getAttribute("data-height") ?? "0";
        const rotation = g.getAttribute("data-rotation") ?? "";
        const radius = g.getAttribute("data-radius") ?? "0";
        const label = g.getAttribute("data-label") ?? "";
        const child = g.firstElementChild;
        if (!child) return;
        const tag = child.tagName.toLowerCase();
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };

        if (window.applyFormVisibility) {
            window.applyFormVisibility(type, document.getElementById('filter-sensor-type')?.value);
        }

        setVal("input_id", id);
        setVal("filter-floor", floor);

        if (type === "Wall" || tag === "line") {
            setVal("input_size", parseFloat(size));
            setVal("input_width", parseFloat(width));
            setVal("input_height", parseFloat(height));
            setVal("input_radius", "");
            setVal("input_label", "");
            setVal("input_rotation", rotation);
        } else if (type === "Room" || type === "Window" || type === "Door" || tag === "rect") {
            setVal("input_width", parseFloat(width));
            setVal("input_height", parseFloat(height));
            setVal("input_size", "");
            setVal("input_radius", "");
            setVal("input_label", "");
            setVal("input_rotation", rotation);
        } else if (type === "Circle" || tag === "circle") {
            setVal("input_radius", radius);
            setVal("input_width", "");
            setVal("input_height", "");
            setVal("input_size", "");
            setVal("input_label", "");
            setVal("input_rotation", "");
        } else if (type === "Label" || tag === "text") {
            setVal("input_label", label);
            setVal("input_size", parseFloat(size));
            setVal("input_width", "");
            setVal("input_height", "");
            setVal("input_radius", "");
            setVal("input_rotation", rotation);
        }
        const sel = document.getElementById("filter-element");
        if (sel) sel.value = type;
    }

    exportSVG() {
        if (!this.svg) return null;

        // Récupérer les éléments à exclure (temp)
        const nodesToRemove = this.svg.querySelectorAll('.sensor-temp');

        // Retirer temporairement les nodes (en les stockant pour les restaurer ensuite)
        const removedNodes = [];
        nodesToRemove.forEach(node => {
            removedNodes.push({ node, parent: node.parentNode });
            node.parentNode.removeChild(node);
        });

        // Serializer
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.svg);

        // Restaurer les nodes supprimés
        removedNodes.forEach(({ node, parent }) => parent.appendChild(node));

        return svgString;
    }

}

// Global reference
window.ArchitecturalFloorPlan = ArchitecturalFloorPlan;