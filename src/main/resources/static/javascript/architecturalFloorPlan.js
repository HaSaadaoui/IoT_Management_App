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

    updateConfig(floorData, sensorMode, svgPath, floorsCount) {
        this.floorData = floorData;
        this.sensorMode = sensorMode;
        this.svgPath = svgPath;
        if (floorsCount != null) this.floorsCount = floorsCount;

        // Reset camera zoom/pan so the new floor starts properly fitted
        this.camera.scale = 1;
        this.camera.tx = 0;
        this.camera.ty = 0;
        if (this.viewport) {
            this.viewport.setAttribute("transform", "translate(0,0) scale(1)");
        }

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

        await this.drawFloorSVG();

        // Gestion des capteurs
        let sensors = await this.populateSensorsFromSvg();
        if (this.sensorMode === "DESK"){
            sensors.forEach(s => {s.status = deskOccupancy[s.id] || "invalid";});
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

      const normalizeSsePayload = (payload) => {
        if (payload == null) return [];
        if (Array.isArray(payload)) {
          return payload.flatMap(normalizeSsePayload);
        }
        if (Array.isArray(payload.result)) {
          return payload.result.flatMap(normalizeSsePayload);
        }
        if (Array.isArray(payload.results)) {
          return payload.results.flatMap(normalizeSsePayload);
        }
        if (Array.isArray(payload.items)) {
          return payload.items.flatMap(normalizeSsePayload);
        }
        if (payload.result && typeof payload.result === "object") {
          return [payload.result];
        }
        return [payload];
      };

      // Traitement commun uplink + snapshot
      const handleSensorEvent = (e) => {
        try {
          const raw = JSON.parse(e.data);
          const messages = normalizeSsePayload(raw);

          messages.forEach((msg) => {
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

            const value = this.extractSensorValue(this.sensorMode, decoded);

            if (value == null) return;

            this.updateSensorValue(sensorId, value);
          });

        } catch (err) {
          console.warn("[SSE sensors] parse error", err, e.data);
        }
      };

      // snapshot = valeurs initiales depuis le cache (affichage instantané)
      this._sensorEs.addEventListener("snapshot", handleSensorEvent);

      // uplink = messages MQTT live
      this._sensorEs.addEventListener("uplink", handleSensorEvent);

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
        case "SON":
          return payload["LAeq"] ?? payload["LAeq (dB)"];
        case "LIGHT":
          return payload["light"] ?? payload["illuminance"] ?? payload["lux"];
        case "PIR_LIGHT":
        case "PR":
            return payload["pir"] ?? payload["presence"] ?? payload["daylight"] ?? "Empty";
        case "COUNT":
          return {
            in: payload.period_in ?? 0,
            out: payload.period_out ?? 0,
          };
        case "ENERGY":
        case "CONSO":
            return "";  // la valeur sera récupérée par la suite sur Avg Power
        case "MOTION":
            return payload["pir"] ?? "Motion";
        default:
          return null;
      }
    }

    updateDeskStatus(sensorId, status) {
        if (!this.overlayManager) return false;
        return this.overlayManager.updateDeskStatus(sensorId, status);
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

        console.log(this.svgPath);
        console.log(raw);

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

        const typedGroups = Array.from(doc.querySelectorAll("g[data-type]"));
        const typedGroupChildren = new Set(typedGroups.flatMap(g => Array.from(g.querySelectorAll("*"))));

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

        // On trace les groupes d'éléments <g>
        if (typedGroups.length) {
            typedGroups.forEach(srcG => {
                const floor = srcG.getAttribute("floor-number") ?? "";
                const importedG = document.importNode(srcG, true);
                const isSameFloor = (floor == null && this.floorData.floorNumber == null) || (floor != null && this.floorData.floorNumber != null && Number(floor) === Number(this.floorData.floorNumber));
                if (!this.isDashboard && isSameFloor){
                    importedG.setAttribute("data-draggable", "true");
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
            // Certains modes peuvent être fournis par plusieurs types de capteurs
            // ex: TEMP peut venir d'un CO2, d'un TEMPEX, d'un EYE...
            const SENSOR_TYPES_BY_MODE = {
                'TEMP':     ['TEMP', 'TEMPEX', 'CO2', 'EYE'],
                'TEMPEX':   ['TEMPEX', 'TEMP', 'CO2', 'EYE'],
                'HUMIDITY': ['CO2', 'TEMPEX', 'EYE'],
                'CO2':      ['CO2'],
                'NOISE':    ['NOISE', 'SON'],
                'SON':      ['SON', 'NOISE'],
                'LIGHT':    ['LIGHT', 'PIR_LIGHT', 'EYE', 'CO2'],
                'MOTION':   ['MOTION', 'PIR_LIGHT', 'EYE', 'OCCUP'],
                'PIR_LIGHT':['PIR_LIGHT', 'PR'],
                'PR':       ['PR', 'PIR_LIGHT'],
                'COUNT':    ['COUNT'],
                'ENERGY':   ['ENERGY', 'CONSO'],
                'CONSO':    ['CONSO', 'ENERGY'],
                'DESK':     ['DESK'],
            };
            const allowedTypes = SENSOR_TYPES_BY_MODE[this.sensorMode] ?? [this.sensorMode];
            sensors = sensors
                .filter(s => s.floor == this.floorData.floorNumber)
                .filter(s => allowedTypes.includes(s.type));
        }

        return sensors;
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
                            const currentLocationId = data?.locationId || null;
                            if (window.loadLocationOptions) {
                                window.loadLocationOptions(buildingId, floor, currentLocationId);
                            }
                        })
                        .catch(() => {
                            if (window.loadLocationOptions) {
                                window.loadLocationOptions(buildingId, floor, null);
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


