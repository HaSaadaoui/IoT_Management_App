// =======================
// Manage Users (JS)
// =======================

// -----------------------
// Références globales
// -----------------------
var modalCreate = document.getElementById("createUserPopup");
var modalEdit   = document.getElementById("editUserPopup");
var modalDelete = document.getElementById("deleteUserPopup");

const loggedRole = document.body?.dataset?.loggedRole || "";

var btnCreate  = document.getElementById("openCreateBtn");
var exitCreate = document.getElementById("closeCreate");

// -----------------------
// Helpers
// -----------------------
function resetModalFields() {
    if (!modalCreate) return;
    modalCreate.querySelectorAll("input").forEach(input => {
        if (input.type !== "hidden") input.value = "";
    });
    const select = modalCreate.querySelector("select[name='role']");
    if (select) {
        select.value    = "USER";
        select.disabled = loggedRole === "SUPERUSER";
    }
}

function resetError() {
    if (!modalCreate) return;
    const errorDiv = modalCreate.querySelector(".alert-danger");
    if (errorDiv) errorDiv.style.display = "none";
}

function updateCsrfToken() {
    const token = document.querySelector("meta[name='_csrf']")?.content;
    if (!token || !modalCreate) return;
    const form = modalCreate.querySelector("form");
    if (!form) return;
    let csrfInput = form.querySelector("input[name='_csrf']");
    if (!csrfInput) {
        csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "_csrf";
        form.prepend(csrfInput);
    }
    csrfInput.value = token;
}

// -----------------------
// Bouton Create
// -----------------------
if (btnCreate) {
    btnCreate.addEventListener("click", () => {
        updateCsrfToken();
        if (modalCreate) modalCreate.style.display = "block";
        if (loggedRole === "SUPERUSER") {
            const select = modalCreate?.querySelector("select[name='role']");
            if (select) { select.value = "USER"; select.disabled = true; }
        }
    });
}

if (exitCreate) {
    exitCreate.addEventListener("click", () => {
        if (modalCreate) modalCreate.style.display = "none";
        resetModalFields();
        resetError();
    });
}

// -----------------------
// Fermer sur overlay click
// -----------------------
window.onclick = function(event) {
    [modalCreate, modalEdit, modalDelete].forEach(modal => {
        if (modal && event.target === modal) {
            modal.style.display = "none";
            if (modal === modalCreate) { resetModalFields(); resetError(); }
        }
    });
};

// -----------------------
// Delete popup
// -----------------------
let currentForm = null;

document.querySelectorAll(".deleteForm").forEach(form => {
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        currentForm = form;
        if (modalDelete) modalDelete.style.display = "block";
    });
});

const confirmDeleteBtn = document.getElementById("confirmDelete");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", () => {
        if (currentForm) currentForm.submit();
    });
}

const cancelDeleteBtn = document.getElementById("cancelDelete");
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
        if (modalDelete) modalDelete.style.display = "none";
    });
}

// -----------------------
// Retour navigateur (cache)
// -----------------------
window.addEventListener("pageshow", function(event) {
    if (event.persisted) {
        if (modalEdit)   modalEdit.style.display   = "none";
        if (modalCreate) modalCreate.style.display = "none";
        if (modalDelete) modalDelete.style.display = "none";
        window.location.href = "/home?" + new Date().getTime();
    }
});

// -----------------------
// Filtres — déclarations (AVANT DOMContentLoaded)
// -----------------------
const usernameFilter = document.getElementById("usernameFilter");
const emailFilter    = document.getElementById("emailFilter");
const roleFilter     = document.getElementById("roleFilter");
const clearRoleBtn   = document.getElementById("clearRole");
const userRows       = document.querySelectorAll("table tbody tr");
const paginationEl   = document.getElementById("pagination");

const PAGE_SIZE = 10;
let currentPage = 1;
let filteredRows = [];

// Listeners filtres
if (usernameFilter) usernameFilter.addEventListener("input", filterUsers);
if (emailFilter)    emailFilter.addEventListener("input", filterUsers);

if (roleFilter) {
    roleFilter.addEventListener("change", function() {
        if (clearRoleBtn) clearRoleBtn.style.display = this.value ? "block" : "none";
        filterUsers();
    });
}

if (clearRoleBtn) {
    clearRoleBtn.addEventListener("click", function() {
        roleFilter.value   = "";
        this.style.display = "none";
        filterUsers();
    });
}

document.querySelector('[onclick*="usernameFilter"]')?.addEventListener("click", function() {
    if (usernameFilter) { usernameFilter.value = ""; filterUsers(); }
});
document.querySelector('[onclick*="emailFilter"]')?.addEventListener("click", function() {
    if (emailFilter) { emailFilter.value = ""; filterUsers(); }
});

// -----------------------
// Filtrage
// -----------------------
function filterUsers() {
    const usernameValue = (usernameFilter?.value || "").toLowerCase();
    const emailValue    = (emailFilter?.value    || "").toLowerCase();
    const roleValue     =  roleFilter?.value     || "";

    filteredRows = Array.from(userRows).filter(row => {
        const username = row.cells[0]?.textContent.toLowerCase() || "";
        const email    = row.cells[3]?.textContent.toLowerCase() || "";
        const role     = row.cells[4]?.textContent.trim()        || "";
        return username.includes(usernameValue)
            && email.includes(emailValue)
            && (!roleValue || role === roleValue);
    });

    currentPage = 1;
    renderRowsPaginated();
}

// -----------------------
// Pagination
// -----------------------
function renderPagination(totalCount) {
    if (!paginationEl) return;

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    paginationEl.innerHTML = "";

    const btn = (label, page, disabled = false, active = false) => {
        const b = document.createElement("button");
        b.className = "page-btn" + (active ? " active" : "");
        b.textContent = label;
        if (disabled) b.setAttribute("disabled", "disabled");
        b.addEventListener("click", () => {
            if (!disabled && currentPage !== page) {
                currentPage = page;
                renderRowsPaginated();
            }
        });
        return b;
    };

    paginationEl.appendChild(btn("«", 1, currentPage === 1));
    paginationEl.appendChild(btn("‹", currentPage - 1, currentPage === 1));

    const totalPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(totalPagesToShow / 2));
    let endPage   = Math.min(totalPages, startPage + totalPagesToShow - 1);
    if (endPage - startPage + 1 < totalPagesToShow) {
        startPage = Math.max(1, endPage - totalPagesToShow + 1);
    }
    for (let p = startPage; p <= endPage; p++) {
        paginationEl.appendChild(btn(String(p), p, false, p === currentPage));
    }

    paginationEl.appendChild(btn("›", currentPage + 1, currentPage === totalPages));
    paginationEl.appendChild(btn("»", totalPages, currentPage === totalPages));
}

function renderRowsPaginated() {
    const total    = filteredRows.length;
    const start    = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
    userRows.forEach(r => r.style.display = "none");
    pageRows.forEach(r => r.style.display = "");
    renderPagination(total);
}

// -----------------------
// DOMContentLoaded — en dernier
// -----------------------
document.addEventListener("DOMContentLoaded", function() {

    // État initial des modals
    if (modalCreate) modalCreate.style.display = "none";
    if (modalDelete) modalDelete.style.display = "none";

    // Ouvrir Edit automatiquement si editUser chargé par le serveur
    if (modalEdit) modalEdit.style.display = "block";

    // Fermer le modal Edit
    const closeEditBtn = document.getElementById("closeEdit");
    if (closeEditBtn && modalEdit) {
        closeEditBtn.addEventListener("click", () => {
            modalEdit.style.display = "none";
        });
    }

    // SUPERUSER : verrouille les rôles
    if (loggedRole === "SUPERUSER") {
        const createRole = document.querySelector("#createUserPopup select[name='role']");
        if (createRole) { createRole.value = "USER"; createRole.disabled = true; }
        const editRole = document.querySelector("#editUserPopup select#role");
        if (editRole) editRole.disabled = true;
    }

    // Ouvrir Create si erreur serveur
    if (document.querySelector(".alert-danger")) {
        if (modalCreate) modalCreate.style.display = "block";
    }

    // Init pagination
    filteredRows = Array.from(userRows);
    renderRowsPaginated();
});
