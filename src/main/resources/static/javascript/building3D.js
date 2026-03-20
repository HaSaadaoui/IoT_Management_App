// ================== HELPER SVG (bâtiments DB) ==================

// Charge un SVG via URL et renvoie { shape, centerX, centerZ }
async function loadSVGShapeFromUrl(url) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.SVGLoader();
        loader.load(
            url,
            (data) => {
                if (!data.paths.length) {
                    reject(new Error("SVG ne contient aucun <path>"));
                    return;
                }

                const shapes = [];
                data.paths.forEach(path => {
                    const pathShapes = path.toShapes(true);
                    pathShapes.forEach(s => shapes.push(s));
                });

                if (!shapes.length) {
                    reject(new Error("SVG sans shape exploitable"));
                    return;
                }

                // Trouver la shape ayant la plus grande surface
                let bestShape = null;
                let maxArea = -Infinity;

                shapes.forEach(shape => {
                    const area = THREE.ShapeUtils.area(shape.getPoints());
                    const absArea = Math.abs(area);
                    if (absArea > maxArea) {
                        maxArea = absArea;
                        bestShape = shape;
                    }
                });

                if (!bestShape) bestShape = shapes[0];
                const baseShape = bestShape.clone();

                const geom = new THREE.ShapeGeometry(baseShape);
                geom.computeBoundingBox();
                const bbox = geom.boundingBox;

                const centerX = (bbox.min.x + bbox.max.x) / 2;
                const centerZ = (bbox.min.y + bbox.max.y) / 2;

                resolve({ shape: baseShape, centerX, centerZ });
            },
            undefined,
            (err) => {
                reject(err);
            }
        );
    });
}

// ================== CLASS BUILDING3D ==================

class Building3D {
    constructor(containerId, buildingKey = null) {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById('building-canvas');
        this.buildingKey = buildingKey;
        this.dbBuildingConfig = null;
        this.dbShapeCache = null;
        this.config = null;
        this.floorData = {};

        // Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // building
        this.building = null;
        this.floors = [];
        this.roofs = [];
        this.hoveredFloor = null;
        this.selectedFloor = null;

        // sol / grille mémorisés
        this.ground = null;
        this.gridHelper = null;

        // state
        this.isIn3DView = true;
        this.currentFloorNumber = null;
        this.currentSensorMode = 'DESK';
        this.currentArchPlan = null;
        this._ephemeralSvgUrl = null;

        this.isDashboard = true;

        // OCCUPANCY STATE (centralisé)
        this.deskStatusMap = new Map();
        this.colors = {
            primary: 0x662179,
            primaryLight: 0x8b2fa3,
            floorBase: 0xe2e8f0,
            floorHover: 0xddd6fe,
            floorSelected: 0xc4b5fd,
            roof: 0x94a3b8,
            walls: 0xf8fafc,
            free: 0x10b981,
            used: 0xef4444,
            invalid: 0x94a3b8
        };

        // SSE
        this.occupancyUnsub = null;

        this.init();
    }

    async init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        await this.loadConfig();
        await this.setBuilding();

        this.setupEventListeners();
        this.animate();
    }

    getDeskSensor(floorNumber, deskId) {
        if (floorNumber == null || !deskId) return null;
        const floor = this.floorData?.[floorNumber];
        if (!floor || !Array.isArray(floor.desks)) return null;

        const match = floor.desks.find(d => d?.id === deskId);
        return match?.sensor ?? null;
    }

    // Sérialise le SVG courant et le met en blob URL
    persistCurrentSvgToBlob() {
        try {
            // On ne persiste que dans la configuration
            if (!this.currentArchPlan || this.isDashboard) return;

            const svgContent = this.currentArchPlan.exportSVG();
            if (!svgContent) return;

            // Nettoyage ancien blob si existant
            if (this._ephemeralSvgUrl) {
                URL.revokeObjectURL(this._ephemeralSvgUrl);
                this._ephemeralSvgUrl = null;
            }
            // Nouveau blob
            const blob = new Blob([svgContent], { type: "image/svg+xml" });
            this._ephemeralSvgUrl = URL.createObjectURL(blob);
            this.dbBuildingConfig.svgUrl = this._ephemeralSvgUrl;

        } catch (e) {
            console.warn('[Building3D] persistCurrentSvgToBlob error', e);
        }
    }

    startOccupancySSE() {
        this.stopOccupancySSE();

        if (!this.buildingKey || !window.SSEManager?.subscribeOccupancy) return;

        this.occupancyUnsub = window.SSEManager.subscribeOccupancy(this.buildingKey, (msg) => {
            try {
                const deviceId =
                    msg?.end_device_ids?.device_id ||
                    msg?.deviceId ||
                    msg?.device_id;

                const decoded =
                    msg?.uplink_message?.decoded_payload ||
                    msg?.decoded_payload ||
                    msg?.payload ||
                    {};

                const occRaw = decoded?.occupancy;
                if (!deviceId) return;

                const status = this.normalizeDeskStatus(occRaw);
                this.applyDeviceStatus(deviceId, status);
            } catch (e) {
                console.warn('[Building3D][SSE] error', e);
            }
        });
    }

    stopOccupancySSE() {
        if (this.occupancyUnsub) {
            try { this.occupancyUnsub(); } catch {}
            this.occupancyUnsub = null;
        }
    }

    computeDynamicViewForBuilding() {
        if (!this.building || !this.camera || !this.controls || !THREE) {
            const target = new THREE.Vector3(0, 0, 0);
            const camPos = new THREE.Vector3(6, 6, 6);
            const minD = 8, maxD = 40;
            return { target, camPos, minD, maxD };
        }

        this.building.updateMatrixWorld(true);

        // Bounding box / sphere
        const bbox = new THREE.Box3().setFromObject(this.building);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bbox.getCenter(center);
        bbox.getSize(size);

        const sphere = new THREE.Sphere();
        bbox.getBoundingSphere(sphere);

        const radius = Math.max(sphere.radius, 0.001);

        const verticalOffset = Math.min(Math.max(size.y * 0.1, 1), 5);
        const target = center.clone();
        target.y += verticalOffset;

        const distance = THREE.MathUtils.clamp(radius * 2.2, 6, 60);

        const currentDir =  new THREE.Vector3(1, 0.6, 1).normalize();

        const camPos = target.clone().add(currentDir.multiplyScalar(distance));
        const minD = THREE.MathUtils.clamp(radius * 0.8, 3, 25);
        const maxD = THREE.MathUtils.clamp(radius * 5.0, 15, 120);

        return { target, camPos, minD, maxD };
    }

    // Convertit ce que tu reçois (bool/int/string) en free/used/invalid
    normalizeDeskStatus(v) {
        if (v == null) return "invalid";

        if (typeof v === "string") {
            const s = v.toLowerCase();
            if (s === "occupied") return "used";
            if (s === "vacant") return "free";
            if (s === "used" || s === "true" || s === "1") return "used";
            if (s === "free" || s === "false" || s === "0") return "free";
            return "invalid";
        }

        if (typeof v === "boolean") return v ? "used" : "free";
        if (typeof v === "number") return v > 0 ? "used" : "free";

        return "invalid";
    }

    // Met à jour le desk correspondant à un deviceId (sensorId) dans TOUS les floors
    applyDeviceStatus(sensorId, status) {
        //Mettre à jour la map globale
        const prev = this.deskStatusMap.get(sensorId);
        this.deskStatusMap.set(sensorId, status);

        let updated = false;

        for (const [floorKey, floorInfo] of Object.entries(this.floorData)) {
            const floorNumber = parseInt(floorKey, 10);
            if (!floorInfo?.desks) continue;

            for (const desk of Object.values(floorInfo.desks)) {
                const mappedSensor = this.getDeskSensor(floorNumber, desk.id);
                if (mappedSensor === sensorId) {
                    if (desk.status !== status) {
                        desk.status = status;
                        updated = true;
                    }
                }
            }
        }

        //debug utile
        if (prev !== status) {
            console.log("📡 deskStatusMap update:", sensorId, status);
        }

        if (!updated) return;

        // Refresh overlay 3D
        if (this.isIn3DView && this.hoveredFloor) {
            this.showFloorInfo(this.hoveredFloor.userData.floorNumber);
        }

        // Refresh plan 2D
        if (!this.isIn3DView && this.currentArchPlan && this.currentFloorNumber != null) {
            const floorInfo = this.floorData[this.currentFloorNumber];
            const m = {};
            Object.values(floorInfo.desks).forEach(d => (m[d.sensor] = d.status));
            this.currentArchPlan.drawFloorPlan(m);
        }
    }

    async loadOccupancyDataForFloor(floorNumber) {
        console.log("Loading occupancy from SSE cache for", this.buildingKey, "floor", floorNumber);
        // Update stats from building 3D
		if (window.ChartUtils?.generateStatCardsForBuilding) {
			// Génère uniquement les cartes du floor choisi
			window.ChartUtils.generateStatCardsForBuilding(this.buildingKey, floorNumber);
		}

        const floorInfo = this.floorData[floorNumber];
        if (!floorInfo) {
            console.warn(`No floor data for floor ${floorNumber}`);
            return null;
        }

        if (!this.deskStatusMap || this.deskStatusMap.size === 0) {
            console.warn("deskStatusMap empty (SSE not yet received)");
            return {};
        }

        const deskOccupancy = {};

        Object.values(floorInfo.desks).forEach(desk => {
            const sensorId = this.getDeskSensor(floorNumber, desk.id);
            if (sensorId && this.deskStatusMap.has(sensorId)) {
                const status = this.deskStatusMap.get(sensorId);
                desk.status = status;
                deskOccupancy[desk.sensor] = status;
            }
        });

        console.log(`✅ Floor ${floorNumber} resolved from SSE`, deskOccupancy);
        return deskOccupancy;
    }

    async loadRealOccupancyData() {
        console.log('=== Loading Real Occupancy Data for', this.buildingKey, '===');

        if (!this.isIn3DView && this.currentFloorNumber !== null) {
            const deskOccupancy = await this.loadOccupancyDataForFloor(this.currentFloorNumber);
            if (this.currentArchPlan) {
                this.currentArchPlan.drawFloorPlan(deskOccupancy || {});
            }
        } else {
            const overlay = document.getElementById('floor-info-overlay');
            if (!overlay) return;

            // In 3D view, update all floors for the hover info
            for (let [floorNumberKey, floorInfo] of Object.entries(this.floorData)) {
                const floorIndex = parseInt(floorNumberKey, 10);
                await this.loadOccupancyDataForFloor(floorIndex);
            }

            console.log('=== Real Occupancy Data Loaded for All Floors ===');

            // Refresh the floor info overlay if currently hovering over a floor
            if (this.hoveredFloor && this.isIn3DView) {
                console.log('hoveredFloor data is: ' + this.hoveredFloor);
                this.showFloorInfo(this.hoveredFloor.userData.floorNumber);
            }
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);
        this.scene.fog = new THREE.Fog(0x0f172a, 20, 50);
    }

    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
        this.camera.position.set(20, 18, 20);
        this.camera.lookAt(0, 10, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -15;
        dirLight.shadow.camera.right = 15;
        dirLight.shadow.camera.top = 15;
        dirLight.shadow.camera.bottom = -15;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        hemiLight.position.set(0, 20, 0);
        this.scene.add(hemiLight);

        const pointLight1 = new THREE.PointLight(this.colors.primary, 0.5, 30);
        pointLight1.position.set(-10, 10, -10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(this.colors.primaryLight, 0.5, 30);
        pointLight2.position.set(10, 10, 10);
        this.scene.add(pointLight2);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 40;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.target.set(0, 5, 0);
    }

    resetCameraForBuilding() {
        if (!this.camera || !this.controls) return;
        const computed = this.computeDynamicViewForBuilding();
        const { target, camPos, minD, maxD } = computed;
        this.controls.target.copy(target);
        this.camera.position.copy(camPos);
        this.controls.minDistance = minD;
        this.controls.maxDistance = maxD;

        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    async createBuilding() {
        if (this.building) {
            this.scene.remove(this.building);
        }
        this.building = new THREE.Group();
        this.floors = [];
        this.roofs  = [];

        const floorHeight = 2;
        const floorsCount = this.config.floors || 1;
        const excludedFloors = this.config.excludedFloors || [];
        let buildingShape, centerX, centerZ, dbScale;

        if (!this.dbShapeCache) {
            console.log("Loading DB building SVG from:", this.dbBuildingConfig.svgUrl);
            this.dbShapeCache = await loadSVGShapeFromUrl(this.dbBuildingConfig.svgUrl);
        }
        dbScale       = this.dbBuildingConfig.scale || 1;
        buildingShape = this.dbShapeCache.shape;
        centerX       = this.dbShapeCache.centerX * dbScale;
        centerZ       = this.dbShapeCache.centerZ * dbScale;

        for (let i = 0; i < floorsCount; i++) {
            const floorGroup = new THREE.Group();
            floorGroup.userData = { floorNumber: i, type: 'floor' };

            const extrudeSettings     = { depth: 0.3,      bevelEnabled: false };
            const wallExtrudeSettings = { depth: floorHeight, bevelEnabled: false };

            // ---------- FLOOR ----------
            const floorGeometry = new THREE.ExtrudeGeometry(buildingShape, extrudeSettings);
            floorGeometry.scale(dbScale, dbScale, dbScale);
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.floorBase,
                metalness: 0.1,
                roughness: 0.8
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(-centerX, i * floorHeight, -centerZ);
            floor.castShadow = true;
            floor.receiveShadow = true;
            floor.userData = { floorNumber: i, type: 'floor', clickable: excludedFloors.includes(String(i)) ? false : true };
            floorGroup.add(floor);
            this.floors.push(floor);

            // ---------- WALLS ----------
            const wallGeometry = new THREE.ExtrudeGeometry(buildingShape, wallExtrudeSettings);
            wallGeometry.scale(dbScale, dbScale, 1);
            const wallMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.walls,
                transparent: true,
                opacity: 0.3,
                metalness: 0.1,
                roughness: 0.9,
                side: THREE.DoubleSide
            });
            const walls = new THREE.Mesh(wallGeometry, wallMaterial);
            walls.rotation.x = -Math.PI / 2;
            walls.position.set(-centerX, i * floorHeight, -centerZ);
            walls.castShadow = true;
            floorGroup.add(walls);

            // ---------- ROOF ----------
            const roofGeometry = new THREE.ExtrudeGeometry(buildingShape, extrudeSettings);
            roofGeometry.scale(dbScale, dbScale, dbScale);
            const roofMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.roof,
                metalness: 0.3,
                roughness: 0.7
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.rotation.x = -Math.PI / 2;
            roof.position.set(-centerX, i * floorHeight + floorHeight, -centerZ);
            roof.castShadow = true;
            roof.userData = { type: 'roof', floorNumber: i };
            floorGroup.add(roof);
            this.roofs.push(roof);

            // ---------- EDGES ----------
            const edgeGeometry = new THREE.EdgesGeometry(floorGeometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: this.colors.primary,
                linewidth: 2
            });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edges.position.copy(floor.position);
            edges.rotation.copy(floor.rotation);
            floorGroup.add(edges);

            this.building.add(floorGroup);
        }

        if (!this.ground) {
            const groundGeometry = new THREE.PlaneGeometry(50, 50);
            const groundMaterial = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                metalness: 0.1,
                roughness: 0.9
            });
            this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
            this.ground.rotation.x = -Math.PI / 2;
            this.ground.position.y = -0.5;
            this.ground.receiveShadow = true;
            this.scene.add(this.ground);
        }

        if (!this.gridHelper) {
            this.gridHelper = new THREE.GridHelper(50, 50, this.colors.primary, 0x334155);
            this.gridHelper.position.y = -0.4;
            this.scene.add(this.gridHelper);
        }

        this.scene.add(this.building);
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
        this.canvas.addEventListener('click',    (event) => this.onMouseClick(event));
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('beforeunload', () => {
            this.stopOccupancySSE();
            if (this._ephemeralSvgUrl) {
            try { URL.revokeObjectURL(this._ephemeralSvgUrl); } catch {}
            this._ephemeralSvgUrl = null;
            }
        });
    }

    onMouseMove(event) {
        if (!this.isIn3DView) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.floors);

        if (this.hoveredFloor && this.hoveredFloor !== this.selectedFloor) {
            this.hoveredFloor.material.color.setHex(this.colors.floorBase);
            this.hoveredFloor.material.emissive.setHex(0x000000);
        }

        if (intersects.length > 0) {
            const floor = intersects[0].object;
            if (floor.userData.clickable) {
                this.hoveredFloor = floor;
                if (floor !== this.selectedFloor) {
                    floor.material.color.setHex(this.colors.floorHover);
                    floor.material.emissive.setHex(this.colors.primary);
                    floor.material.emissiveIntensity = 0.2;
                }
                this.canvas.style.cursor = 'pointer';
                this.showFloorInfo(floor.userData.floorNumber);
            }
        } else {
            this.hoveredFloor = null;
            this.canvas.style.cursor = 'grab';
            this.hideFloorInfo();
        }
    }

    onMouseClick(event) {
        if (!this.isIn3DView) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.floors);

        if (intersects.length > 0) {
            const floor = intersects[0].object;
            if (floor.userData.clickable) {
                this.enterFloor(floor.userData.floorNumber);
            }
        }
    }

    showFloorInfo(floorNumber) {
        const overlay = document.getElementById('floor-info-overlay');
        if (!overlay) return;

        const data = this.floorData[floorNumber];
        if (!data) return;

        const freeDesks = data.desks.filter(d => d.status === 'free').length;
        const usedDesks = data.desks.filter(d => d.status === 'used').length;
        const invalidDesks = data.desks.filter(d => d.status === 'invalid').length;
        const floorTotalDesks = freeDesks + usedDesks + invalidDesks;

        overlay.innerHTML = `
            <h4 style="margin:0 0 0.5rem;color:#662179;font-size:1rem;">${data.name}</h4>
            <p style="margin:0.25rem 0;font-size:0.9rem;">Total Desks: ${floorTotalDesks}</p>
            <p style="margin:0.25rem 0;font-size:0.9rem;color:#10b981;">🟢 Free: ${freeDesks}</p>
            <p style="margin:0.25rem 0;font-size:0.9rem;color:#ef4444;">🔴 Used: ${usedDesks}</p>
            <p style="margin:0.25rem 0;font-size:0.9rem;color:#94a3b8;">⚪ Invalid: ${invalidDesks}</p>
            <p style="margin-top:0.75rem;font-size:0.85rem;color:#9ca3af;font-style:italic;">Click to enter</p>
        `;
        overlay.classList.add('active');
    }

    hideFloorInfo() {
        const overlay = document.getElementById('floor-info-overlay');
        if (!overlay) return;
        overlay.classList.remove('active');
    }

    enterFloor(floorNumber) {
        this.currentFloorNumber = floorNumber;

        const roof = this.roofs[floorNumber];
        const targetY = floorNumber * 3 + 1.5;

        gsap.to(roof.position, {
            y: roof.position.y + 5,
            duration: 1,
            ease: 'power2.inOut'
        });

        gsap.to(roof.material, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.inOut',
            onStart: () => {
                roof.material.transparent = true;
            }
        });

        gsap.to(this.camera.position, {
            x: 0,
            y: targetY + 15,
            z: 0,
            duration: 1.5,
            ease: 'power2.inOut',
            onComplete: () => this.switch2DFloorView(floorNumber)
        });

        gsap.to(this.controls.target, {
            x: 0,
            y: targetY,
            z: 0,
            duration: 1.5,
            ease: 'power2.inOut'
        });

        const floorSelect = document.getElementById('filter-floor');
        if (floorSelect) {
            floorSelect.value = floorNumber;
        }
    }

    // ===== 2D VIEW =====

    switch2DFloorView(floorNumber) {
        this.isIn3DView = false;

        const container3D = document.getElementById('building-3d-container');
        if (container3D) container3D.style.display = 'none';

        const floorPlan2D = document.getElementById('floor-plan-2d');
        if (floorPlan2D) floorPlan2D.style.display = 'block';

        const backBtn = document.getElementById('back-to-3d-btn');
        if (backBtn) backBtn.style.display = 'block';

        this.loadArchitecturalPlan(floorNumber);
    }

    loadArchitecturalPlan(floorNumber) {
        this.persistCurrentSvgToBlob();
        const deskGrid = document.getElementById('desk-grid');
        if (!deskGrid) {
            console.error('desk-grid not found');
            return;
        }

        deskGrid.innerHTML = '';
        deskGrid.style.gridTemplateColumns = '1fr';
        deskGrid.style.padding = '0';
        deskGrid.style.background = '#ffffff';
        deskGrid.style.borderRadius = '12px';
        deskGrid.style.border = '2px solid #e2e8f0';

        const floorData = this.floorData[floorNumber] || {};
        const floorsCount = this.getFloorsCount();

        const currentFloorData = {
            floorNumber: floorNumber,
            name: floorData.name || "",
            desks: floorData.desks || {}
        };

        if (window.ArchitecturalFloorPlan) {
            if (!this.currentArchPlan) {
                this.currentArchPlan = new ArchitecturalFloorPlan('desk-grid', currentFloorData, this.currentSensorMode, this.config.id, this.dbBuildingConfig.svgUrl, this.isDashboard, floorsCount);
            } else {
                this.currentArchPlan.updateConfig(currentFloorData, this.currentSensorMode, this.dbBuildingConfig.svgUrl);
            }
           this.loadRealOccupancyData();
        } else {
            console.error('ArchitecturalFloorPlan not loaded');
        }

        this.updateFloorTitle(floorNumber);
    }

    updateFloorTitle(floorNumber) {
        const titleEl = document.getElementById('current-floor-title');
        if (!titleEl) return;

        const data = this.floorData[floorNumber] || {};
        let name = '';
        if (data.name) {
            name = data.name;
        } else if (floorNumber === 0) {
            name = 'Ground Floor';
        } else {
            name = `Floor ${floorNumber}`;
        }
        const sensorNames = {
            'DESK': 'Occupancy',
            'CO2': 'CO₂ Air Quality',
            'TEMP': 'Temperature',
            'LIGHT': 'Light Levels',
            'MOTION': 'Motion Detection',
            'NOISE': 'Noise Levels',
            'HUMIDITY': 'Humidity',
            'TEMPEX': 'HVAC Flow',
            'PR': 'Presence & Light',
            'SECURITY': 'Security Alerts'
        };
        const label = sensorNames[this.currentSensorMode] || this.currentSensorMode;
        const title = `${name} - ${label} Visualization`;
        titleEl.textContent = title;
    }

    setSensorMode(mode) {
        this.currentSensorMode = mode;
        if (!this.isIn3DView && this.currentFloorNumber !== null) {
            this.loadArchitecturalPlan(this.currentFloorNumber);
        }
    }

    refreshDeskOccupancy() {
        if (this.currentArchPlan && this.currentSensorMode === 'DESK') {
            this.currentArchPlan.loadDeskOccupancy();
        }
    }

    return3DView() {
        this.isIn3DView = true;

        const container3D   = document.getElementById('building-3d-container');
        const floorPlan2D   = document.getElementById('floor-plan-2d');
        const backBtn       = document.getElementById('back-to-3d-btn');

        if (container3D) container3D.style.display = 'block';
        if (floorPlan2D) floorPlan2D.style.display = 'none';
        if (backBtn)     backBtn.style.display     = 'none';

        const computed = this.computeDynamicViewForBuilding();
        const { target, camPos, minD, maxD } = computed;

        gsap.to(this.camera.position, {
            ...camPos,
            duration: 1.5,
            ease: 'power2.inOut'
        });

        gsap.to(this.controls.target, {
            ...target,
            duration: 1.5,
            ease: 'power2.inOut'
        });

        this.currentFloorNumber = null;
        if (window.ChartUtils?.generateStatCardsForBuilding) {
            // Génère uniquement les cartes du floor choisi
            window.ChartUtils.generateStatCardsForBuilding(this.buildingKey, this.currentFloorNumber);
        }
    }

    async loadConfig() {
        if (!this.buildingKey || this.buildingKey.trim() === '') return;
        
        const upper = this.buildingKey.toUpperCase();
        let dbId = null;
        if (/^\d+$/.test(this.buildingKey)) {
            dbId = parseInt(this.buildingKey, 10);
        }

        this.dbShapeCache = null;

        if (!isNaN(dbId) && dbId !== null) {
            try {
                const resp = await fetch(`/api/buildings/${dbId}`);
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }
                const b = await resp.json();

                this.buildingKey = String(dbId);
                this.dbBuildingConfig = {
                    id: b.id,
                    name: b.name,
                    floors: b.floorsCount || 1,
                    scale: b.scale || 0.01,
                    svgUrl: b.svgPlan,
                    excludedFloors: b.excludedFloors ? b.excludedFloors.map(String) : [] 
                };
                this.config = {
                    id: b.id,
                    floors: b.floorsCount || 1,
                    scale: b.scale || 0.01,
                    excludedFloors: b.excludedFloors ? b.excludedFloors.map(String) : [] 
                };

                this.floorData = [];
                const svgFloorData = await this.loadFloorDataFromSvg(this.dbBuildingConfig.svgUrl);
                if (Object.keys(svgFloorData).length > 0) {
                    this.floorData = svgFloorData;
                }

                console.log("Loaded DB building config:", this.dbBuildingConfig);
            } catch (e) {
                console.error("Erreur lors du chargement du bâtiment DB:", e);
            }
        }
    }

    async loadFloorDataFromSvg(svgUrl) {
        if (!svgUrl) {
            console.warn("[loadFloorDataFromSvg] No SVG URL provided");
            return {};
        }

        try {
            const resp = await fetch(svgUrl);
            if (!resp.ok) {
                console.error("[loadFloorDataFromSvg] HTTP error", resp.status);
                return {};
            }

            const svgContent = await resp.text();
            const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");

            const nodes = [...doc.querySelectorAll(".sensor")]
                .filter(el => el.getAttribute("sensor-mode") === "DESK");

            const floorData = {};

            nodes.forEach(el => {
                const floor = parseInt(el.getAttribute("floor-number"), 10);
                const deskLabel = el.getAttribute("label");   // ex: D01
                const sensorId = el.getAttribute("id");       // ex: desk-03-01

                if (isNaN(floor)) return;

                if (!floorData[floor]) {
                    let name = `Floor ${floor}`;
                    if (floor === 0){
                        name = 'Ground Floor';
                    }
                    floorData[floor] = {
                        name: name,
                        desks: []
                    };
                }

                floorData[floor].desks.push({
                    id: deskLabel,
                    sensor: sensorId,
                    status: "invalid"
                });
            });

            console.log("✔ desk sensors imported from SVG:", floorData);
            return floorData;

        } catch (err) {
            console.error("[loadFloorDataFromSvg] Error parsing SVG:", err);
            return {};
        }
    }

    async setBuilding() {
        this.stopOccupancySSE();
        this.currentFloorNumber = null;
        this.isIn3DView = true;
        this.currentArchPlan = null;

        const container3D   = document.getElementById('building-3d-container');
        const floorPlan2D   = document.getElementById('floor-plan-2d');
        const backBtn       = document.getElementById('back-to-3d-btn');

        if (container3D) container3D.style.display = 'block';
        if (floorPlan2D) floorPlan2D.style.display = 'none';
        if (backBtn)     backBtn.style.display     = 'none';

        if (!this.buildingKey || this.buildingKey.trim() === ''){
            this.clearBuilding();
            this.showEmptyScene();
            return;
        }
        if (!this.isDashboard &&
            (!this.dbBuildingConfig || !this.dbBuildingConfig.svgUrl || this.dbBuildingConfig.svgUrl.trim() === '')){
            this.clearBuilding();
            this.showEmptyScene();
            return; 
        }

        await this.createBuilding();
        this.resetCameraForBuilding();
        this.loadRealOccupancyData();
        this.startOccupancySSE();
    }

    clearBuilding() {
        if (this.building) {
            this.scene.remove(this.building);
            this.building = null;
        }
        this.floors = [];
        this.roofs = [];
    }

    showEmptyScene() {
        this.config = null;
        this.floorData = {};

        // Ground
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.1,
            roughness: 0.9
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -0.5;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // Grid
        this.gridHelper = new THREE.GridHelper(50, 50, this.colors.primary, 0x334155);
        this.gridHelper.position.y = -0.4;
        this.scene.add(this.gridHelper);

        // Camera & Controls
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.minDistance = 8;
            this.controls.maxDistance = 40;
            this.controls.update();
        }
        if (this.camera) {
            this.camera.position.set(6, 6, 6);
            this.camera.lookAt(0, 0, 0);
            this.camera.updateProjectionMatrix();
        }
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.building && this.isIn3DView) {
            this.building.rotation.y += 0.0005;
        }
        this.renderer.render(this.scene, this.camera);
    }

    getFloorsCount() {
        if (this.config?.floors) {
            return parseInt(this.config.floors, 10) || 1;
        }
        return 1;
    }

}

// ================== GLOBAL HELPERS & INIT ==================

window.return3DView = function () {
    if (window.building3D) {
        window.building3D.return3DView();
    }
};

document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('building-3d-container');
    if (!container) return;

    const siteAttr = container.dataset.site ? container.dataset.site.toUpperCase() : null;

    window.building3D = new Building3D('building-3d-container', siteAttr);
    console.log('3D Building Digital Twin initialized for site:', siteAttr ?? '(empty scene)');

    const sensorSelect = document.getElementById('filter-sensor-type');
    if (sensorSelect) {
        sensorSelect.addEventListener('change', () => {
            if (window.building3D) {
                window.building3D.setSensorMode(sensorSelect.value);
            }
        });
    }

    const floorSelect = document.getElementById('filter-floor');
    if (floorSelect) {
        floorSelect.addEventListener('change', () => {
            if (window.building3D) {
                if (floorSelect.value === ""){
                    if(!window.building3D.isDashboard){
                        window.building3D.currentFloorNumber = "";
                        window.building3D.loadArchitecturalPlan(""); 
                    }
                    return;
                }
                const floorNumber = parseInt(floorSelect.value, 10);
                window.building3D.currentFloorNumber = floorNumber;
                window.building3D.switch2DFloorView(floorNumber);
            }
        });
    }

    const buildingSelect = document.getElementById('filter-building');
    if (buildingSelect) {
        buildingSelect.addEventListener('change', async () => {
            const val = buildingSelect.value;

            if (window.building3D && typeof window.building3D.setBuilding === 'function') {
                window.building3D.buildingKey = val;
                await window.building3D.loadConfig();
                window.building3D.setBuilding();
            }

            const buildingName = buildingSelect.selectedOptions[0].text;
        
            const buildingTitle = document.getElementById('building-title');
            if (buildingTitle) buildingTitle.textContent = `🏢 ${buildingName} Office Building`;

            const sensorSelect = document.getElementById('filter-sensor-type');
            if (sensorSelect) {
                const sensorType = sensorSelect.value;

                const sensorInfo = {
                    DESK: {icon: '📊', name: 'Desk Occupancy'},
                    CO2: {icon: '🌫️', name: 'CO₂ Air Quality'},
                    TEMP: {icon: '🌡️', name: 'Temperature'},
                    LIGHT: {icon: '💡', name: 'Light Levels'},
                    MOTION: {icon: '👁️',name: 'Motion Detection'},
                    NOISE: { icon: '🔉',name: 'Noise Levels'},
                    HUMIDITY: {icon: '💧', name: 'Humidity'},
                    TEMPEX: {icon: '🌀', name: 'HVAC Flow (TEMPex)'},
                    PR: {icon: '👤',name: 'Presence & Light'},
                    SECURITY: {icon: '🚨',name: 'Security Alerts'}
                };

                const info = sensorInfo[sensorType] || sensorInfo.DESK;
                const liveTitle     = document.getElementById('live-section-title');
                const histTitle     = document.getElementById('historical-section-title');
                if (liveTitle)     liveTitle.textContent     = `${info.icon} Live ${info.name} - ${buildingName} Office`;
                if (histTitle)     histTitle.textContent     = `📈 Historical ${info.name} Data - ${buildingName} Office`;
            }

        });
    }
});
