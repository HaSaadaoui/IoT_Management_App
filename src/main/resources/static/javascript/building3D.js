// ================== SHAPES ==================

// Shape Châteaudun (basé sur ton SVG 1100x500)
function createChateaudunShape(scale = 0.01) {
    const shape = new THREE.Shape();

    // SVG coordinates: x: 50-1050, y: 50-450
    shape.moveTo(50 * scale, 50 * scale);
    shape.lineTo(950 * scale, 50 * scale);
    shape.lineTo(1050 * scale, 50 * scale);
    shape.lineTo(1050 * scale, 450 * scale);
    shape.lineTo(200 * scale, 280 * scale);
    shape.lineTo(50 * scale, 200 * scale);
    shape.lineTo(50 * scale, 50 * scale);

    const centerX = (50 + 1050) * scale / 2;
    const centerZ = (50 + 450) * scale / 2;

    return { shape, centerX, centerZ };
}

function createLevalloisShape(scale = 1) {
    const shape = new THREE.Shape();

    // Dimensions de base
    const bodyLength    = 55 * scale;
    const rectRightLen  = 20 * scale;
    const halfDepth     = 10 * scale;
    const extraTop      = 10 * scale;

    const radiusLeft = halfDepth;
    const xBodyLeft   = -bodyLength / 2;
    const xBodyRight  =  bodyLength / 2;
    const xHeadRight  =  xBodyRight + rectRightLen;

    const yBottom     = -halfDepth;
    const yTop        =  halfDepth;
    const yHeadTop    =  yTop + extraTop;
    shape.moveTo(xHeadRight, yBottom);

    // 2) Bas bloc → bas corps
    shape.lineTo(xBodyRight, yBottom);

    shape.lineTo(xBodyLeft, yBottom);
    shape.absarc(
        xBodyLeft,      // centre X
        0,              // centre Y
        radiusLeft,     // rayon
        -Math.PI / 2,   // départ en bas
        Math.PI / 2,    // fin en haut
        true            // sens horaire
    );
    shape.lineTo(xBodyRight, yTop);
    shape.lineTo(xBodyRight, yHeadTop);
    shape.lineTo(xHeadRight, yHeadTop);
    shape.lineTo(xHeadRight, yBottom);
    const minX = xBodyLeft;
    const maxX = xHeadRight;
    const minY = yBottom;
    const maxY = yHeadTop;

    const centerX = (minX + maxX) / 2;
    const centerZ = (minY + maxY) / 2;

    return { shape, centerX, centerZ };
}

// ================== HELPER SVG (bâtiments DB) ==================

// Charge un SVG via URL et renvoie { shape, centerX, centerZ }
async function loadSVGShapeFromUrl(url, scale = 1) {
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

                const baseShape = shapes[0].clone();

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

// ================== FLOOR DATA ==================

const BASE_FLOOR_DATA = {
    0: {
        name: 'Ground Floor',
        desks: window.DeskSensorConfig.getFloorDesks(0, 'invalid', 'CHATEAUDUN')
    },
    1: {
        name: 'Floor 1',
        desks: window.DeskSensorConfig.getFloorDesks(1, 'invalid', 'CHATEAUDUN')
    },
    2: {
        name: 'Floor 2',
        desks: window.DeskSensorConfig.getFloorDesks(2, 'invalid', 'CHATEAUDUN')
    },
    3: {
        name: 'Floor 3',
        desks: window.DeskSensorConfig.getFloorDesks(3, 'invalid', 'CHATEAUDUN')
    },
    4: {
        name: 'Floor 4',
        desks: window.DeskSensorConfig.getFloorDesks(4, 'invalid', 'CHATEAUDUN')
    },
    5: {
        name: 'Floor 5',
        desks: window.DeskSensorConfig.getFloorDesks(5, 'invalid', 'CHATEAUDUN')
    },
    6: {
        name: 'Floor 6',
        desks: window.DeskSensorConfig.getFloorDesks(6, 'invalid', 'CHATEAUDUN')
    }
};

const LEVALLOIS_BASE_FLOOR_DATA = {
    0: {
        name: 'Ground Floor',
        desks: window.DeskSensorConfig.getFloorDesks(0, 'invalid', 'LEVALLOIS')
    },
    1: {
        name: 'Floor 1',
        desks: window.DeskSensorConfig.getFloorDesks(1, 'invalid', 'LEVALLOIS')
    },
    2: {
        name: 'Floor 2',
        desks: window.DeskSensorConfig.getFloorDesks(2, 'invalid', 'LEVALLOIS')
    },
    3: {
        name: 'Floor 3',
        desks: window.DeskSensorConfig.getFloorDesks(3, 'invalid', 'LEVALLOIS')
    },
    4: {
        name: 'Floor 4',
        desks: window.DeskSensorConfig.getFloorDesks(4, 'invalid', 'LEVALLOIS')
    },
    5: {
        name: 'Floor 5',
        desks: window.DeskSensorConfig.getFloorDesks(5, 'invalid', 'LEVALLOIS')
    },
    6: {
        name: 'Floor 6',
        desks: window.DeskSensorConfig.getFloorDesks(6, 'invalid', 'LEVALLOIS')
    }
};

// FloorData par site
const CHATEAUDUN_FLOOR_DATA = JSON.parse(JSON.stringify(BASE_FLOOR_DATA));

const LEVALLOIS_FLOOR_DATA = JSON.parse(JSON.stringify(LEVALLOIS_BASE_FLOOR_DATA));
LEVALLOIS_FLOOR_DATA[0].name = 'Levallois - Floor 3';

// ================== CONFIG BUILDINGS ==================

const BUILDINGS = {
    CHATEAUDUN: {
        id: 'CHATEAUDUN',
        floors: 7,
        scale: 0.01,
        createShape: createChateaudunShape,
        floorData: CHATEAUDUN_FLOOR_DATA
    },
    LEVALLOIS: {
        id: 'LEVALLOIS',
        floors: 1,
        scale: 0.06,
        createShape: createLevalloisShape,
        floorData: LEVALLOIS_FLOOR_DATA
    }
};

// ================== CLASS BUILDING3D ==================

class Building3D {
    constructor(containerId, buildingKey = null) {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById('building-canvas');
        this.buildingKey = buildingKey;
        this.isDbBuilding = false;
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

        this.isDashboard = true;

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
        // Use shared configuration for desk-sensor mapping
        return window.DeskSensorConfig
            ? window.DeskSensorConfig.getSensor(floorNumber, deskId, this.buildingKey)
            : null;
    }

    getSvgPlanUrl() {
        // Cas DB
        if (this.isDbBuilding && this.dbBuildingConfig?.svgUrl) {
            return this.dbBuildingConfig.svgUrl;
        }
        return null;
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

    openOccupancySSE() {
        this.closeOccupancySSE();

        const b = this.buildingKey;
        const url = `/api/dashboard/occupancy/stream?building=${encodeURIComponent(b)}`;

        this._occEs = new EventSource(url);

        this._occEs.addEventListener("uplink", (e) => {
            try {
                const raw = JSON.parse(e.data);

                // ✅ ton SSE (d'après ton curl) : { result: { end_device_ids..., uplink_message... } }
                const msg = raw?.result ?? raw;

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
            } catch (err) {
                console.warn("[SSE] parse error", err, e?.data);
            }
        });

        this._occEs.addEventListener("keepalive", () => {});
        this._occEs.onerror = (e) => console.warn("[SSE] error", e);
    }

    closeOccupancySSE() {
        if (this._occEs) {
            this._occEs.close();
            this._occEs = null;
        }
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
        let updated = false;

        for (const [floorKey, floorInfo] of Object.entries(this.floorData)) {
            const floorNumber = parseInt(floorKey, 10);
            if (!floorInfo?.desks) continue;

            for (const desk of Object.values(floorInfo.desks)) {
                const mappedSensor = this.getDeskSensor(floorNumber, desk.id);
                if (mappedSensor && mappedSensor === sensorId) {
                    if (desk.status !== status) {
                    desk.status = status;
                    updated = true;
                    }
                }
            }
        }

        if (!updated) return;

        // Refresh overlay en 3D
        if (this.isIn3DView && this.hoveredFloor) {
            this.showFloorInfo(this.hoveredFloor.userData.floorNumber);
        }

        // Refresh plan 2D si ouvert
        if (!this.isIn3DView && this.currentArchPlan && this.currentFloorNumber != null) {
            // si ton ArchitecturalFloorPlan supporte drawFloorPlan(map)
            const floorInfo = this.floorData[this.currentFloorNumber];
            const m = {};
            Object.values(floorInfo.desks).forEach(d => (m[d.id] = d.status));
            this.currentArchPlan.drawFloorPlan(m);
        }
    }

    async loadOccupancyDataForFloor(floorNumber) {
        const floorInfo = this.floorData[floorNumber];

        if (!floorInfo) {
            console.warn(`No floor data found for floor index ${floorNumber}`);
            return null;
        }

        try {
            const b = this.buildingKey; // CHATEAUDUN / LEVALLOIS / DB:4 ...

            const response = await fetch(
                `/api/dashboard/occupancy?building=${encodeURIComponent(b)}&floor=${floorNumber}`
            );

            if (response.ok) {
                const occupancyData = await response.json();
                console.log(`Floor ${floorNumber} occupancy data:`, occupancyData);

                // Create a map of desk statuses
                const deskStatusMap = new Map();
                occupancyData.forEach(desk => {
                    deskStatusMap.set(desk.id, desk.status);
                });

                // Create deskOccupancy object for this floor
                const deskOccupancy = {};

                // Update desk statuses in floor data
                Object.values(floorInfo.desks).forEach((desk) => {
                    // Get the sensor ID from the desk configuration
                    const sensorId = this.getDeskSensor(floorNumber, desk.id);

                    // Look for matching desk in API response
                    if (sensorId && deskStatusMap.has(sensorId)) {
                        const newStatus = deskStatusMap.get(sensorId);
                        desk.status = newStatus;
                        // Store in deskOccupancy object
                        deskOccupancy[desk.id] = newStatus;
                        console.log(`Updated ${desk.id} (sensor: ${sensorId}): ${newStatus}`);
                    }
                });

                console.log(`=== Occupancy Data Loaded for Floor ${floorNumber} ===`);
                return deskOccupancy;
            } else {
                console.warn(`Failed to fetch occupancy data for floor ${floorNumber}: ${response.status}`);
                return null;
            }
        } catch (err) {
            console.error(`Error loading occupancy data for floor ${floorNumber}:`, err);
            return null;
        }
    }

    async loadRealOccupancyData() {
        console.log('=== Loading Real Occupancy Data for', this.buildingKey, '===');

        // Only load data for the current floor if in 2D view
        if (!this.isIn3DView && this.currentFloorNumber !== null) {
            const deskOccupancy = await this.loadOccupancyDataForFloor(this.currentFloorNumber);

            // Only draw floor plan if this is still the current floor (prevent overwrites from race conditions)
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

        let buildingShape, centerX, centerZ, floorsCount;
        let dbScale = 1;

        if (this.isDbBuilding && this.dbBuildingConfig) {
            floorsCount = this.dbBuildingConfig.floors || 1;

            if (!this.dbShapeCache) {
                console.log("Loading DB building SVG from:", this.dbBuildingConfig.svgUrl);
                this.dbShapeCache = await loadSVGShapeFromUrl(this.dbBuildingConfig.svgUrl);
            }

            dbScale       = this.dbBuildingConfig.scale || 1;
            buildingShape = this.dbShapeCache.shape;
            centerX       = this.dbShapeCache.centerX * dbScale;
            centerZ       = this.dbShapeCache.centerZ * dbScale;
        } else {
            const result  = this.config.createShape(this.config.scale);
            buildingShape = result.shape;
            centerX       = result.centerX;
            centerZ       = result.centerZ;
            floorsCount   = this.config.floors;
        }

        for (let i = 0; i < floorsCount; i++) {
            const floorGroup = new THREE.Group();
            floorGroup.userData = { floorNumber: i, type: 'floor' };

            const extrudeSettings     = { depth: 0.3,      bevelEnabled: false };
            const wallExtrudeSettings = { depth: floorHeight, bevelEnabled: false };

            // ---------- FLOOR ----------
            const floorGeometry = new THREE.ExtrudeGeometry(buildingShape, extrudeSettings);
            if (this.isDbBuilding) {
                floorGeometry.scale(dbScale, dbScale, dbScale);
            }
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
            floor.userData = { floorNumber: i, type: 'floor', clickable: true };
            floorGroup.add(floor);
            this.floors.push(floor);

            // ---------- WALLS ----------
            const wallGeometry = new THREE.ExtrudeGeometry(buildingShape, wallExtrudeSettings);
            if (this.isDbBuilding) {
                wallGeometry.scale(dbScale, dbScale, 1);
            }
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
            if (this.isDbBuilding) {
                roofGeometry.scale(dbScale, dbScale, dbScale);
            }
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
                const mapping = window.DeskSensorConfig?.mappings?.[this.buildingKey] ?? {};
                const keys = Object.keys(mapping);
                const raw = keys[floor?.userData?.floorNumber];
                const parsed = Number.parseInt(raw ?? floor.userData.floorNumber, 10);
                const actualFloor = Number.isNaN(parsed) ? 0 : parsed;
                this.enterFloor(floor.userData.floorNumber, actualFloor);
            }
        }
    }

   showFloorInfo(floorNumber) {
        const desksToExclude = [
                  { id: 'PB5', sensor: 'desk-vs40-03-01' },
                  { id: 'IR1', sensor: 'desk-vs41-03-01' },
                  { id: 'IR2', sensor: 'desk-vs41-03-02' },
                  { id: 'PB1', sensor: 'desk-vs41-03-03' },
                  { id: 'PB2', sensor: 'desk-vs41-03-04' },
                  { id: 'PB3', sensor: 'occup-vs30-03-01' },
                  { id: 'PB4', sensor: 'occup-vs30-03-02' },
                  { id: 'SR1', sensor: 'occup-vs70-03-01' },
                  { id: 'SR2', sensor: 'occup-vs70-03-02' },
                  { id: 'PB6', sensor: 'occup-vs70-03-03' },
                  { id: 'PB7', sensor: 'occup-vs70-03-04' }
              ];

        const overlay = document.getElementById('floor-info-overlay');
        if (!overlay) return;

        const mapping = window.DeskSensorConfig?.mappings?.[this.buildingKey] ?? {};
        const keys = Object.keys(mapping);
        const raw = keys[floorNumber];

        const parsed = Number.parseInt(raw ?? '0', 10);
        const actualFloor = Number.isNaN(parsed) ? 0 : parsed;
        const data = this.floorData[actualFloor];

        let desks = data.desks;
        if (this.buildingKey === 'LEVALLOIS') {
            const excludedIds = new Set(desksToExclude.map(d => d.id));
            desks = desks.filter(desk => !excludedIds.has(desk.id));
        }

        const freeDesks = desks.filter(d => d.status === 'free').length;
        const usedDesks = desks.filter(d => d.status === 'used').length;
        const invalidDesks = desks.filter(d => d.status === 'invalid').length;
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

    enterFloor(floorNumber, actualFloor) {
        this.currentFloorNumber = actualFloor;

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
            onComplete: () => this.switch2DFloorView(actualFloor)
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
            floorSelect.value = actualFloor;
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
        const deskGrid = document.getElementById('desk-grid');
        if (!deskGrid) {
            console.error('desk-grid not found');
            return;
        }

        deskGrid.innerHTML = '';
        deskGrid.style.display = 'block';
        deskGrid.style.gridTemplateColumns = '1fr';
        deskGrid.style.padding = '0';
        deskGrid.style.background = '#ffffff';
        deskGrid.style.borderRadius = '12px';
        deskGrid.style.border = '2px solid #e2e8f0';
        deskGrid.style.minHeight = '600px';

        const floorData = this.floorData[floorNumber] || {};
        const floorsCount = this.getFloorsCount();

        const currentFloorData = {
            floorNumber: floorNumber,
            name: floorData.name || "",
            desks: floorData.desks || {}
        };

        if (window.ArchitecturalFloorPlan) {
            const svgPath = this.getSvgPlanUrl();
            this.currentArchPlan = new ArchitecturalFloorPlan('desk-grid', currentFloorData, this.currentSensorMode, this.config.id, svgPath, this.isDashboard, floorsCount);
            this.loadRealOccupancyData();
        } else {
            console.error('ArchitecturalFloorPlan not loaded');
            this.load2DDesks(floorNumber);
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

    load2DDesks(floorNumber) {
        const deskGrid = document.getElementById('desk-grid');
        if (!deskGrid) return;

        const data = this.floorData[floorNumber];

        deskGrid.style.display = 'grid';
        deskGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        deskGrid.style.padding = '1.5rem';
        deskGrid.style.background = 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)';

        deskGrid.innerHTML = '';
        data.desks.forEach(desk => {
            const deskElement = document.createElement('div');
            deskElement.className = `desk ${desk.status}`;
            deskElement.setAttribute('data-desk', desk.id);
            deskElement.textContent = desk.id;
            deskElement.addEventListener('click', function() {
                alert(`Desk ${desk.id}\nStatus: ${desk.status}\n\nClick to view detailed information.`);
            });
            deskGrid.appendChild(deskElement);
        });
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
    }

    async loadConfig() {
        if (!this.buildingKey || this.buildingKey.trim() === '') return;
        
        const upper = this.buildingKey.toUpperCase();
        let dbId = null;
        if (upper.startsWith('DB:')) {
            dbId = parseInt(this.buildingKey.split(':')[1], 10);
        } else if (/^\d+$/.test(this.buildingKey)) {
            dbId = parseInt(this.buildingKey, 10);
        }

        if (!isNaN(dbId) && dbId !== null) {
            try {
                const resp = await fetch(`/api/buildings/${dbId}`);
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }
                const b = await resp.json();

                this.buildingKey = `DB:${dbId}`;
                this.isDbBuilding = true;
                this.dbShapeCache = null;
                this.dbBuildingConfig = {
                    id: b.id,
                    name: b.name,
                    floors: b.floorsCount || 1,
                    scale: b.scale || 0.01,
                    svgUrl: b.svgPlan
                };
                this.config = {
                    id: b.id,
                    floors: b.floorsCount || 1,
                    scale: b.scale || 0.01,
                    floorData: {}
                };

                this.config.floorData[0] = {
                    name: 'Ground Floor',
                    desks: [] //TODO load from DB?
                };
                for (let i = 1; i < b.floorsCount; i++) {
                    this.config.floorData[i] = {
                        name: 'Floor '+i,
                        desks: [] //TODO load from DB?
                    };
                }

                this.floorData = JSON.parse(JSON.stringify(this.config.floorData));

                console.log("Loaded DB building config:", this.dbBuildingConfig);
            } catch (e) {
                console.error("Erreur lors du chargement du bâtiment DB:", e);
            }
        } else {
            const key = upper;
            if (!BUILDINGS[key]) {
                console.warn('Unknown building key:', key);
                return;     
            } else {
                this.buildingKey = key;
            }

            this.isDbBuilding = false;
            this.dbBuildingConfig = null;
            this.dbShapeCache = null;

            this.config = BUILDINGS[this.buildingKey];
            this.floorData = JSON.parse(JSON.stringify(this.config.floorData));
        }
    }

    async setBuilding() {
        this.closeOccupancySSE();
        this.currentFloorNumber = null;
        this.isIn3DView = true;
        this.currentArchPlan = null;

        const container3D   = document.getElementById('building-3d-container');
        const floorPlan2D   = document.getElementById('floor-plan-2d');
        const backBtn       = document.getElementById('back-to-3d-btn');

        if (container3D) container3D.style.display = 'block';
        if (floorPlan2D) floorPlan2D.style.display = 'none';
        if (backBtn)     backBtn.style.display     = 'none';

        if (!this.buildingKey || this.buildingKey.trim() === '') {
            this.clearBuilding();
            this.showEmptyScene();
            return;
        }

        await this.createBuilding();
        this.resetCameraForBuilding();
        this.loadRealOccupancyData();
        this.openOccupancySSE();
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

    updateDeskData(floorNumber, desks) {
        if (this.floorData[floorNumber]) {
            this.floorData[floorNumber].desks = desks;
            if (!this.isIn3DView && this.currentFloorNumber === floorNumber) {
                this.load2DDesks(floorNumber);
            }
        }
    }

    getFloorsCount() {
        if (this.isDbBuilding && this.dbBuildingConfig?.floors) {
            return parseInt(this.dbBuildingConfig.floors, 10) || 1;
        }
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

    const siteAttr = container.dataset.site
        ? container.dataset.site.toUpperCase()
        : null;

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
                    //window.building3D.return3DView();
                    return;
                }
                const floorNumber = parseInt(floorSelect.value, 10);
                window.building3D.currentFloorNumber = floorNumber;
                window.building3D.switch2DFloorView(floorNumber);
            }
        });
    }

    const sizeInput = document.getElementById('sensor_size');
    const sensorID = document.getElementById('sensor_id');
    if (sizeInput && sensorID) {
        sizeInput.addEventListener('change', () => {
            if (window.building3D.currentArchPlan) {
                if (sizeInput.value === ""){
                    return;
                }
                if (!sensorID.value || sensorID.value.trim() === ''){
                    return;
                }
                const size = parseInt(sizeInput.value, 10);
                window.building3D.currentArchPlan.updateSensorSize(sensorID.value, size);
            }
        });
    }

    const buildingSelect = document.getElementById('filter-building');
    if (buildingSelect) {
        buildingSelect.addEventListener('change', async () => {
            let val = buildingSelect.value; // "chateaudun", "levallois", "lille", "all", "DB:4" ...

            if (val.toUpperCase() === 'ALL') {
                val = 'CHATEAUDUN';
            }

            if (window.building3D && typeof window.building3D.setBuilding === 'function') {
                window.building3D.buildingKey = val.toUpperCase();
                await window.building3D.loadConfig();
                window.building3D.setBuilding();
            }

            const labels = {
                CHATEAUDUN: 'Châteaudun Office',
                LEVALLOIS: 'Levallois Office'
            };
            const upperVal = val ? val.toUpperCase() : '';
            const label = labels[upperVal] || 'Office';

            const liveTitle     = document.getElementById('live-section-title');
            const histTitle     = document.getElementById('historical-section-title');
            const buildingTitle = document.getElementById('building-title');

            if (liveTitle)     liveTitle.textContent     = `📊 Live Desk Occupancy - ${label}`;
            if (histTitle)     histTitle.textContent     = `📈 Historical Sensor Data - ${label}`;
            if (buildingTitle) buildingTitle.textContent = `🏢 ${label} Building`;
        });
    }
});
