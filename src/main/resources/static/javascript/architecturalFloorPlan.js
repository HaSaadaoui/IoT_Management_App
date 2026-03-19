// ===== ARCHITECTURAL FLOOR PLAN - CEILING VIEW =====
// Professional architectural drawing system matching "Occupation Live" style
class ArchitecturalFloorPlan {
    constructor(
        containerId,
        floorData,
        sensorMode = "DESK",
        buildingKey,
        svgPath,
        isDashboard = true,
        floorsCount = 1
    ) {
        this.container = document.getElementById(containerId);
        this.floorData = floorData;
        this.sensorMode = sensorMode;
        this.svg = null;
        this.root = null;
        this.viewport = null;
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

        this.camera = {
            scale: 1,
            min: 0.2,
            max: 8,
            tx: 0,
            ty: 0
        };

        this.zoomConfig = {
            wheelSpeed: 0.15
        };

        this.init();
    }

    init() {
        this.createSVG();
        this.elementsManager = new FloorElementsManager(this.svg, this.colors);
        this.enableZoom();
        if (this.isDashboard){
            this.enablePan();
        }
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
        this.svg.setAttribute("margin", "0");
        this.svg.setAttribute("viewBox", "0 200 1200 800");
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        this.svg.style.background = this.colors.background;
        this.container.appendChild(this.svg);

        // Groupe pour gérer le zoom et le pan de tout le contenu
        this.viewport = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.viewport.setAttribute("id", "viewport");
        this.svg.appendChild(this.viewport)

        // Content-root pour centrer le plan et faciliter les transformations
        this.root = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.root.setAttribute("id", "content-root");
        this.root.style.display = "none";
        this.viewport.appendChild(this.root);
    }

    createGroup(id) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", id);
        return g;
    }

    displayContentRoot() {
        const root = this.svg.querySelector("#content-root");
        if (root){
            root.style.display = "block";
        }
    }

    async drawFloorPlan(deskOccupancy = {}) {
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
            default:
                await this.drawFloorSVG();
                break;
        }

        // Gestion des capteurs
        // Par défaut on récupère les capteurs en dur (Chateaudun), sinon on récupère ceux du SVG
        let sensors = this.generateSensorData(this.sensorMode, this.floorData.floorNumber);
        if (!sensors.length) {
            sensors = await this.populateSensorsFromSvg();
            if (this.sensorMode === "DESK"){
                sensors.forEach(s => {s.status = deskOccupancy[s.id] || "invalid";});
            }
        }

        this.overlayManager = new SensorOverlayManager(this.svg, this.colors, this.isDashboard);
        this.overlayManager.setSensorMode(this.sensorMode, sensors, this.floorData.floorNumber);

        if (this.isDashboard && this.sensorMode !== "DESK"){
            this.startLiveSensors();
        }

        // On modifie le SVG pour le centrer sur l'écran
        const vb = this.svg.viewBox.baseVal;
        this.centerSVGContent({targetX: vb.x, targetY: vb.y, targetWidth: vb.width, targetHeight: vb.height, padding: 20, fit: true });

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
        case "TEMPEX" :
        case "TEMP":
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
                if (!this.isDashboard){
                    importedG.setAttribute("data-draggable", importedG.getAttribute("data-draggable") ?? "true");
                    importedG.style.cursor = "move";
                } else {
                    importedG.setAttribute("data-draggable", "false");
                    importedG.style.cursor = "default";
                }
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

    async populateSensorsFromSvg(valueMap = null) {
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

        let sensors = nodes
            .map((el) => {

                function extractRotation(transform) {
                    if (!transform) return 0;
                    const match = transform.match(/rotate\(([-\d.]+)/);
                    return match ? parseFloat(match[1]) : 0;
                }

                const liveValue = valueMap?.get(el.getAttribute('id')) ?? '--';
                return { id : el.getAttribute('id'),
                    type : el.getAttribute('sensor-mode') || 'UNKNOWN',
                    floor : el.getAttribute('floor-number'),
                    x : parseFloat(el.getAttribute('x')),
                    y : parseFloat(el.getAttribute('y')),
                    size : parseInt(parseFloat(el.getAttribute('size') || el.getAttribute('font-size'))),
                    width : parseInt(parseFloat(el.getAttribute('width'))),
                    height : parseInt(parseFloat(el.getAttribute('height'))),
                    rotation : extractRotation(el.getAttribute('transform')),
                    chairs : JSON.parse(el.getAttribute("chairs") || "{}"),
                    label : el.getAttribute('label'),
                    value : liveValue,
                    status : "invalid" //valeur par défaut
                };
        });

        // pour la configuration on récupère tous les capteurs du svg
        // pour le dashboard uniquement ceux de l'étage courant et du mode courant 
        if (this.isDashboard){
            sensors = sensors
                .filter(s => s.floor == this.floorData.floorNumber)
                .filter(s => s.type === this.sensorMode);
        }

        return sensors;
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
        this.elementsManager.drawLabel(g, 120, 160, "New York", 16, "bold");

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
    centerSVGContent({targetX = 0, targetY = 0, targetWidth = 1200, targetHeight = 1200, padding = 20, fit = true} = {}) {
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
        const tx = padding + targetX + (availW - scaledW) / 2 - bbox.x * scale;
        const ty = padding + targetY + (availH - scaledH) / 2 - bbox.y * scale;

        // Appliquer la transform
        root.setAttribute("transform", `translate(${tx}, ${ty}) scale(${scale})`);
    }

    _initDragAndDrop() {
        if (!this.svg) return;

        this._removeDragListeners?.(); // nettoyer les anciens listeners

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
                    const inputLabel = document.getElementById("input_label");
                    const chairTop = document.getElementById("chair_top");
                    const chairBottom = document.getElementById("chair_bottom");
                    const chairLeft = document.getElementById("chair_left");
                    const chairRight = document.getElementById("chair_right");
                    const filterEl = document.getElementById('filter-element');
                    const sensorTypeSelect = document.getElementById('filter-sensor-type');
                    const mode = sensor.getAttribute("sensor-mode") || "DESK";
                    const chairs = JSON.parse(sensor.getAttribute("chairs") || "{}");

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
                    if (inputLabel) inputLabel.value = sensor.getAttribute("label") || "";
                    if (chairs && Object.keys(chairs).length > 0) {
                        if (chairTop) chairTop.value = chairs?.["top"];
                        if (chairBottom) chairBottom.value = chairs?.["bottom"];
                        if (chairLeft) chairLeft.value = chairs?.["left"];
                        if (chairRight) chairRight.value = chairs?.["right"];
                    } else {
                        if (chairTop) chairTop.value = "0";
                        if (chairBottom) chairBottom.value = "0";
                        if (chairLeft) chairLeft.value = "0";
                        if (chairRight) chairRight.value = "0";   
                    }

                    // Charger les options de location + pré-sélectionner la valeur courante
                    const buildingId = document.getElementById("filter-building")?.value || "";
                    const floor = document.getElementById("filter-floor")?.value ?? "";

                    fetch(`/api/sensors/${encodeURIComponent(inputId.value)}`)
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            const currentLocation = data?.location || "";
                            // loadLocationOptions est défini dans configuration.js
                            if (window.loadLocationOptions) {
                                window.loadLocationOptions(buildingId, floor, currentLocation);
                            }
                        })
                        .catch(() => {
                            if (window.loadLocationOptions) {
                                window.loadLocationOptions(buildingId, floor, "");
                            }
                        });
                    }
            }

            const TOLERANCE_PERCENT = 20;

            let el = findDraggable(evt.target);

            if (!el) {
                const pt = this.svg.createSVGPoint();
                pt.x = evt.clientX;
                pt.y = evt.clientY;
                const viewportPt = pt.matrixTransform(this.viewport.getScreenCTM().inverse());

                const allDraggables = Array.from(
                    this.viewport.querySelectorAll('[data-draggable="true"]')
                );

                let bestEl = null;
                let bestDist = Infinity;

                for (const candidate of allDraggables) {
                    const bbox = candidate.getBBox();
                    const ctm = candidate.parentNode.getScreenCTM();
                    const invViewport = this.viewport.getScreenCTM().inverse();
                    const toViewport = invViewport.multiply(ctm);

                    // Transformer les 4 coins (pas seulement 2) pour gérer scale négatif
                    const corners = [
                        { x: bbox.x,              y: bbox.y },
                        { x: bbox.x + bbox.width, y: bbox.y },
                        { x: bbox.x,              y: bbox.y + bbox.height },
                        { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
                    ].map(c => {
                        let p = this.svg.createSVGPoint();
                        p.x = c.x; p.y = c.y;
                        return p.matrixTransform(toViewport);
                    });

                    const xs = corners.map(c => c.x);
                    const ys = corners.map(c => c.y);
                    const xMin = Math.min(...xs);
                    const xMax = Math.max(...xs);
                    const yMin = Math.min(...ys);
                    const yMax = Math.max(...ys);

                    const minDim = Math.min(xMax - xMin, yMax - yMin);
                    const tol = minDim * TOLERANCE_PERCENT / 100;

                    if (viewportPt.x >= xMin - tol && viewportPt.x <= xMax + tol &&
                        viewportPt.y >= yMin - tol && viewportPt.y <= yMax + tol) {

                        const cx = (xMin + xMax) / 2;
                        const cy = (yMin + yMax) / 2;
                        const dist = Math.hypot(viewportPt.x - cx, viewportPt.y - cy);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestEl = candidate;
                        }
                    }
                }

                el = bestEl;
                if (el) this.populateFormFromG(el);
            }

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

        // Mémoriser la fonction de nettoyage
        this._removeDragListeners = () => {
        this.svg.removeEventListener("pointerdown",  onDown);
        this.svg.removeEventListener("pointermove",  onMove);
        this.svg.removeEventListener("pointerup",    onUp);
        this.svg.removeEventListener("pointercancel",onUp);
        };
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
        const style = g.getAttribute("data-style") ?? "Dark";
        const child = g.firstElementChild;
        if (!child) return;
        const tag = child.tagName.toLowerCase();
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };

        if (window.applyFormVisibility) {
            window.applyFormVisibility(type, document.getElementById('filter-sensor-type')?.value);
        }

        setVal("input_id", id);
        setVal("filter-floor", floor);
        setVal("filter-style", style);
        if (type === "Wall" || tag === "line") {
            setVal("input_size", parseFloat(size));
            setVal("input_width", parseFloat(width));
            setVal("input_height", parseFloat(height));
            setVal("input_radius", 0);
            setVal("input_label", "");
            setVal("input_rotation", rotation);
        } else if (type === "Room" || type === "Window" || type === "Door" || tag === "rect") {
            setVal("input_width", parseFloat(width));
            setVal("input_height", parseFloat(height));
            setVal("input_size", 0);
            setVal("input_radius", 0);
            setVal("input_label", "");
            setVal("input_rotation", rotation);
        } else if (type === "Circle" || tag === "circle") {
            setVal("input_radius", radius);
            setVal("input_width", 0);
            setVal("input_height", 0);
            setVal("input_size", 0);
            setVal("input_label", "");
            setVal("input_rotation", 0);
        } else if (type === "Label" || tag === "text") {
            setVal("input_label", label);
            setVal("input_size", parseFloat(size));
            setVal("input_width", 0);
            setVal("input_height", 0);
            setVal("input_radius", 0);
            setVal("input_rotation", rotation);
        }
        const sel = document.getElementById("filter-element");
        if (sel) sel.value = type;
    }

    _applyTransform() {
        if (this._rafPending) return;
        this._rafPending = true;
        requestAnimationFrame(() => {
            this.viewport.setAttribute(
                "transform",
                `translate(${this.camera.tx}, ${this.camera.ty}) scale(${this.camera.scale})`
            );
            this._rafPending = false;
        });
    }

    enablePan() {
        let dragging = false;
        let last = { x: 0, y: 0 };

        const onDown = evt => { dragging = true; last = { x: evt.clientX, y: evt.clientY }; };
        const onMove = evt => {
            if (!dragging) return;
            this.camera.tx += evt.clientX - last.x;
            this.camera.ty += evt.clientY - last.y;
            last = { x: evt.clientX, y: evt.clientY };
            this._applyTransform();
        };
        const onUp = () => { dragging = false; };

        // Garder sur svg + document uniquement pour mouseup
        this.svg.addEventListener("mousedown", onDown);
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup",   onUp);

        // Nettoyage
        this._removePanListeners = () => {
            this.svg.removeEventListener("mousedown", onDown);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup",   onUp);
        };
    }

    enableZoom() {
        this.svg.addEventListener("wheel", evt => {
            evt.preventDefault();

            const { wheelSpeed } = this.zoomConfig;
            const delta = evt.deltaY > 0 ? -1 : 1;

            // Point souris → coordonnées SVG
            const pt = this.svg.createSVGPoint();
            pt.x = evt.clientX;
            pt.y = evt.clientY;
            const cursor = pt.matrixTransform(this.svg.getScreenCTM().inverse());

            const oldScale = this.camera.scale;
            let newScale = oldScale * (1 + delta * wheelSpeed);
            newScale = Math.max(this.camera.min, Math.min(this.camera.max, newScale));

            // Compensation pour que le point sous le curseur reste fixe
            this.camera.tx -= (cursor.x * newScale - cursor.x * oldScale);
            this.camera.ty -= (cursor.y * newScale - cursor.y * oldScale);

            this.camera.scale = newScale;
            this.viewport.setAttribute("transform", `translate(${this.camera.tx}, ${this.camera.ty}) scale(${this.camera.scale})`);
        }, { passive: false });
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