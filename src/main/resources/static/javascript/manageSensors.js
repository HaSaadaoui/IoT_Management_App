// =======================
// Manage Sensors (JS)
// =======================

const CAN_EDIT_SENSORS = !!window.CAN_EDIT_SENSORS;

function disableLink(a) {
  if (!a) return;
  a.classList.add('disabled');
  a.setAttribute('aria-disabled', 'true');
  a.setAttribute('tabindex', '-1');
}

// Références globales
const modalCreate = document.getElementById("createSensorPopup");
const modalDelete = document.getElementById("deleteSensorPopup");
const modalEdit   = document.getElementById("editSensorPopup");
const btnCreate   = document.getElementById("openCreateBtn");
const exitDelete  = document.getElementById("closeDelete");

// Données injectées par Thymeleaf
const SENSORS  = Array.isArray(window.SENSORS)  ? window.SENSORS  : [];
const GATEWAYS = Array.isArray(window.GATEWAYS) ? window.GATEWAYS : [];
const BUILDING_FLOORS = Array.isArray(window.BUILDING_FLOORS) ? window.BUILDING_FLOORS : [];
// -----------------------
// Helpers UI
// -----------------------
function updateSelectPlaceholderStyle(select) {
  if (!select) return;
  select.classList.toggle('empty', !select.value);
}

function populateFloors(selectEl, building, currentFloor = null) {
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="" disabled selected>Select a Floor</option>';

  if (!building) {
    selectEl.disabled = true;
    return;
  }

  // ✅ UTILISE window.BUILDING_FLOORS au lieu de SENSORS
  const bf = (window.BUILDING_FLOORS || []).find(b => b.name === building);
  if (!bf || !bf.floorsCount) {
    selectEl.disabled = true;
    return;
  }

  for (let i = 0; i < bf.floorsCount; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    if (i == 0){
      opt.textContent = `Ground Floor`;
    } else {
      opt.textContent = `Floor ${i}`;
    }
    
    selectEl.appendChild(opt);
  }

  selectEl.disabled = false;
  if (currentFloor != null) {
    selectEl.value = String(currentFloor);
  }
}

function sqlLikeToRegex(pattern) {
  let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  escaped = escaped.replace(/%/g, '.*');
  return new RegExp('^' + escaped + '.*', 'i');
}

function matchesLikeOrIncludes(value, query) {
  if (!query) return true;
  const v = String(value ?? '');
  if (query.includes('%')) return sqlLikeToRegex(query).test(v);
  return v.toLowerCase().startsWith(query.toLowerCase());
}

function keepHexAndUpper(s) {
  return (s || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

// -----------------------
// DOM Ready
// -----------------------
document.addEventListener('DOMContentLoaded', () => {

  // Filtres / Table / Pagination
  const tableBody      = document.getElementById('sensorTableBody');
  const buildingFilter = document.getElementById('buildingFilter');
  const statusFilter   = document.getElementById('statusFilter');
  const searchInput    = document.getElementById('searchInput');
  const dateInput      = document.getElementById('dateFilter');
  const paginationEl   = document.getElementById('pagination');

  // Champs Create
  const openCreateBtn      = document.getElementById('openCreateBtn');
  const closeCreateBtn     = document.getElementById('closeCreateSensor') || document.getElementById('closeCreate');
  const gatewaySelect      = document.getElementById('gatewaySelect');
  const protocolSelect     = document.getElementById('protocolSelect');
  const frequencyPlanWrapper = document.getElementById('frequencyPlanWrapper');
  const floorSelect       = document.getElementById('floorSelect');
  const frequencyPlanInput = document.getElementById('frequencyPlanInput');
  const buildingNameInput  = document.getElementById('buildingNameInput');
  const devEuiInput        = document.getElementById('devEuiInput');
  const joinEuiInput       = document.getElementById('joinEuiInput');
  const appKeyInput        = document.getElementById('appKeyInput');

  // Champs Edit
  const closeEditBtn           = document.getElementById('closeEditSensor');
  const gatewaySelectEdit      = document.getElementById('gatewaySelectEdit');
  const frequencyPlanInputEdit = document.getElementById('frequencyPlanInputEdit');
  const buildingNameInputEdit  = document.getElementById('buildingNameInputEdit');
  const floorSelectEdit   = document.getElementById('floorSelectEdit');

  // État pagination
  const PAGE_SIZE = 10;
  let currentPage = 1;
  let filteredRows = [];

  // Placeholders sur selects
  if (buildingFilter) updateSelectPlaceholderStyle(buildingFilter);
  if (statusFilter)   updateSelectPlaceholderStyle(statusFilter);

  // -----------------------
  // Peupler le filtre Building
  // -----------------------
  function populateBuildings() {
    if (!buildingFilter) return;
    const uniques = Array.from(new Set(
      (SENSORS || []).map(s => (s.buildingName || '').trim()).filter(Boolean)
    )).sort();
    buildingFilter.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
    for (const b of uniques) {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      buildingFilter.appendChild(opt);
    }
    updateSelectPlaceholderStyle(buildingFilter);
  }

  // -----------------------
  // Toggle Frequency Plan selon protocole
  // -----------------------
  function toggleFrequencyPlan() {
    if (!protocolSelect || !frequencyPlanWrapper) return;
    const selectedText = protocolSelect.selectedOptions[0]?.text?.toLowerCase() ?? '';
    const isLorawan = selectedText.includes('lora');
    frequencyPlanWrapper.style.display = isLorawan ? 'block' : 'none';
    if (!isLorawan && frequencyPlanInput) {
      frequencyPlanInput.value = '';
    }
  }

  protocolSelect?.addEventListener('change', toggleFrequencyPlan);

  // -----------------------
  // Gateway -> Frequency Plan + Building
  // -----------------------
  function applyGatewayHintsCreate() {
    if (!gatewaySelect) return;
    const opt = gatewaySelect.selectedOptions[0];
    if (!opt) return;
    const freq = opt.getAttribute('data-freq')     || '';
    const bldg = opt.getAttribute('data-building') || '';

    if (frequencyPlanInput && frequencyPlanWrapper?.style.display !== 'none') {
      const match = Array.from(frequencyPlanInput.options).find(o => o.value === freq);
      if (match) frequencyPlanInput.value = freq;
    }

    if (buildingNameInput) {
      const match = Array.from(buildingNameInput.options).find(o => o.value === bldg);
      buildingNameInput.value = match ? bldg : '';
    }

    populateFloors(floorSelect, buildingNameInput?.value || '');
  }

  gatewaySelect?.addEventListener('change', applyGatewayHintsCreate);

// Floor dynamique selon building (Add)
buildingNameInput?.addEventListener('change', () => {
  populateFloors(floorSelect, buildingNameInput.value);
});

  // -----------------------
  // Formatage HEX
  // -----------------------
  devEuiInput?.addEventListener('input', () => {
    devEuiInput.value = keepHexAndUpper(devEuiInput.value).slice(0, 16);
  });
  joinEuiInput?.addEventListener('input', () => {
    joinEuiInput.value = keepHexAndUpper(joinEuiInput.value).slice(0, 16);
  });
  appKeyInput?.addEventListener('input', () => {
    appKeyInput.value = keepHexAndUpper(appKeyInput.value).slice(0, 32);
  });

  // -----------------------
  // Table rendering
  // -----------------------
  function renderRows(rows) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    rows.forEach((s) => {
      const row = document.createElement('tr');
      const editClass = CAN_EDIT_SENSORS ? '' : 'disabled';
      const delClass  = CAN_EDIT_SENSORS ? '' : 'disabled';

      row.innerHTML = `
        <td>${s.idSensor ?? ''}</td>
        <td>${s.devEui ?? ''}</td>
        <td>${s.commissioningDate ?? ''}</td>
        <td>
          <span class="${s.status ? 'badge badge--ok' : 'badge badge--off'}">
            ${s.status ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>${s.buildingName ?? ''}</td>
        <td>${s.location ?? ''}</td>
        <td>${s.idGateway ?? ''}</td>
        <td>
          <div class="button-container">
            <a href="/manage-sensors/monitoring/${s.idSensor}">
              <img src="/image/monitoring-data.svg" alt="Monitor">
            </a>
            <a href="/manage-sensors/edit/${s.idSensor}" class="${editClass}" aria-disabled="${!CAN_EDIT_SENSORS}">
              <img src="/image/edit-icon.svg" alt="Edit">
            </a>
            <a href="#" class="openDeletePopup ${delClass}" data-id="${s.idSensor}" aria-disabled="${!CAN_EDIT_SENSORS}">
              <img src="/image/delete-icon.svg" alt="Delete">
            </a>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });

    if (rows.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="8" style="text-align:center; font-style:italic; padding:16px;">
          No sensors found.
        </td>
      `;
      tableBody.appendChild(emptyRow);
    }

    if (CAN_EDIT_SENSORS) {
      tableBody.querySelectorAll('.openDeletePopup').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          const id = btn.getAttribute('data-id');
          const form = document.getElementById('deleteForm');
          if (form) form.action = `/manage-sensors/delete/${id}`;
          if (modalDelete) modalDelete.style.display = 'block';
        });
      });
    } else {
      tableBody.querySelectorAll('a.disabled').forEach(disableLink);
    }
  }

  // -----------------------
  // Pagination
  // -----------------------
  function renderPagination(totalCount) {
    if (!paginationEl) return;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    paginationEl.innerHTML = '';

    const btn = (label, page, disabled = false, active = false, ariaLabel) => {
      const b = document.createElement('button');
      b.className = 'page-btn' + (active ? ' active' : '');
      b.textContent = label;
      if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
      if (disabled) b.setAttribute('disabled', 'disabled');
      b.addEventListener('click', () => {
        if (!disabled && currentPage !== page) {
          currentPage = page;
          renderRowsPaginated();
        }
      });
      return b;
    };

    paginationEl.appendChild(btn('«', 1, currentPage === 1, false, 'First page'));
    paginationEl.appendChild(btn('‹', currentPage - 1, currentPage === 1, false, 'Previous page'));

    const totalPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(totalPagesToShow / 2));
    let endPage   = Math.min(totalPages, startPage + totalPagesToShow - 1);
    if (endPage - startPage + 1 < totalPagesToShow) {
      startPage = Math.max(1, endPage - totalPagesToShow + 1);
    }
    for (let p = startPage; p <= endPage; p++) {
      paginationEl.appendChild(btn(String(p), p, false, p === currentPage));
    }

    paginationEl.appendChild(btn('›', currentPage + 1, currentPage === totalPages, false, 'Next page'));
    paginationEl.appendChild(btn('»', totalPages, currentPage === totalPages, false, 'Last page'));
  }

  function renderRowsPaginated() {
    const total    = filteredRows.length;
    const start    = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
    renderRows(pageRows);
    renderPagination(total);
    updateSensorCount(total);
  }

  function updateSensorCount(count) {
    const el = document.getElementById('sensorCount');
    if (el) el.textContent = count;
  }

  // -----------------------
  // Filtres
  // -----------------------
  function applyFilters() {
    const b = buildingFilter?.value || '';
    const s = statusFilter?.value   || '';
    const q = (searchInput?.value || '').trim();
    const d = (dateInput?.value   || '').trim();

    let rows = (SENSORS || []).slice();

    if (b) rows = rows.filter(x => (x.buildingName || '') === b);
    if (s) {
      const boolVal = (s === 'true');
      rows = rows.filter(x => String(x.status) === String(boolVal));
    }
    if (q) rows = rows.filter(x => matchesLikeOrIncludes(x.idSensor, q));
    if (d) {
      const dDate = new Date(d);
      rows = rows.filter(x => {
        if (!x.commissioningDate) return false;
        return new Date(x.commissioningDate) >= dDate;
      });
    }

    filteredRows = rows;
    currentPage  = 1;
    renderRowsPaginated();
  }

  buildingFilter?.addEventListener('change', () => { updateSelectPlaceholderStyle(buildingFilter); applyFilters(); });
  statusFilter?.addEventListener('change',   () => { updateSelectPlaceholderStyle(statusFilter);   applyFilters(); });
  searchInput?.addEventListener('input', applyFilters);
  dateInput?.addEventListener('input',   applyFilters);

  document.getElementById('clearBuilding')?.addEventListener('click', () => {
    if (!buildingFilter) return;
    buildingFilter.value = '';
    updateSelectPlaceholderStyle(buildingFilter);
    applyFilters();
  });
  document.getElementById('clearStatus')?.addEventListener('click', () => {
    if (!statusFilter) return;
    statusFilter.value = '';
    updateSelectPlaceholderStyle(statusFilter);
    applyFilters();
  });
  document.getElementById('clearSearch')?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    applyFilters();
  });
  document.getElementById('clearDate')?.addEventListener('click', () => {
    if (!dateInput) return;
    dateInput.value = '';
    applyFilters();
  });

  // -----------------------
  // Modals : Create / Edit / Delete
  // -----------------------

  // CREATE
  if (openCreateBtn && modalCreate) {
    openCreateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modalCreate.style.display = 'block';
      toggleFrequencyPlan();
      applyGatewayHintsCreate();
    });
  }
  if (closeCreateBtn && modalCreate) {
    closeCreateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modalCreate.style.display = 'none';
    });
  }

  // EDIT
if (modalEdit && floorSelectEdit) {
  // ✅ Building récupéré depuis data-building (pas depuis un select)
  const buildingEdit  = floorSelectEdit.dataset.building || '';
  const currentFloor  = floorSelectEdit.dataset.current  || '';
  populateFloors(floorSelectEdit, buildingEdit, currentFloor);
  // Pas d'event change building : on ne change pas le building en Edit
}

if (closeEditBtn && modalEdit) {
  closeEditBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modalEdit.style.display = 'none';
  });
}

  // DELETE
  if (exitDelete && modalDelete) {
    exitDelete.addEventListener('click', () => {
      const errorDiv = document.querySelector('.error-message-delete');
      if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
      modalDelete.style.display = 'none';
    });
  }

  // Fermer sur overlay click
  window.addEventListener('click', (e) => {
    if (modalCreate && e.target === modalCreate) modalCreate.style.display = 'none';
    if (modalEdit   && e.target === modalEdit)   modalEdit.style.display   = 'none';
    if (modalDelete && e.target === modalDelete) {
      const errorDiv = document.querySelector('.error-message-delete');
      if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
      modalDelete.style.display = 'none';
    }
  });

  // Fermer sur Échap
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modalCreate && getComputedStyle(modalCreate).display !== 'none') modalCreate.style.display = 'none';
    if (modalEdit   && getComputedStyle(modalEdit).display   !== 'none') modalEdit.style.display   = 'none';
    if (modalDelete && getComputedStyle(modalDelete).display !== 'none') modalDelete.style.display = 'none';
  });

  // -----------------------
  // Init page
  // -----------------------
  populateBuildings();
  filteredRows = SENSORS || [];
  renderRowsPaginated();
  toggleFrequencyPlan();
  applyGatewayHintsCreate();
});

// -----------------------
// Flatpickr
// -----------------------
if (typeof flatpickr === 'function') {
  flatpickr('.datepicker', { dateFormat: 'Y-m-d' });
}
