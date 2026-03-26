// ============================================================
// i18n.js — Système de traduction JSON
// Usage :
//   data-i18n="key"              → remplace textContent
//   data-i18n-placeholder="key" → remplace placeholder
//   data-i18n-title="key"       → remplace title (tooltip)
//   i18n.t('key')               → retourne la traduction dans le JS
// ============================================================

const i18n = (function () {

    let _translations = {};
    let _lang = 'fr';

    // Retourne la traduction pour une clé, ou fallback, ou la clé elle-même
    function t(key, fallback) {
        return (_translations[key] !== undefined && _translations[key] !== '')
            ? _translations[key]
            : (fallback !== undefined ? fallback : key);
    }

    // Applique toutes les traductions aux éléments du DOM
    function apply() {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var val = t(el.getAttribute('data-i18n'));
            if (val) el.textContent = val;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var val = t(el.getAttribute('data-i18n-placeholder'));
            if (val) el.placeholder = val;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var val = t(el.getAttribute('data-i18n-title'));
            if (val) el.title = val;
        });
    }

    // Charge un fichier de langue depuis /i18n/{lang}.json
    async function load(lang) {
        try {
            var resp = await fetch('/i18n/' + lang + '.json');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            _translations = await resp.json();
            _lang = lang;
        } catch (e) {
            console.warn('[i18n] Impossible de charger la langue "' + lang + '" :', e.message);
        }
    }

    // Détecte la langue du navigateur parmi les langues supportées, sinon 'fr'
    function browserLang() {
        var supported = ['fr', 'en'];
        var raw = (navigator.language || navigator.userLanguage || 'fr').toLowerCase().split('-')[0];
        return supported.indexOf(raw) !== -1 ? raw : 'fr';
    }

    // Initialise depuis la langue du navigateur
    async function init() {
        await load(browserLang());
        apply();
    }

    return {
        t: t,
        apply: apply,
        init: init,
        get lang() { return _lang; }
    };

})();
