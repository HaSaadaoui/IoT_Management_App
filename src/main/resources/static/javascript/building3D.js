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

// Shape Levallois (arrondi à gauche + bloc rectangulaire en haut à droite)
function createLevalloisShape(scale = 1) {
    const shape = new THREE.Shape();

    // Dimensions de base
    const bodyLength    = 55 * scale;   // longueur open space
    const rectRightLen  = 20 * scale;   // profondeur bloc droit
    const halfDepth     = 10 * scale;   // demi-hauteur corps central
    const extraTop      = 10 * scale;   // dépassement du bloc droit vers le haut

    const radiusLeft = halfDepth;

    // Coordonnées clés
    const xBodyLeft   = -bodyLength / 2;
    const xBodyRight  =  bodyLength / 2;
    const xHeadRight  =  xBodyRight + rectRightLen;

    const yBottom     = -halfDepth;
    const yTop        =  halfDepth;
    const yHeadTop    =  yTop + extraTop;

    // 1) Coin bas droit bloc
    shape.moveTo(xHeadRight, yBottom);

    // 2) Bas bloc → bas corps
    shape.lineTo(xBodyRight, yBottom);

    // 3) Bas corps → bas arrondi gauche
    shape.lineTo(xBodyLeft, yBottom);

    // 4) Arrondi à gauche (demi-disque)
    shape.absarc(
        xBodyLeft,      // centre X
        0,              // centre Y
        radiusLeft,     // rayon
        -Math.PI / 2,   // départ en bas
        Math.PI / 2,    // fin en haut
        true            // sens horaire
    );

    // 5) Haut corps → haut droit corps
    shape.lineTo(xBodyRight, yTop);

    // 6) On monte pour former le bloc rectangulaire en haut
    shape.lineTo(xBodyRight, yHeadTop);

    // 7) Top du bloc droit
    shape.lineTo(xHeadRight, yHeadTop);

    // 8) Fermeture (retour au bas droit bloc)
    shape.lineTo(xHeadRight, yBottom);

    // Centre approximatif pour positionner le mesh
    const minX = xBodyLeft;
    const maxX = xHeadRight;
    const minY = yBottom;
    const maxY = yHeadTop;

    const centerX = (minX + maxX) / 2;
    const centerZ = (minY + maxY) / 2;

    return { shape, centerX, centerZ };
}

// Shape Lille : grand rectangle + extension triangulaire en haut
// Shape Lille : basée sur le path du SVG, centrée et triangulaire à droite
function createLilleShape(scale = 0.01) {
    const shape = new THREE.Shape();

    // Points bruts issus du SVG (layer2)
    const p1 = { x: 253.32256,  y: 736.20180 }; // bas gauche
    const p2 = { x: 934.43075,  y: 186.88615 }; // haut "gauche"
    const p3 = { x: 1487.52730, y: 186.34602 }; // haut droite
    const p4 = { x: 1486.98720, y: 736.20180 }; // bas droite

    // On calcule le centre du trapèze pour le recentrer autour de (0,0)
    const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
    const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
    const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
    const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Helper : recentrer + mettre à l'échelle + flip horizontal
    function mapAndFlip(pt) {
        const localX = (pt.x - cx) * scale;  // recentré
        const localY = (pt.y - cy) * scale;  // recentré
        const flippedX = -localX;            // flip horizontal → triangle passe à droite
        return { x: flippedX, y: localY };
    }

    const q1 = mapAndFlip(p1);
    const q2 = mapAndFlip(p2);
    const q3 = mapAndFlip(p3);
    const q4 = mapAndFlip(p4);

    // Dessin dans l'ordre
    shape.moveTo(q1.x, q1.y);
    shape.lineTo(q2.x, q2.y);
    shape.lineTo(q3.x, q3.y);
    shape.lineTo(q4.x, q4.y);
    shape.lineTo(q1.x, q1.y); // fermeture

    // On est déjà centré autour de (0,0)
    const centerX = 0;
    const centerZ = 0;

    return { shape, centerX, centerZ };
}


// ================== FLOOR DATA ==================

const BASE_FLOOR_DATA = {
    0: {
        name: 'Ground Floor',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y:  2 },
            { id: 'D06', status: 'invalid', x: -1, y:  2 },
            { id: 'D07', status: 'invalid', x:  1, y:  2 },
            { id: 'D08', status: 'invalid', x:  3, y:  2 }
        ]
    },
    1: {
        name: 'Floor 1',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y:  0 },
            { id: 'D06', status: 'invalid', x: -1, y:  0 },
            { id: 'D07', status: 'invalid', x:  1, y:  0 },
            { id: 'D08', status: 'invalid', x:  3, y:  0 },
            { id: 'D09', status: 'invalid', x: -3, y:  2 },
            { id: 'D10', status: 'invalid', x: -1, y:  2 },
            { id: 'D11', status: 'invalid', x:  1, y:  2 },
            { id: 'D12', status: 'invalid', x:  3, y:  2 }
        ]
    },
    2: {
        name: 'Floor 2',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y: -0.5 },
            { id: 'D06', status: 'invalid', x: -1, y: -0.5 },
            { id: 'D07', status: 'invalid', x:  1, y: -0.5 },
            { id: 'D08', status: 'invalid', x:  3, y: -0.5 },
            { id: 'D09', status: 'invalid', x: -3, y:  1 },
            { id: 'D10', status: 'invalid', x: -1, y:  1 },
            { id: 'D11', status: 'invalid', x:  1, y:  1 },
            { id: 'D12', status: 'invalid', x:  3, y:  1 },
            { id: 'D13', status: 'invalid', x: -3, y:  2.5 },
            { id: 'D14', status: 'invalid', x: -1, y:  2.5 },
            { id: 'D15', status: 'invalid', x:  1, y:  2.5 },
            { id: 'D16', status: 'invalid', x:  3, y:  2.5 }
        ]
    },
    3: {
        name: 'Floor 3',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y:  0 },
            { id: 'D06', status: 'invalid', x: -1, y:  0 },
            { id: 'D07', status: 'invalid', x:  1, y:  0 },
            { id: 'D08', status: 'invalid', x:  3, y:  0 },
            { id: 'D09', status: 'invalid', x: -3, y:  2 },
            { id: 'D10', status: 'invalid', x: -1, y:  2 },
            { id: 'D11', status: 'invalid', x:  1, y:  2 },
            { id: 'D12', status: 'invalid', x:  3, y:  2 }
        ]
    },
    4: {
        name: 'Floor 4',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y: -0.5 },
            { id: 'D06', status: 'invalid', x: -1, y: -0.5 },
            { id: 'D07', status: 'invalid', x:  1, y: -0.5 },
            { id: 'D08', status: 'invalid', x:  3, y: -0.5 },
            { id: 'D09', status: 'invalid', x: -3, y:  1 },
            { id: 'D10', status: 'invalid', x: -1, y:  1 },
            { id: 'D11', status: 'invalid', x:  1, y:  1 },
            { id: 'D12', status: 'invalid', x:  3, y:  1 }
        ]
    },
    5: {
        name: 'Floor 5',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y:  0 },
            { id: 'D06', status: 'invalid', x: -1, y:  0 },
            { id: 'D07', status: 'invalid', x:  1, y:  0 },
            { id: 'D08', status: 'invalid', x:  3, y:  0 },
            { id: 'D09', status: 'invalid', x: -3, y:  2 },
            { id: 'D10', status: 'invalid', x: -1, y:  2 },
            { id: 'D11', status: 'invalid', x:  1, y:  2 },
            { id: 'D12', status: 'invalid', x:  3, y:  2 }
        ]
    },
    6: {
        name: 'Floor 6',
        desks: [
            { id: 'D01', status: 'invalid', x: -3, y: -2 },
            { id: 'D02', status: 'invalid', x: -1, y: -2 },
            { id: 'D03', status: 'invalid', x:  1, y: -2 },
            { id: 'D04', status: 'invalid', x:  3, y: -2 },
            { id: 'D05', status: 'invalid', x: -3, y:  0 },
            { id: 'D06', status: 'invalid', x: -1, y:  0 },
            { id: 'D07', status: 'invalid', x:  1, y:  0 },
            { id: 'D08', status: 'invalid', x:  3, y:  0 },
            { id: 'D09', status: 'invalid', x: -3, y:  2 },
            { id: 'D10', status: 'invalid', x: -1, y:  2 },
            { id: 'D11', status: 'invalid', x:  1, y:  2 },
            { id: 'D12', status: 'invalid', x:  3, y:  2 }
        ]
    }
};

// FloorData par site
const CHATEAUDUN_FLOOR_DATA = JSON.parse(JSON.stringify(BASE_FLOOR_DATA));

const LEVALLOIS_FLOOR_DATA = JSON.parse(JSON.stringify(BASE_FLOOR_DATA));
LEVALLOIS_FLOOR_DATA[0].name = 'Levallois - Ground';

const LILLE_FLOOR_DATA = JSON.parse(JSON.stringify(BASE_FLOOR_DATA));
LILLE_FLOOR_DATA[0].name = 'Lille - Ground';

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
        floors: 1,              // un seul étage modélisé
        scale: 0.06,
        createShape: createLevalloisShape,
        floorData: LEVALLOIS_FLOOR_DATA
    },
LILLE: {
    id: 'LILLE',
    floors: 4,
    scale: 0.01,
    createShape: createLilleShape,
    floorData: LILLE_FLOOR_DATA
}

};

// ================== CLASS BUILDING3D ==================

class Building3D {
    constructor(containerId, buildingKey = 'CHATEAUDUN') {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById('building-canvas');

        this.buildingKey = buildingKey.toUpperCase();
        this.config = BUILDINGS[this.buildingKey] || BUILDINGS.CHATEAUDUN;

        this.floorData = JSON.parse(JSON.stringify(this.config.floorData));

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
        this.loadRealOccupancyData();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        this.createBuilding();
        this.resetCameraForBuilding();
        this.setupEventListeners();
        this.animate();
    }

    async loadRealOccupancyData() {
        console.log('=== Loading Real Occupancy Data for', this.buildingKey, '===');

        for (const [floorKey, floorInfo] of Object.entries(this.floorData)) {
            const floorIndex = parseInt(floorKey, 10);
            const apiFloor = floorIndex + 1;

            try {
                const response = await fetch(`/api/dashboard/occupancy?floor=${apiFloor}`);
                // const response = await fetch(`/api/dashboard/occupancy?site=${this.config.id}&floor=${apiFloor}`);

                if (!response.ok) {
                    console.warn(`Failed to fetch occupancy data for floor ${apiFloor}: ${response.status}`);
                    continue;
                }

                const occupancyData = await response.json();
                const deskStatusMap = new Map();
                occupancyData.forEach(desk => deskStatusMap.set(desk.id, desk.status));

                floorInfo.desks.forEach((desk) => {
                    const paddedFloor = String(apiFloor).padStart(2, '0');
                    const deskNumber = desk.id.replace('D', '');
                    const paddedDesk = deskNumber.padStart(2, '0');

                    const expectedIdDesk  = `desk-${paddedFloor}-${paddedDesk}`;
                    const expectedIdVS40  = `desk-vs40-${paddedFloor}-${paddedDesk}`;
                    const expectedIdVS41  = `desk-vs41-${paddedFloor}-${paddedDesk}`;

                    if (deskStatusMap.has(expectedIdDesk) ||
                        deskStatusMap.has(expectedIdVS40) ||
                        deskStatusMap.has(expectedIdVS41)) {

                        const newStatus =
                            deskStatusMap.get(expectedIdDesk) ||
                            deskStatusMap.get(expectedIdVS40) ||
                            deskStatusMap.get(expectedIdVS41);

                        desk.status = newStatus;

                        if (this.currentArchPlan) {
                            this.currentArchPlan.deskOccupancy[desk.id] = newStatus;
                        }
                    }
                });

                if (this.currentArchPlan) {
                    this.currentArchPlan.drawFloorPlan();
                }

            } catch (err) {
                console.error(`Error loading occupancy data for floor ${apiFloor}:`, err);
            }
        }

        if (this.hoveredFloor && this.isIn3DView) {
            this.showFloorInfo(this.hoveredFloor.userData.floorNumber);
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

        if (this.buildingKey === 'LEVALLOIS') {
            this.camera.position.set(8, 6, 8);
            this.controls.target.set(0, 2, 0);
            this.controls.minDistance = 3;
            this.controls.maxDistance = 15;
        } else if (this.buildingKey === 'LILLE') {
            // Lille : bâtiment plus large, on recule un peu
            this.camera.position.set(14, 9, 14);
            this.controls.target.set(0, 3, 0);
            this.controls.minDistance = 6;
            this.controls.maxDistance = 25;
        } else {
            this.camera.position.set(20, 18, 20);
            this.controls.target.set(0, 5, 0);
            this.controls.minDistance = 8;
            this.controls.maxDistance = 40;
        }

        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    createBuilding() {
        this.building = new THREE.Group();

        const floorHeight = 3;
        const { shape: buildingShape, centerX, centerZ } =
            this.config.createShape(this.config.scale);
        const floorsCount = this.config.floors;

        // reset
        this.floors = [];
        this.roofs  = [];

        for (let i = 0; i < floorsCount; i++) {
            const floorGroup = new THREE.Group();
            floorGroup.userData = { floorNumber: i, type: 'floor' };

            const extrudeSettings = { depth: 0.3, bevelEnabled: false };

            // Plateau
            const floorGeometry = new THREE.ExtrudeGeometry(buildingShape, extrudeSettings);
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

            // Murs translucides
            const wallExtrudeSettings = { depth: floorHeight, bevelEnabled: false };
            const wallGeometry = new THREE.ExtrudeGeometry(buildingShape, wallExtrudeSettings);
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

            // Toit
            const roofGeometry = new THREE.ExtrudeGeometry(buildingShape, extrudeSettings);
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

            // Edges
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

        // Sol & grille (une seule fois)
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
                this.enterFloor(floor.userData.floorNumber);
                this.loadRealOccupancyData();
            }
        }
    }

    showFloorInfo(floorNumber) {
        const overlay = document.getElementById('floor-info-overlay');
        if (!overlay) return;

        const data = this.floorData[floorNumber];
        const freeDesks = data.desks.filter(d => d.status === 'free').length;
        const usedDesks = data.desks.filter(d => d.status === 'used').length;

        overlay.innerHTML = `
            <h4 style="margin:0 0 0.5rem;color:#662179;font-size:1rem;">${data.name}</h4>
            <p style="margin:0.25rem 0;font-size:0.9rem;">Total Desks: ${data.desks.length}</p>
            <p style="margin:0.25rem 0;font-size:0.9rem;color:#10b981;">🟢 Free: ${freeDesks}</p>
            <p style="margin:0.25rem 0;font-size:0.9rem;color:#ef4444;">🔴 Used: ${usedDesks}</p>
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

        // Clear the desk grid container
        deskGrid.innerHTML = '';
        deskGrid.style.display = 'block';
        deskGrid.style.gridTemplateColumns = '1fr';
        deskGrid.style.padding = '0';
        deskGrid.style.background = '#ffffff';
        deskGrid.style.borderRadius = '12px';
        deskGrid.style.border = '2px solid #e2e8f0';
        deskGrid.style.minHeight = '600px';

        const floorData = {
            floorNumber: floorNumber,
            name: this.floorData[floorNumber].name,
            desks: this.floorData[floorNumber].desks
        };

        if (window.ArchitecturalFloorPlan) {
            this.currentArchPlan = new ArchitecturalFloorPlan('desk-grid', floorData, this.currentSensorMode);

            if (this.currentSensorMode === 'DESK') {
                this.currentArchPlan.loadDeskOccupancy();
            }
        } else {
            console.error('ArchitecturalFloorPlan not loaded');
            this.load2DDesks(floorNumber);
        }

        this.updateFloorTitle(floorNumber);
    }

    updateFloorTitle(floorNumber) {
        const titleEl = document.getElementById('current-floor-title');
        if (!titleEl) return;

        const data = this.floorData[floorNumber];
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
        const title = `${data.name} - ${label} Visualization`;
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

        // Reset roof
        if (this.currentFloorNumber !== null && this.roofs[this.currentFloorNumber]) {
            const roof = this.roofs[this.currentFloorNumber];
            const targetY = this.currentFloorNumber * 3 + 3;

            gsap.to(roof.position, {
                y: targetY,
                duration: 1,
                ease: 'power2.inOut'
            });

            gsap.to(roof.material, {
                opacity: 1,
                duration: 0.8,
                ease: 'power2.inOut',
                onStart: () => { roof.material.transparent = false; }
            });
        }

        // caméra adaptée au building courant
        let camPos, target;
        if (this.buildingKey === 'LEVALLOIS') {
            camPos = { x: 8,  y: 6,  z: 8 };
            target = { x: 0,  y: 2,  z: 0 };
        } else if (this.buildingKey === 'LILLE') {
            camPos = { x: 14, y: 9, z: 14 };
            target = { x: 0,  y: 3, z: 0 };
        } else {
            camPos = { x: 20, y: 18, z: 20 };
            target = { x: 0,  y: 5,  z: 0 };
        }

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

    setBuilding(buildingKey) {
        const key = (buildingKey || 'CHATEAUDUN').toUpperCase();

        if (!BUILDINGS[key]) {
            console.warn('Unknown building key:', key);
            return;
        }

        this.buildingKey = key;
        this.config = BUILDINGS[this.buildingKey];

        this.floorData = JSON.parse(JSON.stringify(this.config.floorData));

        this.currentFloorNumber = null;
        this.isIn3DView = true;
        this.currentArchPlan = null;

        const container3D   = document.getElementById('building-3d-container');
        const floorPlan2D   = document.getElementById('floor-plan-2d');
        const backBtn       = document.getElementById('back-to-3d-btn');

        if (container3D) container3D.style.display = 'block';
        if (floorPlan2D) floorPlan2D.style.display = 'none';
        if (backBtn)     backBtn.style.display     = 'none';

        if (this.building) {
            this.scene.remove(this.building);
        }
        this.building = null;
        this.floors = [];
        this.roofs  = [];

        this.createBuilding();
        this.resetCameraForBuilding();
        this.loadRealOccupancyData();
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

    const siteAttr = (container.dataset.site || 'CHATEAUDUN').toUpperCase();
    window.building3D = new Building3D('building-3d-container', siteAttr);
    console.log('3D Building Digital Twin initialized for site:', siteAttr);

    // Select "Sensor Type"
    const sensorSelect = document.getElementById('filter-sensor-type');
    if (sensorSelect) {
        sensorSelect.addEventListener('change', () => {
            if (window.building3D) {
                window.building3D.setSensorMode(sensorSelect.value);
            }
        });
    }

    const buildingSelect = document.getElementById('filter-building');
    if (buildingSelect) {
        buildingSelect.addEventListener('change', () => {
            let val = buildingSelect.value.toUpperCase(); // "CHATEAUDUN", "LEVALLOIS", "LILLE", "ALL"

            if (val === 'ALL') {
                val = 'CHATEAUDUN'; // fallback
            }

            if (window.building3D && typeof window.building3D.setBuilding === 'function') {
                window.building3D.setBuilding(val);
            }

            const labels = {
                CHATEAUDUN: 'Châteaudun Office',
                LEVALLOIS: 'Levallois Office',
                LILLE: 'Lille Office'
            };
            const label = labels[val] || 'Office';

            const liveTitle     = document.getElementById('live-section-title');
            const histTitle     = document.getElementById('historical-section-title');
            const buildingTitle = document.getElementById('building-title');

            if (liveTitle)     liveTitle.textContent     = `📊 Live Desk Occupancy - ${label}`;
            if (histTitle)     histTitle.textContent     = `📈 Historical Sensor Data - ${label}`;
            if (buildingTitle) buildingTitle.textContent = `🏢 ${label} Building`;
        });
    }
});
