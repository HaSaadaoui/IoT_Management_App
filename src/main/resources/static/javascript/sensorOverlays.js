// Multi-Sensor Visualization Overlay System
class SensorOverlayManager {

    static ICONS = {
        CO2:      "🌫️",
        TEMP:     "🌡️",
        TEMPEX:   "🌪️",
        LIGHT:    "💡",
        MOTION:   "👁️",
        NOISE:    "🔉",
        HUMIDITY: "💧",
        PR:       { present: "👤", empty: "⚪" },
        SECURITY: { alert: "🚨", ok: "🔒" },
        COUNT:    "🧑‍🤝‍🧑",
        ENERGY:   "⚡"
    }

    static normalizeMode(sensorType) {
        const normalized = String(sensorType || '').toUpperCase();
        if (normalized === 'NOISE') return 'SON';
        if (normalized === 'ENERGY') return 'CONSO';
        return normalized;
    }

    static isSameSensorFamily(left, right) {
        return SensorOverlayManager.normalizeMode(left) === SensorOverlayManager.normalizeMode(right);
    }

    constructor(svgContainer, colors, isDashboard = false) {
        this.svg = svgContainer;
        this.colors = colors;
        this.thresholds = null; // stocke ici les seuils dynamiques
        this.currentFloor = 0;
        this.isDashboard = isDashboard;
        this.currentMode = 'DESK';
        this.sensors = [];
        this.animationFrames = [];

        this.init()
    }

    async init(){
        await this.loadThresholds();
    }

    _resolveParentGroup(floorNumber) {
        const isUnset = floorNumber === "" || floorNumber == null;
        const selector = isUnset
            ? "#all-floors"
            : `#floor-${parseInt(floorNumber, 10)}`;

        const group = this.svg.querySelector(selector);

        if (!group) {
            console.warn(`[SensorOverlayManager] Group not found: "${selector}", falling back to #all-floors`);
            return this.svg.querySelector("#all-floors");
        }

        return group;
    }

    getIcon(sensorType, options = {}) {
        const normalizedType = SensorOverlayManager.normalizeMode(sensorType);
        const icon = SensorOverlayManager.ICONS[normalizedType]
            || SensorOverlayManager.ICONS[sensorType]
            || (normalizedType === "SON" ? SensorOverlayManager.ICONS.NOISE : null)
            || (normalizedType === "CONSO" ? SensorOverlayManager.ICONS.ENERGY : null);
        if (!icon) return "❓";
        if (normalizedType === "SECURITY") {
            return options.alert ? icon.alert : icon.ok;
        } else if (normalizedType === "PR") {
            return options.present ? icon.present : icon.empty;
        }
        return icon;
    }

    setSensorMode(mode, sensors, floorNumber) {
        this.currentMode = SensorOverlayManager.normalizeMode(mode);
        this.sensors = sensors;
        this.currentFloor = floorNumber;
        this.clearOverlay();
        this.createOverlay(this.currentMode);
    }

    clearOverlay() {
        this.animationFrames.forEach(id => cancelAnimationFrame(id));
        this.animationFrames = [];

        const floorGroup = this.svg.querySelector(`#floor-${this.currentFloor}`);
        if (!floorGroup) return;

        // On supprime seulement les capteurs précédents
        const markers = floorGroup.querySelectorAll(".sensor-marker, .circle-marker, radialGradient, defs");
        markers.forEach(el => el.remove());
    }

    createOverlay(mode) {

        // On y dessine directement les capteurs
        if (this.isDashboard) {
            switch (mode) {
                case 'CO2': this.createCO2Heatmap(); break;
                case 'TEMP':
                case 'TEMPEX': this.createTempThermal(); break;
                case 'LIGHT':
                case 'EYE':
                case 'PIR_LIGHT':
                case 'PR': this.createLightMap(); break;
                case 'MOTION': this.createMotionRadar(); break;
                case 'SON': this.createNoiseMap(); break;
                case 'HUMIDITY': this.createHumidityZones(); break;
                case 'SECURITY': this.createSecurityOverlay(); break;
                case 'COUNT': this.createCounterMap(); break;
                case 'CONSO': this.createEnergyMap(); break;
                case 'DESK': this.createSensorsConfig(); break;
            }
        } else {
            this.createSensorsConfig();
        }
    }

    async loadThresholds() {
        try {
            const res = await fetch('/api/configuration/alert-config');
            if (!res.ok) throw new Error("Impossible de charger les seuils");
            this.thresholds = await res.json();
        } catch (err) {
            console.error("Erreur lors du chargement des seuils :", err);
        }
    }

    createCO2Heatmap() {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

      this.sensors.forEach((sensor) => {
        const parent = this._resolveParentGroup(sensor.floor);
        const gradId = `co2-grad-${sensor.id}`;
        const circleId = `co2-circle-${sensor.id}`;

        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        gradient.setAttribute("id", gradId);

        const color = this.getCO2Color(sensor.value);

        gradient.innerHTML = `
          <stop offset="0%" data-stop="0" style="stop-color:${color};stop-opacity:0.7"/>
          <stop offset="50%" data-stop="50" style="stop-color:${color};stop-opacity:0.3"/>
          <stop offset="100%" data-stop="100" style="stop-color:${color};stop-opacity:0"/>
        `;

        defs.appendChild(gradient);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "circle-marker");
        circle.setAttribute("id", circleId);
        circle.setAttribute("cx", sensor.x);
        circle.setAttribute("cy", sensor.y);
        circle.setAttribute("r", "80");
        circle.setAttribute("fill", `url(#${gradId})`);

        parent.appendChild(circle);

        this.addSensorIcon(
          sensor.x,
          sensor.y,
          this.getIcon("CO2"),
          `${sensor.value} ppm`,
          sensor.id,
          sensor.floor
        );
      });

      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    updateCO2Visual(sensor) {
      const grad = document.getElementById(`co2-grad-${sensor.id}`);
      const circle = document.getElementById(`co2-circle-${sensor.id}`);

      if (!grad || !circle) return;

      const color = this.getCO2Color(sensor.value);

      grad.querySelectorAll("stop").forEach(stop => {
        stop.style.stopColor = color;
      });

      // Pulse uniquement en critical (>1000)
      if (sensor.value > 1000) {
        this.addPulseAnimation(circle);
      }
    }

    getCO2Color(ppm) {
        if (!this.thresholds) return '#3b82f6';

        const warning = this.thresholds.co2Warning;
        const critical = this.thresholds.co2Critical;
        if (ppm >= warning && ppm < critical) return '#f59e0b';
        if (ppm >= critical) return '#ef4444';
        return '#3b82f6';
    }

    createTempThermal() {
      const stableDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const stableIsNumericValue = (value) => Number.isFinite(Number(value));
      const stableClusterThreshold = 34;
      const stableLabelClusters = [];

      this.sensors.forEach(sensor => {
        const parent = this._resolveParentGroup(sensor.floor);
        const gradId = `temp-grad-${sensor.id}`;
        const circleId = `temp-circle-${sensor.id}`;

        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        gradient.setAttribute("id", gradId);

        const color = this.getTempColor(sensor.value);

        gradient.innerHTML = `
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.6"/>
          <stop offset="70%" style="stop-color:${color};stop-opacity:0.2"/>
          <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
        `;

        stableDefs.appendChild(gradient);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "circle-marker");
        circle.setAttribute("id", circleId);
        circle.setAttribute("cx", sensor.x);
        circle.setAttribute("cy", sensor.y);
        circle.setAttribute("r", "90");
        circle.setAttribute("fill", `url(#${gradId})`);

        parent.appendChild(circle);
      });

      const stableSameCluster = (left, right) =>
        left.floor === right.floor &&
        Math.abs(left.x - right.x) < stableClusterThreshold &&
        Math.abs(left.y - right.y) < stableClusterThreshold;

      const stableSensorScore = (sensor) => {
        const valueScore = stableIsNumericValue(sensor.value) ? 100 : 0;
        const co2Score = sensor.type === 'CO2' ? 20 : 0;
        const eyeScore = sensor.type === 'EYE' ? 15 : 0;
        const nativeTempScore = (sensor.type === 'TEMP' || sensor.type === 'TEMPEX') ? 10 : 0;
        return valueScore + co2Score + eyeScore + nativeTempScore;
      };

      this.sensors.forEach(sensor => {
        if (!['TEMP', 'TEMPEX', 'CO2', 'EYE'].includes(sensor.type)) return;

        const cluster = stableLabelClusters.find(entry => stableSameCluster(entry.anchor, sensor));
        if (!cluster) {
          stableLabelClusters.push({ anchor: sensor, chosen: sensor });
          return;
        }

        if (stableSensorScore(sensor) > stableSensorScore(cluster.chosen)) {
          cluster.chosen = sensor;
        }
      });

      stableLabelClusters.forEach(({ chosen }) => {
        const iconY = (chosen.type === 'CO2' || chosen.type === 'EYE') ? chosen.y - 18 : chosen.y;
        const label = stableIsNumericValue(chosen.value)
          ? `${Number(chosen.value).toFixed(1)} °C`
          : "";
        this.addSensorIcon(
          chosen.x,
          iconY,
          this.getIcon("TEMP"),
          `${chosen.value} °C`,
          chosen.id,
          chosen.floor
        );
      });

      this.svg.insertBefore(stableDefs, this.svg.firstChild);
      return;

      /* Legacy temperature overlay path disabled during cleanup.
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const isNumericValue = (value) => typeof value === 'number' && !Number.isNaN(value);
      const clusterThreshold = 28;
      const labelClusters = [];
      const hasNearbyMeasuredTemperatureCarrier = (sensor) => {
        return this.sensors.some(candidate =>
          candidate.id !== sensor.id &&
          (candidate.type === 'CO2' || candidate.type === 'EYE') &&
          isNumericValue(candidate.value) &&
          Math.abs(candidate.x - sensor.x) < clusterThreshold &&
          Math.abs(candidate.y - sensor.y) < clusterThreshold
        );
      };
      this.sensors.forEach(sensor => {
        const parent = this._resolveParentGroup(sensor.floor);
        const gradId = `temp-grad-${sensor.id}`;
        const circleId = `temp-circle-${sensor.id}`;

        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        gradient.setAttribute("id", gradId);

        const color = this.getTempColor(sensor.value);

        gradient.innerHTML = `
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.6"/>
          <stop offset="70%" style="stop-color:${color};stop-opacity:0.2"/>
          <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
        `;

        defs.appendChild(gradient);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "circle-marker");
        circle.setAttribute("id", circleId);
        circle.setAttribute("cx", sensor.x);
        circle.setAttribute("cy", sensor.y);
        circle.setAttribute("r", "90");
        circle.setAttribute("fill", `url(#${gradId})`);

        parent.appendChild(circle);

        if (sensor.type === 'TEMP' || sensor.type === 'TEMPEX') {
          if (!isNumericValue(sensor.value) && hasNearbyMeasuredTemperatureCarrier(sensor)) {
            return;
          }
          this.addSensorIcon(sensor.x, sensor.y, this.getIcon("TEMP"), `${sensor.value} °C`, sensor.id, sensor.floor);
        } else if (sensor.type === 'CO2' || sensor.type === 'EYE') {
          this.addSensorIcon(sensor.x, sensor.y - 18, this.getIcon("TEMP"), `${sensor.value} °C`, sensor.id, sensor.floor);
        }
      });

      this.svg.insertBefore(defs, this.svg.firstChild);
      */
    }

    getTempColor(temp) {
        if (!this.thresholds) return '#3b82f6'; // fallback bleu

        const highCritical = this.thresholds.tempCriticalHigh;
        const lowCritical = this.thresholds.tempCriticalLow;
        const highWarning = this.thresholds.tempWarningHigh;
        const lowWarning = this.thresholds.tempWarningLow;

        if (temp >= highCritical || temp <= lowCritical) return '#ef4444'; // critical
        if (temp >= highWarning || temp <= lowWarning) return '#f59e0b'; // warning
        return '#3b82f6'; // info
    }

    createLightMap() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.sensors.forEach((sensor, i) => {
            const parent = this._resolveParentGroup(sensor.floor);
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `light-grad-${i}`);
            const color = this.getLightColor(sensor.value);
            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.5"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("class", "circle-marker");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "70");
            circle.setAttribute("fill", `url(#light-grad-${i})`);
            parent.appendChild(circle);
            
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("LIGHT"), sensor.value + " lux", sensor.id, sensor.floor);
        });
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getLightColor(lux) {
        if (lux < 100) return '#1e3a8a';
        if (lux < 500) return '#10b981';
        if (lux < 1000) return '#fbbf24';
        return '#ef4444';
    }

    createRipple(x, y, floor = null) {
        const parent = this._resolveParentGroup(floor);
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const ripple = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ripple.setAttribute("class", "circle-marker");
                ripple.setAttribute("cx", x);
                ripple.setAttribute("cy", y);
                ripple.setAttribute("r", "10");
                ripple.setAttribute("fill", "none");
                ripple.setAttribute("stroke", "#8b5cf6");
                ripple.setAttribute("stroke-width", "2");
                ripple.setAttribute("opacity", "1");
                parent.appendChild(ripple);
                
                const animate = () => {
                    let r = 10, opacity = 1;
                    const expand = () => {
                        r += 2;
                        opacity -= 0.02;
                        ripple.setAttribute("r", r);
                        ripple.setAttribute("opacity", opacity);
                        if (opacity > 0) {
                            this.animationFrames.push(requestAnimationFrame(expand));
                        } else {
                            ripple.remove();
                        }
                    };
                    expand();
                };
                animate();
            }, i * 500);
        }
    }

    createNoiseMap() {
      this.sensors.forEach(sensor => {
        const parent = this._resolveParentGroup(sensor.floor);
        const color = this.getNoiseColor(sensor.value);

        for (let i = 0; i < 3; i++) {
          const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          ring.setAttribute("class", "circle-marker");
          ring.setAttribute("id", `noise-ring-${sensor.id}-${i}`);
          ring.setAttribute("cx", sensor.x);
          ring.setAttribute("cy", sensor.y);
          ring.setAttribute("r", 20 + i * 15);
          ring.setAttribute("fill", "none");
          ring.setAttribute("stroke", color);
          ring.setAttribute("stroke-width", "2");
          ring.setAttribute("opacity", 0.6 - i * 0.2);

          parent.appendChild(ring);
        }

        this.addSensorIcon(sensor.x, sensor.y, this.getIcon("NOISE"), `${sensor.value} dB`, sensor.id, sensor.floor);
      });
    }

    getNoiseColor(db) {
        if (!this.thresholds) return '#3b82f6';

        const warning = this.thresholds.noiseWarning;
        return db > warning ? '#f59e0b' : '#3b82f6';
    }

    createHumidityZones() {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const isNumericValue = (value) => Number.isFinite(Number(value));
      const clusterThreshold = 34;
      const labelClusters = [];

      this.sensors.forEach(sensor => {
        const parent = this._resolveParentGroup(sensor.floor);
        const gradId = `humid-grad-${sensor.id}`;
        const circleId = `humid-circle-${sensor.id}`;

        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        gradient.setAttribute("id", gradId);

        const color = this.getHumidityColor(sensor.value);

        gradient.innerHTML = `
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.5"/>
          <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
        `;

        defs.appendChild(gradient);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "circle-marker");
        circle.setAttribute("id", circleId);
        circle.setAttribute("cx", sensor.x);
        circle.setAttribute("cy", sensor.y);
        circle.setAttribute("r", "75");
        circle.setAttribute("fill", `url(#${gradId})`);

        parent.appendChild(circle);
      });

      const sameCluster = (left, right) =>
        left.floor === right.floor &&
        Math.abs(left.x - right.x) < clusterThreshold &&
        Math.abs(left.y - right.y) < clusterThreshold;

      const sensorScore = (sensor) => {
        const valueScore = isNumericValue(sensor.value) ? 100 : 0;
        const co2Score = sensor.type === 'CO2' ? 20 : 0;
        const eyeScore = sensor.type === 'EYE' ? 15 : 0;
        const nativeHumidityScore = sensor.type === 'TEMPEX' ? 10 : 0;
        return valueScore + co2Score + eyeScore + nativeHumidityScore;
      };

      this.sensors.forEach(sensor => {
        const cluster = labelClusters.find(entry => sameCluster(entry.anchor, sensor));
        if (!cluster) {
          labelClusters.push({ anchor: sensor, chosen: sensor });
          return;
        }

        if (sensorScore(sensor) > sensorScore(cluster.chosen)) {
          cluster.chosen = sensor;
        }
      });

      labelClusters.forEach(({ chosen }) => {
        const iconY = (chosen.type === 'CO2' || chosen.type === 'EYE') ? chosen.y - 18 : chosen.y;
        const label = isNumericValue(chosen.value)
          ? `${Math.round(Number(chosen.value))} %`
          : "";
        this.addSensorIcon(
          chosen.x,
          iconY,
          this.getIcon("HUMIDITY"),
          label,
          chosen.id,
          chosen.floor
        );
      });

      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getHumidityColor(h) {
        if (!this.thresholds) return '#3b82f6';

        const highWarning = this.thresholds.humidityWarningHigh;
        const lowWarning = this.thresholds.humidityWarningLow;

        if (h >= highWarning || h <= lowWarning) return '#f59e0b';
        return '#3b82f6';
    }

    createTempexFlow() {
        this.sensors.forEach(sensor => {
            const parent = this._resolveParentGroup(sensor.floor);
            if (sensor.type === 'TEMPEX' || sensor.type === 'TEMP') {
                const arrow = this.createArrow(sensor.x, sensor.y, sensor.direction || 0, sensor.intensity || 1);
                parent.appendChild(arrow);
                this.addSensorIcon(sensor.x, sensor.y - 25, this.getIcon("TEMPEX"), `${sensor.value}°C`, sensor.id, sensor.floor);
            }
            // CO2/EYE sensors: no arrow or label in TEMPEX mode
        });
    }

    createArrow(x, y, direction, intensity) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const length = 30 * intensity;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x} ${y} l ${length} 0 l -8 -5 m 8 5 l -8 5`);
        path.setAttribute("stroke", "#662179");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        path.setAttribute("transform", `rotate(${direction} ${x} ${y})`);
        g.appendChild(path);
        return g;
    }

    isPresenceActive(sensor) {
        const rawValue = sensor?.presence ?? sensor?.value ?? sensor?.status;
        if (typeof rawValue === "boolean") {
            return rawValue;
        }
        if (typeof rawValue === "number") {
            return rawValue > 0;
        }

        const normalized = String(rawValue ?? "").trim().toLowerCase();
        return [
            "1",
            "true",
            "present",
            "occupied",
            "motion",
            "active",
            "detected",
            "on",
            "yes"
        ].includes(normalized);
    }

    createPresenceLight() {
        this.sensors.forEach(sensor => {
            const parent = this._resolveParentGroup(sensor.floor);
            const isPresent = this.isPresenceActive(sensor);

            if (isPresent) {
                const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                glow.setAttribute("class", "circle-marker");
                glow.setAttribute("cx", sensor.x);
                glow.setAttribute("cy", sensor.y);
                glow.setAttribute("r", "60");
                glow.setAttribute("fill", "#fbbf24");
                glow.setAttribute("opacity", "0.3");
                parent.appendChild(glow);
                this.addSensorIcon(sensor.x, sensor.y, this.getIcon("PR", { present: true }), "Present", sensor.id, sensor.floor);
            } else {
                this.addSensorIcon(sensor.x, sensor.y, this.getIcon("PR", { present: false }), "Empty", sensor.id, sensor.floor);
            }
        });
    }

    createSecurityOverlay() {
        this.sensors.forEach(sensor => {
            const parent = this._resolveParentGroup(sensor.floor);
            if (sensor.alert) {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("class", "circle-marker");
                circle.setAttribute("cx", sensor.x);
                circle.setAttribute("cy", sensor.y);
                circle.setAttribute("r", "20");
                circle.setAttribute("fill", "#ef4444");
                circle.setAttribute("opacity", "0.7");
                parent.appendChild(circle);
                this.addPulseAnimation(circle);
            }
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("SECURITY", { alert: sensor.alert }), sensor.message || "OK", sensor.id, sensor.floor);
        });
    }

    addSensorIcon(x, y, emoji, label, sensorId, floor = null) {
        const parent = this._resolveParentGroup(floor);
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "sensor-marker");

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", x);
        icon.setAttribute("y", y);
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", "20");
        icon.textContent = emoji;

        // Label y offset: emoji baseline is at y, its visual bottom is at ~y+4.
        // Place label 28 units below so the visual gap (~24px) is always comfortable.
        const labelY = y + 28;

        // White background rect so the label is legible over heatmap bubbles
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", x - 22);
        bg.setAttribute("y", labelY - 10);
        bg.setAttribute("width", "44");
        bg.setAttribute("height", "13");
        bg.setAttribute("rx", "2");
        bg.setAttribute("fill", "white");
        bg.setAttribute("fill-opacity", "0.75");

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", labelY);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "10");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#374151");

        //Ajout de l'id pour que updateVisual puisse trouver le texte
        if (sensorId) {
            text.setAttribute("id", `sensor-value-${sensorId}`);
        }

        g.appendChild(icon);
        const labelText = label == null ? "" : String(label).trim();
        const hasRenderableLabel = labelText !== ""
            && !labelText.includes("undefined")
            && !labelText.includes("NaN")
            && !labelText.startsWith("--")
            && !labelText.startsWith("â€”");

        text.textContent = hasRenderableLabel ? labelText : "";
        bg.style.display = hasRenderableLabel ? "" : "none";
        text.style.display = hasRenderableLabel ? "" : "none";

        g.appendChild(bg);
        g.appendChild(text);
        parent.appendChild(g);
    }

    addPulseAnimation(element) {
        let scale = 1;
        let growing = true;
        const pulse = () => {
            scale += growing ? 0.02 : -0.02;
            if (scale >= 1.2) growing = false;
            if (scale <= 1) growing = true;
            element.setAttribute("transform", `scale(${scale})`);
            element.setAttribute("transform-origin", `${element.getAttribute("cx")} ${element.getAttribute("cy")}`);
            this.animationFrames.push(requestAnimationFrame(pulse));
        };
        pulse();
    }

    createCounterMap() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const COLOR = "#6366f1"; // indigo stable

        this.sensors.forEach((sensor, i) => {
            const parent = this._resolveParentGroup(sensor.floor);
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `counter-grad-${i}`);

            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${COLOR};stop-opacity:0.45"/>
                <stop offset="100%" style="stop-color:${COLOR};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);

            // Halo
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("class", "circle-marker");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "65");
            circle.setAttribute("fill", `url(#counter-grad-${i})`);
            parent.appendChild(circle);

            // Icône compteur
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
            icon.setAttribute("x", sensor.x);
            icon.setAttribute("y", sensor.y - 6);
            icon.setAttribute("text-anchor", "middle");
            icon.setAttribute("font-size", "20");
            icon.textContent = this.getIcon("COUNT");
            parent.appendChild(icon);

            // Valeurs IN | OUT
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("id", `sensor-value-${sensor.id}`);
            label.setAttribute("x", sensor.x);
            label.setAttribute("y", sensor.y + 16);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("font-size", "12");
            label.setAttribute("font-weight", "bold");
            label.setAttribute("fill", "#1f2937");

            const inVal = sensor.value?.in ?? "—";
            const outVal = sensor.value?.out ?? "—";

            label.textContent = `${inVal} | ${outVal}`;
            parent.appendChild(label);
        });

        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    createEnergyMap() {
        // Définitions pour les gradients
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

        this.sensors.forEach((sensor, i) => {
            const parent = this._resolveParentGroup(sensor.floor);
            // 🔹 Gradient radial pour le halo
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `energy-grad-${i}`);

            const color = this.getEnergyColor(sensor.value);
            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.55"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);

            // 🔹 Cercle halo
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("class", "circle-marker");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "75");
            circle.setAttribute("fill", `url(#energy-grad-${i})`);
            parent.appendChild(circle);

            // 🔹 Icône et valeur
            const labelText = sensor.value != null ? `${sensor.value} kWh` : "—";
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("ENERGY"), labelText, sensor.id, sensor.floor);
        });

        // Insérer defs avant le reste du SVG
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getEnergyColor(kwh) {
        if (kwh == null) return '#9ca3af'; // gris
        if (kwh < 50)   return '#10b981'; // vert
        if (kwh < 100)   return '#facc15'; // jaune
        if (kwh < 200)  return '#f97316'; // orange
        return '#ef4444';               // rouge
    }

    createMotionRadar() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const COLOR = "#7c3aed"; // violet motion

        this.sensors.forEach((sensor, i) => {
            const parent = this._resolveParentGroup(sensor.floor);
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `motion-grad-${i}`);

            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${COLOR};stop-opacity:${sensor.status === 'active' ? 0.4 : 0.25}"/>
                <stop offset="100%" style="stop-color:${COLOR};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);

            // 🟣 Halo
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("class", "circle-marker");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "60");
            circle.setAttribute("fill", `url(#motion-grad-${i})`);
            parent.appendChild(circle);

            //Icône
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
            icon.setAttribute("x", sensor.x);
            icon.setAttribute("y", sensor.y - 14);
            icon.setAttribute("text-anchor", "middle");
            icon.setAttribute("dominant-baseline", "middle");
            icon.setAttribute("font-size", "20");
            icon.textContent = this.getIcon("MOTION");
            parent.appendChild(icon);

            // Texte "Motion"
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("id", `sensor-value-${sensor.id}`);
            label.setAttribute("x", sensor.x);
            label.setAttribute("y", sensor.y + 8);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("dominant-baseline", "middle");
            label.setAttribute("font-size", "12");
            label.setAttribute("fill", "#1f2937");
            label.textContent = "Motion";
            parent.appendChild(label);
        });

        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    createSensor(g, sensor) {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", sensor.x);
        icon.setAttribute("y", sensor.y);
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", sensor.size);
        icon.setAttribute("floor-number", sensor.floor);
        icon.setAttribute("sensor-mode", sensor.type);
        icon.setAttribute("id", sensor.id);
        icon.setAttribute("class", "sensor");
        icon.textContent = this.getIcon(sensor.type);
        g.appendChild(icon);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", sensor.x);
        text.setAttribute("y", sensor.y + sensor.size);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", sensor.size / 2);
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#374151");
        text.setAttribute("class","sensor-temp");
        text.textContent = sensor.id;
        g.appendChild(text);
    }

    createDesk(g, sensor) {
        const desk = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        desk.setAttribute("x", sensor.x);
        desk.setAttribute("y", sensor.y);
        desk.setAttribute("width", sensor.width);
        desk.setAttribute("height", sensor.height);
        desk.setAttribute("fill", this.colors[sensor.status] || "#94a3b8");
        desk.setAttribute("stroke", "#000000");
        desk.setAttribute("stroke-width", 2);
        desk.setAttribute("rx", 3);
        desk.setAttribute("class", "sensor");
        desk.setAttribute("id", sensor.id);
        desk.setAttribute("floor-number", sensor.floor);
        desk.setAttribute("sensor-mode", sensor.type);
        sensor.size = sensor.size || Math.min(sensor.width, sensor.height) / 2;
        desk.setAttribute("size", sensor.size);
        desk.setAttribute("label", sensor.label);
        desk.setAttribute("status", sensor.status || "invalid");
        desk.setAttribute("chairs", JSON.stringify(sensor.chairs));
        if (sensor.rotation) {
            const cx = sensor.x + sensor.width / 2;
            const cy = sensor.y + sensor.height / 2;
            desk.setAttribute("transform",`rotate(${sensor.rotation} ${cx} ${cy})`);
        }
        g.appendChild(desk);

        this.addDeskLabel(g, sensor);
        if (sensor.chairs){
            this.addDeskChair(g, sensor);
        }
    }

    addDeskLabel(g, sensor){
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

        const cx = sensor.x + sensor.width / 2;
        const cy = sensor.y + sensor.height / 2;        

        text.setAttribute("x", cx);
        text.setAttribute("y", cy);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.setAttribute("font-size", sensor.size);
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#ffffff");
        text.setAttribute("class","sensor-temp");
        text.textContent = sensor.label || sensor.id;

        if (sensor.rotation) {
            const cx_rotate = sensor.x + sensor.width / 2;
            const cy_rotate = sensor.y + sensor.height / 2;
            text.setAttribute("transform",`rotate(${sensor.rotation} ${cx_rotate} ${cy_rotate})`);
        }

        g.appendChild(text);
    }

    addDeskChair(g, sensor){
        const sides = ["top", "bottom", "left", "right"];
        sides.forEach(side => {
            const count = sensor.chairs?.[side] || 0;
            if (count <= 0) return;

            for (let i = 0; i < count; i++) {
                let cx = 0, cy = 0, rad = 0;
                switch (side) {
                    case "top":
                        rad = sensor.width / 10;
                        cx = sensor.x + sensor.width * (i + 1) / (count + 1);
                        cy = sensor.y - 2 * rad;
                        break;
                    case "bottom":
                        rad = sensor.width / 10;
                        cx = sensor.x + sensor.width * (i + 1) / (count + 1);
                        cy = sensor.y + sensor.height + 2 * rad;
                        break;
                    case "left":
                        rad = sensor.height / 10;
                        cx = sensor.x - 2 * rad;
                        cy = sensor.y + sensor.height * (i + 1) / (count + 1);
                        break;
                    case "right":
                        rad = sensor.height / 10;
                        cx = sensor.x + sensor.width + 2 * rad;
                        cy = sensor.y + sensor.height * (i + 1) / (count + 1);
                        break;
                }

                const chair = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                chair.setAttribute("cx", cx);
                chair.setAttribute("cy", cy);
                chair.setAttribute("r", rad);
                chair.setAttribute("fill", "#94a3b8");
                chair.setAttribute("stroke", "#000000");
                chair.setAttribute("stroke-width", 1);
                chair.setAttribute("class", "sensor-temp");

                if (sensor.rotation) {
                    const cx_rotate = sensor.x + sensor.width / 2;
                    const cy_rotate = sensor.y + sensor.height / 2;
                    chair.setAttribute("transform",`rotate(${sensor.rotation} ${cx_rotate} ${cy_rotate})`);
                }
                g.appendChild(chair);
            }
        });
    }

    updateDeskStatus(sensorId, status) {
        const sensor = this.sensors?.find(s => s.id === sensorId);
        if (!sensor) return false;
        sensor.status = status;
        const group = this.svg.querySelector(`#${CSS.escape("marker-" + sensorId)}`);
        if (!group) return false;
        const rect = group.querySelector('.sensor');
        if (rect) {
            rect.setAttribute('fill', this.colors[status] || '#94a3b8');
            rect.setAttribute('status', status);
        }
        return true;
    }

    updateSensorValue(sensorId, value, timestamp) {
      const sensor = this.sensors?.find(s => s.id === sensorId);
      console.log('Sensor: ', sensor);

      if (!sensor) return false;
      sensor.value = value;
      console.log('Sensor value: ', sensor.value);
      sensor.timestamp = timestamp;

      this.updateVisual(sensor);
      console.log('Updated visual: ', sensor);

      // Update gradient/heatmap based on current display mode, not sensor.type
      // (CO2 sensors can display temperature in TEMP mode, etc.)
      switch (this.currentMode) {
        case "CO2":      this.updateCO2Visual(sensor);      break;
        case "TEMP":
        case "TEMPEX":
          this.updateTempVisual(sensor);
          break;
        case "HUMIDITY": this.updateHumidityVisual(sensor); break;
        case "SON":      this.updateNoiseVisual(sensor);    break;
        case "LIGHT":
        case "EYE":
        case "PIR_LIGHT":
        case "PR":       this.updateLightVisual(sensor);    break;
      }
      return true;
    }

    updateVisual(sensor) {
      if (!sensor) return;

      const el = document.getElementById(`sensor-value-${sensor.id}`);

      if (!el) return;
      const bg = el.previousSibling;
      const numericValue = Number(sensor.value);
      const hasNumericValue = Number.isFinite(numericValue);
      const setLabelState = (text) => {
        const hasText = typeof text === "string" && text.trim() !== "";
        el.textContent = hasText ? text : "";
        el.style.display = hasText ? "" : "none";
        if (bg) bg.style.display = hasText ? "" : "none";
      };

      if (this.currentMode === "CO2") {
        setLabelState(hasNumericValue ? `${Math.round(numericValue)} ppm` : "");
        return;
      }

      if (this.currentMode === "TEMP" || this.currentMode === "TEMPEX") {
        setLabelState(hasNumericValue ? `${numericValue.toFixed(1)} °C` : "");
        return;
      }

      if (this.currentMode === "HUMIDITY") {
        setLabelState(hasNumericValue ? `${Math.round(numericValue)} %` : "");
        return;
      }

      if (["LIGHT", "EYE", "PIR_LIGHT", "PR"].includes(this.currentMode)) {
        setLabelState(hasNumericValue ? `${Math.round(numericValue)} lux` : "");
        return;
      }

      if (this.currentMode === "SON") {
        setLabelState(hasNumericValue ? `${numericValue.toFixed(1)} dB` : "");
        return;
      }

      if (this.currentMode === "COUNT") {
        if (sensor.value) {
          const inVal = sensor.value.in ?? "—";
          const outVal = sensor.value.out ?? "—";
          setLabelState(`${inVal} | ${outVal}`);
        } else {
          setLabelState("");
        }
        return;
      }

      if (this.currentMode === "CONSO") {
        const elt = document.getElementById("live-current-power");
        const text = elt?.textContent?.trim();
        setLabelState(text ? `${text} kW` : "");
        return;
      }

      // Use currentMode for the unit label so that multi-metric sensors
      // (e.g. CO2 sensors providing temperature in TEMP mode) show the right unit.
      switch (this.currentMode) {
        case "CO2":
          setLabelState(hasNumericValue ? `${Math.round(numericValue)} ppm` : "");
          break;
        case "TEMP":
        case "TEMPEX":
          el.textContent = `${sensor.value} °C`;
          break;
        case "HUMIDITY":
          setLabelState(hasNumericValue ? `${Math.round(numericValue)} %` : "");
          break;
        case "LIGHT":
        case "EYE":
        case "PIR_LIGHT":
        case "PR":
          setLabelState(hasNumericValue ? `${Math.round(numericValue)} lux` : "");
          break;
        case "SON":
          setLabelState(hasNumericValue ? `${numericValue.toFixed(1)} dB` : "");
          break;
        case "COUNT":
          if (sensor.value) {
            const inVal = sensor.value.in ?? "—";
            const outVal = sensor.value.out ?? "—";
            el.textContent = `${inVal} | ${outVal}`;
          } else {
            el.textContent = "— | —";
          }
          break;
        case "CONSO": {
          const elt = document.getElementById("live-current-power");
          if (elt) {
            el.textContent = `${elt.textContent.trim()} kW`;
          } else {
            el.textContent = `-- kW`;
          }
          break;
        }
        default:
          el.textContent = sensor.value;
      }
    }

    createSensorsConfig() {
        this.sensors.forEach((sensor) => {
            this.drawSensor(sensor);
        });
    }

    drawSensor(sensor) {
        const parent = this._resolveParentGroup(sensor.floor);
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "sensor-marker");
        g.setAttribute("id", "marker-"+sensor.id);
        if (!SensorOverlayManager.isSameSensorFamily(sensor.type, this.currentMode) || parseInt(sensor.floor) !== parseInt(this.currentFloor)){
            g.style.display="none";
        }
        if (!this.isDashboard && parseInt(sensor.floor) === parseInt(this.currentFloor)) {
            g.setAttribute("data-draggable", "true");
            g.style.cursor = "move";
        } else {
            g.removeAttribute("data-draggable");
            g.style.cursor = "default";
        }

        if (sensor.type === "DESK") {
            this.createDesk(g, sensor);
        } else {
            this.createSensor(g, sensor);
        }
        
        parent.appendChild(g);
    }
 
    removeSensorMarkerById(id) {
        if (!id) return false;

        // On cherche dans tout le SVG
        const el = this.svg.querySelector(`#${CSS.escape("marker-" + id)}`);
        if (!el) return false;

        el.remove();
        return true;
    }

    updateSensorGeometry(sensor) {
        const group = this.svg.querySelector(`#marker-${sensor.id}`);
        if(!group) return;

        const sensorEl = group.querySelector(".sensor");
        if (!sensorEl) return;

        sensor.x = parseFloat(sensorEl.getAttribute("x"));
        sensor.y = parseFloat(sensorEl.getAttribute("y"));

        this.removeSensorMarkerById(sensor.id);
        this.drawSensor(sensor);
    }

    updateNoiseVisual(sensor) {
      for (let i = 0; i < 3; i++) {
        const ring = document.getElementById(`noise-ring-${sensor.id}-${i}`);
        if (ring) {
          ring.setAttribute("stroke", this.getNoiseColor(sensor.value));
        }
      }
    }

    updateHumidityVisual(sensor) {
      const grad = document.getElementById(`humid-grad-${sensor.id}`);
      const circle = document.getElementById(`humid-circle-${sensor.id}`);
      if (!grad || !circle) return;

      const color = this.getHumidityColor(sensor.value);

      grad.querySelectorAll("stop").forEach(stop => {
        stop.style.stopColor = color;
      });
    }

    updateTempVisual(sensor) {
      const grad = document.getElementById(`temp-grad-${sensor.id}`);
      const circle = document.getElementById(`temp-circle-${sensor.id}`);
      if (!grad || !circle) return;

      const color = this.getTempColor(sensor.value);

      grad.querySelectorAll("stop").forEach(stop => {
        stop.style.stopColor = color;
      });

      if (this.getTempColor(sensor.value) === '#ef4444') {
        this.addPulseAnimation(circle);
      }
    }

    updateLightVisual(sensor) {
      const idx = this.sensors?.findIndex(s => s.id === sensor.id);
      if (idx === -1) return;
      const grad = document.getElementById(`light-grad-${idx}`);
      if (!grad) return;
      const color = this.getLightColor(sensor.value);
      grad.querySelectorAll("stop").forEach(stop => {
        stop.style.stopColor = color;
      });
    }
}

window.SensorOverlayManager = SensorOverlayManager;
