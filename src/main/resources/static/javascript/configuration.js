// ======================================================
// ===============  GLOBAL VARIABLES  ===================
// ======================================================

// Gateway Configuration Management
let gatewayThresholds = {
    cpu: { warning: 70.0, critical: 85.0 },
    ram: { warning: 70.0, critical: 85.0 },
    disk: { warning: 80.0, critical: 90.0 },
    temperature: { warning: 70.0, critical: 80.0 }
};

// --- 3D / SVG ---
let scene, camera, renderer, controls;
let svgShape = null;
let buildingGroup = null; // groupe du bâtiment extrudé

// Palette identique au viewer 3D
const COLORS = {
    primary: 0x662179,
    primaryLight: 0x8b2fa3,
    floorBase: 0xe2e8f0,
    roof: 0x94a3b8,
    walls: 0xf8fafc
};

// Ace editor pour le payload
let editor;

// ======================================================
// ===============  TEMPLATE PAYLOAD ELSYS  =============
// ======================================================

const defaultPayloadCode = `
var TYPE_TEMP         = 0x01;
var TYPE_RH           = 0x02;
var TYPE_CO2          = 0x06;
var TYPE_VDD          = 0x07;
var TYPE_OCCUPANCY    = 0x11;

function bin16dec(bin) {
    var num = bin & 0xFFFF;
    if (0x8000 & num) num = - (0x010000 - num);
    return num;
}

function decodePayload(bytes){
    var obj = {};
    for (let i = 0; i < bytes.length; i++) {
        switch (bytes[i]) {
            case TYPE_TEMP:
                var temp = (bytes[i+1] << 8) | (bytes[i+2]);
                temp = bin16dec(temp);
                obj.temperature = temp / 10;
                i += 2;
                break;
            case TYPE_RH:
                obj.humidity = bytes[i+1];
                i += 1;
                break;
            case TYPE_VDD:
                obj.vdd = (bytes[i+1] << 8) | (bytes[i+2]);
                i += 2;
                break;
            case TYPE_OCCUPANCY:
                obj.occupancy = bytes[i+1];
                i += 1;
                break;
            default:
                i = bytes.length;
                break;
        }
    }
    return obj;
}
`;

// ======================================================
// ==================  SVG → SHAPE LOADER  ===============
// ======================================================

function loadSVGShape(file, callback) {
    const reader = new FileReader();

    reader.onload = (event) => {
        const svgText = event.target.result;

        if (!THREE || !THREE.SVGLoader) {
            console.error("THREE.SVGLoader not available");
            alert("SVGLoader not available. Check SVGLoader.js script.");
            return;
        }

        const loader = new THREE.SVGLoader();
        const data = loader.parse(svgText);

        if (!data.paths.length) {
            alert("No <path> found in SVG!");
            return;
        }

        // Collect ALL shapes from ALL paths
        const shapes = [];
        data.paths.forEach(path => {
            const pathShapes = path.toShapes(true);
            pathShapes.forEach(s => shapes.push(s));
        });

        if (!shapes.length) {
            alert("SVG contains no convertible shapes.");
            return;
        }

        console.log(`Found ${shapes.length} shapes from SVG paths`);
        
        // Use only the LARGEST shape to avoid artifacts
        // Often SVG files have small artifacts or background shapes
        let largestShape = shapes[0];
        let largestArea = 0;
        
        shapes.forEach(shape => {
            // Calculate approximate area by counting curves
            const area = shape.curves.length;
            if (area > largestArea) {
                largestArea = area;
                largestShape = shape;
            }
        });
        
        svgShape = largestShape;
        console.log("Using largest shape with", svgShape.curves.length, "curves");
        callback(svgShape);
    };

    reader.readAsText(file);
}

// ======================================================
// ======================  3D SCENE  =====================
// ======================================================

function initScene() {
    const wrapper   = document.getElementById("three-wrapper");
    const container = document.getElementById("three-container");

    if (!wrapper || !container) {
        console.error("three-wrapper or three-container not found");
        return;
    }

    // Affiche le wrapper 3D et nettoie l'ancien canvas
    wrapper.style.display = "block";
    container.innerHTML = "";

    const width  = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    // Même fond + fog que dans Building3D
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 20, 50);

    camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(20, 18, 20);
    camera.lookAt(0, 10, 0);

    // Renderer avec alpha pour voir le gradient CSS derrière
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Lumières proches du dashboard
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const pointLight1 = new THREE.PointLight(COLORS.primary, 0.5, 30);
    pointLight1.position.set(-10, 10, -10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(COLORS.primaryLight, 0.5, 30);
    pointLight2.position.set(10, 10, 10);
    scene.add(pointLight2);

    // Sol foncé + grille
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
    scene.add(ground);

    const grid = new THREE.GridHelper(50, 50, COLORS.primary, 0x334155);
    grid.position.y = -0.4;
    scene.add(grid);

// ======================================================
// ===============  GATEWAY CONFIGURATION  =============
// ======================================================

/**
 * Load current gateway thresholds from server
 */
async function loadGatewayThresholds() {
    try {
        const response = await fetch('/api/gateway-config/thresholds');
        if (response.ok) {
            gatewayThresholds = await response.json();
            updateGatewayThresholdInputs();
        } else {
            console.error('Failed to load gateway thresholds');
        }
    } catch (error) {
        console.error('Error loading gateway thresholds:', error);
    }
}

/**
 * Update gateway threshold input fields with current values
 */
function updateGatewayThresholdInputs() {
    // CPU thresholds
    const cpuCritical = document.getElementById('gateway-cpu-critical');
    const cpuWarning = document.getElementById('gateway-cpu-warning');
    if (cpuCritical) cpuCritical.value = gatewayThresholds.cpu.critical;
    if (cpuWarning) cpuWarning.value = gatewayThresholds.cpu.warning;
    
    // RAM thresholds
    const ramCritical = document.getElementById('gateway-ram-critical');
    const ramWarning = document.getElementById('gateway-ram-warning');
    if (ramCritical) ramCritical.value = gatewayThresholds.ram.critical;
    if (ramWarning) ramWarning.value = gatewayThresholds.ram.warning;
    
    // Disk thresholds
    const diskCritical = document.getElementById('gateway-disk-critical');
    const diskWarning = document.getElementById('gateway-disk-warning');
    if (diskCritical) diskCritical.value = gatewayThresholds.disk.critical;
    if (diskWarning) diskWarning.value = gatewayThresholds.disk.warning;
    
    // Temperature thresholds
    const tempCritical = document.getElementById('gateway-temp-critical');
    const tempWarning = document.getElementById('gateway-temp-warning');
    if (tempCritical) tempCritical.value = gatewayThresholds.temperature.critical;
    if (tempWarning) tempWarning.value = gatewayThresholds.temperature.warning;
}

/**
 * Save gateway thresholds to server
 */
async function saveGatewayThresholds() {
    try {
        // Collect values from form inputs
        const newThresholds = {
            cpu: {
                warning: parseFloat(document.getElementById('gateway-cpu-warning').value),
                critical: parseFloat(document.getElementById('gateway-cpu-critical').value)
            },
            ram: {
                warning: parseFloat(document.getElementById('gateway-ram-warning').value),
                critical: parseFloat(document.getElementById('gateway-ram-critical').value)
            },
            disk: {
                warning: parseFloat(document.getElementById('gateway-disk-warning').value),
                critical: parseFloat(document.getElementById('gateway-disk-critical').value)
            },
            temperature: {
                warning: parseFloat(document.getElementById('gateway-temp-warning').value),
                critical: parseFloat(document.getElementById('gateway-temp-critical').value)
            }
        };
        
        // Validate thresholds
        if (!validateGatewayThresholds(newThresholds)) {
            return;
        }
        
        // Send to server
        const response = await fetch('/api/gateway-config/thresholds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(newThresholds)
        });
        
        const result = await response.json();
        
        if (result.success) {
            gatewayThresholds = newThresholds;
            showNotification('✅ Gateway thresholds saved successfully!', 'success');
        } else {
            showNotification('❌ Failed to save gateway thresholds: ' + result.message, 'error');
        }
        
    } catch (error) {
        console.error('Error saving gateway thresholds:', error);
        showNotification('❌ Error saving gateway thresholds: ' + error.message, 'error');
    }
}

/**
 * Validate gateway threshold values
 */
function validateGatewayThresholds(thresholds) {
    // Check CPU thresholds
    if (thresholds.cpu.warning >= thresholds.cpu.critical) {
        showNotification('❌ CPU Warning threshold must be less than Critical threshold', 'error');
        return false;
    }
    
    // Check RAM thresholds
    if (thresholds.ram.warning >= thresholds.ram.critical) {
        showNotification('❌ RAM Warning threshold must be less than Critical threshold', 'error');
        return false;
    }
    
    // Check Disk thresholds
    if (thresholds.disk.warning >= thresholds.disk.critical) {
        showNotification('❌ Disk Warning threshold must be less than Critical threshold', 'error');
        return false;
    }
    
    // Check Temperature thresholds
    if (thresholds.temperature.warning >= thresholds.temperature.critical) {
        showNotification('❌ Temperature Warning threshold must be less than Critical threshold', 'error');
        return false;
    }
    
    // Check reasonable ranges
    if (thresholds.cpu.critical > 100 || thresholds.ram.critical > 100 || thresholds.disk.critical > 100) {
        showNotification('❌ CPU, RAM, and Disk thresholds cannot exceed 100%', 'error');
        return false;
    }
    
    if (thresholds.temperature.critical > 120) {
        showNotification('❌ Temperature threshold seems too high (>120°C)', 'error');
        return false;
    }
    
    return true;
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

    // Contrôles
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 8;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.update();

    window.addEventListener("resize", onWindowResize);

    animate();
}

function onWindowResize() {
    const wrapper = document.getElementById("three-wrapper");
    if (!wrapper || !renderer || !camera) return;

    const width  = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();

    // Légère rotation du bâtiment
    if (buildingGroup) {
        buildingGroup.rotation.y += 0.0005;
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ======================================================
// ==================  BUILDING EXTRUDE  =================
// ======================================================

function extrudeBuilding(originalShape, floors, scale) {
    if (buildingGroup && scene) {
        scene.remove(buildingGroup);
    }

    const group = new THREE.Group();
    const floorHeight = 3;

    // Clone the shape for manipulation
    const shape = originalShape.clone();
    
    console.log("Extruding building with shape:", shape);
    console.log("Shape curves:", shape.curves.length);

    // ---------- GÉOMÉTRIE DE BASE (DALLE) ----------
    const baseExtrudeSettings = { 
        depth: 0.3, 
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    };
    const baseFloorGeom = new THREE.ExtrudeGeometry(shape, baseExtrudeSettings);
    
    // Apply scale uniformly
    baseFloorGeom.scale(scale, scale, scale);

    // Centre approximatif
    baseFloorGeom.computeBoundingBox();
    const bbox = baseFloorGeom.boundingBox;
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerZ = (bbox.min.y + bbox.max.y) / 2; // l'axe Y devient Z après rotation
    
    console.log("Bounding box:", bbox);
    console.log("Center:", centerX, centerZ);

    // ---------- MATÉRIAUX ----------
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.floorBase,
        metalness: 0.1,
        roughness: 0.8
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.roof,
        metalness: 0.3,
        roughness: 0.7
    });

    const wallMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.walls,
        transparent: true,
        opacity: 0.35,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide
    });

    // ---------- GÉOMÉTRIE DES MURS ----------
    const baseWallGeom = new THREE.ExtrudeGeometry(
        shape,
        { depth: floorHeight, bevelEnabled: false }
    );
    baseWallGeom.scale(scale, scale, 1); // on ne touche pas à la hauteur

    for (let i = 0; i < floors; i++) {
        const yBase = i * floorHeight;

        // ===== FLOOR =====
        const floorMesh = new THREE.Mesh(baseFloorGeom, floorMaterial);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(-centerX, yBase, -centerZ);
        floorMesh.castShadow = true;
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        // ===== MURS =====
        const walls = new THREE.Mesh(baseWallGeom, wallMaterial);
        walls.rotation.x = -Math.PI / 2;
        walls.position.set(-centerX, yBase, -centerZ);
        walls.castShadow = true;
        group.add(walls);

        // ===== TOIT =====
        const roofMesh = new THREE.Mesh(baseFloorGeom, roofMaterial);
        roofMesh.rotation.x = -Math.PI / 2;
        roofMesh.position.set(-centerX, yBase + floorHeight, -centerZ);
        roofMesh.castShadow = true;
        group.add(roofMesh);

        // ===== EDGES VIOLETS =====
        const edgeGeometry = new THREE.EdgesGeometry(baseFloorGeom);
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: COLORS.primary,
            linewidth: 2
        });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edges.position.copy(floorMesh.position);
        edges.rotation.copy(floorMesh.rotation);
        group.add(edges);
    }

    buildingGroup = group;
    scene.add(group);
    console.log("Floors requested:", floors, "meshes in group:", group.children.length);
    return group;
}

// ======================================================
// =====================  MAIN ACTION  ===================
// ======================================================

function generate3DFromForm() {
    if (typeof THREE === "undefined") {
        alert("THREE is not loaded. Check three.min.js script tag.");
        return;
    }

    const floorsEl = document.getElementById("building-floors");
    const scaleEl  = document.getElementById("building-scale");
    const svgInput = document.getElementById("building-svg");

    const floors  = parseInt(floorsEl.value, 10) || 1;
    const scale   = parseFloat(scaleEl.value) || 0.01;
    const svgFile = svgInput.files[0];

    if (!svgFile) {
        alert("Please upload a building SVG first.");
        return;
    }

    loadSVGShape(svgFile, (shape) => {
        initScene();
        extrudeBuilding(shape, floors, scale);
    });
}
    const value = (selectEl.value || "").toLowerCase();
    let mode = "ace/mode/javascript";

    if (value.includes("python")) mode = "ace/mode/python";
    else if (value.includes("java")) mode = "ace/mode/java";
    else if (value.includes("c++")) mode = "ace/mode/c_cpp";

    editor.session.setMode(mode);
}

// Utilitaire hex → bytes
function hexToBytes(hex) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, "");
    const bytes = [];
    for (let c = 0; c < clean.length; c += 2) {
        bytes.push(parseInt(clean.substr(c, 2), 16));
    }
    return bytes;
}

// Test du decoder (exécute le code Ace + decodePayload)
function testDecoder() {
    if (!editor) {
        alert("Payload editor not ready.");
        return;
    }

    const hexInput = document.getElementById("test-byte-payload").value;
    if (!hexInput) {
        alert("Please enter a hex payload!");
        return;
    }

    const byteArray = hexToBytes(hexInput);
    const editorCode = editor.getValue();

    let result = {};
    try {
        // On attend que le code définisse function decodePayload(bytes) { ... }
        const func = new Function("bytes", editorCode + "\nreturn decodePayload(bytes);");
        result = func(byteArray);
    } catch (err) {
        console.error(err);
        result = { error: err.message };
    }

    const out = document.getElementById("test-decoded");
    if (out) {
        out.innerText = JSON.stringify(result, null, 2);
    }
}

// Toggle notification channel inputs
function toggleNotifChannelInput() {
    const emailChk = document.getElementById("notif-email");
    const smsChk   = document.getElementById("notif-sms");
    const emailDiv = document.getElementById("notif-email-input");
    const phoneDiv = document.getElementById("notif-phone-input");

    if (emailDiv) emailDiv.style.display = emailChk && emailChk.checked ? "block" : "none";
    if (phoneDiv) phoneDiv.style.display = smsChk && smsChk.checked ? "block" : "none";
}

async function saveBuildingConfig() {
    const nameEl   = document.getElementById("building-name");
    const floorsEl = document.getElementById("building-floors");
    const scaleEl  = document.getElementById("building-scale");
    const svgInput = document.getElementById("building-svg");

    const name    = (nameEl.value || "").trim();
    const floors  = parseInt(floorsEl.value, 10) || 1;
    const scale   = parseFloat(scaleEl.value) || 0.01;
    const svgFile = svgInput.files[0];

    if (!name) {
        alert("Merci de saisir un nom de bâtiment.");
        return;
    }
    if (!svgFile) {
        alert("Merci de sélectionner un fichier SVG.");
        return;
    }

    // 1) récupérer le CSRF sur /api/buildings/csrf-token
    let csrf;
    try {
        const csrfResp = await fetch("/api/buildings/csrf-token", {
            credentials: "same-origin"
        });
        if (!csrfResp.ok) {
            throw new Error("HTTP " + csrfResp.status);
        }
        csrf = await csrfResp.json();
        console.log("CSRF token:", csrf);
    } catch (e) {
        console.error("Erreur CSRF:", e);
        alert("Impossible de récupérer le token CSRF");
        return;
    }

    // 2) Construire le FormData
    const formData = new FormData();
    formData.append("name", name);
    formData.append("floors", floors);
    formData.append("scale", scale);
    formData.append("svgFile", svgFile);

    // ⚠️ IMPORTANT : ajouter le token CSRF comme champ de formulaire
    // csrf.parameterName est typiquement "_csrf"
    formData.append(csrf.parameterName, csrf.token);

    // 3) POST sur /api/buildings
    fetch("/api/buildings", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
    })
    .then(resp => {
        if (!resp.ok) {
            throw new Error("HTTP error " + resp.status);
        }
        return resp.json();
    })
    .then(data => {
        console.log("Building saved:", data);
        alert("Building enregistré avec succès (id=" + (data.id ?? "?") + ")");
    })
    .catch(err => {
        console.error(err);
        alert("Erreur lors de l'enregistrement du building.");
    });
}

// ======================================================
// ================== ALERT CONFIG SAVE ==================
// ======================================================

async function saveAlertConfig() {
    // 1. Get CSRF Token
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    
    if (!csrfMeta || !csrfHeaderMeta) {
        alert("CSRF token not found. Please refresh the page.");
        return;
    }
    
    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    // 2. Gather Data
    const payload = {
        dataMaxAgeMinutes: parseInt(document.getElementById("alert-data-age").value),
        co2: {
            critical: parseFloat(document.getElementById("alert-co2-critical").value),
            warning: parseFloat(document.getElementById("alert-co2-warning").value)
        },
        temperature: {
            criticalHigh: parseFloat(document.getElementById("alert-temp-crit-high").value),
            criticalLow: parseFloat(document.getElementById("alert-temp-crit-low").value),
            warningHigh: parseFloat(document.getElementById("alert-temp-warn-high").value),
            warningLow: parseFloat(document.getElementById("alert-temp-warn-low").value)
        },
        humidity: {
            warningHigh: parseFloat(document.getElementById("alert-hum-warn-high").value),
            warningLow: parseFloat(document.getElementById("alert-hum-warn-low").value)
        },
        noise: {
            warning: parseFloat(document.getElementById("alert-noise-warning").value)
        }
    };

    // 3. Send Request
    try {
        const response = await fetch("/api/configuration/alerts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        alert("Configuration saved successfully!");
        console.log("Alert config saved:", data);
        
    } catch (error) {
        console.error("Error saving alert config:", error);
        alert("Failed to save configuration: " + error.message);
    }
}

// ======================================================
// ============== NOTIFICATION CHANNELS ==================
// ======================================================

async function saveNotificationChannels() {
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    
    if (!csrfMeta || !csrfHeaderMeta) {
        alert("CSRF token not found. Please refresh the page.");
        return;
    }
    
    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    const parameterType = document.getElementById("notif-parameter").value;
    const emailEnabled = document.getElementById("notif-email").checked;
    const smsEnabled = document.getElementById("notif-sms").checked;
    const customEmail = document.getElementById("notif-custom-email").value.trim();
    const customPhone = document.getElementById("notif-custom-phone").value.trim();

    const payload = {
        parameterType: parameterType,
        emailEnabled: emailEnabled,
        smsEnabled: smsEnabled,
        customEmail: customEmail || null,
        customPhone: customPhone || null
    };

    try {
        const response = await fetch("/api/configuration/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        alert("Notification preferences saved successfully!");
        loadNotificationPreferences();
        
    } catch (error) {
        console.error("Error saving notification preferences:", error);
        alert("Failed to save notification preferences: " + error.message);
    }
}

async function loadNotificationPreferences() {
    try {
        const response = await fetch("/api/configuration/notifications");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const preferences = await response.json();
        const listDiv = document.getElementById("notification-prefs-list");
        
        if (!preferences || preferences.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">No notification preferences configured yet.</p>';
            return;
        }
        
        let html = '';
        preferences.forEach(pref => {
            const channels = [];
            if (pref.emailEnabled) channels.push('📧 Email');
            if (pref.smsEnabled) channels.push('📱 SMS');
            
            html += `
                <div class="notification-item">
                    <div class="notification-info">
                        <div class="notification-label">${pref.parameterType}</div>
                        <div class="notification-details">
                            Channels: ${channels.join(', ') || 'None'}
                            ${pref.customEmail ? '<br>Custom Email: ' + pref.customEmail : ''}
                            ${pref.customPhone ? '<br>Custom Phone: ' + pref.customPhone : ''}
                        </div>
                    </div>
                    <div class="threshold-actions">
                        <button class="btn-edit" onclick="editNotificationPreference('${pref.id}')">
                            ✏️ Edit
                        </button>
                        <button class="btn-delete" onclick="deleteNotificationPreference('${pref.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        console.error("Error loading notification preferences:", error);
        document.getElementById("notification-prefs-list").innerHTML = '<p class="text-muted">Error loading preferences.</p>';
    }
}

// Update parameter units display based on selected parameter type
function updateParameterUnits() {
    const parameterType = document.getElementById("threshold-parameter").value;
    const units = {
        "CO2": "ppm",
        "Temperature": "°C",
        "Humidity": "%",
        "Noise": "dB"
    };
    
    const unit = units[parameterType] || "";
    const unitSpans = document.querySelectorAll("#sensor-threshold-form .input-unit");
    unitSpans.forEach(span => {
        span.textContent = unit;
    });
}

// Edit notification preference
async function editNotificationPreference(prefId) {
    try {
        const response = await fetch(`/api/configuration/notifications/${prefId}`);
        if (response.ok) {
            const pref = await response.json();
            document.getElementById("notif-parameter").value = pref.parameterType;
            document.getElementById("notif-email").checked = pref.emailEnabled;
            document.getElementById("notif-sms").checked = pref.smsEnabled;
            document.getElementById("notif-custom-email").value = pref.customEmail || '';
            document.getElementById("notif-custom-phone").value = pref.customPhone || '';
            
            // Show/hide custom inputs based on checked status
            toggleNotifChannelInput('email');
            toggleNotifChannelInput('sms');
            
            // Scroll to form
            document.getElementById("notif-parameter").scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (error) {
        console.error("Error loading notification preference for edit:", error);
    }
}

// Delete notification preference
async function deleteNotificationPreference(prefId) {
    if (!confirm("Are you sure you want to delete this notification preference?")) {
        return;
    }
    
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    
    if (!csrfMeta || !csrfHeaderMeta) {
        alert("CSRF token not found. Please refresh the page.");
        return;
    }
    
    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");
    
    try {
        const response = await fetch(`/api/configuration/notifications/${prefId}`, {
            method: "DELETE",
            headers: {
                [csrfHeader]: csrfToken
            }
        });
        
        if (response.ok) {
            alert("Notification preference deleted successfully!");
            loadNotificationPreferences();
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error("Error deleting notification preference:", error);
        alert("Failed to delete notification preference: " + error.message);
    }
}

// ======================================================
// ================== SENSOR THRESHOLDS ==================
// ======================================================

function loadSensors() {
    console.log("loadSensors function called"); // Debug log
    
    const select = document.getElementById("sensor-select");
    if (!select) {
        console.error("sensor-select element not found!");
        return;
    }
    
    // Use sensors data passed from server like manageSensors.html does
    const sensors = window.SENSORS || [];
    console.log("Sensors from server:", sensors); // Debug log
    console.log("Number of sensors:", sensors.length); // Debug log
    
    // Clear existing options first (except the default one)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    if (sensors.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No sensors found in database";
        select.appendChild(option);
        console.log("Added 'no sensors' option");
        return;
    }
    
    sensors.forEach((sensor, index) => {
        console.log(`Processing sensor ${index}:`, sensor); // Debug log
        
        const option = document.createElement("option");
        // Use the same property names as manageSensors.html
        const sensorId = sensor.idSensor;
        const deviceType = sensor.deviceType || 'Unknown';
        
        console.log(`Sensor ${index} - ID: ${sensorId}, Type: ${deviceType}`); // Debug log
        
        if (sensorId) {
            option.value = sensorId;
            option.textContent = `${sensorId} (${deviceType})`;
            select.appendChild(option);
            console.log("Successfully added sensor option:", sensorId); // Debug log
        } else {
            console.warn("Sensor has no valid ID:", sensor);
        }
    });
    
    console.log("Final select options count:", select.children.length);
}

function loadSensorThresholds() {
    const sensorId = document.getElementById("sensor-select").value;
    const form = document.getElementById("sensor-threshold-form");
    
    if (!sensorId) {
        form.style.display = "none";
        return;
    }
    
    form.style.display = "block";
}

async function saveSensorThreshold() {
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    
    if (!csrfMeta || !csrfHeaderMeta) {
        alert("CSRF token not found. Please refresh the page.");
        return;
    }
    
    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");

    const sensorId = document.getElementById("sensor-select").value;
    const parameterType = document.getElementById("threshold-parameter").value;
    const criticalHigh = parseFloat(document.getElementById("sensor-critical-high").value);
    const warningHigh = parseFloat(document.getElementById("sensor-warning-high").value);
    const warningLow = parseFloat(document.getElementById("sensor-warning-low").value);
    const criticalLow = parseFloat(document.getElementById("sensor-critical-low").value);

    if (!sensorId) {
        alert("Please select a sensor.");
        return;
    }

    const payload = {
        sensorId: sensorId,
        parameterType: parameterType,
        criticalThreshold: criticalHigh || null,
        warningThreshold: warningHigh || null,
        warningLow: warningLow || null,
        criticalLow: criticalLow || null,
        enabled: true
    };

    try {
        const response = await fetch("/api/configuration/sensor-thresholds", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [csrfHeader]: csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert("Sensor threshold saved successfully!");
        loadAllSensorThresholds();
        
    } catch (error) {
        console.error("Error saving sensor threshold:", error);
        alert("Failed to save sensor threshold: " + error.message);
    }
}

async function loadAllSensorThresholds() {
    try {
        const response = await fetch("/api/configuration/sensor-thresholds");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const thresholds = await response.json();
        const listDiv = document.getElementById("sensor-thresholds-list");
        
        if (!thresholds || thresholds.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">No custom sensor thresholds configured yet.</p>';
            return;
        }
        
        let html = '';
        thresholds.forEach(threshold => {
            const values = [];
            if (threshold.criticalThreshold) values.push(`Critical High: ${threshold.criticalThreshold}`);
            if (threshold.warningThreshold) values.push(`Warning High: ${threshold.warningThreshold}`);
            if (threshold.warningLow) values.push(`Warning Low: ${threshold.warningLow}`);
            if (threshold.criticalLow) values.push(`Critical Low: ${threshold.criticalLow}`);
            
            html += `
                <div class="threshold-item">
                    <div class="threshold-info">
                        <div class="threshold-label">${threshold.sensorId} - ${threshold.parameterType}</div>
                        <div class="threshold-values">${values.join(' | ')}</div>
                    </div>
                    <div class="threshold-actions">
                        <button class="btn-edit" onclick="editSensorThreshold('${threshold.id}', '${threshold.sensorId}', '${threshold.parameterType}')">
                            ✏️ Edit
                        </button>
                        <button class="btn-delete" onclick="deleteSensorThreshold('${threshold.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        console.error("Error loading sensor thresholds:", error);
        document.getElementById("sensor-thresholds-list").innerHTML = '<p class="text-muted">Error loading thresholds.</p>';
    }
}

// Edit sensor threshold
async function editSensorThreshold(thresholdId, sensorId, parameterType) {
    document.getElementById("sensor-select").value = sensorId;
    document.getElementById("threshold-parameter").value = parameterType;
    loadSensorThresholds();
    
    try {
        const response = await fetch(`/api/configuration/sensor-thresholds/${thresholdId}`);
        if (response.ok) {
            const threshold = await response.json();
            if (threshold.criticalThreshold) document.getElementById("sensor-critical-high").value = threshold.criticalThreshold;
            if (threshold.warningThreshold) document.getElementById("sensor-warning-high").value = threshold.warningThreshold;
            if (threshold.warningLow) document.getElementById("sensor-warning-low").value = threshold.warningLow;
            if (threshold.criticalLow) document.getElementById("sensor-critical-low").value = threshold.criticalLow;
            updateParameterUnits();
        }
    } catch (error) {
        console.error("Error loading threshold for edit:", error);
    }
}

// Delete sensor threshold
async function deleteSensorThreshold(thresholdId) {
    if (!confirm("Are you sure you want to delete this sensor threshold override?")) {
        return;
    }
    
    const csrfMeta = document.querySelector('meta[name="_csrf"]');
    const csrfHeaderMeta = document.querySelector('meta[name="_csrf_header"]');
    
    if (!csrfMeta || !csrfHeaderMeta) {
        alert("CSRF token not found. Please refresh the page.");
        return;
    }
    
    const csrfToken = csrfMeta.getAttribute("content");
    const csrfHeader = csrfHeaderMeta.getAttribute("content");
    
    try {
        const response = await fetch(`/api/configuration/sensor-thresholds/${thresholdId}`, {
            method: "DELETE",
            headers: {
                [csrfHeader]: csrfToken
            }
        });
        
        if (response.ok) {
            alert("Sensor threshold deleted successfully!");
            loadAllSensorThresholds();
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error("Error deleting sensor threshold:", error);
        alert("Failed to delete sensor threshold: " + error.message);
    }
}

// ======================================================
// ================== GLOBAL EXPORTS =====================
// ======================================================

window.generate3DFromForm = generate3DFromForm;
window.show2D = function show2D() {
    const wrapper = document.getElementById("three-wrapper");
    const plan    = document.getElementById("plan2D");

    if (wrapper) wrapper.style.display = "none";
    if (plan) {
        plan.style.display = "block";
        plan.innerHTML = "<h3 style='text-align:center;padding-top:120px;'>2D View Placeholder</h3>";
    }
};

window.changeEditorLanguage = changeEditorLanguage;
window.testDecoder = testDecoder;
window.toggleNotifChannelInput = toggleNotifChannelInput;
window.saveBuildingConfig = saveBuildingConfig;
window.saveAlertConfig = saveAlertConfig;
window.saveNotificationChannels = saveNotificationChannels;
window.loadNotificationPreferences = loadNotificationPreferences;
window.loadSensors = loadSensors;
window.loadSensorThresholds = loadSensorThresholds;
window.saveSensorThreshold = saveSensorThreshold;
window.loadAllSensorThresholds = loadAllSensorThresholds;
window.editSensorThreshold = editSensorThreshold;
window.deleteSensorThreshold = deleteSensorThreshold;
window.updateParameterUnits = updateParameterUnits;
window.editNotificationPreference = editNotificationPreference;
window.deleteNotificationPreference = deleteNotificationPreference;

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    if (typeof loadSensors === 'function') loadSensors();
    if (typeof loadNotificationPreferences === 'function') loadNotificationPreferences();
    if (typeof loadAllSensorThresholds === 'function') loadAllSensorThresholds();
});