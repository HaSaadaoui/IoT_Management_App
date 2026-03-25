// ========================
// Manage Gateways (JS)
// ========================

const CAN_EDIT_GATEWAYS = !!window.CAN_EDIT_GATEWAYS;
const BUILDING_FLOORS   = Array.isArray(window.BUILDING_FLOORS) ? window.BUILDING_FLOORS : [];
const LOCATIONS         = Array.isArray(window.LOCATIONS) ? window.LOCATIONS : [];

function populateLocations(selectEl, buildingId, currentLocationId = null) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="" disabled selected>Select a location</option>';
    if (!buildingId) {
        selectEl.disabled = true;
        return;
    }
    const filtered = LOCATIONS.filter(l => String(l.buildingId) === String(buildingId));
    if (filtered.length === 0) {
        selectEl.disabled = true;
        return;
    }
    filtered.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.name;
        selectEl.appendChild(opt);
    });
    selectEl.disabled = false;
    if (currentLocationId) selectEl.value = String(currentLocationId);
}

// ── Popups ──
var modalCreate = document.getElementById("createGatewayPopup");
var modalEdit   = document.getElementById("editGatewayPopup");
var modalDelete = document.getElementById("deleteGatewayPopup");

// ── Boutons ──
var btnCreate  = document.getElementById("openCreateBtn");
var exitCreate = document.getElementById("closeCreate");
var exitEdit   = document.getElementById("closeEdit");
var exitDelete = document.getElementById("closeDelete");

// ── Selects floors ──
const floorSelectCreate    = document.getElementById('floorSelectCreate');
const buildingSelectCreate = document.getElementById('buildingSelectCreate');
const floorSelectEdit      = document.getElementById('floorSelectEdit');
const buildingSelectEdit   = document.getElementById('buildingSelectEdit');

// ── Selects locations ──
const locationSelectCreate = document.getElementById('locationSelectCreate');
const locationSelectEdit   = document.getElementById('locationSelectEdit');

// -----------------------
// Populate Floors
// -----------------------
function populateFloors(selectEl, buildingId, currentFloor = null) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="" disabled selected>Select a Floor</option>';

    if (!buildingId) {
        selectEl.disabled = true;
        return;
    }

    const bf = BUILDING_FLOORS.find(b => String(b.id) === String(buildingId));
    if (!bf || !bf.floorsCount) {
        selectEl.disabled = true;
        return;
    }

    for (let i = 1; i <= bf.floorsCount; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = 'Floor ' + i;
        selectEl.appendChild(opt);
    }
    selectEl.disabled = false;

    if (currentFloor != null) {
        selectEl.value = String(currentFloor);
    }
}

/**
 * Affiche/masque le champ frequencyPlan si le protocol est lorawan
 */
function toggleFrequencyPlan(elSelect, elRow) {
    if (!elSelect || !elRow || !window.AVAILABLE_PROTOCOLS) return;

    const lorawanProtocol = window.AVAILABLE_PROTOCOLS.find(p =>
        p.name && p.name.toLowerCase().includes('lorawan')
    );
    const lorawanProtocolId = lorawanProtocol ? String(lorawanProtocol.id) : null;

    const selected = elSelect.value;

    if (lorawanProtocolId && selected === lorawanProtocolId) {
        elRow.style.display = "block";
    } else {
        elRow.style.display = "none";
        const selectFreq = elRow.querySelector("select");
        if (selectFreq) selectFreq.value = "";
    }
}


// CREATE : building change → peuple floors + locations
buildingSelectCreate?.addEventListener('change', () => {
    populateFloors(floorSelectCreate, buildingSelectCreate.value);
    populateLocations(locationSelectCreate, buildingSelectCreate.value);
    if (locationSelectCreate) locationSelectCreate.disabled = false;
});

// EDIT : pré-peuple les floors + locations au chargement si le modal est présent
if (floorSelectEdit) {
    const buildingId        = floorSelectEdit.dataset.building || '';
    const currentFloor      = floorSelectEdit.dataset.current  || null;
    const currentLocationId = locationSelectEdit?.dataset.current || null;
    populateFloors(floorSelectEdit, buildingId, currentFloor);
    populateLocations(locationSelectEdit, buildingId, currentLocationId);
}

// EDIT : building change → repeuple floors + locations
buildingSelectEdit?.addEventListener('change', () => {
    populateFloors(floorSelectEdit, buildingSelectEdit.value);
    populateLocations(locationSelectEdit, buildingSelectEdit.value);
});

// -----------------------
// Ouvrir / Fermer modals
// -----------------------
if (btnCreate && modalCreate) {
    if (!CAN_EDIT_GATEWAYS) {
        btnCreate.classList.add("disabled");
        btnCreate.setAttribute("aria-disabled", "true");
    } else {
        btnCreate.addEventListener("click", () => {
            refreshCsrfToken();
            modalCreate.style.display = "block";
        });
    }
}

if (exitCreate && modalCreate) {
    exitCreate.addEventListener("click", () => {
        resetCreateModalFields();
        resetCreateError();
        modalCreate.style.display = "none";
    });
}

if (exitEdit && modalEdit) {
    exitEdit.addEventListener("click", () => {
        resetEditModalFields();
        resetEditError();
        modalEdit.style.display = "none";
    });
}

if (exitDelete && modalDelete) {
    exitDelete.addEventListener("click", () => {
        resetDeleteError();
        modalDelete.style.display = "none";
    });
}

window.onclick = function(event) {
    [modalCreate, modalEdit, modalDelete].forEach(modal => {
        if (modal && event.target === modal) {
            modal.style.display = "none";
            if (modal === modalCreate) { resetCreateModalFields(); resetCreateError(); }
            else if (modal === modalEdit)   { resetEditModalFields();   resetEditError();   }
            else if (modal === modalDelete) { resetDeleteError(); }
        }
    });
};

document.addEventListener("DOMContentLoaded", function () {

const protocolSelectCreate   = document.getElementById("protocolSelectCreate");
const frequencyPlanRowCreate = document.getElementById("frequencyPlanRowCreate");
const protocolSelectEdit   = document.getElementById("protocolSelectEdit");
const frequencyPlanRowEdit = document.getElementById("frequencyPlanRowEdit");

if (protocolSelectCreate && frequencyPlanRowCreate) {
    // Initial state
    toggleFrequencyPlan(protocolSelectCreate, frequencyPlanRowCreate);
    protocolSelectCreate.addEventListener("change", () => {
        toggleFrequencyPlan(protocolSelectCreate, frequencyPlanRowCreate);
    });
}

// EDIT (si le modal est présent)
if (protocolSelectEdit && frequencyPlanRowEdit) {
    toggleFrequencyPlan(protocolSelectEdit, frequencyPlanRowEdit);
    protocolSelectEdit.addEventListener("change", () => {
        toggleFrequencyPlan(protocolSelectEdit, frequencyPlanRowEdit);
    });
}
    if (document.querySelector('.error-message-create') && modalCreate) {
        modalCreate.style.display = "block";
        // Re-peuple le floor select Create si un building était sélectionné
        if (buildingSelectCreate?.value) {
            populateFloors(floorSelectCreate, buildingSelectCreate.value);
        }
    }
    if (document.querySelector('.error-message-edit') && modalEdit) {
        modalEdit.style.display = "block";
    }
    if (document.querySelector('.error-message-delete') && modalDelete) {
        modalDelete.style.display = "block";
        const deleteBtn = modalDelete.querySelector('button[type="submit"]');
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
});

// -----------------------
// Reset modals
// -----------------------
function resetCreateModalFields() {
    if (!modalCreate) return;
    modalCreate.querySelectorAll("input").forEach(i => i.value = "");
    modalCreate.querySelectorAll("select").forEach(s => { s.value = ""; });
    // Réinitialise le floor select
    if (floorSelectCreate) {
        floorSelectCreate.innerHTML = '<option value="" disabled selected>Select a Floor</option>';
        floorSelectCreate.disabled = true;
    }
}

function resetCreateError() {
    if (!modalCreate) return;
    const errorDiv = modalCreate.querySelector(".alert-danger");
    if (errorDiv) errorDiv.style.display = "none";
    modalCreate.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
}

function resetEditModalFields() {
    if (!modalEdit) return;
    modalEdit.querySelectorAll("input").forEach(i => i.value = "");
    modalEdit.querySelectorAll("select").forEach(s => { s.value = ""; });
}

function resetEditError() {
    if (!modalEdit) return;
    const errorDiv = modalEdit.querySelector(".alert-danger");
    if (errorDiv) errorDiv.style.display = "none";
    modalEdit.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
}

function resetDeleteError() {
    const errorDiv = document.querySelector('.error-message-delete');
    if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
    if (modalDelete) {
        const deleteBtn = modalDelete.querySelector('button[type="submit"]');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    }
}

// -----------------------
// Flatpickr
// -----------------------
if (typeof flatpickr === "function") {
    flatpickr(".datepicker", { dateFormat: "Y-m-d" });
}

// -----------------------
// Navigation back/reload
// -----------------------
window.addEventListener('pageshow', function(event) {
    const navType = performance.getEntriesByType('navigation')[0]?.type;
    if (document.querySelector('.error-message-create')
     || document.querySelector('.error-message-edit')
     || document.querySelector('.error-message-delete')) {
        history.replaceState(null, null, window.location.href);
    }
    if (event.persisted || navType === 'back_forward' || navType === 'reload') {
        ['#deleteGatewayPopup', '#editGatewayPopup', '#createGatewayPopup'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
        });
        ['.error-message-create', '.error-message-edit', '.error-message-delete'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });
    }
});

// -----------------------
// CSRF
// -----------------------
function refreshCsrfToken() {
    fetch('/csrf-token')
        .then(r => r.json())
        .then(data => {
            const input = document.querySelector('form#myForm input[name="' + data.parameterName + '"]');
            if (input) input.value = data.token;
        });
}

// -----------------------
// Table / Pagination / Filtres
// -----------------------
document.addEventListener('DOMContentLoaded', () => {
    const gateways    = Array.isArray(window.GATEWAYS) ? window.GATEWAYS : [];
    const tableBody   = document.getElementById('gatewayTableBody');
    const buildingFilter = document.getElementById('buildingFilter');
    const searchInput = document.getElementById('searchInput');
    const dateInput   = document.getElementById('dateFilter');
    const paginationEl = document.getElementById('pagination');



    const PAGE_SIZE = 10;
    let currentPage = 1;
    let filteredRows = [];
    let buildingMap  = {};

    function updateBuildingPlaceholderStyle() {
        if (!buildingFilter) return;
        buildingFilter.classList.toggle('empty', !buildingFilter.value);
    }

    if (searchInput) {
        searchInput.addEventListener('focus', () => searchInput.style.borderColor = '#440d64');
        searchInput.addEventListener('blur',  () => searchInput.style.borderColor = '#662179');
    }

    function sqlLikeToRegex(pattern) {
        let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        escaped = escaped.replace(/%/g, '.*');
        return new RegExp('^' + escaped + '$', 'i');
    }

    function matchesLikeOrIncludes(value, query) {
        if (!query) return true;
        const v = String(value ?? '');
        if (query.includes('%')) return sqlLikeToRegex(query).test(v);
        return v.toLowerCase().startsWith(query.toLowerCase());
    }

    async function loadBuildings() {
        try {
            const resp = await fetch('/api/buildings');
            if (resp.ok) {
                const buildings = await resp.json();
                buildingMap = Object.fromEntries(buildings.map(b => [b.id, b.name]));
            }
        } catch (e) {
            // Fallback sur BUILDING_FLOORS si l'API échoue
            BUILDING_FLOORS.forEach(b => { buildingMap[b.id] = b.name; });
            console.warn('Could not load buildings from API, using BUILDING_FLOORS', e);
        }
        populateBuildings();
        filteredRows = gateways.slice();
        renderRowsPaginated();
    }

    function populateBuildings() {
        if (!buildingFilter) return;
        const uniques = Array.from(new Set(
            (gateways || []).map(g => g.buildingId).filter(b => b != null)
        )).sort((a, b) => a - b);

        buildingFilter.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
        for (const id of uniques) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = buildingMap[id] ?? 'Building ' + id;
            buildingFilter.appendChild(opt);
        }
        updateBuildingPlaceholderStyle();
    }

    function renderRows(rows) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        rows.forEach(gw => {
            const row = document.createElement('tr');
            const protocolName = window.AVAILABLE_PROTOCOLS?.find(p => p.id == gw.protocolId)?.name || 'N/A';
            const freqLabel =
                gw.frequencyPlan === 'EU_863_870_TTN'    ? 'Europe' :
                gw.frequencyPlan === 'US_902_928_FSB_2'  ? 'United States' :
                gw.frequencyPlan === 'AU_915_928_FSB_2'  ? 'Australia' :
                gw.frequencyPlan === 'CN_470_510_FSB_11' ? 'China' :
                gw.frequencyPlan === 'AS_920_923'        ? 'Asia' : (gw.frequencyPlan ?? '');

            const disabledClass  = CAN_EDIT_GATEWAYS ? '' : 'disabled';
            const buildingLabel  = gw.buildingId != null
                ? (buildingMap[gw.buildingId] ?? 'Building ' + gw.buildingId) : '';

            row.innerHTML = `
                <td>${gw.gatewayId ?? ''}</td>
                <td>${gw.ipAddress ?? ''}</td>
                <td>${protocolName}</td>
                <td>${freqLabel}</td>
                <td>${gw.createdAt ?? ''}</td>
                <td>${buildingLabel}</td>
                <td>
                  <div class="button-container">
                    <a href="/manage-gateways/monitoring/${gw.gatewayId}/view?ip=${encodeURIComponent(gw.ipAddress ?? '')}">
                      <img src="/image/monitoring-data.svg" alt="Monitor">
                    </a>
                    <a href="/manage-gateways/edit/${gw.gatewayId}"
                       class="${disabledClass}"
                       aria-disabled="${!CAN_EDIT_GATEWAYS}">
                      <img src="/image/edit-icon.svg" alt="Edit">
                    </a>
                    <a href="#"
                       class="openDeletePopup ${disabledClass}"
                       aria-disabled="${!CAN_EDIT_GATEWAYS}"
                       data-id="${gw.gatewayId}">
                      <img src="/image/delete-icon.svg" alt="Delete">
                    </a>
                  </div>
                </td>`;
            tableBody.appendChild(row);
        });

        if (CAN_EDIT_GATEWAYS) {
            tableBody.querySelectorAll('.openDeletePopup').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    const id = btn.getAttribute('data-id');
                    const form = document.getElementById('deleteForm');
                    if (form) form.action = `/manage-gateways/delete/${id}`;
                    if (modalDelete) modalDelete.style.display = 'block';
                });
            });
        }
    }

    function renderRowsPaginated() {
        const total = filteredRows.length;
        const start = (currentPage - 1) * PAGE_SIZE;
        renderRows(filteredRows.slice(start, start + PAGE_SIZE));
        renderPagination(total);
    }

    function renderPagination(totalCount) {
        if (!paginationEl) return;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        currentPage = Math.min(currentPage, totalPages);
        if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

        const btn = (label, page, disabled = false, active = false, ariaLabel) => {
            const b = document.createElement('button');
            b.className = 'page-btn' + (active ? ' active' : '');
            b.textContent = label;
            if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
            if (disabled) b.setAttribute('disabled', 'disabled');
            b.addEventListener('click', () => {
                if (!disabled && currentPage !== page) { currentPage = page; renderRowsPaginated(); }
            });
            return b;
        };

        const totalPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(totalPagesToShow / 2));
        let endPage   = Math.min(totalPages, startPage + totalPagesToShow - 1);
        if (endPage - startPage + 1 < totalPagesToShow) startPage = Math.max(1, endPage - totalPagesToShow + 1);

        paginationEl.innerHTML = '';
        paginationEl.appendChild(btn('«', 1,              currentPage === 1,           false, 'First page'));
        paginationEl.appendChild(btn('‹', currentPage - 1, currentPage === 1,          false, 'Previous page'));
        for (let p = startPage; p <= endPage; p++) paginationEl.appendChild(btn(String(p), p, false, p === currentPage));
        paginationEl.appendChild(btn('›', currentPage + 1, currentPage === totalPages,  false, 'Next page'));
        paginationEl.appendChild(btn('»', totalPages,       currentPage === totalPages,  false, 'Last page'));
    }

    function applyFilters() {
        const b = buildingFilter?.value || '';
        const q = (searchInput?.value || '').trim();
        const d = (dateInput?.value || '').trim();

        let rows = gateways.slice();
        if (b) rows = rows.filter(g => String(g.buildingId) === String(b));
        if (q) rows = rows.filter(g => matchesLikeOrIncludes(g.gatewayId, q) || matchesLikeOrIncludes(g.ipAddress, q));
        if (d) {
            const dDate = new Date(d);
            rows = rows.filter(g => g.createdAt && new Date(g.createdAt) >= dDate);
        }
        filteredRows = rows;
        currentPage = 1;
        renderRowsPaginated();
    }

    buildingFilter?.addEventListener('change', () => { updateBuildingPlaceholderStyle(); applyFilters(); });
    searchInput?.addEventListener('input', applyFilters);
    dateInput?.addEventListener('input', applyFilters);

    document.getElementById('clearBuilding')?.addEventListener('click', () => {
        if (!buildingFilter) return;
        buildingFilter.value = '';
        updateBuildingPlaceholderStyle();
        applyFilters();
    });

    loadBuildings();
});
