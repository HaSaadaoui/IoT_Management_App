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
    };

    constructor(svgContainer) {
        this.svg = svgContainer;
        this.isDashboard = true;
        this.currentMode = 'DESK';
        this.sensors = [];
        this.overlayGroup = null;
        this.animationFrames = [];
    }

    getIcon(sensorType, options = {}) {
        const icon = SensorOverlayManager.ICONS[sensorType];
        if (!icon) return "❓";
        if (sensorType === "SECURITY") {
            return options.alert ? icon.alert : icon.ok;
        } else if (sensorType === "PR") {
            return options.present ? icon.present : icon.empty;
        }
        return icon;
    }

    setSensorMode(mode, sensors, isDashboard = true) {
        this.currentMode = mode;
        this.sensors = sensors;
        this.isDashboard = isDashboard;
        this.clearOverlay();
        this.createOverlay(mode);
    }

    clearOverlay() {
        this.animationFrames.forEach(id => cancelAnimationFrame(id));
        this.animationFrames = [];
        if (this.overlayGroup) {
            this.overlayGroup.remove();
        }
    }

    createOverlay(mode) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", `overlay-${mode}`);
        this.overlayGroup = g;

        if (this.isDashboard){
            switch(mode) {
                case 'CO2': this.createCO2Heatmap(); break;
                case 'TEMP': this.createTempThermal(); break;
                case 'LIGHT': this.createLightMap(); break;
                case 'MOTION': this.createMotionRadar(); break;
                case 'NOISE': this.createNoiseMap(); break;
                case 'HUMIDITY': this.createHumidityZones(); break;
                case 'TEMPEX': this.createTempexFlow(); break;
                case 'PR': this.createPresenceLight(); break;
                case 'SECURITY': this.createSecurityOverlay(); break;
                case 'COUNT': this.createCounterMap(); break;
                case 'ENERGY': this.createEnergyMap(); break;
            }
        } else {
            this.createSensorsConfig();
        }
        
        this.svg.appendChild(this.overlayGroup);
    }

    createCO2Heatmap() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.sensors.forEach((sensor, i) => {
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `co2-grad-${i}`);
            const color = this.getCO2Color(sensor.value);
            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.7"/>
                <stop offset="50%" style="stop-color:${color};stop-opacity:0.3"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "80");
            circle.setAttribute("fill", `url(#co2-grad-${i})`);
            if (sensor.value > 1500) {
                this.addPulseAnimation(circle);
            }
            this.overlayGroup.appendChild(circle);
            
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("CO2"), sensor.value + " ppm", sensor.id);
        });
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getCO2Color(ppm) {
        if (ppm < 800) return '#10b981';
        if (ppm < 1200) return '#fbbf24';
        if (ppm < 1500) return '#f97316';
        return '#ef4444';
    }

    createTempThermal() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.sensors.forEach((sensor, i) => {
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `temp-grad-${i}`);
            const color = this.getTempColor(sensor.value);
            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.6"/>
                <stop offset="70%" style="stop-color:${color};stop-opacity:0.2"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "90");
            circle.setAttribute("fill", `url(#temp-grad-${i})`);
            this.overlayGroup.appendChild(circle);
            
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("TEMP"), sensor.value + "°C", sensor.id);
        });
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getTempColor(temp) {
        if (temp < 19) return '#3b82f6';
        if (temp <= 23) return '#10b981';
        if (temp <= 26) return '#f97316';
        return '#ef4444';
    }

    createLightMap() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.sensors.forEach((sensor, i) => {
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `light-grad-${i}`);
            const color = this.getLightColor(sensor.value);
            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.5"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "70");
            circle.setAttribute("fill", `url(#light-grad-${i})`);
            this.overlayGroup.appendChild(circle);
            
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("LIGHT"), sensor.value + " lux", sensor.id);
        });
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getLightColor(lux) {
        if (lux < 100) return '#1e3a8a';
        if (lux < 500) return '#10b981';
        if (lux < 1000) return '#fbbf24';
        return '#ef4444';
    }

    createRipple(x, y) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const ripple = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ripple.setAttribute("cx", x);
                ripple.setAttribute("cy", y);
                ripple.setAttribute("r", "10");
                ripple.setAttribute("fill", "none");
                ripple.setAttribute("stroke", "#8b5cf6");
                ripple.setAttribute("stroke-width", "2");
                ripple.setAttribute("opacity", "1");
                this.overlayGroup.appendChild(ripple);
                
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
            const color = this.getNoiseColor(sensor.value);
            for (let i = 0; i < 3; i++) {
                const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ring.setAttribute("cx", sensor.x);
                ring.setAttribute("cy", sensor.y);
                ring.setAttribute("r", 20 + i * 15);
                ring.setAttribute("fill", "none");
                ring.setAttribute("stroke", color);
                ring.setAttribute("stroke-width", "2");
                ring.setAttribute("opacity", 0.6 - i * 0.2);
                this.overlayGroup.appendChild(ring);
            }
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("NOISE"), sensor.value + " dB", sensor.id);
        });
    }

    getNoiseColor(db) {
        if (db < 40) return '#10b981';
        if (db < 60) return '#fbbf24';
        if (db < 70) return '#f97316';
        return '#ef4444';
    }

    createHumidityZones() {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.sensors.forEach((sensor, i) => {
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `humid-grad-${i}`);
            const color = this.getHumidityColor(sensor.value);
            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.5"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "75");
            circle.setAttribute("fill", `url(#humid-grad-${i})`);
            this.overlayGroup.appendChild(circle);
            
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("HUMIDITY"), sensor.value + "%", sensor.id);
        });
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    getHumidityColor(humidity) {
        if (humidity < 30) return '#3b82f6';
        if (humidity <= 50) return '#10b981';
        return '#ef4444';
    }

    createTempexFlow() {
        this.sensors.forEach(sensor => {
            const arrow = this.createArrow(sensor.x, sensor.y, sensor.direction || 0, sensor.intensity || 1);
            this.overlayGroup.appendChild(arrow);
            this.addSensorIcon(sensor.x, sensor.y - 25, this.getIcon("TEMPEX"), `${sensor.value}°C`, sensor.id);
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

    createPresenceLight() {
        this.sensors.forEach(sensor => {
            if (sensor.presence) {
                const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                glow.setAttribute("cx", sensor.x);
                glow.setAttribute("cy", sensor.y);
                glow.setAttribute("r", "60");
                glow.setAttribute("fill", "#fbbf24");
                glow.setAttribute("opacity", "0.3");
                this.overlayGroup.appendChild(glow);
                this.addSensorIcon(sensor.x, sensor.y, this.getIcon("PR", { sensor: sensor.presence }), "Present");
            } else {
                this.addSensorIcon(sensor.x, sensor.y, this.getIcon("PR"), "Empty");
            }
        });
    }

    createSecurityOverlay() {
        this.sensors.forEach(sensor => {
            if (sensor.alert) {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", sensor.x);
                circle.setAttribute("cy", sensor.y);
                circle.setAttribute("r", "20");
                circle.setAttribute("fill", "#ef4444");
                circle.setAttribute("opacity", "0.7");
                this.overlayGroup.appendChild(circle);
                this.addPulseAnimation(circle);
            }
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("SECURITY", { alert: sensor.alert }), sensor.message || "OK", sensor.id);
        });
    }

    addSensorIcon(x, y, emoji, label, sensorId) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "sensor-marker");

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", x);
        icon.setAttribute("y", y);
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", "20");
        icon.textContent = emoji;

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y + 20);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "10");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#374151");

        //Ajout de l'id pour que updateVisual puisse trouver le texte
        if (sensorId) {
            text.setAttribute("id", `sensor-value-${sensorId}`);
        }

        text.textContent = label;

        g.appendChild(icon);
        g.appendChild(text);
        this.overlayGroup.appendChild(g);
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
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `counter-grad-${i}`);

            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${COLOR};stop-opacity:0.45"/>
                <stop offset="100%" style="stop-color:${COLOR};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);

            // Halo
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "65");
            circle.setAttribute("fill", `url(#counter-grad-${i})`);
            this.overlayGroup.appendChild(circle);

            // Icône compteur
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
            icon.setAttribute("x", sensor.x);
            icon.setAttribute("y", sensor.y - 6);
            icon.setAttribute("text-anchor", "middle");
            icon.setAttribute("font-size", "20");
            icon.textContent = this.getIcon("COUNT");
            this.overlayGroup.appendChild(icon);

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

            label.textContent = `${sensor.value} | ${outVal}`;
            this.overlayGroup.appendChild(label);
        });

        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    createEnergyMap() {
        // Définitions pour les gradients
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

        this.sensors.forEach((sensor, i) => {
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
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "75");
            circle.setAttribute("fill", `url(#energy-grad-${i})`);
            this.overlayGroup.appendChild(circle);

            // 🔹 Icône et valeur
            const labelText = sensor.value != null ? `${sensor.value} kWh` : "—";
            this.addSensorIcon(sensor.x, sensor.y, this.getIcon("ENERGY"), labelText, sensor.id);
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
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
            gradient.setAttribute("id", `motion-grad-${i}`);

            gradient.innerHTML = `
                <stop offset="0%" style="stop-color:${COLOR};stop-opacity:${sensor.status === 'active' ? 0.4 : 0.25}"/>
                <stop offset="100%" style="stop-color:${COLOR};stop-opacity:0"/>
            `;
            defs.appendChild(gradient);

            // 🟣 Halo
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", sensor.x);
            circle.setAttribute("cy", sensor.y);
            circle.setAttribute("r", "60");
            circle.setAttribute("fill", `url(#motion-grad-${i})`);
            this.overlayGroup.appendChild(circle);

            //Icône
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
            icon.setAttribute("x", sensor.x);
            icon.setAttribute("y", sensor.y - 14);
            icon.setAttribute("text-anchor", "middle");
            icon.setAttribute("dominant-baseline", "middle");
            icon.setAttribute("font-size", "20");
            icon.textContent = this.getIcon("MOTION");
            this.overlayGroup.appendChild(icon);

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
            this.overlayGroup.appendChild(label);
        });

        this.svg.insertBefore(defs, this.svg.firstChild);
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
      return true;
    }

    updateVisual(sensor) {
      if (!sensor) return;

      const el = document.getElementById(`sensor-value-${sensor.id}`);
      console.log("Element:", el);

      if (!el || sensor.value === "") return;

      switch (sensor.type) {
        case "CO2":
          el.textContent = `${sensor.value} ppm`;
          break;
        case "TEMP":
        case "TEMPEX":
          el.textContent = `${sensor.value} °C`;
          break;
        case "HUMIDITY":
          el.textContent = `${sensor.value} %`;
          break;
        case "LIGHT":
          el.textContent = `${sensor.value} lux`;
          break;
        case "COUNT":
          //Pour COUNT, sensor.value est un objet { in, out }
          if (sensor.value) {
            const inVal = sensor.value.in ?? "—";
            const outVal = sensor.value.out ?? "—";
            el.textContent = `${inVal} | ${outVal}`;
          } else {
            el.textContent = "— | —";
          }
          break;
        case "ENERGY":
          el.textContent = `${(sensor.value / 1000).toFixed(2)} kW`;
          break;
        default:
          el.textContent = sensor.value;
      }
    }

    createSensorsConfig() {
        this.sensors.forEach((sensor) => {
            if (sensor.type === this.currentMode){
                this.drawSensorIcon(sensor.id, sensor.type, sensor.floor, sensor.x, sensor.y, sensor.size);
            }
        });
    }

    drawSensorIcon(sensorId, sensorType, floor, x, y, size) {

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "sensor-marker");
        g.setAttribute("id", "marker-"+sensorId);

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", x);
        icon.setAttribute("y", y);
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", size);
        icon.setAttribute("floor-number", floor);
        icon.setAttribute("sensor-mode", sensorType);
        icon.setAttribute("id", sensorId);
        icon.textContent = this.getIcon(sensorType);
        g.appendChild(icon);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", parseInt(y) + parseInt(size));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", parseInt(size) / 2);
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#374151");
        text.textContent = sensorId;
        g.appendChild(text);
        
        this.overlayGroup.appendChild(g);
    }
 
    removeElementById(id) {
        if (!this.overlayGroup || !id) return false;

        const el = this.overlayGroup.querySelector(`#${CSS.escape("marker-"+id)}`);
        if (!el) return false;

        el.remove();
        return true;
    }

}

window.SensorOverlayManager = SensorOverlayManager;
