// ======================================================
// ===============  GLOBAL VARIABLES  ===================
// ======================================================

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

        const shapes = [];
        data.paths.forEach(path => {
            const pathShapes = path.toShapes(true);
            pathShapes.forEach(s => shapes.push(s));
        });

        if (!shapes.length) {
            alert("SVG contains no convertible shapes.");
            return;
        }

        svgShape = shapes[0];
        console.log("SVG shape loaded:", svgShape);
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

    const shape = originalShape.clone();

    // ---------- GÉOMÉTRIE DE BASE (DALLE) ----------
    const baseExtrudeSettings = { depth: 0.3, bevelEnabled: false };
    const baseFloorGeom = new THREE.ExtrudeGeometry(shape, baseExtrudeSettings);
    baseFloorGeom.scale(scale, scale, scale); // XY scalés, Z = épaisseur de la dalle

    // Centre approximatif
    baseFloorGeom.computeBoundingBox();
    const bbox = baseFloorGeom.boundingBox;
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerZ = (bbox.min.y + bbox.max.y) / 2; // l’axe Y devient Z après rotation

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

// ======================================================
// =================  PAYLOAD EDITOR  ====================
// ======================================================

document.addEventListener("DOMContentLoaded", function () {
    const payloadEl = document.getElementById("payload-editor");
    if (payloadEl && window.ace) {
        editor = ace.edit("payload-editor");
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/javascript");
        editor.setValue(defaultPayloadCode, -1);   // <-- payload Elsys par défaut
    }
});

// changement de langage (juste le mode Ace)
function changeEditorLanguage(selectEl) {
    if (!editor) return;
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

// Toggle email / phone blocks
function toggleChannelInput() {
    const emailChk = document.getElementById("alert-email");
    const smsChk   = document.getElementById("alert-sms");
    const emailDiv = document.getElementById("channel-email");
    const phoneDiv = document.getElementById("channel-phone");

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
window.toggleChannelInput = toggleChannelInput;
window.saveBuildingConfig = saveBuildingConfig;