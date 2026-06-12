/* ============================================================
   NAAXOS ROUTER — charge les pages modulaires dans #app
   Navigation par chemins réels (/interventions, /cabinet, ...)
   + mise à jour SEO par page (title / description / canonical / OG)
   ============================================================ */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var currentPage = null;
  var pageCache = {};
  var ORIGIN = 'https://www.naaxos.fr';

  /* Pages connues (segment d'URL) */
  var KNOWN = [
    'accueil', 'interventions', 'realisations', 'secteurs', 'cabinet',
    'actualites', 'rejoindre', 'contact', 'mentions-legales',
    'politique-confidentialite'
  ];

  /* ---- Métadonnées SEO par page ---- */
  var PAGE_META = {
    accueil:       { t:"Naaxos — Cabinet de finance opérationnelle à Grenoble",
                     d:"Conseil en finance opérationnelle pour PME et ETI à Grenoble : DAF de transition, trésorerie, contrôle de gestion. Expert sous 48h. Devis gratuit →" },
    interventions: { t:"Interventions finance : DAF transition, RAF, trésorerie",
                     d:"DAF de transition, RAF, contrôle de gestion, Finance IT, gestion de crise de trésorerie : 6 interventions de finance opérationnelle. Découvrez-les →" },
    realisations:  { t:"Réalisations & cas clients — Naaxos finance PME/ETI",
                     d:"Missions de finance opérationnelle Naaxos : résultats chiffrés en trésorerie, DAF de transition et contrôle de gestion pour PME et ETI. Voir les cas →" },
    secteurs:      { t:"Secteurs — expertise finance sectorielle Naaxos",
                     d:"Industrie, distribution, tech, BTP, santé, énergie : Naaxos adapte son conseil en finance opérationnelle à chaque secteur PME et ETI. Découvrez →" },
    cabinet:       { t:"Le cabinet Naaxos — experts finance à Grenoble",
                     d:"Cabinet de finance opérationnelle fondé par des experts-comptables à Grenoble : consultants seniors, vision et valeurs. Faisons connaissance →" },
    actualites:    { t:"Actualités & analyses finance d'entreprise — Naaxos",
                     d:"Analyses terrain sur la finance d'entreprise : trésorerie, DAF de transition, pilotage et structuration financière, par Naaxos. À lire →" },
    rejoindre:     { t:"Recrutement — rejoindre le cabinet Naaxos Grenoble",
                     d:"Naaxos recrute des experts finance seniors : DAF, RAF, comptables, cash managers, auditeurs. Missions de terrain en PME et ETI. Postulez →" },
    contact:       { t:"Prendre rendez-vous — Naaxos finance Grenoble",
                     d:"Décrivez votre situation financière : un expert Naaxos vous rappelle sous 24h. Rendez-vous de 15 min, sans engagement. Contactez-nous →" },
    'mentions-legales': { t:"Mentions légales — Naaxos",
                     d:"Mentions légales du cabinet Naaxos : éditeur, hébergement et informations juridiques du site naaxos.fr." },
    'politique-confidentialite': { t:"Politique de confidentialité — Naaxos",
                     d:"Politique de confidentialité et traitement des données personnelles du cabinet de conseil Naaxos." }
  };

  /* ---- Helpers SEO ---- */
  function setMeta(attr, key, val) {
    var el = document.querySelector('meta[' + attr + '="' + key + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }
  function setCanonical(url) {
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
    el.setAttribute('href', url);
  }
  function applySeo(id) {
    var m = PAGE_META[id] || PAGE_META.accueil;
    var url = ORIGIN + (id === 'accueil' ? '/' : '/' + id);
    document.title = m.t;
    setMeta('name', 'description', m.d);
    setMeta('property', 'og:title', m.t);
    setMeta('property', 'og:description', m.d);
    setMeta('property', 'og:url', url);
    setCanonical(url);
  }

  /* ---- Normaliser une cible vers un id de page connu ---- */
  function toId(seg) {
    if (!seg) return 'accueil';
    return KNOWN.indexOf(seg) !== -1 ? seg : 'accueil';
  }
  function pathToId() {
    var seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    // Compat anciennes URL en #ancre
    if (!seg && window.location.hash) seg = window.location.hash.replace(/^#/, '');
    return toId(seg);
  }

  /* ---- Charger une page dans #app ---- */
  async function loadPage(id) {
    id = toId(id);
    if (id === currentPage) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    // Fermer le menu mobile
    var mm = document.getElementById('mobileMenu');
    if (mm) mm.classList.remove('open');

    // Récupérer le HTML (cache ou fetch) — chemin absolu, robuste quelle que soit l'URL courante
    var html = pageCache[id];
    if (!html) {
      try {
        var resp = await fetch('/pages/' + id + '.html');
        if (!resp.ok) throw new Error(resp.status);
        html = await resp.text();
        pageCache[id] = html;
      } catch (e) {
        console.warn('[router] Page introuvable:', id, e);
        if (id !== 'accueil') return loadPage('accueil');
        app.innerHTML = '<p style="padding:100px 20px;text-align:center;">Page introuvable.</p>';
        return;
      }
    }

    // Injecter
    app.innerHTML = html;
    currentPage = id;

    // Mettre à jour les métadonnées SEO de la page
    applySeo(id);

    // Rendre les widgets Turnstile éventuels de la page fraîchement injectée
    if (typeof window.renderTurnstileWidgets === 'function') {
      setTimeout(window.renderTurnstileWidgets, 60);
    }

    // Exécuter les <script> inline de la page
    app.querySelectorAll('script').forEach(function (old) {
      var s = document.createElement('script');
      if (old.src) { s.src = old.src; } else { s.textContent = old.textContent; }
      old.parentNode.replaceChild(s, old);
    });

    // Mettre à jour la nav active
    document.querySelectorAll('.nav-link').forEach(function (a) { a.classList.remove('active'); });
    var navLink = document.getElementById('nav-' + id);
    if (navLink) navLink.classList.add('active');

    // Scroll en haut
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Observer les éléments fade-up (io défini dans script.js)
    setTimeout(function () {
      if (typeof io !== 'undefined') {
        app.querySelectorAll('.fade-up:not(.visible)').forEach(function (el) { io.observe(el); });
      }
    }, 100);

    // Hooks spécifiques par page
    if (id === 'actualites' && typeof loadArticles === 'function') {
      setTimeout(loadArticles, 50);
    }
  }

  /* ---- Navigation programmatique (remplace showPage de script.js) ---- */
  window.showPage = function (id) {
    id = toId(id);
    var path = (id === 'accueil') ? '/' : '/' + id;
    if (window.location.pathname !== path) {
      history.pushState({ id: id }, '', path);
    }
    loadPage(id);
  };

  /* ---- Interception des liens internes <a href="/..."> ----
     Garde la navigation SPA (pas de rechargement complet) tout en
     conservant des liens réels, crawlables par Google. ---- */
     document.addEventListener('click', function (e) {
     // Laisser passer ctrl/cmd/clic milieu, nouvel onglet, etc.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      // Uniquement les liens internes en chemin absolu (pas http(s), mailto, tel, #)
      if (!href || href.charAt(0) !== '/' || href.charAt(1) === '/') return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      var seg = href.replace(/^\/+/, '').split(/[/?#]/)[0];
      e.preventDefault();
      e.stopPropagation();
      window.showPage(seg || 'accueil');
    });

  /* ---- Boutons précédent / suivant du navigateur ---- */
  window.addEventListener('popstate', function () {
    loadPage(pathToId());
  });

  /* ---- Page initiale ---- */
  loadPage(pathToId());
})();
