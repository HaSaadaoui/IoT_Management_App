// Récupérer les popups
var modalCreate = document.getElementById("createUserPopup");
var modalEdit = document.getElementById("editUserPopup");
var modalDelete = document.getElementById("deleteUserPopup");

// Récupérer le bouton qui ouvre la popup Create
var btnCreate = document.getElementById("openCreateBtn");

// Récupérer les éléments qui ferment les popups
var exitCreate = document.getElementById("closeCreate");
if (document.getElementById("closeEdit")) {
    var exitEdit = document.getElementById("closeEdit");
    exitEdit.addEventListener("click", () => {
        modalEdit.style.display = "none";
    });
}
var cancelDelete = document.getElementById("cancelDelete");

// Quand l'utilisateur clique sur ouvrir la popup Create
if (btnCreate) {
    btnCreate.addEventListener("click", () => {
        updateCsrfToken();
        modalCreate.style.display = "block";
    });
}

// Quand l'utilisateur clique sur Exit, fermer la popup Create
if (exitCreate) {
    exitCreate.addEventListener("click", () => {
        modalCreate.style.display = "none";
        resetModalFields();
        resetError();
    });
}

// Quand l'utilisateur clique sur Cancel, fermer la popup Delete
if (cancelDelete) {
    cancelDelete.addEventListener("click", () => {
        modalDelete.style.display = "none";
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
}

// Si l'erreur est levée alors ouvrir la popup Create, sinon fermer les popups
document.addEventListener("DOMContentLoaded", function() {
    if (modalCreate) modalCreate.style.display = "none";
    if (modalDelete) modalDelete.style.display = "none";
    if (document.querySelector(".alert-danger")) {
        modalCreate.style.display = "block";
    }
});

// Fonction pour réinitialiser les champs du formulaire Create
function resetModalFields() {
    const inputs = modalCreate.querySelectorAll("input");
    inputs.forEach(input => input.value = "");
    const select = modalCreate.querySelector("select");
    if (select) {
        select.value = "USER";
    }
}

// Fonction pour réinitialiser l'affichage de l'erreur
function resetError() {
    const errorDiv = modalCreate.querySelector(".alert-danger");
    if (errorDiv) {
        errorDiv.style.display = "none";
    }
}

let currentForm;
document.querySelectorAll(".deleteForm").forEach(form => {
    form.addEventListener('click', () => {
        event.preventDefault();
        currentForm = form;
        modalDelete.style.display = "block";
    });
});

document.getElementById('confirmDelete').addEventListener('click', () => {
    if (currentForm) currentForm.submit();
});

document.getElementById('cancelDelete').addEventListener('click', () => {
    modalDelete.style.display = 'none';
});

// retour à la page /home avec le clic retour du navigateur
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log("Page chargée depuis le cache");
        if (modalEdit) {
            modalEdit.style.display = "none";
        }
        modalCreate.style.display = "none";
        modalDelete.style.display = "none";
        window.location.href = "/home?" + new Date().getTime();
    }
});


// -----------------------
// Filtres + Pagination
// -----------------------

// Filter elements
const usernameFilter = document.getElementById('usernameFilter');
const emailFilter    = document.getElementById('emailFilter');
const roleFilter     = document.getElementById('roleFilter');
const clearRoleBtn   = document.getElementById('clearRole');

// Récupère toutes les lignes du tableau
const userRows = document.querySelectorAll('table tbody tr');
const paginationEl = document.getElementById('pagination');

// Pagination state
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredRows = [];

// Listeners pour filtres
if (usernameFilter) {
    usernameFilter.addEventListener('input', filterUsers);
    document.querySelector('[onclick*="usernameFilter"]')?.addEventListener('click', function() {
        usernameFilter.value = '';
        filterUsers();
    });
}

if (emailFilter) {
    emailFilter.addEventListener('input', filterUsers);
    document.querySelector('[onclick*="emailFilter"]')?.addEventListener('click', function() {
        emailFilter.value = '';
        filterUsers();
    });
}

if (roleFilter) {
    roleFilter.addEventListener('change', function() {
        clearRoleBtn.style.display = this.value ? 'block' : 'none';
        filterUsers();
    });
}

if (clearRoleBtn) {
    clearRoleBtn.addEventListener('click', function() {
        roleFilter.value = '';
        this.style.display = 'none';
        filterUsers();
    });
}

// Fonction de filtrage
function filterUsers() {
    const usernameValue = usernameFilter ? usernameFilter.value.toLowerCase() : '';
    const emailValue    = emailFilter ? emailFilter.value.toLowerCase() : '';
    const roleValue     = roleFilter ? roleFilter.value : '';

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

    paginationEl.innerHTML = '';

    const btn = (label, page, disabled = false, active = false) => {
        const b = document.createElement('button');
        b.className = 'page-btn' + (active ? ' active' : '');
        b.textContent = label;
        if (disabled) b.setAttribute('disabled', 'disabled');
        b.addEventListener('click', () => {
            if (!disabled && currentPage !== page) {
                currentPage = page;
                renderRowsPaginated();
            }
        });
        return b;
    };

    paginationEl.appendChild(btn('«', 1, currentPage === 1));
    paginationEl.appendChild(btn('‹', currentPage - 1, currentPage === 1));

    const totalPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(totalPagesToShow / 2));
    let endPage   = Math.min(totalPages, startPage + totalPagesToShow - 1);
    if (endPage - startPage + 1 < totalPagesToShow) {
        startPage = Math.max(1, endPage - totalPagesToShow + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
        paginationEl.appendChild(btn(String(p), p, false, p === currentPage));
    }

    paginationEl.appendChild(btn('›', currentPage + 1, currentPage === totalPages));
    paginationEl.appendChild(btn('»', totalPages, currentPage === totalPages));
}

function renderRowsPaginated() {
    const total = filteredRows.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

    // cacher toutes les lignes
    userRows.forEach(r => r.style.display = 'none');
    // afficher seulement celles de la page
    pageRows.forEach(r => r.style.display = '');
    renderPagination(total);
}

// -----------------------
// Init page
// -----------------------
document.addEventListener('DOMContentLoaded', () => {
    filteredRows = Array.from(userRows);
    renderRowsPaginated();
});
function updateCsrfToken() {
    const token = document.querySelector("meta[name='_csrf']").content;
    let csrfInput = modalCreate.querySelector("input[name='_csrf']");
    if (!csrfInput) {
        // si le champ n'existe pas, on le crée
        csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "_csrf";
        modalCreate.querySelector("form").prepend(csrfInput);
    }
    csrfInput.value = token;
}