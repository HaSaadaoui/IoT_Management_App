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
