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
                    { id: 'D1', status: 'free', x: -3, y: -2 },
                    { id: 'D2', status: 'used', x: -1, y: -2 },
                    { id: 'D3', status: 'free', x: 1, y: -2 },
                    { id: 'D4', status: 'free', x: 3, y: -2 },
                    { id: 'D5', status: 'used', x: -3, y: 2 },
                    { id: 'D6', status: 'free', x: -1, y: 2 },
                    { id: 'D7', status: 'free', x: 1, y: 2 },
                    { id: 'D8', status: 'used', x: 3, y: 2 }
                ]
            },
            1: {
                name: 'Floor 1',
                desks: [
                    { id: 'D1', status: 'free', x: -3, y: -2 },
                    { id: 'D2', status: 'used', x: -1, y: -2 },
                    { id: 'D3', status: 'free', x: 1, y: -2 },
                    { id: 'D4', status: 'invalid', x: 3, y: -2 },
                    { id: 'D5', status: 'free', x: -3, y: 0 },
                    { id: 'D6', status: 'used', x: -1, y: 0 },
                    { id: 'D7', status: 'free', x: 1, y: 0 },
                    { id: 'D8', status: 'free', x: 3, y: 0 },
                    { id: 'D9', status: 'used', x: -3, y: 2 },
                    { id: 'D10', status: 'free', x: -1, y: 2 },
                    { id: 'D11', status: 'used', x: 1, y: 2 },
                    { id: 'D12', status: 'free', x: 3, y: 2 }
                ]
            },
            2: {
                name: 'Floor 2',
                desks: [
                    { id: 'D1', status: 'free', x: -3, y: -2 },
                    { id: 'D2', status: 'free', x: -1, y: -2 },
                    { id: 'D3', status: 'used', x: 1, y: -2 },
                    { id: 'D4', status: 'free', x: 3, y: -2 },
                    { id: 'D5', status: 'used', x: -3, y: -0.5 },
                    { id: 'D6', status: 'free', x: -1, y: -0.5 },
                    { id: 'D7', status: 'free', x: 1, y: -0.5 },
                    { id: 'D8', status: 'used', x: 3, y: -0.5 },
                    { id: 'D9', status: 'free', x: -3, y: 1 },
                    { id: 'D10', status: 'used', x: -1, y: 1 },
                    { id: 'D11', status: 'free', x: 1, y: 1 },
                    { id: 'D12', status: 'free', x: 3, y: 1 },
                    { id: 'D13', status: 'used', x: -3, y: 2.5 },
                    { id: 'D14', status: 'free', x: -1, y: 2.5 },
                    { id: 'D15', status: 'free', x: 1, y: 2.5 },
                    { id: 'D16', status: 'used', x: 3, y: 2.5 }
                ]
            },
            3: {
                name: 'Floor 3',
                desks: [
                    { id: 'D1', status: 'free', x: -3, y: -2 },
                    { id: 'D2', status: 'free', x: -1, y: -2 },
                    { id: 'D3', status: 'free', x: 1, y: -2 },
                    { id: 'D4', status: 'used', x: 3, y: -2 },
                    { id: 'D5', status: 'free', x: -3, y: 0 },
                    { id: 'D6', status: 'free', x: -1, y: 0 },
                    { id: 'D7', status: 'used', x: 1, y: 0 },
                    { id: 'D8', status: 'free', x: 3, y: 0 },
                    { id: 'D9', status: 'free', x: -3, y: 2 },
                    { id: 'D10', status: 'used', x: -1, y: 2 },
                    { id: 'D11', status: 'free', x: 1, y: 2 },
                    { id: 'D12', status: 'used', x: 3, y: 2 }
                ]
            },
            4: {
                name: 'Floor 4',
                desks: [
                    { id: 'D1', status: 'free', x: -3, y: -2 },
                    { id: 'D2', status: 'used', x: -1, y: -2 },
                    { id: 'D3', status: 'free', x: 1, y: -2 },
                    { id: 'D4', status: 'free', x: 3, y: -2 },
                    { id: 'D5', status: 'free', x: -3, y: -0.5 },
                    { id: 'D6', status: 'used', x: -1, y: -0.5 },
                    { id: 'D7', status: 'free', x: 1, y: -0.5 },
                    { id: 'D8', status: 'free', x: 3, y: -0.5 },
                    { id: 'D9', status: 'used', x: -3, y: 1 },
                    { id: 'D10', status: 'free', x: -1, y: 1 },
                    { id: 'D11', status: 'used', x: 1, y: 1 },
                    { id: 'D12', status: 'free', x: 3, y: 1 }
                ]
            },
            5: {
                name: 'Floor 5',
                desks: [
                    { id: 'D1', status: 'free', x: -3, y: -2 },
                    { id: 'D2', status: 'free', x: -1, y: -2 },
                    { id: 'D3', status: 'used', x: 1, y: -2 },
                    { id: 'D4', status: 'free', x: 3, y: -2 },
                    { id: 'D5', status: 'free', x: -3, y: 0 },
                    { id: 'D6', status: 'free', x: -1, y: 0 },
                    { id: 'D7', status: 'free', x: 1, y: 0 },
                    { id: 'D8', status: 'used', x: 3, y: 0 },
                    { id: 'D9', status: 'free', x: -3, y: 2 },
                    { id: 'D10', status: 'free', x: -1, y: 2 },
                    { id: 'D11', status: 'used', x: 1, y: 2 },
                    { id: 'D12', status: 'free', x: 3, y: 2 }
                ]
            }
        };
        
        this.init();
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
        const floorWidth = 10;
        const floorDepth = 8;
        const wallThickness = 0.2;
        
        // Create 6 floors
        for (let i = 0; i < 6; i++) {
            const floorGroup = new THREE.Group();
            floorGroup.userData = { floorNumber: i, type: 'floor' };
            
            // Floor base
            const floorGeometry = new THREE.BoxGeometry(floorWidth, 0.3, floorDepth);
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.floorBase,
                metalness: 0.1,
                roughness: 0.8
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.y = i * floorHeight;
            floor.castShadow = true;
            floor.receiveShadow = true;
            floor.userData = { floorNumber: i, type: 'floor', clickable: true };
            floorGroup.add(floor);
            this.floors.push(floor);
            
            // Walls
            const wallMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.walls,
                transparent: true,
                opacity: 0.7,
                metalness: 0.1,
                roughness: 0.9
            });
            
            // Front and back walls
            const wallGeometry1 = new THREE.BoxGeometry(floorWidth, floorHeight, wallThickness);
            const frontWall = new THREE.Mesh(wallGeometry1, wallMaterial);
            frontWall.position.set(0, i * floorHeight + floorHeight / 2, floorDepth / 2);
            frontWall.castShadow = true;
            floorGroup.add(frontWall);
            
            const backWall = new THREE.Mesh(wallGeometry1, wallMaterial);
            backWall.position.set(0, i * floorHeight + floorHeight / 2, -floorDepth / 2);
            backWall.castShadow = true;
            floorGroup.add(backWall);
            
            // Side walls
            const wallGeometry2 = new THREE.BoxGeometry(wallThickness, floorHeight, floorDepth);
            const leftWall = new THREE.Mesh(wallGeometry2, wallMaterial);
            leftWall.position.set(-floorWidth / 2, i * floorHeight + floorHeight / 2, 0);
            leftWall.castShadow = true;
            floorGroup.add(leftWall);
            
            const rightWall = new THREE.Mesh(wallGeometry2, wallMaterial);
            rightWall.position.set(floorWidth / 2, i * floorHeight + floorHeight / 2, 0);
            rightWall.castShadow = true;
            floorGroup.add(rightWall);
            
            // Roof (can be animated)
            const roofGeometry = new THREE.BoxGeometry(floorWidth, 0.2, floorDepth);
            const roofMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.roof,
                metalness: 0.3,
                roughness: 0.7
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = i * floorHeight + floorHeight;
            roof.castShadow = true;
            roof.userData = { type: 'roof', floorNumber: i };
            floorGroup.add(roof);
            this.roofs.push(roof);
            
            // Add purple accent edge
            const edgeGeometry = new THREE.EdgesGeometry(floorGeometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: this.colors.primary,
                linewidth: 2
            });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edges.position.copy(floor.position);
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
            'DESK': 'Desk Occupancy',
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
