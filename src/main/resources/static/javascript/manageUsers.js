// -----------------------
// Modals + CRUD actions
// -----------------------

// Récupérer les popups
var modalCreate = document.getElementById("createUserPopup");
var modalEdit   = document.getElementById("editUserPopup");
var modalDelete = document.getElementById("deleteUserPopup");

// Role logged (depuis <body data-logged-role="...">)
const loggedRole = document.body?.dataset?.loggedRole || "";

// Récupérer le bouton qui ouvre la popup Create
var btnCreate = document.getElementById("openCreateBtn");

// Récupérer les éléments qui ferment les popups
var exitCreate = document.getElementById("closeCreate");

if (document.getElementById("closeEdit")) {
    var exitEdit = document.getElementById("closeEdit");
    exitEdit.addEventListener("click", () => {
        if (modalEdit) modalEdit.style.display = "none";
    });
}

var cancelDelete = document.getElementById("cancelDelete");

// Quand l'utilisateur clique sur ouvrir la popup Create
if (btnCreate) {
    btnCreate.addEventListener("click", () => {
        updateCsrfToken();
        if (modalCreate) modalCreate.style.display = "block";

        // SUPERUSER : impose USER + disabled (sécurité front)
        if (loggedRole === "SUPERUSER") {
            const select = modalCreate?.querySelector("select[name='role']");
            if (select) {
                select.value = "USER";
                select.disabled = true;
            }
        }
    });
}

// Quand l'utilisateur clique sur Exit, fermer la popup Create
if (exitCreate) {
    exitCreate.addEventListener("click", () => {
        if (modalCreate) modalCreate.style.display = "none";
        resetModalFields();
        resetError();
    });
}

// Quand l'utilisateur clique sur Cancel, fermer la popup Delete
if (cancelDelete) {
    cancelDelete.addEventListener("click", () => {
        if (modalDelete) modalDelete.style.display = "none";
    });
}

// Quand l'utilisateur clique en dehors d'une popup, la fermer
window.onclick = function(event) {
    [modalCreate, modalEdit, modalDelete].forEach(modal => {
        if (modal && event.target === modal) {
            modal.style.display = "none";
            if (modal === modalCreate) {
                resetModalFields();
                resetError();
            }
        }
    });
};

// Si l'erreur est levée alors ouvrir la popup Create, sinon fermer les popups
document.addEventListener("DOMContentLoaded", function() {
    if (modalCreate) modalCreate.style.display = "none";
    if (modalDelete) modalDelete.style.display = "none";

    // SUPERUSER : verrouille le role create + edit au chargement (sécurité front)
    if (loggedRole === "SUPERUSER") {
        const createRole = document.querySelector("#createUserPopup select[name='role']");
        if (createRole) {
            createRole.value = "USER";
            createRole.disabled = true;
        }
        const editRole = document.querySelector("#editUserPopup select#role");
        if (editRole) {
            editRole.disabled = true;
        }
    }

    if (document.querySelector(".alert-danger")) {
        if (modalCreate) modalCreate.style.display = "block";
    }
});

// Fonction pour réinitialiser les champs du formulaire Create
function resetModalFields() {
    if (!modalCreate) return;

    const inputs = modalCreate.querySelectorAll("input");
    inputs.forEach(input => {
        // ne pas reset les hidden (role/_csrf) par défaut
        if (input.type !== "hidden") input.value = "";
    });

    const select = modalCreate.querySelector("select[name='role']");
    if (select) {
        select.value = "USER";
        if (loggedRole === "SUPERUSER") {
            select.disabled = true;
        } else {
            select.disabled = false;
        }
    }
}

// Fonction pour réinitialiser l'affichage de l'erreur
function resetError() {
    if (!modalCreate) return;
    const errorDiv = modalCreate.querySelector(".alert-danger");
    if (errorDiv) {
        errorDiv.style.display = "none";
    }
}

// Delete : ouvrir la popup sur SUBMIT (plus fiable que click)
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

// retour à la page /home avec le clic retour du navigateur
window.addEventListener("pageshow", function(event) {
    if (event.persisted) {
        console.log("Page chargée depuis le cache");
        if (modalEdit) modalEdit.style.display = "none";
        if (modalCreate) modalCreate.style.display = "none";
        if (modalDelete) modalDelete.style.display = "none";
        window.location.href = "/home?" + new Date().getTime();
    }
});


// -----------------------
// Filtres + Pagination
// -----------------------

// Filter elements
const usernameFilter = document.getElementById("usernameFilter");
const emailFilter    = document.getElementById("emailFilter");
const roleFilter     = document.getElementById("roleFilter");
const clearRoleBtn   = document.getElementById("clearRole");

// Récupère toutes les lignes du tableau
const userRows = document.querySelectorAll("table tbody tr");
const paginationEl = document.getElementById("pagination");

// Pagination state
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredRows = [];

// Listeners pour filtres
if (usernameFilter) {
    usernameFilter.addEventListener("input", filterUsers);
    document.querySelector('[onclick*="usernameFilter"]')?.addEventListener("click", function() {
        usernameFilter.value = "";
        filterUsers();
    });
}

if (emailFilter) {
    emailFilter.addEventListener("input", filterUsers);
    document.querySelector('[onclick*="emailFilter"]')?.addEventListener("click", function() {
        emailFilter.value = "";
        filterUsers();
    });
}

if (roleFilter) {
    roleFilter.addEventListener("change", function() {
        if (clearRoleBtn) clearRoleBtn.style.display = this.value ? "block" : "none";
        filterUsers();
    });
}

if (clearRoleBtn) {
    clearRoleBtn.addEventListener("click", function() {
        roleFilter.value = "";
        this.style.display = "none";
        filterUsers();
    });
}

// Fonction de filtrage
function filterUsers() {
    const usernameValue = usernameFilter ? usernameFilter.value.toLowerCase() : "";
    const emailValue    = emailFilter ? emailFilter.value.toLowerCase() : "";
    const roleValue     = roleFilter ? roleFilter.value : "";

    const rows = Array.from(userRows).filter(row => {
        const username = row.cells[0].textContent.toLowerCase();
        const email    = row.cells[3].textContent.toLowerCase();
        const role     = row.cells[4].textContent.trim();

        const matchesUsername = username.includes(usernameValue);
        const matchesEmail    = email.includes(emailValue);
        const matchesRole     = !roleValue || role === roleValue;

        return matchesUsername && matchesEmail && matchesRole;
    });

    filteredRows = rows;
    currentPage = 1;
    renderRowsPaginated();
}

// -----------------------
// Pagination functions
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
    const total = filteredRows.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

    // cacher toutes les lignes
    userRows.forEach(r => r.style.display = "none");
    // afficher seulement celles de la page
    pageRows.forEach(r => r.style.display = "");
    renderPagination(total);
}

// -----------------------
// Init page
// -----------------------
document.addEventListener("DOMContentLoaded", () => {
    filteredRows = Array.from(userRows);
    renderRowsPaginated();
});

function updateCsrfToken() {
    const token = document.querySelector("meta[name='_csrf']")?.content;
    if (!token || !modalCreate) return;

    const form = modalCreate.querySelector("form");
    if (!form) return;

    let csrfInput = form.querySelector("input[name='_csrf']");
    if (!csrfInput) {
        // si le champ n'existe pas, on le crée
        csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "_csrf";
        form.prepend(csrfInput);
    }
    csrfInput.value = token;
}