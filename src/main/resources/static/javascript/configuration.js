// ======================================================
// ===============  GLOBAL VARIABLES  ===================
// ======================================================

// --- 3D / SVG ---
let scene, camera, renderer, controls;
let svgShape = null;

// --- Payload formatter (Ace) ---
let payloadEditor = null;

// ======================================================
// ===============  PAYLOAD FORMATTER  ==================
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

// Init de l’éditeur Ace du payload au chargement
window.addEventListener("load", () => {
    const editorDiv = document.getElementById("payload-editor");
    if (editorDiv && window.ace) {
        payloadEditor = ace.edit("payload-editor");
        payloadEditor.setTheme("ace/theme/monokai");
        payloadEditor.session.setMode("ace/mode/javascript");
        payloadEditor.setValue(defaultPayloadCode, -1);
    }
});

// Changement de langage (juste pour la coloration)
function changeEditorLanguage(select) {
    if (!payloadEditor) {
        console.warn("Payload Ace editor not initialized");
        return;
    }

    const lang = select.value.toLowerCase();
    let mode = "javascript";
    if (lang === "python") mode = "python";
    else if (lang === "java") mode = "java";
    else if (lang === "c++") mode = "c_cpp";

    payloadEditor.session.setMode("ace/mode/" + mode);
}

function hexToBytes(hex) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, "");
    const bytes = [];
    for (let c = 0; c < clean.length; c += 2) {
        bytes.push(parseInt(clean.substr(c, 2), 16));
    }
    return bytes;
}

function testDecoder() {
    if (!payloadEditor) {
        alert("Payload editor not ready.");
        return;
    }

    const hexInput = document.getElementById("test-byte-payload").value;
    if (!hexInput) {
        alert("Please enter a hex payload!");
        return;
    }

    const byteArray = hexToBytes(hexInput);
    const editorCode = payloadEditor.getValue();

    let result = {};
    try {
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

// Alert channels (email / phone)
function toggleChannelInput() {
    const emailChecked = document.getElementById("alert-email")?.checked;
    const smsChecked   = document.getElementById("alert-sms")?.checked;

    const emailDiv = document.getElementById("channel-email");
    const phoneDiv = document.getElementById("channel-phone");

    if (emailDiv) emailDiv.style.display = emailChecked ? "block" : "none";
    if (phoneDiv) phoneDiv.style.display = smsChecked ? "block" : "none";
}

// On exporte ces fonctions pour les attributs onclick HTML
window.changeEditorLanguage = changeEditorLanguage;
window.testDecoder = testDecoder;
window.toggleChannelInput = toggleChannelInput;

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

    wrapper.style.display = "block";
    container.innerHTML = "";

    const width  = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 35, 45);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(30, 60, 30);
    sun.castShadow = true;
    scene.add(sun);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 120;
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
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ======================================================
// ==================  BUILDING EXTRUDE  =================
// ======================================================

function extrudeBuilding(originalShape, floors, scale) {
    const group = new THREE.Group();
    const floorHeight = 3;

    const shape = originalShape.clone();

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.1,
        roughness: 0.8
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.3,
        roughness: 0.7
    });

    for (let i = 0; i < floors; i++) {
        const extrudeSettings = { depth: 0.3, bevelEnabled: false };

        // FLOOR
        const floorGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        floorGeom.scale(-scale, scale, scale);  // miroir X + scale
        floorGeom.center();

        const floorMesh = new THREE.Mesh(floorGeom, floorMaterial);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.y = i * floorHeight;
        floorMesh.castShadow = true;
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        // ROOF
        const roofGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        roofGeom.scale(-scale, scale, scale);
        roofGeom.center();

        const roofMesh = new THREE.Mesh(roofGeom, roofMaterial);
        roofMesh.rotation.x = -Math.PI / 2;
        roofMesh.position.y = i * floorHeight + floorHeight;
        roofMesh.castShadow = true;
        group.add(roofMesh);
    }

    scene.add(group);
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
// ========================  2D MODE  ====================
// ======================================================

function show2D() {
    const wrapper = document.getElementById("three-wrapper");
    const plan    = document.getElementById("plan2D");

    if (wrapper) wrapper.style.display = "none";
    if (plan) {
        plan.style.display = "block";
        plan.innerHTML = "<h3 style='text-align:center;padding-top:120px;'>2D View Placeholder</h3>";
    }
}

// ======================================================
// ================== GLOBAL EXPORTS =====================
// ======================================================

window.generate3DFromForm = generate3DFromForm;
window.show2D = show2D;
