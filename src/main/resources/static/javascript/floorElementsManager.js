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
            const divider = document.createElementNS("http://www.w3.org/2000/svg","line");
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

        parent.appendChild(el);
        return el;
    }

    drawDoor(parent, x, y, width, height, orientation = "horizontal", arc = false, rotation = null) {
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
        if (rotation) {
            el.setAttribute("transform", rotation);
        }
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

    drawCircle(parent, xStart, yStart, xRadii, yRadii, xAxisRotation, largeArcFlag, sweepFlag, xEnd, yEnd, isOutline) {
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

    drawLine(parent, points, color, width) {
        const line = document.createElementNS(this.ns, "line");
        line.setAttribute("x1", points[0].x);
        line.setAttribute("y1", points[0].y);
        line.setAttribute("x2", points[1].x);
        line.setAttribute("y2", points[1].y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", width);
        line.setAttribute("stroke-linecap", "square");

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

        if (rotation){
            label.setAttribute("transform", rotation);
        }

        parent.appendChild(label);
        return label;
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
        console.log({ id, status });
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
        return g;
    }
}