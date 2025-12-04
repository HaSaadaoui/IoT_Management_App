// ===== 3D BUILDING DIGITAL TWIN VISUALIZATION =====

class Building3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById('building-canvas');
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Building components
        this.building = null;
        this.floors = [];
        this.roofs = [];
        this.hoveredFloor = null;
        this.selectedFloor = null;
        
        // State
        this.isIn3DView = true;
        this.currentFloorNumber = null;
        this.currentSensorMode = 'DESK';
        
        // Colors
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
        
        // Floor data
        this.floorData = {
            0: {
                name: 'Ground Floor',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: 2 },
                    { id: 'D06', status: 'invalid', x: -1, y: 2 },
                    { id: 'D07', status: 'invalid', x: 1, y: 2 },
                    { id: 'D08', status: 'invalid', x: 3, y: 2 }
                ]
            },
            1: {
                name: 'Floor 1',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: 0 },
                    { id: 'D06', status: 'invalid', x: -1, y: 0 },
                    { id: 'D07', status: 'invalid', x: 1, y: 0 },
                    { id: 'D08', status: 'invalid', x: 3, y: 0 },
                    { id: 'D09', status: 'invalid', x: -3, y: 2 },
                    { id: 'D10', status: 'invalid', x: -1, y: 2 },
                    { id: 'D11', status: 'invalid', x: 1, y: 2 },
                    { id: 'D12', status: 'invalid', x: 3, y: 2 }
                ]
            },
            2: {
                name: 'Floor 2',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: -0.5 },
                    { id: 'D06', status: 'invalid', x: -1, y: -0.5 },
                    { id: 'D07', status: 'invalid', x: 1, y: -0.5 },
                    { id: 'D08', status: 'invalid', x: 3, y: -0.5 },
                    { id: 'D09', status: 'invalid', x: -3, y: 1 },
                    { id: 'D10', status: 'invalid', x: -1, y: 1 },
                    { id: 'D11', status: 'invalid', x: 1, y: 1 },
                    { id: 'D12', status: 'invalid', x: 3, y: 1 },
                    { id: 'D13', status: 'invalid', x: -3, y: 2.5 },
                    { id: 'D14', status: 'invalid', x: -1, y: 2.5 },
                    { id: 'D15', status: 'invalid', x: 1, y: 2.5 },
                    { id: 'D16', status: 'invalid', x: 3, y: 2.5 }
                ]
            },
            3: {
                name: 'Floor 3',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: 0 },
                    { id: 'D06', status: 'invalid', x: -1, y: 0 },
                    { id: 'D07', status: 'invalid', x: 1, y: 0 },
                    { id: 'D08', status: 'invalid', x: 3, y: 0 },
                    { id: 'D09', status: 'invalid', x: -3, y: 2 },
                    { id: 'D10', status: 'invalid', x: -1, y: 2 },
                    { id: 'D11', status: 'invalid', x: 1, y: 2 },
                    { id: 'D12', status: 'invalid', x: 3, y: 2 }
                ]
            },
            4: {
                name: 'Floor 4',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: -0.5 },
                    { id: 'D06', status: 'invalid', x: -1, y: -0.5 },
                    { id: 'D07', status: 'invalid', x: 1, y: -0.5 },
                    { id: 'D08', status: 'invalid', x: 3, y: -0.5 },
                    { id: 'D09', status: 'invalid', x: -3, y: 1 },
                    { id: 'D10', status: 'invalid', x: -1, y: 1 },
                    { id: 'D11', status: 'invalid', x: 1, y: 1 },
                    { id: 'D12', status: 'invalid', x: 3, y: 1 }
                ]
            },
            5: {
                name: 'Floor 5',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: 0 },
                    { id: 'D06', status: 'invalid', x: -1, y: 0 },
                    { id: 'D07', status: 'invalid', x: 1, y: 0 },
                    { id: 'D08', status: 'invalid', x: 3, y: 0 },
                    { id: 'D09', status: 'invalid', x: -3, y: 2 },
                    { id: 'D10', status: 'invalid', x: -1, y: 2 },
                    { id: 'D11', status: 'invalid', x: 1, y: 2 },
                    { id: 'D12', status: 'invalid', x: 3, y: 2 }
                ]
            },
            6: {
                name: 'Floor 6',
                desks: [
                    { id: 'D01', status: 'invalid', x: -3, y: -2 },
                    { id: 'D02', status: 'invalid', x: -1, y: -2 },
                    { id: 'D03', status: 'invalid', x: 1, y: -2 },
                    { id: 'D04', status: 'invalid', x: 3, y: -2 },
                    { id: 'D05', status: 'invalid', x: -3, y: 0 },
                    { id: 'D06', status: 'invalid', x: -1, y: 0 },
                    { id: 'D07', status: 'invalid', x: 1, y: 0 },
                    { id: 'D08', status: 'invalid', x: 3, y: 0 },
                    { id: 'D09', status: 'invalid', x: -3, y: 2 },
                    { id: 'D10', status: 'invalid', x: -1, y: 2 },
                    { id: 'D11', status: 'invalid', x: 1, y: 2 },
                    { id: 'D12', status: 'invalid', x: 3, y: 2 }
                ]
            }
        };
        
        this.init();
        // this.loadRealOccupancyData();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        this.createBuilding();
        this.setupEventListeners();
        this.animate();
    }

    getDeskSensor(floorNumber, deskId) {
        // Use shared configuration for desk-sensor mapping
        return window.DeskSensorConfig
            ? window.DeskSensorConfig.getSensor(floorNumber, deskId)
            : null;
    }

    async loadRealOccupancyData() {
        console.log('=== Loading Real Occupancy Data for 3D Building ===');

        // Only load data for the current floor if in 2D view
        if (!this.isIn3DView && this.currentFloorNumber !== null) {
            const floorNumber = this.currentFloorNumber; // TODO: Check off-by-one error
            const floorInfo = this.floorData[this.currentFloorNumber];

            try {
                // Fetch occupancy data for this floor using the dashboard API
                const response = await fetch(`/api/dashboard/occupancy?floor=${floorNumber}`);

                if (response.ok) {
                    const occupancyData = await response.json();
                    console.log(`Floor ${floorNumber} occupancy data:`, occupancyData);

                    // Create a map of desk statuses
                    const deskStatusMap = new Map();
                    occupancyData.forEach(desk => {
                        deskStatusMap.set(desk.id, desk.status);
                    });

                    // Create temporary deskOccupancy object for this floor
                    const deskOccupancy = {};

                    // Update desk statuses in floor data
                    Object.values(floorInfo.desks).forEach((desk) => {
                        // Get the sensor ID from the desk configuration
                        const sensorId = this.getDeskSensor(this.currentFloorNumber, desk.id);

                        // Look for matching desk in API response
                        if (sensorId && deskStatusMap.has(sensorId)) {
                            const newStatus = deskStatusMap.get(sensorId);
                            desk.status = newStatus;
                            // Store in temporary variable
                            deskOccupancy[desk.id] = newStatus;
                            console.log(`Updated ${desk.id} (sensor: ${sensorId}): ${newStatus}`);
                        }
                    });

                    // Pass deskOccupancy to drawFloorPlan
                    if (this.currentArchPlan) {
                        this.currentArchPlan.drawFloorPlan(deskOccupancy);
                    }

                    console.log('=== Real Occupancy Data Loaded for Floor', floorNumber, '===');
                } else {
                    console.warn(`Failed to fetch occupancy data for floor ${floorNumber}: ${response.status}`);
                }
            } catch (error) {
                console.error(`Error loading occupancy data for floor ${floorNumber}:`, error);
            }
        } else {
            // In 3D view, update all floors for the hover info
            for (let [floorNumberKey, floorInfo] of Object.entries(this.floorData)) {
                const floorNumber = parseInt(floorNumberKey, 10) + 1;
                try {
                    const response = await fetch(`/api/dashboard/occupancy?floor=${floorNumber}`);

                    if (response.ok) {
                        const occupancyData = await response.json();
                        const deskStatusMap = new Map();
                        occupancyData.forEach(desk => {
                            deskStatusMap.set(desk.id, desk.status);
                        });

                        // Update desk statuses in floor data
                        Object.values(floorInfo.desks).forEach((desk) => {
                            const sensorId = this.getDeskSensor(parseInt(floorNumberKey, 10), desk.id);
                            if (sensorId && deskStatusMap.has(sensorId)) {
                                desk.status = deskStatusMap.get(sensorId);
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Error loading occupancy data for floor ${floorNumber}:`, error);
                }
            }

            console.log('=== Real Occupancy Data Loaded for All Floors ===');

            // Refresh the floor info overlay if currently hovering over a floor
            if (this.hoveredFloor && this.isIn3DView) {
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
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
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
        
        // Hemisphere light
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        hemiLight.position.set(0, 20, 0);
        this.scene.add(hemiLight);
        
        // Point lights for accent
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
    
    createBuilding() {
        this.building = new THREE.Group();
        
        const floorHeight = 3;
        const scale = 0.01; // Scale down from SVG coordinates (1100x500) to 3D (11x5)
        
        // Define angular building shape (from 2D floor plan)
        // SVG coordinates: x: 50-1050, y: 50-450
        const buildingShape = new THREE.Shape();
        buildingShape.moveTo(50 * scale, 50 * scale);
        buildingShape.lineTo(950 * scale, 50 * scale);
        buildingShape.lineTo(1050 * scale, 50 * scale);
        buildingShape.lineTo(1050 * scale, 450 * scale);
        buildingShape.lineTo(200 * scale, 280 * scale);
        buildingShape.lineTo(50 * scale, 200 * scale);
        buildingShape.lineTo(50 * scale, 50 * scale);
        
        // Center the shape (shift by half of bounding box)
        const centerX = (50 + 1050) * scale / 2;
        const centerZ = (50 + 450) * scale / 2;
        
        // Create 7 floors (0-6)
        for (let i = 0; i < 7; i++) {
            const floorGroup = new THREE.Group();
            floorGroup.userData = { floorNumber: i, type: 'floor' };
            
            // Floor base (extruded shape)
            const extrudeSettings = {
                depth: 0.3,
                bevelEnabled: false
            };
            const floorGeometry = new THREE.ExtrudeGeometry(buildingShape, extrudeSettings);
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.floorBase,
                metalness: 0.1,
                roughness: 0.8
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2; // Rotate to horizontal
            floor.position.set(-centerX, i * floorHeight, -centerZ);
            floor.castShadow = true;
            floor.receiveShadow = true;
            floor.userData = { floorNumber: i, type: 'floor', clickable: true };
            floorGroup.add(floor);
            this.floors.push(floor);
            
            // Walls (extruded outline)
            const wallExtrudeSettings = {
                depth: floorHeight,
                bevelEnabled: false
            };
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
            
            // Roof
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
            
            // Add purple accent edges
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
        
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.1,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Grid helper
        const gridHelper = new THREE.GridHelper(50, 50, this.colors.primary, 0x334155);
        gridHelper.position.y = -0.4;
        this.scene.add(gridHelper);
        
        this.scene.add(this.building);
    }
    
    setupEventListeners() {
        // Mouse move for hover
        this.canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
        
        // Click for selection
        this.canvas.addEventListener('click', (event) => this.onMouseClick(event));
        
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    onMouseMove(event) {
        if (!this.isIn3DView) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.floors);
        
        // Reset previous hover
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
        const data = this.floorData[floorNumber];
        const freeDesks = data.desks.filter(d => d.status === 'free').length;
        const usedDesks = data.desks.filter(d => d.status === 'used').length;
        
        overlay.innerHTML = `
            <h4 style="margin: 0 0 0.5rem; color: var(--primary); font-size: 1rem;">${data.name}</h4>
            <p style="margin: 0.25rem 0; font-size: 0.9rem;">Total Desks: ${data.desks.length}</p>
            <p style="margin: 0.25rem 0; font-size: 0.9rem; color: #10b981;">🟢 Free: ${freeDesks}</p>
            <p style="margin: 0.25rem 0; font-size: 0.9rem; color: #ef4444;">🔴 Used: ${usedDesks}</p>
            <p style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">Click to enter</p>
        `;
        overlay.classList.add('active');
    }
    
    hideFloorInfo() {
        const overlay = document.getElementById('floor-info-overlay');
        overlay.classList.remove('active');
    }
    
    enterFloor(floorNumber) {
        this.currentFloorNumber = floorNumber;
        const data = this.floorData[floorNumber];
        
        // Animate roof opening
        const roof = this.roofs[floorNumber];
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
        
        // Animate camera
        const targetY = floorNumber * 3 + 1.5;
        gsap.to(this.camera.position, {
            x: 0,
            y: targetY + 15,
            z: 0,
            duration: 1.5,
            ease: 'power2.inOut',
            onComplete: () => {
                this.switch2DFloorView(floorNumber);
            }
        });
        
        gsap.to(this.controls.target, {
            x: 0,
            y: targetY,
            z: 0,
            duration: 1.5,
            ease: 'power2.inOut'
        });
    }
    
    switch2DFloorView(floorNumber) {
        this.isIn3DView = false;
        
        // Hide 3D container
        document.getElementById('building-3d-container').style.display = 'none';
        
        // Show 2D floor plan
        const floorPlan2D = document.getElementById('floor-plan-2d');
        floorPlan2D.style.display = 'block';
        
        // Update title
        const data = this.floorData[floorNumber];
        document.getElementById('current-floor-title').textContent = `${data.name} - Architectural Ceiling View`;
        
        // Show back button
        document.getElementById('back-to-3d-btn').style.display = 'block';
        
        // Load architectural floor plan
        this.loadArchitecturalPlan(floorNumber);
    }
    
    loadArchitecturalPlan(floorNumber) {
        // Clear the desk grid container
        const deskGrid = document.getElementById('desk-grid');
        deskGrid.innerHTML = '';
        deskGrid.style.display = 'block';
        deskGrid.style.gridTemplateColumns = '1fr';
        deskGrid.style.padding = '0';
        deskGrid.style.background = '#ffffff';
        deskGrid.style.borderRadius = '12px';
        deskGrid.style.border = '2px solid #e2e8f0';
        deskGrid.style.minHeight = '600px';
        
        // Create architectural floor plan
        const floorData = {
            floorNumber: floorNumber,
            name: this.floorData[floorNumber].name,
            desks: this.floorData[floorNumber].desks
        };
        
        // Initialize architectural plan with sensor mode
        if (window.ArchitecturalFloorPlan) {
            this.currentArchPlan = new ArchitecturalFloorPlan('desk-grid', floorData, this.currentSensorMode);

            // Load real occupancy data from API
            this.loadRealOccupancyData();
        } else {
            console.error('ArchitecturalFloorPlan not loaded');
            // Fallback to simple grid
            this.load2DDesks(floorNumber);
        }
        
        // Update title with sensor type
        this.updateFloorTitle(floorNumber);
    }
    
    updateFloorTitle(floorNumber) {
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
        const title = `${data.name} - ${sensorNames[this.currentSensorMode]} Visualization`;
        document.getElementById('current-floor-title').textContent = title;
    }
    
    setSensorMode(mode) {
        this.currentSensorMode = mode;
        // If in 2D view, reload with new sensor mode
        if (!this.isIn3DView && this.currentFloorNumber !== null) {
            this.loadArchitecturalPlan(this.currentFloorNumber);
        }
    }

    // Public method to refresh desk occupancy data
    refreshDeskOccupancy() {
        if (this.currentArchPlan && this.currentSensorMode === 'DESK') {
            this.currentArchPlan.loadDeskOccupancy();
        }
    }
    
    load2DDesks(floorNumber) {
        const deskGrid = document.getElementById('desk-grid');
        const data = this.floorData[floorNumber];
        
        // Reset grid styles
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
        
        // Show 3D container
        document.getElementById('building-3d-container').style.display = 'block';
        
        // Hide 2D floor plan
        document.getElementById('floor-plan-2d').style.display = 'none';
        
        // Hide back button
        document.getElementById('back-to-3d-btn').style.display = 'none';
        
        // Reset roof
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
            ease: 'power2.inOut'
        });
        
        // Reset camera
        gsap.to(this.camera.position, {
            x: 15,
            y: 12,
            z: 15,
            duration: 1.5,
            ease: 'power2.inOut'
        });
        
        gsap.to(this.controls.target, {
            x: 0,
            y: 5,
            z: 0,
            duration: 1.5,
            ease: 'power2.inOut'
        });
        
        this.currentFloorNumber = null;
    }
    
    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        // Subtle building rotation animation
        if (this.building && this.isIn3DView) {
            this.building.rotation.y += 0.0005;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // Public method to update desk data in real-time
    updateDeskData(floorNumber, desks) {
        if (this.floorData[floorNumber]) {
            this.floorData[floorNumber].desks = desks;
            
            // If currently viewing this floor in 2D, update display
            if (!this.isIn3DView && this.currentFloorNumber === floorNumber) {
                this.load2DDesks(floorNumber);
            }
        }
    }
}

// Global function for back button
function return3DView() {
    if (window.building3D) {
        window.building3D.return3DView();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the container to be ready
    setTimeout(() => {
        window.building3D = new Building3D('building-3d-container');
        console.log('3D Building Digital Twin initialized');
    }, 100);
});
