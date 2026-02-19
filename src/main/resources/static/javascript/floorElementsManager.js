class FloorElementsManager {
    constructor(svg, colors) {
        this.svg = svg;
        this.colors = colors;
        this.ns = "http://www.w3.org/2000/svg";
    }

    createGroup(id) {
        const g = document.createElementNS(this.ns, "g");
        g.setAttribute("id", id);
        return g;
    }

    // Config drawing methods
    drawRect(parent, x, y, width, height, rotation = null, fill = false){
        const el = document.createElementNS(this.ns, "rect");
        el.setAttribute("x", x);
        el.setAttribute("y", y);
        el.setAttribute("width", width);
        el.setAttribute("height", height);
        el.setAttribute("fill", fill ? "#ffffff" : "none");
        el.setAttribute("stroke", this.colors.wallStroke);
        el.setAttribute("stroke-width", 2);
        if (rotation) {
            const cx = x + width / 2;
            const cy = y + height / 2;
            el.setAttribute("transform",`rotate(${rotation} ${cx} ${cy})`);
        }
        parent.appendChild(el);
    }

    drawCircle(parent, cx, cy, radius) {
        const path = document.createElementNS(this.ns, "circle");

        path.setAttribute("r", radius);
        path.setAttribute("cx", cx);
        path.setAttribute("cy", cy);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.colors.wallStroke);
        path.setAttribute("stroke-width", 2);

        parent.appendChild(path);
        return path;
    }
    
    drawLine(parent, points, color, width, rotation = null) {
        const line = document.createElementNS(this.ns, "line");
        line.setAttribute("x1", points[0].x);
        line.setAttribute("y1", points[0].y);
        line.setAttribute("x2", points[1].x);
        line.setAttribute("y2", points[1].y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", width);
        line.setAttribute("stroke-linecap", "square");
        if (rotation) {
            const cx = (points[0].x + points[1].x) / 2;
            const cy = (points[0].y + points[1].y) / 2;
            line.setAttribute("transform",`rotate(${rotation} ${cx} ${cy})`);
        }
        parent.appendChild(line);
        return line;
    }

    drawLabel(parent, x, y, text, fontSize = 12, fontWeight = "normal", rotation = null) {
        const label = document.createElementNS(this.ns, "text");
        label.setAttribute("x", x);
        label.setAttribute("y", y);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-family", "Arial, sans-serif");
        label.setAttribute("font-size", fontSize);
        label.setAttribute("font-weight", fontWeight);
        label.setAttribute("fill", this.colors.text);
        label.textContent = text;
        if (rotation) {
            const cx = x;
            const cy = y;
            label.setAttribute("transform",`rotate(${rotation} ${cx} ${cy})`);
        }
        parent.appendChild(label);
        return label;
    }

    // Old Dashboard methods (to be refactored)
    drawWall(parent, points, isOutline = false) {
        const path = document.createElementNS(this.ns, "path");
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
        return path;
    }

    drawWindow(parent, x, y, length, orientation = "horizontal") {
        const windowWidth = orientation === "horizontal" ? length : 6;
        const windowHeight = orientation === "horizontal" ? 6 : length;

        const el = document.createElementNS(this.ns, "rect");
        el.setAttribute("x", x - windowWidth / 2);
        el.setAttribute("y", y - windowHeight / 2);
        el.setAttribute("width", windowWidth);
        el.setAttribute("height", windowHeight);
        el.setAttribute("fill", "#e0f2fe");
        el.setAttribute("stroke", this.colors.wallStroke);
        el.setAttribute("stroke-width", 2);

        // Window panes
        if (orientation === "horizontal") {
            const divider = document.createElementNS(this.ns, "line");
            divider.setAttribute("x1", x);
            divider.setAttribute("y1", y - 3);
            divider.setAttribute("x2", x);
            divider.setAttribute("y2", y + 3);
            divider.setAttribute("stroke", this.colors.wallStroke);
            divider.setAttribute("stroke-width", 1);
            parent.appendChild(divider);
        } else {
            const divider = document.createElementNS(this.ns, "line");
            divider.setAttribute("x1", x - 3);
            divider.setAttribute("y1", y);
            divider.setAttribute("x2", x + 3);
            divider.setAttribute("y2", y);
            divider.setAttribute("stroke", this.colors.wallStroke);
            divider.setAttribute("stroke-width", 1);
            parent.appendChild(divider);
        }

        parent.appendChild(el);
        return el;
    }

    drawDoor(parent, x, y, width, height, orientation = "horizontal", arc = false) {
        const w = orientation === "horizontal" ? width : height;
        const h = orientation === "horizontal" ? height : width;

        const el = document.createElementNS(this.ns, "rect");
        el.setAttribute("x", x - w / 2);
        el.setAttribute("y", y - h / 2);
        el.setAttribute("width", w);
        el.setAttribute("height", h);
        el.setAttribute("fill", "#ffffff");
        el.setAttribute("stroke", this.colors.wallStroke);
        el.setAttribute("stroke-width", 2);
        parent.appendChild(el);

        // Door arc
        if (arc) {
            const arc = document.createElementNS(this.ns,"path");
            if (orientation === "horizontal") {
                arc.setAttribute("d",`M ${x - 20} ${y} Q ${x} ${y - 20} ${x + 20} ${y}`);
            } else {
                arc.setAttribute("d",`M ${x} ${y - 20} Q ${x + 20} ${y} ${x} ${y + 20}`);
            }
            arc.setAttribute("fill", "none");
            arc.setAttribute("stroke", this.colors.interiorLine);
            arc.setAttribute("stroke-width", 1);
            arc.setAttribute("stroke-dasharray", "2,2");
            parent.appendChild(arc);
        }

        return el;
    }

    drawCircleArc(parent, xStart, yStart, xRadii, yRadii, xAxisRotation, largeArcFlag, sweepFlag, xEnd, yEnd, isOutline) {
        const path = document.createElementNS(this.ns, "path");

        let d = `M ${xStart} ${yStart} A ${xRadii} ${yRadii} ${xAxisRotation} ${largeArcFlag} ${sweepFlag} ${xEnd} ${yEnd}`;

        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.colors.wallStroke);
        path.setAttribute("stroke-width", isOutline ? 4 : 2);
        path.setAttribute("stroke-linecap", "square");
        path.setAttribute("stroke-linejoin", "miter");

        parent.appendChild(path);
        return path;
    }

    drawChair(parent, x, y) {
        const chair = document.createElementNS(this.ns, "circle");
        chair.setAttribute("cx", x);
        chair.setAttribute("cy", y);
        chair.setAttribute("r", 4);
        chair.setAttribute("fill", "#94a3b8");
        chair.setAttribute("stroke", this.colors.wallStroke);
        chair.setAttribute("stroke-width", 1);

        parent.appendChild(chair);
        return chair;
    } 
    
    drawWorkstation(parent, x, y, status, id, width = 45, height = 35, chairPosition = "top", rotation = null, chairX = null, chairY = null, textX = null, textY = null) {
        const g = document.createElementNS(this.ns, "g");
        g.setAttribute("class", "workstation");
        g.setAttribute("data-desk-id", id);
        g.setAttribute("data-draggable", "true");

        // Main desk rectangle
        const desk = document.createElementNS(this.ns, "rect");
        desk.setAttribute("x", x);
        desk.setAttribute("y", y);
        desk.setAttribute("width", width);
        desk.setAttribute("height", height);
        desk.setAttribute("fill", this.colors[status]);
        desk.setAttribute("stroke", this.colors.wallStroke);
        desk.setAttribute("stroke-width", 2);
        desk.setAttribute("rx", 3);
        desk.setAttribute("class", "sensor");
        desk.setAttribute("id", id);

        // Add rotation if specified
        if (rotation) {
            desk.setAttribute("transform", rotation);
        }

        // Calculate center for text
        const centerX = textX !== null ? textX : x + width / 2;
        const centerY = textY !== null ? textY : y + height / 2;

        // Desk ID label
        const text = document.createElementNS(this.ns, "text");
        text.setAttribute("x", centerX);
        text.setAttribute("y", centerY + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.setAttribute("font-size", "12");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", this.colors.wallFill);
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
        return g;
    }

    // Main methods (add/update/remove)
    addElement(el) {
        const parent = (el.floor === "" || el.floor == null)
            ? this.svg.querySelector("#all-floors")
            : this.svg.querySelector(`#floor-${parseInt(el.floor, 10)}`);

        const g = this.createGroup(el.id);
        // === META CANONIQUES ===
        g.setAttribute("data-type", el.type);
        g.setAttribute("floor-number", el.floor ?? "");
        g.setAttribute("data-draggable", "true");
        g.style.cursor = "move";
        if (el.x != null) g.setAttribute("data-x", el.x);
        if (el.y != null) g.setAttribute("data-y", el.y);
        if (el.width != null) g.setAttribute("data-width", el.width);
        if (el.height != null) g.setAttribute("data-height", el.height);
        if (el.size != null) g.setAttribute("data-size", el.size);
        if (el.radius != null) g.setAttribute("data-radius", el.radius);
        if (el.label != null) g.setAttribute("data-label", el.label);
        if (el.rotation != null) g.setAttribute("data-rotation", el.rotation);

        switch(el.type) {
            case "Wall":
                const points = [{x: el.x, y: el.y}, {x: el.x + el.size, y: el.y}];
                this.drawLine(g, points, this.colors.wallStroke, el.width, el.rotation || null);
                break;
            case "Room":
                this.drawRect(g, el.x, el.y, el.width, el.height, el.rotation || null, false);
                break;
            case "Window":
                this.drawRect(g, el.x, el.y, el.width, el.height, el.rotation || null, true);
                break;
            case "Door":
                this.drawRect(g, el.x, el.y, el.width, el.height, el.rotation || null, true);
                break;
            case "Circle":
                this.drawCircle(g, el.x, el.y, el.radius);
                break;
            case "Label":
                this.drawLabel(g, el.x, el.y, el.label, el.size, "normal", el.rotation || null);
                break;
        }
        parent.appendChild(g);
    }

    updateElement(el) {
        const g = this.svg.querySelector(`#${el.id}`);
        if(!g) return;
        const child = g.firstElementChild;
        if(!child) return;

        if (g.getAttribute("data-type") !== el.type) {
            console.warn(`Type mismatch for element ${el.id}: expected ${g.getAttribute("data-type")}, got ${el.type}`);
            return;
        }

        el.x = parseFloat(child.getAttribute("x")) || parseFloat(child.getAttribute("x1")) || parseFloat(child.getAttribute("cx"));
        el.y = parseFloat(child.getAttribute("y")) || parseFloat(child.getAttribute("y1")) || parseFloat(child.getAttribute("cy"));

        // MAJ META
        if (el.type) g.setAttribute("data-type", el.type);
        if (el.floor != null) g.setAttribute("floor-number", el.floor);
        if (el.x != null) g.setAttribute("data-x", el.x);
        if (el.y != null) g.setAttribute("data-y", el.y);
        if (el.size != null) g.setAttribute("data-size", el.size);
        if (el.width != null) g.setAttribute("data-width", el.width);
        if (el.height != null) g.setAttribute("data-height", el.height);
        if (el.radius != null) g.setAttribute("data-radius", el.radius);
        if (el.label != null) g.setAttribute("data-label", el.label);
        if (el.rotation != null) g.setAttribute("data-rotation", el.rotation);

        // MAJ enfant
        switch(el.type) {
            case "Wall": {
                child.setAttribute("x1", el.x);
                child.setAttribute("y1", el.y);
                child.setAttribute("x2", el.x + el.size);
                child.setAttribute("y2", el.y);
                child.setAttribute("stroke-width", el.width);
                if (el.rotation != null) {
                    const cx = (el.x + (el.x + el.size)) / 2;
                    const cy = el.y;
                    child.setAttribute("transform", `rotate(${el.rotation} ${cx} ${cy})`);
                } else {
                    child.removeAttribute("transform");
                }
                break;
            }
            case "Room":
            case "Window":
            case "Door": {
                child.setAttribute("x", el.x);
                child.setAttribute("y", el.y);
                child.setAttribute("width", el.width);
                child.setAttribute("height", el.height);
                if (el.rotation != null) {
                    const cx = el.x + el.width / 2;
                    const cy = el.y + el.height / 2;
                    child.setAttribute("transform", `rotate(${el.rotation} ${cx} ${cy})`);
                } else {
                    child.removeAttribute("transform");
                }
                break;
            }
            case "Circle": {
                child.setAttribute("cx", el.x);
                child.setAttribute("cy", el.y);
                child.setAttribute("r", el.radius);
                break;
            }
            case "Label": {
                child.setAttribute("x", el.x);
                child.setAttribute("y", el.y);
                if (typeof el.size === "number") child.setAttribute("font-size", el.size);
                if (typeof el.label === "string") child.textContent = el.label;
                if (el.rotation != null) {
                    child.setAttribute("transform", `rotate(${el.rotation} ${el.x} ${el.y})`);
                } else {
                    child.removeAttribute("transform");
                }
                break;
            }
        }
    }

    removeElement(id) {
        const group = this.svg.querySelector(`#${id}`);
        if(!group) return false;
        group.remove();
        return true;
    }

}