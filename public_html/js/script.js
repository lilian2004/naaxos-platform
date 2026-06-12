/* ---- PAGE NAVIGATION ----
   La navigation est gérée par router.js (chargement des pages via fetch
   dans #app). L'ancienne fonction showPage monolithique (qui cherchait
   des éléments #page-xxx désormais inexistants) a été retirée. ---- */

/* ---- NAV SCROLL ---- */
const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => { navEl.classList.toggle('scrolled', window.scrollY > 24); });

/* ---- MOBILE ---- */
function toggleMobile() { document.getElementById('mobileMenu').classList.toggle('open'); }

/* ---- INTERSECTION OBSERVER ---- */
const io = new IntersectionObserver(entries => {
  entries.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), i * 80); });
}, { threshold: 0.08 });
// Note : les éléments .fade-up sont observés par router.js après chaque
// injection de page (au démarrage, #app est encore vide ici).

/* ---- FAQ ---- */
function toggleFaq(el) {
  const item = el.closest ? el.closest('.faq-item') : el.parentElement;
  if (!item) return;
  const isOpen = item.classList.contains('open');
  const parent = item.parentElement;
  if (parent) parent.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

/* ---- CV FORM ---- */
var _cvBase64 = null, _cvFileName = null, _cvMimeType = null;

function handleCvUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const MAX_MB = 5;
  if (file.size > MAX_MB * 1024 * 1024) {
    alert('Le fichier dépasse ' + MAX_MB + ' Mo. Veuillez compresser votre CV.');
    input.value = ''; return;
  }
  const allowed = ['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
    alert('Format non autorisé. Veuillez utiliser un fichier PDF, DOC ou DOCX.'); input.value = ''; return;
  }
  _cvFileName = file.name; _cvMimeType = file.type || 'application/octet-stream';
  const reader = new FileReader();
  reader.onload = function(e) {
    _cvBase64 = e.target.result.split(',')[1];
    document.getElementById('cvFileName').textContent = '✅ ' + file.name;
    document.getElementById('cvDropZone').style.borderColor = '#22c55e';
    document.getElementById('cvError').style.display = 'none';
  };
  reader.onerror = function() { alert('Erreur de lecture. Réessayez.'); _cvBase64 = null; };
  reader.readAsDataURL(file);
}

async function submitCvForm() {
  const prenom = (document.getElementById('cv_prenom')||{value:''}).value.trim();
  const nom    = (document.getElementById('cv_nom')||{value:''}).value.trim();
  const email  = (document.getElementById('cv_email')||{value:''}).value.trim();
  const poste  = (document.getElementById('cv_poste')||{value:''}).value;
  const dispo  = (document.getElementById('cv_disponibilite')||{value:''}).value;
  const errDiv = document.getElementById('cvFormError');
  const cvErrDiv = document.getElementById('cvError');
  // Honeypot : champ invisible rempli = bot → succès silencieux, pas d'envoi
  const hp = (document.getElementById('cv_website')||{value:''}).value;
  if (hp) { document.getElementById('cvSuccess').style.display = 'block'; return; }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  let ok = true;
  if (!prenom || prenom.length > 80 || !nom || nom.length > 80 ||
      !emailOk || email.length > 150 || !poste || !dispo) ok = false;
  if (!_cvBase64) { if(cvErrDiv) cvErrDiv.style.display='block'; ok = false; }
  else { if(cvErrDiv) cvErrDiv.style.display='none'; }
  if (!ok) { if(errDiv) errDiv.style.display='block'; return; }
  if(errDiv) errDiv.style.display='none';

  // Jeton anti-bot Turnstile obligatoire
  const token = _turnstileToken('cvTurnstile');
  if (!token) {
    if (errDiv) {
      var pt = errDiv.querySelector('p');
      if (pt) pt.textContent = '⚠️ Merci de compléter la vérification anti-robot.';
      errDiv.style.display='block';
    }
    return;
  }

  const btn = document.getElementById('cvSubmitBtn');
  if (btn) { btn.textContent = 'Envoi en cours…'; btn.disabled = true; }

  const data = {
    __token:       token,
    prenom:        prenom,
    nom:           nom,
    email:         email,
    poste:         poste,
    disponibilite: dispo
  };
  const cv = {
    filename: _cvFileName,
    mimetype: _cvMimeType,
    base64:   _cvBase64
  };

  try {
    // Écriture via l'Edge Function : valide le CV, l'upload dans le bucket privé, insère la ligne
    await submitToFunction('candidature', data, cv);
    document.getElementById('cvSuccess').style.display = 'block';
    if (btn) { btn.textContent = '✅ Candidature envoyée'; btn.style.background='#22c55e'; btn.disabled=true; }
  } catch(err) {
    console.error('[Naaxos] CV form error:', err);
    _turnstileReset('cvTurnstile');
    if (btn) { btn.textContent = 'Envoyer ma candidature →'; btn.disabled = false; }
    if (errDiv) {
      var p = errDiv.querySelector('p');
      if (p) p.textContent = '⚠️ Erreur envoi candidature : ' + (err && err.message ? err.message : String(err));
      errDiv.style.display='block';
    }
  }
}

function scrollToCvForm() {
  const s = document.getElementById('cv-form-section');
  if (s) { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

/* ======================================================
   PROJECT DATA
====================================================== */
const PROJECTS = {
  'crise-tresorerie': {
    tag: '🔴 Crise de trésorerie · BTP · 80 salariés',
    title: 'Sortie de crise de trésorerie en 72h',
    context: 'PME du BTP en situation critique : difficultés répétées à payer les fournisseurs, compte bancaire en alerte, dirigeant dépassé par la situation. Le cabinet partenaire a orienté vers Naaxos en urgence.',
    kpis: [
      { num: '72h', label: 'Diagnostic réalisé' },
      { num: '+900K€', label: 'Lignes négociées' },
      { num: '3 mois', label: 'Stabilisation' },
    ],
    steps: [
      { title: 'Diagnostic flash', desc: 'Analyse des flux entrants/sortants sur 90 jours, identification des risques immédiats, cartographie des créanciers prioritaires.' },
      { title: 'Plan d\'action immédiat', desc: 'Priorisation des paiements, négociation d\'échelonnements avec les fournisseurs critiques, sécurisation des contrats en cours.' },
      { title: 'Négociation bancaire', desc: 'Présentation d\'un dossier structuré aux partenaires bancaires. Obtention de 900K€ de lignes supplémentaires en moins d\'une semaine.' },
      { title: 'Pilotage 90 jours', desc: 'Mise en place d\'un plan de trésorerie hebdomadaire, réunions de suivi bi-hebdomadaires avec la direction, formation de l\'équipe finance.' },
    ],
    conclusion: 'La PME a évité la cessation de paiements. Six mois après la mission, la trésorerie est positive et le pilotage est internalisé.'
  },
  'daf-transition': {
    tag: '🔄 DAF de transition · Retail · 250 salariés',
    title: 'Prise de poste en 48h, continuité totale',
    context: 'Départ brutal du DAF d\'un groupe retail en pleine période de clôtures. La direction ne disposait d\'aucun successeur interne. Risque fort sur la continuité financière et la relation avec les parties prenantes.',
    kpis: [
      { num: '48h', label: 'Prise de poste' },
      { num: '0', label: 'Rupture de continuité' },
      { num: '8 mois', label: 'Durée mission' },
    ],
    steps: [
      { title: 'Prise en charge immédiate', desc: 'Arrivée sous 48h. Briefing direction, prise de connaissance du dossier, management de l\'équipe finance (6 personnes).' },
      { title: 'Continuité des clôtures', desc: 'Clôture mensuelle réalisée dans les délais habituels. Reporting maintenu sans interruption malgré le changement.' },
      { title: 'Accompagnement stratégique', desc: 'Préparation des budgets annuels, conseil sur les décisions d\'investissement, accompagnement de la direction générale.' },
      { title: 'Passation & recrutement', desc: 'Pilotage du recrutement du DAF permanent, onboarding, passation de 3 mois. Mission terminée sans friction.' },
    ],
    conclusion: 'Zéro rupture de continuité financière. Le DAF recruté a bénéficié d\'une passation structurée et documentée.'
  },
  'reporting': {
    tag: '📊 Reporting · Industrie · 120 salariés',
    title: 'Refonte du reporting : de 12 jours à J+7',
    context: 'PME industrielle avec une clôture mensuelle prenant 12 jours ouvrés. Données peu fiables, direction sans pilotage réel, décisions prises à l\'aveugle. Un frein direct à la croissance.',
    kpis: [
      { num: '−40%', label: 'Délai de clôture' },
      { num: 'J+7', label: 'Clôture finale' },
      { num: '3 mois', label: 'Durée mission' },
    ],
    steps: [
      { title: 'Audit des processus', desc: 'Cartographie de tous les flux d\'information financière. Identification des goulets d\'étranglement et des saisies manuelles redondantes.' },
      { title: 'Refonte des flux de données', desc: 'Automatisation des interfaces entre l\'ERP et les outils de reporting. Réduction de 60% des saisies manuelles.' },
      { title: 'Construction des tableaux de bord', desc: 'Conception de 3 niveaux de reporting : opérationnel (quotidien), tactique (mensuel), stratégique (trimestriel).' },
      { title: 'Formation et transfert', desc: 'Formation de l\'équipe finance sur les nouveaux processus. Accompagnement pendant 2 mois post-déploiement.' },
    ],
    conclusion: 'La direction dispose désormais de chiffres fiables à J+7. La clôture mensuelle est passée de 12 à 7 jours.'
  },
  'bfr-distribution': {
    tag: '⚖️ BFR · Distribution · 15M€ CA',
    title: 'Optimisation du BFR : +2M€ de trésorerie libérée',
    context: 'PME de distribution avec un BFR structurellement trop élevé. Malgré une rentabilité correcte, la trésorerie était en tension permanente. Le dirigeant ne comprenait pas pourquoi.',
    kpis: [
      { num: '+2M€', label: 'Trésorerie libérée' },
      { num: '−18j', label: 'DSO réduit' },
      { num: '4 mois', label: 'Mission' },
    ],
    steps: [
      { title: 'Diagnostic BFR', desc: 'Analyse complète DSO (65j → 47j), DPO, rotation des stocks. Identification des 20% de clients qui expliquent 80% du problème.' },
      { title: 'Plan d\'action clients', desc: 'Renégociation des conditions de paiement, mise en place d\'un processus de relance structuré, factoring sélectif.' },
      { title: 'Optimisation des stocks', desc: 'Segmentation ABC des SKUs, réduction du stock de sécurité sur les lignes lentes. Stock optimisé de −20%.' },
      { title: 'Pilotage hebdomadaire', desc: 'Tableau de bord BFR quotidien, alertes automatiques sur les dépassements, reporting mensuel pour la direction.' },
    ],
    conclusion: '2M€ de trésorerie libérée en 4 mois. La PME a pu financer son développement sans recourir au crédit bancaire.'
  },
  'levee-fonds': {
    tag: '💰 Levée de fonds · Tech / SaaS · Série A',
    title: 'Structuration & levée de 5M€ en 6 semaines',
    context: 'Start-up SaaS en forte croissance, sans CFO, face à des investisseurs institutionnels exigeants. Le fondateur gérait seul la finance avec des outils inadaptés. La data room était inexistante.',
    kpis: [
      { num: '5M€', label: 'Levée réalisée' },
      { num: '6 sem.', label: 'Structuration' },
      { num: '3', label: 'Term sheets reçus' },
    ],
    steps: [
      { title: 'Audit finance & métriques', desc: 'Reconstruction de l\'historique financier sur 3 ans. Mise en place des métriques SaaS : ARR, MRR, churn, CAC, LTV.' },
      { title: 'Business plan financier', desc: 'Modélisation financière sur 5 ans avec 3 scénarios. Hypothèses documentées et defensibles face aux investisseurs.' },
      { title: 'Data room complète', desc: 'Constitution de la data room : légal, financial, commercial, RH. Due diligence préparée à l\'avance pour accélérer la clôture.' },
      { title: 'Accompagnement roadshow', desc: 'Préparation des pitchs financiers, simulation des questions investisseurs, support pendant les négociations.' },
    ],
    conclusion: '3 term sheets reçus. Levée de 5M€ bouclée en 6 semaines. L\'investisseur principal a salué la qualité du dossier financier.'
  },
  'ma': {
    tag: '🤝 M&A · Services B2B · 30M€ CA',
    title: 'Acquisition & intégration financière complète en 5 mois',
    context: 'PME de services B2B ayant acquis un concurrent de taille similaire. Systèmes d\'information hétérogènes, comptabilités distinctes, cultures d\'entreprise différentes. Risque fort sur la continuité.',
    kpis: [
      { num: '5 mois', label: 'Intégration complète' },
      { num: '−30%', label: 'Coûts de structure' },
      { num: '1', label: 'Reporting unifié' },
    ],
    steps: [
      { title: 'Due diligence financière', desc: 'Analyse complète des comptes de la cible : retraitement des provisions, identification des risques cachés, valorisation des actifs.' },
      { title: 'Plan d\'intégration', desc: 'Feuille de route sur 100 jours : priorités, responsabilités, quick wins identifiés, roadmap système.' },
      { title: 'Harmonisation des processus', desc: 'Fusion des plans comptables, uniformisation des processus de clôture, intégration des équipes finance.' },
      { title: 'Synergies et économies', desc: 'Identification et réalisation de 30% d\'économies sur les coûts de structure. Reporting consolidé opérationnel à M+5.' },
    ],
    conclusion: 'Intégration réalisée en 5 mois contre 12 mois estimés initialement. 30% d\'économies sur les coûts de structure réalisées dès la première année.'
  },
  'schneider': {
    tag: '⚡ Énergie & Environnement · Schneider Electric',
    title: 'Projet Schneider : Contrôle de gestion & reporting RSE',
    context: 'Naaxos a été sollicité par une filiale Schneider Electric pour structurer le contrôle de gestion d\'un programme d\'efficacité énergétique et mettre en place le reporting extra-financier requis par les investisseurs institutionnels.',
    kpis: [
      { num: '12', label: 'Sites pilotés' },
      { num: '100%', label: 'KPIs RSE tracés' },
      { num: '4 mois', label: 'Déploiement' },
    ],
    steps: [
      { title: 'Audit du dispositif existant', desc: 'Analyse des flux financiers liés au programme, cartographie des données disponibles, identification des lacunes.' },
      { title: 'Structuration du contrôle de gestion', desc: 'Mise en place d\'un suivi budgétaire par site, indicateurs de performance économique et environnementale.' },
      { title: 'Reporting extra-financier', desc: 'Construction d\'un dashboard ESG conforme aux standards requis : émissions CO2, économies d\'énergie réalisées, ROI par programme.' },
      { title: 'Formation des équipes', desc: 'Formation des responsables de site et du contrôleur de gestion groupe sur les nouveaux outils.' },
    ],
    conclusion: 'Le programme dispose désormais d\'un pilotage financier rigoureux aligné avec les exigences des investisseurs ESG. Référence Schneider Electric depuis 2024.'
  },
  'sante': {
    tag: '🩺 Santé & Médico-social · Groupe de cliniques',
    title: 'Structuration financière d\'un groupe de cliniques',
    context: 'Groupe de 4 cliniques privées en forte croissance. La fonction finance était géminée entre les établissements, sans vision consolidée, sans DAF groupe. La direction cherchait à structurer avant une éventuelle cession.',
    kpis: [
      { num: '4', label: 'Cliniques consolidées' },
      { num: '6 mois', label: 'Structuration' },
      { num: '+18%', label: 'Marge EBITDA visible' },
    ],
    steps: [
      { title: 'DAF groupe de transition', desc: 'Prise en charge de la direction financière groupe. Harmonisation des processus comptables entre les 4 établissements.' },
      { title: 'Reporting consolidé', desc: 'Premier reporting consolidé mensuel. Identification des établissements sous-performants et des leviers d\'amélioration.' },
      { title: 'Préparation cession', desc: 'Structuration de la data room, retraitement des comptes IFRS, normalisation de l\'EBITDA pour présentation aux acquéreurs.' },
      { title: 'Accompagnement des négociations', desc: 'Support financier pendant les négociations avec 2 fonds d\'investissement. Défense des hypothèses du business plan.' },
    ],
    conclusion: 'Le groupe a été valorisé 18% au-dessus de l\'estimation initiale grâce à la qualité du dossier financier. Mission de 6 mois.'
  },
  'structuration': {
    tag: '🚀 Structuration · Tech SaaS · 50 salariés',
    title: 'Structuration de la fonction finance après une levée',
    context: 'Scale-up ayant réalisé une levée de 8M€. Les processus finance n\'avaient pas suivi la croissance. Équipe de 50 personnes avec une seule comptable et aucun outil de pilotage adapté.',
    kpis: [
      { num: '6 mois', label: 'Structuration' },
      { num: '×3', label: 'Vitesse clôture' },
      { num: '1 DAF', label: 'Recruté & formé' },
    ],
    steps: [
      { title: 'Audit de la fonction finance', desc: 'Cartographie des processus, évaluation des outils, identification des risques opérationnels et des quick wins.' },
      { title: 'Déploiement ERP & outils', desc: 'Sélection et déploiement d\'un ERP adapté, intégration avec les outils métier (CRM, RH), formation des équipes.' },
      { title: 'Construction du reporting', desc: 'Tableau de bord SaaS (ARR, MRR, CAC, LTV), reporting mensuel pour le board, prévisions de trésorerie automatisées.' },
      { title: 'Recrutement & passation', desc: 'Définition du profil DAF, participation aux entretiens, onboarding et passation sur 2 mois.' },
    ],
    conclusion: 'La scale-up dispose d\'une fonction finance solide et scalable. Le DAF recruté s\'appuie sur des fondations robustes pour accompagner la prochaine phase de croissance.'
  },
  'depart-brutal': {
    tag: '🤝 Départ brutal · PME/ETI',
    title: 'Continuité financière immédiate après départ soudain',
    context: 'Départ imprévu d\'un responsable finance (DAF/RAF/Responsable comptable). Risque immédiat sur la continuité des clôtures, la trésorerie et la relation avec les partenaires (banques, CAC, direction).',
    kpis: [
      { num: '48h', label: 'Prise en charge' },
      { num: '0', label: 'Rupture opérationnelle' },
      { num: '100%', label: 'Dossiers sécurisés' }
    ],
    steps: [
      { title: 'Stabilisation immédiate', desc: 'Priorisation des sujets critiques (trésorerie, paiements, clôture, obligations réglementaires) et reprise du pilotage quotidien.' },
      { title: 'Sécurisation des dossiers', desc: 'Reprise des dossiers en cours, documentation des points de risque, continuité des échanges avec la direction et les partenaires externes.' },
      { title: 'Organisation transitoire', desc: 'Mise en place d\'une gouvernance claire, répartition des responsabilités et routines de suivi hebdomadaires.' },
      { title: 'Passation ou recrutement', desc: 'Accompagnement de la transition vers la cible interne (recrutement, passation documentée, montée en compétence de l\'équipe).' }
    ],
    conclusion: 'La continuité financière est assurée sans interruption, avec une transition maîtrisée et documentée.'
  }
};

function openProject(id) {
  const p = PROJECTS[id];
  if (!p) return;
  const kpisHtml = p.kpis.map(k => `<div class="project-kpi"><div class="project-kpi-num">${k.num}</div><div class="project-kpi-label">${k.label}</div></div>`).join('');
  const stepsHtml = p.steps.map((s, i) => `<div class="project-step"><div class="project-step-num">${i+1}</div><div class="project-step-content"><h4>${s.title}</h4><p>${s.desc}</p></div></div>`).join('');
  document.getElementById('projectModalContent').innerHTML = `
    <div class="news-tag" style="margin-bottom:16px;">${p.tag}</div>
    <h2 style="color:var(--primary);margin-bottom:16px;font-size:1.7rem;">${p.title}</h2>
    <p style="margin-bottom:8px;"><strong style="color:var(--primary);">Contexte :</strong> ${p.context}</p>
    <div class="project-kpis">${kpisHtml}</div>
    <h4 style="color:var(--primary);margin-bottom:16px;">Déroulement de la mission</h4>
    <div class="project-steps">${stepsHtml}</div>
    <div style="margin-top:24px;padding:20px 24px;background:rgba(112,131,224,0.07);border-radius:10px;border-left:3px solid var(--secondary);">
      <p><strong style="color:var(--primary);">Résultat :</strong> ${p.conclusion}</p>
    </div>
    <div style="margin-top:28px;text-align:center;">
      <span class="btn btn-primary" onclick="closeProjectModal();showPage('contact');">Discuter d'une situation similaire →</span>
    </div>
  `;
  document.getElementById('projectModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProjectModal() {
  document.getElementById('projectModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('projectModal').addEventListener('click', function(e) {
  if (e.target === this) closeProjectModal();
});

/* ======================================================
   NEWS DATA
====================================================== */
const NEWS = {
  'alerte-tresorerie': {
    tag: 'Trésorerie', date: '15 novembre 2025',
    title: 'Crise de trésorerie en PME : les 5 signaux d\'alerte à ne jamais ignorer',
    intro: 'La plupart des crises de trésorerie ne surviennent pas du jour au lendemain. Elles s\'annoncent. Voici les 5 signaux que nos experts observent le plus souvent en mission — et que vous ne devez jamais ignorer.',
    sections: [
      { h: '1. Les délais de paiement clients s\'allongent', p: 'Quand votre DSO dépasse chroniquement 60 jours sans plan d\'action, c\'est un signal fort. Chaque jour supplémentaire coûte de la trésorerie réelle. Une PME avec 5M€ de CA qui allonge son DSO de 10 jours perd 137K€ de trésorerie disponible.' },
      { h: '2. Vous ne savez pas ce que sera votre solde dans 30 jours', p: 'Absence de plan de trésorerie ou plan peu fiable : c\'est le signe d\'une direction financière qui pilote à vue. Dans 80% des crises que nous traitons, ce signal était présent 3 à 6 mois avant la rupture.' },
      { h: '3. Votre banque devient plus froide', p: 'Un responsable bancaire qui se fait moins disponible, des appels moins chaleureux, des demandes de garanties supplémentaires : votre banque réduit son exposition avant que vous ne le réalisiez.' },
      { h: '4. Vous payez certains fournisseurs en retard systématiquement', p: 'La tentation de "faire tourner" les paiements en retardant certains fournisseurs est une spirale dangereuse. Elle détériore les conditions d\'achat et augmente le BFR structurellement.' },
      { h: '5. Votre rentabilité comptable diverge de votre trésorerie réelle', p: 'Vous êtes bénéficiaire sur le papier mais à découvert ? Votre BFR est trop élevé. C\'est souvent un problème de gestion des stocks ou des délais clients. Traitable, mais à condition d\'agir rapidement.' },
    ],
    cta: 'Vous reconnaissez l\'un de ces signaux ?'
  },
  'integration-ma': {
    tag: 'M&A', date: '3 octobre 2025',
    title: 'Intégration post-acquisition : pourquoi 60% des fusions sous-performent financièrement',
    intro: 'Les études le confirment : 60% des acquisitions ne créent pas la valeur attendue. Ce n\'est rarement la stratégie qui est en cause — c\'est l\'intégration financière. Voici ce que nous observons sur le terrain.',
    sections: [
      { h: 'Erreur n°1 : Sous-estimer le temps d\'intégration', p: 'La majorité des dirigeants pensent que l\'intégration financière prend 3 mois. En réalité, pour une PME de 20M€+, une intégration solide prend 6 à 12 mois. Précipiter crée des erreurs coûteuses.' },
      { h: 'Erreur n°2 : Négliger la due diligence finance', p: 'Une due diligence bâclée laisse des risques cachés : provisions insuffisantes, litiges non provisionnés, contrats déséquilibrés. Nous avons vu des acquisitions où les passifs cachés représentaient 15% du prix d\'achat.' },
      { h: 'Erreur n°3 : Négliger le reporting consolidé', p: 'Sans reporting consolidé dès J+30, la direction pilote deux entités distinctes sans vision globale. Les synergies se font attendre, les coûts doubles ne sont pas identifiés.' },
      { h: 'La solution : préparer l\'intégration avant la signature', p: 'Les acquisitions qui réussissent sont celles où le plan d\'intégration financière est finalisé avant le closing. Pas après. Naaxos accompagne les acquéreurs dès la phase de due diligence pour préparer J+100.' },
    ],
    cta: 'Vous préparez une acquisition ?'
  },
  'kpis-dirigeants': {
    tag: 'Reporting', date: '18 septembre 2025',
    title: 'Les 7 indicateurs financiers que tout dirigeant de PME doit suivre',
    intro: 'Un bon tableau de bord ne se mesure pas à son nombre d\'indicateurs. Il se mesure à sa capacité à déclencher des décisions. Voici les 7 KPIs que nous installons systématiquement en mission.',
    sections: [
      { h: '1. La trésorerie disponible à J, J+30 et J+60', p: 'Pas optionnel. C\'est la base. Un dirigeant qui ne sait pas ce que sera son solde dans 30 jours ne pilote pas — il subit.' },
      { h: '2. Le DSO (Days Sales Outstanding)', p: 'Votre délai moyen de paiement clients. Chaque jour de réduction libère de la trésorerie. Suivez-le par client, pas en moyenne globale.' },
      { h: '3. Le DPO et la balance fournisseurs', p: 'Votre pouvoir de négociation se lit dans vos conditions de paiement. Optimiser le DPO sans dégrader les relations fournisseurs est un art.' },
      { h: '4. La marge brute par ligne de produit / service', p: 'La marge globale cache les écarts. Certains produits financent d\'autres qui perdent de l\'argent. Indispensable pour les décisions de gamme.' },
      { h: '5. Le ratio EBITDA / CA', p: 'Votre rentabilité opérationnelle, avant structure financière et amortissements. La jauge la plus utilisée par les repreneurs et investisseurs.' },
      { h: '6. Le BFR en jours de CA', p: 'Mesure votre besoin en financement du cycle d\'exploitation. Un BFR élevé signifie que vous financez vos clients et stocks avec votre trésorerie.' },
      { h: '7. Le taux de réalisation budget vs réel', p: 'L\'écart entre vos prévisions et votre réalité. Il révèle la qualité de votre pilotage et vous force à comprendre vos écarts.' },
    ],
    cta: 'Vous souhaitez construire votre tableau de bord ?'
  },
  'daf-transition-guide': {
    tag: 'DAF de transition', date: '28 octobre 2025',
    title: 'DAF de transition : ce que votre entreprise peut attendre dès la première semaine',
    intro: 'Un DAF de transition n\'est pas un observateur. Il est opérationnel immédiatement. Voici ce qui est généralement attendu — et livré — dans les premiers jours d\'intervention.',
    sections: [
      { h: 'Jour 1-2 : sécurisation des urgences', p: 'Revue de la trésorerie, des échéances critiques, des paiements sensibles et des points de blocage. Priorisation immédiate avec la direction.' },
      { h: 'Jour 3-4 : visibilité et pilotage', p: 'Mise en place d\'un premier niveau de pilotage (trésorerie court terme, statut clôture, alertes risques), avec une communication claire aux décideurs.' },
      { h: 'Jour 5 : plan d\'action 30/60/90 jours', p: 'Formalisation d\'un plan concret : stabilisation, quick wins, sujets structurels, ressources nécessaires, calendrier et responsabilités.' },
      { h: 'Ce que cela change pour la direction', p: 'Moins d\'incertitude, décisions plus rapides, continuité assurée et une trajectoire claire pour la suite (renfort, transition, recrutement).' }
    ],
    cta: 'Vous devez sécuriser une fonction finance rapidement ?'
  },
  'finance-it-erp': {
    tag: 'Finance IT / ERP', date: '8 septembre 2025',
    title: 'ERP en PME : les 3 erreurs qui font échouer les projets de transformation finance',
    intro: 'La plupart des échecs ERP ne viennent pas de l\'outil, mais du cadrage. En PME, trois erreurs reviennent systématiquement et coûtent cher.',
    sections: [
      { h: 'Erreur n°1 : implémenter sans cible processus', p: 'Si les processus finance ne sont pas clarifiés avant le projet, l\'ERP reproduit les dysfonctionnements existants. Il faut définir la cible avant de configurer.' },
      { h: 'Erreur n°2 : sous-estimer la qualité des données', p: 'Référentiels incomplets, codifications incohérentes, historiques non fiabilisés : sans assainissement des données, le reporting reste peu fiable.' },
      { h: 'Erreur n°3 : négliger l\'adoption métier', p: 'Sans accompagnement des équipes, les bons paramétrages ne suffisent pas. Formation, routines et gouvernance sont indispensables pour tenir dans le temps.' },
      { h: 'Approche recommandée', p: 'Cadrage orienté valeur, quick wins mesurables, gouvernance légère et pilotage finance-métier : c\'est ce qui sécurise la transformation en PME.' }
    ],
    cta: 'Vous lancez un projet ERP finance ?'
  },
  'structuration-startup': {
    tag: 'Scale-up', date: '2 août 2025',
    title: 'Quand structurer la fonction finance ? Le moment que la plupart des start-ups ratent',
    intro: 'Dans une start-up, la finance est souvent confiée à un comptable externe, un DAF à temps partiel ou... personne. Jusqu\'au jour où la croissance crée une dépendance : levée de fonds, M&A, cession, crise opérationnelle.',
    sections: [
      { h: 'Les 3 seuils qui changent tout', p: 'Le premier seuil est à 2-3M€ de CA : il faut une comptabilité interne fiable et un minimum de reporting. Le deuxième est à 10M€ : un contrôleur de gestion devient indispensable. Le troisième est à 20-30M€ : le DAF à temps plein s\'impose.' },
      { h: 'Le piège de l\'expert-comptable externe seul', p: 'L\'expert-comptable produit les comptes légaux. Il ne pilote pas votre trésorerie, ne vous alerte pas sur les dérives de marge, ne prépare pas votre data room. Ce sont deux rôles distincts.' },
      { h: 'Le coût de la structuration tardive', p: 'Nous avons accompagné des scale-ups qui ont perdu 6 à 12 mois sur leur levée de fonds faute de données financières fiables. À 2M€ de retard sur la levée, le coût de l\'absence de DAF est réel.' },
      { h: 'La solution DAF de transition pendant la structuration', p: 'Un DAF de transition peut poser les bases en 3 à 6 mois : outils, processus, reporting, puis accompagner le recrutement du DAF permanent. C\'est la solution la plus efficiente pour les entreprises en croissance.' },
    ],
    cta: 'Votre fonction finance est-elle à la hauteur de votre croissance ?'
  },
  'bfr-levier': {
    tag: 'BFR', date: '14 juillet 2025',
    title: 'BFR : le levier de trésorerie le plus sous-exploité des PME françaises',
    intro: 'Le BFR (Besoin en Fonds de Roulement) est souvent perçu comme une contrainte incontournable. En réalité, c\'est un levier de trésorerie puissant. En moyenne, nos clients ont un BFR optimisable de 15 à 25% de leur CA.',
    sections: [
      { h: 'Pourquoi le BFR est si souvent négligé', p: 'Parce qu\'il est invisible. Contrairement à un crédit bancaire, le BFR ne coûte pas d\'intérêts explicitement. Il immobilise silencieusement votre trésorerie dans des stocks et des créances clients en attente.' },
      { h: 'Les 3 composantes du BFR que vous pouvez optimiser', p: 'Les créances clients (DSO) : raccourcir le délai de paiement libère immédiatement de la trésorerie. Les stocks : chaque euro de stock en moins est un euro en banque. Les dettes fournisseurs (DPO) : allonger les délais fournisseurs (sans abuser) améliore mécaniquement la trésorerie.' },
      { h: 'Comment identifier votre BFR optimisable', p: 'Comparez votre DSO actuel au DSO de vos meilleures pratiques internes. Analysez vos stocks par rotation (produits dormants vs actifs). Vérifiez vos conditions fournisseurs vs les standards du secteur.' },
      { h: 'Cas réel : 2M€ libérés en 4 mois', p: 'Une PME de distribution à 15M€ de CA avait un DSO à 65 jours et des stocks surdimensionnés. En 4 mois d\'intervention, nous avons libéré 2M€ de trésorerie — sans crédit bancaire.' },
    ],
    cta: 'Voulez-vous évaluer votre BFR optimisable ?'
  },
  'daf-vs-recrutement': {
    tag: 'DAF', date: '1 juin 2025',
    title: 'DAF de transition vs recrutement : comment choisir selon votre situation ?',
    intro: 'Face à un besoin de direction financière, deux options s\'offrent à vous : recruter un DAF permanent ou faire appel à un DAF de transition. Dans 80% des situations urgentes, la réponse est évidente.',
    sections: [
      { h: 'Quand choisir le DAF de transition', p: 'En cas d\'urgence (départ brutal, crise, transition post-acquisition), le DAF de transition s\'impose. Il est disponible sous 48h, opérationnel dès le premier jour, sans période d\'intégration. Son coût est élevé mais son ROI est immédiat en situation critique.' },
      { h: 'Quand choisir le recrutement', p: 'Quand vous avez le temps (3 à 6 mois minimum pour un bon recrutement), une situation stable, et un profil défini. Le recrutement crée une relation durable mais prend du temps et peut échouer.' },
      { h: 'La solution hybride (la plus courante)', p: 'Dans 60% des cas que nous traitons, la solution est hybride : un DAF de transition pour la phase d\'urgence + accompagnement du recrutement du DAF permanent. La passation est assurée sur 1 à 2 mois.' },
      { h: 'Le vrai coût d\'un poste vacant', p: 'Un poste de DAF vacant pendant 4 mois dans une PME de 20M€ coûte en moyenne 150 à 300K€ en décisions différées, contrôle de gestion dégradé et risques non détectés. Plus que le coût d\'un DAF de transition.' },
    ],
    cta: 'Vous cherchez un DAF de transition ou souhaitez recruter ?'
  }
};

function openNews(id) {
  const dynamic = (window.NAAXOS_DYNAMIC_NEWS || {})[id];
  const n = dynamic || NEWS[id];
  if (!n) {
    console.warn('[Naaxos] Article introuvable :', id);
    return;
  }
  // Sécurisation : certains articles (ex. Drive) peuvent avoir des champs manquants
  const safeTag      = n.tag   || 'Actualité';
  const safeDate     = n.date  || '';
  const safeTitle    = n.title || 'Article';
  const safeIntro    = n.intro || '';
  const safeSections = Array.isArray(n.sections) ? n.sections : [];
  const safeCta      = n.cta   || 'Vous souhaitez en parler avec nos experts ?';

  const safeImage    = n.image || '';

  const sectionsHtml = safeSections.length
    ? safeSections.map(function (s) {
        const h = (s && s.h) ? s.h : '';
        const p = (s && s.p) ? s.p : '';
        return (h ? '<h4>' + h + '</h4>' : '') + (p ? '<p>' + p + '</p>' : '');
      }).join('')
    : '<p style="color:var(--gray);font-style:italic;">Contenu détaillé à venir. Contactez-nous pour en discuter.</p>';

  document.getElementById('newsModalContent').innerHTML =
    '<div class="news-modal-tag"><span class="news-tag">' + safeTag + '</span> · <span class="news-date">' + safeDate + '</span></div>' +
    '<h2>' + safeTitle + '</h2>' +
    (safeImage ? '<img src="' + _escapeHtml(safeImage) + '" alt="' + _escapeHtml(safeTitle) + '" class="news-modal-img" loading="lazy">' : '') +
    (safeIntro ? '<p><em>' + safeIntro + '</em></p>' : '') +
    sectionsHtml +
    '<div style="margin-top:28px;padding:20px 24px;background:rgba(112,131,224,0.07);border-radius:10px;border-left:3px solid var(--secondary);">' +
      '<p style="font-weight:600;color:var(--primary);margin-bottom:12px;">' + safeCta + '</p>' +
      '<span class="btn btn-primary" onclick="closeNewsModal();showPage(\'contact\');">Prendre rendez-vous →</span>' +
    '</div>';
  document.getElementById('newsModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeNewsModal() {
  document.getElementById('newsModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('newsModal').addEventListener('click', function(e) {
  if (e.target === this) closeNewsModal();
});


function _escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _fmtNewsDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Tri : dates ISO / anglais, ou « 15 novembre 2025 » / « 1 juin 2025 » */
function _parseItemDateMs(item) {
  if (!item || item.date == null) return 0;
  const d = String(item.date).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const t = Date.parse(d);
    if (!Number.isNaN(t)) return t;
  }
  const t2 = Date.parse(d);
  if (!Number.isNaN(t2)) return t2;
  const m = d.match(/^(\d{1,2})\s+([a-zàâäéèêëïîôùûüç]+)\s+(\d{4})$/i);
  if (!m) return 0;
  const mo = {
    janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11
  };
  const key = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const monthIdx = mo[key];
  if (monthIdx === undefined) return 0;
  return new Date(parseInt(m[3], 10), monthIdx, parseInt(m[1], 10)).getTime();
}

function _safeSlug(str, fallback) {
  const s = (str || '').toString().trim();
  if (s) return s;
  return fallback || ('article-' + Math.random().toString(36).slice(2, 9));
}

function _localNewsApiItems() {
  return Object.keys(NEWS).map(function (slug) {
    const n = NEWS[slug];
    return {
      slug: slug,
      id: slug,
      titre: n.title,
      resume: n.intro,
      tag: n.tag,
      date: n.date,
      _source: 'local'
    };
  });
}

// ─── Bibliothèque d'icônes SVG par thématique ──────────────────────────
const NAAXOS_ICONS = {
  default:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  tresorerie: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="17" cy="15" r="1.2"/></svg>',
  daf:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  reporting:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/></svg>',
  financeIt:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  scaleup:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  bfr:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  ma:         '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>'
};
function _getCategoryIcon(tag) {
  const t = (tag || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.indexOf('tresor') >= 0) return NAAXOS_ICONS.tresorerie;
  if (t.indexOf('daf') >= 0 || t.indexOf('transition') >= 0) return NAAXOS_ICONS.daf;
  if (t.indexOf('bfr') >= 0) return NAAXOS_ICONS.bfr;
  if (t.indexOf('m&a') >= 0 || t.indexOf('acquis') >= 0 || t.indexOf('fusion') >= 0) return NAAXOS_ICONS.ma;
  if (t.indexOf('it') >= 0 || t.indexOf('erp') >= 0 || t.indexOf('digital') >= 0) return NAAXOS_ICONS.financeIt;
  if (t.indexOf('scale') >= 0 || t.indexOf('startup') >= 0 || t.indexOf('tech') >= 0) return NAAXOS_ICONS.scaleup;
  if (t.indexOf('report') >= 0 || t.indexOf('kpi') >= 0 || t.indexOf('controle') >= 0 || t.indexOf('gestion') >= 0) return NAAXOS_ICONS.reporting;
  return NAAXOS_ICONS.default;
}

function _newsCardHtml(item, slug) {
  const tag = _escapeHtml(item.tag || 'Actualité');
  const date = _escapeHtml(_fmtNewsDate(item.date));
  const title = _escapeHtml(item.titre || item.title || 'Article');
  const resume = _escapeHtml(item.resume || '');
  const icon = _getCategoryIcon(item.tag);
  const safeSlug = String(slug).replace(/'/g, "\\'");
  // Visuel : image de l'article si fournie, sinon l'icône de catégorie (design inchangé)
  const media = item.image_url
    ? `<img src="${_escapeHtml(item.image_url)}" alt="${title}" loading="lazy">`
    : icon;
  const ctaHtml = item.cta_phrase
    ? `<p class="news-bubble-cta">${_escapeHtml(item.cta_phrase)}</p>`
    : '';
  return `
    <div class="news-bubble fade-up" onclick="openNews('${safeSlug}')">
      <div class="news-bubble-img">${media}</div>
      <div class="news-bubble-body">
        <div class="news-meta"><span class="news-tag">${tag}</span><span class="news-date">${date}</span></div>
        <h3>${title}</h3>
        <p>${resume}</p>
        ${ctaHtml}
        <div class="news-read-more">Lire l'analyse →</div>
      </div>
    </div>
  `;
}

/* Log de debug — actif uniquement si NAAXOS_CONFIG.DEBUG === true */
function _dbg() {
  if (window.NAAXOS_CONFIG && window.NAAXOS_CONFIG.DEBUG) {
    console.log.apply(console, ['[DEBUG]'].concat([].slice.call(arguments)));
  }
}

/* Récupère les articles depuis Supabase (table 'articles', SELECT public).
   Retourne TOUJOURS un objet { ok, articles, error } afin de distinguer :
     - succès avec données   → { ok:true,  articles:[...], error:null }
     - succès mais vide       → { ok:true,  articles:[],    error:null }
     - échec (réseau/HTTP/config) → { ok:false, articles:[], error:'...' }
   Ne lève jamais : le site reste fonctionnel même si Supabase est indisponible. */
async function fetchArticles() {
  var cfg = window.NAAXOS_CONFIG || {};
  var base = cfg.SUPABASE_URL || window.SUPABASE_URL;
  var key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
  var timeout = (cfg.FETCH_TIMEOUT && +cfg.FETCH_TIMEOUT) || 10000;

  _dbg('fetchArticles() — base:', base, '| clé présente:', !!key);

  if (!base || !key) {
    var msgCfg = 'Supabase non configuré (URL ou clé manquante).';
    console.warn('[articles] ' + msgCfg);
    return { ok: false, articles: [], error: msgCfg };
  }
  // Garde-fou : placeholders non remplacés = config.local.js absent/non chargé
  if (/VOTRE-PROJET|XXXX/.test(base) || /XXXX/.test(key)) {
    var msgPh = 'Valeurs placeholder détectées dans la config Supabase — '
      + 'config.local.js est-il bien présent et chargé ? (URL=' + base + ')';
    console.warn('[articles] ' + msgPh);
    return { ok: false, articles: [], error: msgPh };
  }

  // Uniquement les articles publiés, triés par date de publication (récent d'abord)
  var url = base + '/rest/v1/articles?select=*'
          + '&statut=eq.' + encodeURIComponent('publié')
          + '&order=date_publication.desc.nullslast,date_created.desc';
  _dbg('fetchArticles() — URL:', url);

  // Timeout via AbortController pour ne pas laisser le spinner tourner indéfiniment
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout) : null;

  try {
    var resp = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      signal: ctrl ? ctrl.signal : undefined
    });
    if (timer) clearTimeout(timer);
    _dbg('fetchArticles() — status HTTP:', resp.status);
    if (!resp.ok) {
      var body = '';
      try { body = await resp.text(); } catch (e) { /* ignore */ }
      throw new Error('HTTP ' + resp.status + (body ? ' — ' + body.slice(0, 200) : ''));
    }
    var articles = await resp.json();
    var arr = Array.isArray(articles) ? articles : [];
    console.info('[articles] Articles Supabase chargés : ' + arr.length);
    _dbg('fetchArticles() — détail:', arr);
    return { ok: true, articles: arr, error: null };
  } catch (e) {
    if (timer) clearTimeout(timer);
    var reason = (e && e.name === 'AbortError')
      ? 'délai dépassé (' + timeout + ' ms)'
      : (e && e.message ? e.message : String(e));
    console.error('[articles] Erreur API : ' + reason, e);
    return { ok: false, articles: [], error: reason };
  }
}

/* Extrait un résumé texte propre depuis du HTML/Markdown */
function _excerpt(str, n) {
  var text = String(str || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_>`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= n) return text;
  return text.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

/* Normalise une ligne Supabase au format attendu par les cartes/modal */
function _normalizeSupabaseArticle(a) {
  a = a || {};
  var slug = _safeSlug(a.slug, a.id);
  return {
    slug: slug,
    id: a.id,
    titre: a.titre || 'Sans titre',
    contenu: a.contenu || '',
    resume: a.extrait || _excerpt(a.contenu || '', 160),   // extrait fourni en priorité
    auteur: a.auteur || 'Naaxos',
    tag: a.categorie || 'Actualité',                        // catégorie comme tag
    date: a.date_publication || a.date_created || '',       // date de publication d'abord
    image_url: a.image_url || '',
    cta_phrase: a.cta_phrase || '',
    date_created: a.date_created || '',
    fromSupabase: true
  };
}

/* Affiche un état (chargement / erreur) dans le conteneur d'actualités. */
function _renderNewsState(container, type, opts) {
  opts = opts || {};
  if (type === 'loading') {
    container.innerHTML =
      '<div class="news-state is-visible" role="status" aria-live="polite">'
      + '<div class="news-spinner" aria-hidden="true"></div>'
      + '<span>Chargement des actualités…</span>'
      + '</div>';
  } else if (type === 'error') {
    container.innerHTML =
      '<div class="news-state is-visible" role="alert">'
      + '<span class="news-state-title">Impossible de charger les articles</span>'
      + '<span>' + _escapeHtml(opts.message || 'Veuillez réessayer dans un instant.') + '</span>'
      + '<button type="button" class="news-retry" onclick="loadArticles(true)">Réessayer</button>'
      + '</div>';
  } else if (type === 'empty') {
    container.innerHTML =
      '<div class="news-state is-visible" role="status">'
      + '<span>' + _escapeHtml(opts.message || 'Aucune actualité pour le moment.') + '</span>'
      + '</div>';
  }
}

async function loadArticles(force) {
  _dbg('loadArticles() appelée', force ? '(forcé)' : '');
  const container = document.getElementById('news-container');
  if (!container) { console.warn('[articles] #news-container introuvable dans la page.'); return; }
  // Évite les doubles chargements concurrents (router + DOMContentLoaded) et les recharges inutiles.
  if (!force && (container.dataset.loaded === '1' || container.dataset.loaded === 'loading')) {
    _dbg('loadArticles() — déjà chargé / en cours, on saute');
    return;
  }
  container.dataset.loaded = 'loading';

  // 1) État de chargement visible immédiatement
  _renderNewsState(container, 'loading');

  // 2) Récupérer les articles Supabase (résultat structuré : ok / articles / error)
  const supabaseResult = await fetchArticles();
  const supabaseFailed = !supabaseResult.ok;
  const supabaseList = (supabaseResult.articles || []).map(_normalizeSupabaseArticle);
  _dbg('loadArticles() — Supabase ok:', supabaseResult.ok,
       '| normalisés:', supabaseList.length,
       supabaseFailed ? ('| erreur: ' + supabaseResult.error) : '');

  // Composition de la liste :
  //  - Supabase OK      → uniquement les articles Supabase (les articles locaux ne s'affichent pas)
  //  - Supabase en échec → fallback sur les articles locaux (filet de secours)
  const bySlug = new Map();
  function setIfBetter(slug, item, priority) {
    const cur = bySlug.get(slug);
    if (!cur || cur.priority > priority) bySlug.set(slug, { item, priority });
  }
  if (supabaseFailed) {
    // Filet de secours : Supabase injoignable (clé API / réseau / service) → analyses locales
    _localNewsApiItems().forEach(function (item) {
      const slug = _safeSlug(item.slug, item.id);
      setIfBetter(slug, Object.assign({}, item, { slug }), 2);
    });
  }
  supabaseList.forEach(function (item) {
    const slug = _safeSlug(item.slug, item.id);
    setIfBetter(slug, Object.assign({}, item, { slug, fromSupabase: true }), 1);
  });

  const list = Array.from(bySlug.values())
    .map(function (x) { return x.item; })
    .sort(function (a, b) { return _parseItemDateMs(b) - _parseItemDateMs(a); });

  console.info('[articles] Articles affichés : ' + list.length
    + (supabaseFailed ? ' (fallback local)' : ' (Supabase)'));

  if (!list.length) {
    if (supabaseFailed) {
      // Supabase injoignable ET aucun article local → vraie erreur
      _renderNewsState(container, 'error', {
        message: 'Le service est momentanément indisponible (' + supabaseResult.error + ').'
      });
    } else {
      // Supabase répond mais aucun article publié → simple information, pas une erreur
      _renderNewsState(container, 'empty', {
        message: 'Aucune actualité publiée pour le moment. Revenez bientôt !'
      });
    }
    container.dataset.loaded = '0'; // permet un nouvel essai au prochain passage
    return;
  }

  window.NAAXOS_DYNAMIC_NEWS = window.NAAXOS_DYNAMIC_NEWS || {};
  const cards = [];

  for (const item of list) {
    const slug = item.slug || _safeSlug(item.slug, item.id);
    cards.push(_newsCardHtml(item, slug));

    if (NEWS[slug]) {
      const n = NEWS[slug];
      window.NAAXOS_DYNAMIC_NEWS[slug] = {
        tag: n.tag, date: n.date, title: n.title,
        intro: n.intro, sections: n.sections, cta: n.cta
      };
    }
    if (item.fromDrive) {
      const c = item.content || {};
      const prev = window.NAAXOS_DYNAMIC_NEWS[slug];
      window.NAAXOS_DYNAMIC_NEWS[slug] = {
        tag      : item.tag || 'Actualité',
        date     : _fmtNewsDate(item.date) || item.date || '',
        title    : item.titre || item.title || 'Article',
        intro    : c.intro || item.resume || '',
        sections : Array.isArray(c.sections) && c.sections.length ? c.sections : (prev && prev.sections) || [],
        cta      : c.cta || 'Vous souhaitez en parler ?'
      };
    }
    if (item.fromSupabase) {
      window.NAAXOS_DYNAMIC_NEWS[slug] = {
        tag      : item.tag || 'Actualité',
        date     : _fmtNewsDate(item.date) || item.date || '',
        title    : item.titre || 'Article',
        intro    : item.resume || '',
        sections : [{ h: '', p: _escapeHtml(item.contenu || '').replace(/\n+/g, '<br>') }],
        cta      : item.cta_phrase || 'Vous souhaitez en parler avec nos experts ?',
        image    : item.image_url || ''
      };
    }
  }

  // Si Supabase a échoué mais qu'on a un fallback local : notice discrète + articles
  const noticeHtml = (supabaseFailed && supabaseList.length === 0)
    ? '<div class="news-fallback-notice" role="status">'
      + 'Les dernières actualités n\'ont pas pu être chargées — affichage de nos analyses de référence.'
      + '</div>'
    : '';

  container.innerHTML = noticeHtml + cards.join('');
  container.dataset.loaded = '1';

  // Révéler les cartes : elles sont injectées APRÈS le passage d'observation
  // du router, donc on les observe nous-mêmes (sinon elles restent en opacity:0).
  const newCards = container.querySelectorAll('.fade-up:not(.visible)');
  if (typeof io !== 'undefined' && io && io.observe) {
    newCards.forEach(function (el) { io.observe(el); });
  } else {
    newCards.forEach(function (el) { el.classList.add('visible'); });
  }

  // SEO : injecter le schema BlogPosting de chaque article
  _injectArticlesSchema(list);
}

/* Injecte (ou remplace) un JSON-LD ItemList de BlogPosting pour les articles */
function _injectArticlesSchema(list) {
  try {
    var old = document.getElementById('naaxos-articles-schema');
    if (old) old.parentNode.removeChild(old);
    if (!Array.isArray(list) || !list.length) return;

    var items = list.map(function (item, i) {
      var slug = item.slug || '';
      var ms = (typeof _parseItemDateMs === 'function') ? _parseItemDateMs(item) : 0;
      var iso = ms ? new Date(ms).toISOString().slice(0, 10) : (item.date || '');
      var post = {
        "@type": "BlogPosting",
        "headline": (item.titre || item.title || 'Article'),
        "description": (item.resume || item.intro || _excerpt(item.contenu || '', 160)),
        "image": (item.image_url || "https://www.naaxos.fr/assets/images/og-naaxos.jpg"),
        "url": "https://www.naaxos.fr/actualites#" + slug,
        "author": { "@type": "Organization", "name": (item.auteur || 'Naaxos') },
        "publisher": { "@type": "Organization", "name": "Naaxos" }
      };
      if (iso) post.datePublished = iso;
      return { "@type": "ListItem", "position": i + 1, "item": post };
    });

    var schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": items
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'naaxos-articles-schema';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  } catch (e) {
    console.warn('[seo] schema articles non injecté', e);
  }
}

/* ======================================================
   CHATBOT ENGINE v8 — corrigé + intelligent + lead-capture
====================================================== */
(function() {
  const widget   = document.getElementById('chatWidget');
  const msgs_el  = document.getElementById('chatMessages');
  const opts_el  = document.getElementById('chatOptions');
  const input_el = document.getElementById('chatInput');
  const hint_el  = document.getElementById('chatHint');

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  CHATBOT LLM — GUIDE DE CONFIGURATION                           ║
  // ╠══════════════════════════════════════════════════════════════════╣
  // ║                                                                  ║
  // ║  ÉTAPE 1 — Choisir un fournisseur (gratuit)                     ║
  // ║  ┌──────────────────────────────────────────────────────────┐   ║
  // ║  │ OPTION A : Google Gemini 1.5 Flash                       │   ║
  // ║  │  1. Aller sur https://aistudio.google.com/app/apikey     │   ║
  // ║  │  2. Cliquer "Create API Key"                             │   ║
  // ║  │  3. Copier la clé (commence par "AIza...")               │   ║
  // ║  │  4. provider: 'gemini', model: 'gemini-1.5-flash'        │   ║
  // ║  ├──────────────────────────────────────────────────────────┤   ║
  // ║  │ OPTION B : Groq (LLaMA 3.3 70B, très rapide)            │   ║
  // ║  │  1. Aller sur https://console.groq.com/keys              │   ║
  // ║  │  2. Cliquer "Create API Key"                             │   ║
  // ║  │  3. Copier la clé (commence par "gsk_...")               │   ║
  // ║  │  4. provider: 'groq', model: 'llama-3.3-70b-versatile'  │   ║
  // ║  └──────────────────────────────────────────────────────────┘   ║
  // ║                                                                  ║
  // ║  ÉTAPE 2 — Coller la clé dans apiKey ci-dessous                 ║
  // ║  Exemple : apiKey: 'AIzaSyAbc123...',                           ║
  // ║                                                                  ║
  // ║  ÉTAPE 3 — Test en local                                        ║
  // ║  Ouvrir le fichier HTML dans Chrome, taper une question         ║
  // ║  financière dans le chat → la réponse doit arriver en ~2s.      ║
  // ║                                                                  ║
  // ║  ⚠️  SÉCURITÉ — IMPORTANT POUR LA MISE EN PRODUCTION           ║
  // ║  La clé est visible dans le code source HTML. Pour la prod :    ║
  // ║  → Utiliser un proxy Cloudflare Worker (gratuit) :              ║
  // ║    https://developers.cloudflare.com/workers/get-started/guide/ ║
  // ║  → Le Worker reçoit les requêtes du site et ajoute la clé       ║
  // ║    côté serveur, la clé reste invisible pour les visiteurs.     ║
  // ║                                                                  ║
  // ║  Pour désactiver le LLM : mettre  enabled: false                ║
  // ║  Le chatbot retombe sur les menus pré-définis (FLOWS).          ║
  // ╚══════════════════════════════════════════════════════════════════╝
  const LLM_CONFIG = {
    enabled:  true,                  // false = désactiver le LLM, revenir aux FLOWS
    provider: 'gemini',              // 'gemini'  ou  'groq'
    apiKey:   'VOTRE_CLE_API_ICI',   // ← remplacer par votre clé
    // Gemini : gemini-1.5-flash  |  Groq : llama-3.3-70b-versatile
    model:    'gemini-1.5-flash',
  };

  // ── Prompt système — définit le rôle et les limites du chatbot ──
  const SYSTEM_PROMPT = `Tu es l'assistant virtuel de Naaxos, cabinet de conseil en finance opérationnelle basé à Grenoble, spécialisé pour les PME et ETI.

SERVICES NAAXOS :
• DAF de transition — disponible sous 48h, prise en charge immédiate
• RAF & Responsable Comptable — renfort ou remplacement
• Contrôle de gestion — tableaux de bord, pilotage J+7, indicateurs
• Comptabilité — production comptable, clôtures, surcharge
• Finance IT & ERP — déploiement SAP, automatisation, reporting
• Urgence trésorerie — diagnostic flash 72h, négociation bancaire

ZONES : Auvergne-Rhône-Alpes et Île-de-France. Missions France entière possible.
CONTACT : contact@naaxos.fr | +33 4 58 17 31 10
DÉLAI : intervention sous 48h ouvrées.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT aux questions liées à : finance d'entreprise, trésorerie, comptabilité, contrôle de gestion, DAF, BFR, ERP, levée de fonds, M&A, ou aux services/cabinet Naaxos.
2. Pour toute question hors sujet (cuisine, sport, divertissement, informatique grand public, etc.), réponds EXACTEMENT : "Je suis spécialisé uniquement dans les services de Naaxos et la finance d'entreprise. Je ne peux pas répondre à cette question."
3. Tes réponses sont courtes : 2 à 4 phrases maximum. Professionnelles, rassurantes, orientées solution.
4. Si la question révèle un besoin concret (trésorerie tendue, poste vacant, levée en cours, etc.), termine ta réponse par la balise : [RDV]
5. Ne jamais inventer de chiffres, de noms de clients ou de références non mentionnées.
6. Réponds toujours en français.
7. Quand l'information n'est pas certaine, dis-le clairement et propose un rendez-vous.`;

  // ── Base de connaissances locale (site Naaxos) ───────────────
  const NAAXOS_KB = [
    {
      keys: ['daf', 'transition', 'directeur financier', 'raf', 'remplacement', 'urgence'],
      answer: "Naaxos accompagne les PME et ETI sur la finance operationnelle : DAF de transition, RAF/Responsable comptable, controle de gestion, tresorerie et Finance IT/ERP.",
      rdv: false
    },
    {
      keys: ['daf de transition', 'directeur financier', 'interim cfo', 'cfo'],
      answer: "Le DAF de transition prend en charge la direction financiere temporairement pour stabiliser l'existant, piloter la tresorerie et structurer le reporting.",
      rdv: true
    },
    {
      keys: ['tresorerie', 'trésorerie', 'crise', 'cash', 'bfr', 'banque', 'fournisseur'],
      answer: "En cas de tension de tresorerie, Naaxos peut intervenir rapidement pour diagnostiquer la situation, prioriser les actions et securiser les flux.",
      rdv: true
    },
    {
      keys: ['raf', 'responsable comptable', 'externalise', 'renfort equipe'],
      answer: "Oui, Naaxos intervient en renfort ou remplacement de RAF/Responsable Comptable selon la charge, l'urgence et le niveau de structuration.",
      rdv: true
    },
    {
      keys: ['controle', 'contrôle', 'gestion', 'reporting', 'tableau de bord', 'kpi', 'pilotage'],
      answer: "Naaxos aide a mettre en place des indicateurs, tableaux de bord et routines de pilotage pour ameliorer la prise de decision.",
      rdv: false
    },
    {
      keys: ['comptabilite', 'cloture', 'clotures', 'production comptable'],
      answer: "Naaxos peut intervenir sur la production comptable, la fiabilisation des clotures et l'organisation de la fonction finance-comptabilite.",
      rdv: false
    },
    {
      keys: ['erp', 'sap', 'finance it', 'automatisation', 'outil', 'process'],
      answer: "Naaxos accompagne aussi les sujets Finance IT et ERP, dont SAP, pour structurer les processus et ameliorer la qualite du reporting.",
      rdv: false
    },
    {
      keys: ['levee', 'levée', 'fonds', 'investisseur', 'roadshow', 'data room'],
      answer: "Pour une levee de fonds, Naaxos aide a fiabiliser les donnees financieres, structurer les supports et preparer les echanges avec les investisseurs.",
      rdv: true
    },
    {
      keys: ['taille', 'pme', 'eti', 'entreprise'],
      answer: "Naaxos intervient principalement aupres de PME et ETI, avec un accompagnement adapte au niveau de maturite et d'urgence.",
      rdv: false
    },
    {
      keys: ['zone', 'secteur geographique', 'grenoble', 'aura', 'auvergne', 'rhone alpes', 'ile-de-france', 'idf'],
      answer: "Naaxos est base a Grenoble et intervient en Auvergne-Rhone-Alpes et en Ile-de-France, avec possibilite de missions plus larges selon le besoin.",
      rdv: false
    },
    {
      keys: ['delai', 'demarrage', 'demarrer', '48h', 'urgence'],
      answer: "Selon le contexte, une intervention peut etre engagee rapidement apres qualification du besoin.",
      rdv: true
    },
    {
      keys: ['premier echange', 'premier rendez-vous', 'qualification'],
      answer: "Le premier echange permet de clarifier votre contexte, l'urgence, les objectifs et le format d'intervention le plus pertinent.",
      rdv: true
    },
    {
      keys: ['prix', 'tarif', 'cout', 'coût', 'combien', 'budget'],
      answer: "Le cout depend du perimetre, de l'urgence et de la duree. Le plus fiable est un echange de qualification pour proposer un cadre adapte.",
      rdv: true
    },
    {
      keys: ['garantie', 'resultat garanti', 'promesse'],
      answer: "Naaxos s'engage sur une approche operationnelle et structuree, mais ne promet pas de resultats garantis sans analyse du contexte reel.",
      rdv: false
    },
    {
      keys: ['negociation bancaire', 'banque', 'financement bancaire'],
      answer: "Naaxos peut accompagner la preparation financiere et la structuration des echanges avec les partenaires bancaires.",
      rdv: true
    },
    {
      keys: ['bfr', 'besoin en fonds de roulement'],
      answer: "Oui, l'optimisation du BFR fait partie des leviers frequents pour ameliorer la tresorerie et la performance.",
      rdv: true
    },
    {
      keys: ['depart daf', 'daf parti', 'vacance poste', 'relais'],
      answer: "Naaxos peut assurer une transition operationnelle pour securiser la continuite financiere pendant la periode de remplacement.",
      rdv: true
    },
    {
      keys: ['equipe debordee', 'surcharge', 'renfort'],
      answer: "Naaxos peut intervenir en renfort pour absorber la charge, fiabiliser les priorites et remettre une organisation efficace.",
      rdv: true
    },
    {
      keys: ['mission ponctuelle', 'mission longue', 'duree mission'],
      answer: "Les deux formats sont possibles. Le cadrage depend de votre besoin : mission ciblee, transition, ou accompagnement sur plusieurs mois.",
      rdv: true
    },
    {
      keys: ['recrut', 'poste', 'candidature', 'rejoindre', 'cv'],
      answer: "Naaxos recrute des profils finance experimentes. Vous pouvez consulter la page Nous rejoindre et deposer votre candidature via le formulaire dedie.",
      rdv: false
    },
    {
      keys: ['contact', 'rendez-vous', 'rdv', 'telephone', 'téléphone', 'email', 'mail', 'joindre'],
      answer: "Vous pouvez contacter Naaxos a contact@naaxos.fr ou au +33 4 58 17 31 10, et demander un rendez-vous via le formulaire de la page Contact.",
      rdv: true
    },
    {
      keys: ['hors sujet', 'question non finance', 'sport', 'cuisine', 'musique'],
      answer: "Je suis specialise sur les services Naaxos et la finance d'entreprise. Si vous voulez, je peux vous aider sur tresorerie, DAF, pilotage ou levee de fonds.",
      rdv: false
    }
  ];

  function _norm(txt) {
    return (txt || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9+\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getKBMatches(text, maxItems) {
    var t = _norm(text);
    if (!t) return [];
    var scored = NAAXOS_KB.map(function(item) {
      var score = 0;
      item.keys.forEach(function(k) { if (t.indexOf(_norm(k)) !== -1) score += 1; });
      return { item: item, score: score };
    }).filter(function(x) { return x.score > 0; })
      .sort(function(a, b) { return b.score - a.score; });
    return scored.slice(0, maxItems || 3).map(function(x) { return x.item; });
  }

  function localKnowledgeReply(text) {
    var m = getKBMatches(text, 1);
    if (!m.length) return null;
    return { text: m[0].answer, rdv: !!m[0].rdv };
  }

  function buildGroundedUserMessage(userMessage) {
    var matches = getKBMatches(userMessage, 3);
    if (!matches.length) return userMessage;
    var snippets = matches.map(function(m, i) { return (i + 1) + '. ' + m.answer; }).join('\n');
    return "Contexte Naaxos (base site):\n" + snippets + "\n\nQuestion utilisateur:\n" + userMessage;
  }

  // ── Historique de conversation pour le contexte LLM ──
  var llmHistory = []; // [{role:'user'|'assistant', content:'...'}]

  // ── état ──────────────────────────────────────────────
  let state      = 'idle';
  let started    = false;
  let leadData   = { email: '', phone: '', need: '' };
  let waitingFor = null; // 'email' | 'phone' | null

  // ── hint auto-hide ─────────────────────────────────────
  setTimeout(() => {
    if (!hint_el) return;
    hint_el.style.transition = 'opacity .5s';
    hint_el.style.opacity = '0';
    setTimeout(() => hint_el && hint_el.remove(), 600);
  }, 9000);

  // ── toggle ────────────────────────────────────────────
  window.toggleChat = function() {
    widget.classList.toggle('open');
    if (widget.classList.contains('open') && !started) {
      started = true;
      setTimeout(startConversation, 450);
    }
    if (hint_el) hint_el.remove();
  };

  // ── off-topic detector ────────────────────────────────
  const OFF_TOPIC = ['recette','cuisine','film','musique','sport','météo','foot','jeu','voyage','politique','religion','amour','informatique générale','blague'];
  function isOffTopic(txt) {
    const t = txt.toLowerCase();
    return OFF_TOPIC.some(w => t.includes(w));
  }

  // ── FLOWS ────────────────────────────────────────────
  const FLOWS = {
    welcome: {
      msgs: [
        "Bonjour 👋 Je suis l'assistant Naaxos.",
        "Je suis là pour vous aider sur vos enjeux de finance d'entreprise — trésorerie, direction financière, contrôle de gestion, levée de fonds.",
        "Qu'est-ce qui vous amène aujourd'hui ?"
      ],
      opts: ["Une crise de trésorerie","Besoin d'un DAF de transition","Structurer ma fonction finance","Préparer une levée de fonds","Nous rejoindre","Autre question"],
      next: 'topic'
    },
    topic: {
      "Une crise de trésorerie": {
        msgs: [
          "Je comprends — une crise de trésorerie nécessite une réaction rapide. 🚨",
          "Naaxos peut intervenir sous 48h : diagnostic flash, sécurisation des flux, négociation bancaire.",
          "Depuis combien de temps ressentez-vous cette tension ?"
        ],
        opts: ["Moins d'une semaine","1 à 4 semaines","Plus d'un mois","C'est chronique"],
        next: 'qualify',
        needLabel: 'Crise de trésorerie'
      },
      "Besoin d'un DAF de transition": {
        msgs: [
          "Le DAF de transition, c'est notre cœur de métier. 👔",
          "Nos experts sont anciens DAF, opérationnels dès le premier jour — sans période d'intégration.",
          "Quelle est la raison principale de ce besoin ?"
        ],
        opts: ["Départ soudain du DAF","Besoin temporaire (croissance)","Recrutement en cours","DAF actuel débordé"],
        next: 'qualify',
        needLabel: 'DAF de transition'
      },
      "Structurer ma fonction finance": {
        msgs: [
          "C'est souvent le nerf de la guerre pour piloter efficacement. 📊",
          "Nous accompagnons les PME et ETI pour passer d'une finance réactive à une direction financière créatrice de valeur.",
          "Quelle est la taille approximative de votre entreprise ?"
        ],
        opts: ["Moins de 5M€ CA","5 à 50M€ CA","Plus de 50M€ CA"],
        next: 'qualify',
        needLabel: 'Structuration finance'
      },
      "Préparer une levée de fonds": {
        msgs: [
          "La levée de fonds exige une préparation financière irréprochable. 💰",
          "Data room, business plan, métriques SaaS, accompagnement roadshow — nous couvrons l'ensemble.",
          "À quel stade êtes-vous ?"
        ],
        opts: ["Dossier à préparer","Investisseurs déjà identifiés","Négociations en cours"],
        next: 'qualify',
        needLabel: 'Levée de fonds'
      },
      "Nous rejoindre": {
        msgs: [
          "Vous souhaitez intégrer l'équipe Naaxos ? 🎯",
          "Nous recrutons des experts seniors en finance d'entreprise pour des missions terrain.",
          "Je vous oriente directement."
        ],
        opts: ["Voir les postes ouverts","Candidature spontanée"],
        next: 'recrutement'
      },
      "Autre question": {
        msgs: [
          "Pas de problème. 😊",
          "Décrivez-moi votre situation en quelques mots — je vous orienterai vers la meilleure solution."
        ],
        opts: [],
        next: 'free_text'
      },
      _default: {
        msgs: ["Je vais analyser votre demande. Pouvez-vous me donner un peu plus de contexte ?"],
        opts: ["Trésorerie","DAF de transition","Structuration finance","Levée de fonds"],
        next: 'topic'
      }
    },
    qualify: {
      _default: {
        msgs: [
          "Merci pour ces informations. ✅",
          "Dans quel secteur évolue votre entreprise ?"
        ],
        opts: ["Industrie / Manufacturing","Distribution / Retail","Tech / SaaS","BTP / Immobilier","Énergie / Environnement","Santé","Services B2B","Autre"],
        next: 'value_prop'
      }
    },
    value_prop: {
      _default: {
        msgs: [
          "Parfait, j'ai une bonne vision de votre situation. 💡",
          "Naaxos intervient régulièrement sur des cas similaires dans ce secteur. Un expert senior peut analyser votre situation précisément — un premier diagnostic identifie généralement 2 à 3 leviers d'action concrets.",
          "La prochaine étape, c'est un échange de 15 minutes, <strong>gratuit et sans engagement</strong>."
        ],
        opts: ["Je veux être contacté","Voir des cas clients similaires","Comment ça se passe concrètement ?"],
        next: 'cta'
      }
    },
    cta: {
      "Je veux être contacté": {
        msgs: ["Avec plaisir ! 📅","Pour que notre équipe vous rappelle rapidement, pourriez-vous me laisser votre email professionnel ?"],
        opts: [],
        next: 'capture_email'
      },
      "Voir des cas clients similaires": {
        msgs: ["Bonne idée — nos cas clients présentent des résultats chiffrés sur des situations comparables à la vôtre. 📋"],
        opts: ["Voir les réalisations →","Prendre rendez-vous"],
        next: 'cta_cases'
      },
      "Comment ça se passe concrètement ?": {
        msgs: [
          "C'est simple : vous remplissez un formulaire en 2 minutes, un expert Naaxos vous rappelle sous 24h.",
          "Lors de cet échange : on comprend votre situation, on évalue l'urgence, on vous propose le bon format d'intervention.",
          "Aucun engagement, aucune relance commerciale agressive.",
          "Souhaitez-vous qu'on vous contacte ?"
        ],
        opts: ["Oui, me contacter","Peut-être plus tard"],
        next: 'cta_soft'
      },
      _default: {
        msgs: ["Comment puis-je vous aider davantage ?"],
        opts: ["Prendre rendez-vous","Voir les cas clients"],
        next: 'cta'
      }
    },
    capture_email: {
      _default: {
        msgs: [], // handled dynamically via free text
        opts: [],
        next: 'capture_phone'
      }
    },
    capture_phone: {
      _default: {
        msgs: [],
        opts: [],
        next: 'confirm_lead'
      }
    },
    confirm_lead: {
      _default: {
        msgs: [
          "Parfait, merci ! 🙏",
          "Nos équipes vous contacteront dans les <strong>24h ouvrées</strong> pour un premier échange.",
          "En attendant, n'hésitez pas à consulter nos cas clients ou nos analyses."
        ],
        opts: ["Voir les réalisations","Lire nos analyses","C'est tout, merci"],
        next: 'soft_end'
      }
    },
    recrutement: {
      "Voir les postes ouverts": {
        msgs: ["Voici nos postes ouverts : Cash Manager, Comptable, Auditeur Senior, DAF, Responsable Comptable. 📋","Je vous emmène sur la page recrutement."],
        opts: ["Accéder à la page"],
        next: 'redir_rejoindre'
      },
      "Candidature spontanée": {
        msgs: ["Parfait — déposez votre candidature via le formulaire sur notre page recrutement."],
        opts: ["Aller à la page"],
        next: 'redir_rejoindre'
      },
      _default: {
        msgs: ["Je vous emmène sur la page recrutement."],
        opts: ["Voir la page"],
        next: 'redir_rejoindre'
      }
    },
    redir_rejoindre: {
      _default: {
        msgs: ["À tout de suite ! 👋"],
        opts: [],
        next: 'done',
        action: () => { showPage('rejoindre'); setTimeout(window.toggleChat, 800); }
      }
    },
    cta_cases: {
      "Voir les réalisations →": {
        msgs: ["Je vous y emmène !"],
        opts: [],
        next: 'done',
        action: () => { showPage('realisations'); setTimeout(window.toggleChat, 600); }
      },
      "Prendre rendez-vous": {
        msgs: ["Je vous emmène au formulaire de contact."],
        opts: [],
        next: 'done',
        action: () => { showPage('contact'); setTimeout(window.toggleChat, 600); }
      },
      _default: {
        msgs: ["Je vous y emmène !"],
        opts: [],
        next: 'done',
        action: () => { showPage('realisations'); setTimeout(window.toggleChat, 600); }
      }
    },
    cta_soft: {
      "Oui, me contacter": {
        msgs: ["Parfait ! Pourriez-vous me laisser votre email professionnel ?"],
        opts: [],
        next: 'capture_email'
      },
      _default: {
        msgs: ["Pas de souci. 😊","Notre équipe reste disponible — le formulaire de contact est toujours là si vous changez d'avis.","Bonne journée !"],
        opts: ["Fermer"],
        next: 'done'
      }
    },
    soft_end: {
      "Voir les réalisations": {
        msgs: ["Je vous y emmène !"],
        opts: [],
        next: 'done',
        action: () => { showPage('realisations'); setTimeout(window.toggleChat, 600); }
      },
      "Lire nos analyses": {
        msgs: ["Je vous y emmène !"],
        opts: [],
        next: 'done',
        action: () => { showPage('actualites'); setTimeout(window.toggleChat, 600); }
      },
      _default: {
        msgs: ["Merci et à bientôt ! 👋"],
        opts: [],
        next: 'done'
      }
    },
    free_text: {
      _default: {
        msgs: [
          "Merci pour ces précisions. 🎯",
          "Pour vous donner une réponse vraiment adaptée à votre situation, le mieux est un échange rapide avec un expert senior — <strong>gratuit et sans engagement</strong>.",
          "Souhaitez-vous être contacté ?"
        ],
        opts: ["Oui, me contacter","Pas pour l'instant"],
        next: 'cta_soft'
      }
    },
    done: {
      _default: {
        msgs: ["N'hésitez pas à revenir si vous avez d'autres questions. Bonne journée ! 👋"],
        opts: [],
        next: null
      }
    }
  };

  // ── helpers ──────────────────────────────────────────
  function scrollChat() { msgs_el.scrollTop = msgs_el.scrollHeight; }

  function addTyping() {
    removeTyping();
    const row = document.createElement('div');
    row.className = 'typing-row';
    row.id = 'chat-typing';
    row.innerHTML = '<div class="msg-av">N</div><div class="typing-bbl"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    msgs_el.appendChild(row);
    scrollChat();
  }
  function removeTyping() {
    const t = document.getElementById('chat-typing');
    if (t) t.remove();
  }

  function addBotMsg(html) {
    const row = document.createElement('div');
    row.className = 'msg bot';
    row.innerHTML = '<div class="msg-av">N</div><div class="msg-bbl">' + html + '</div>';
    msgs_el.appendChild(row);
    scrollChat();
  }

  function addUserMsg(text) {
    clearOpts();
    const row = document.createElement('div');
    row.className = 'msg user';
    row.innerHTML = '<div class="msg-bbl">' + text + '</div>';
    msgs_el.appendChild(row);
    scrollChat();
  }

  function showOpts(opts, nextState) {
    clearOpts();
    opts.forEach(function(opt) {
      const btn = document.createElement('button');
      btn.className = 'chat-opt';
      btn.textContent = opt;
      btn.onclick = function() { handleOption(opt, nextState); };
      opts_el.appendChild(btn);
    });
  }
  function clearOpts() { opts_el.innerHTML = ''; }

  // ── message chain ────────────────────────────────────
  function playMsgs(msgList, onDone) {
    var idx = 0;
    function next() {
      if (idx >= msgList.length) { if (onDone) onDone(); return; }
      var m = msgList[idx++];
      if (!m) { next(); return; }
      addTyping();
      var delay = 450 + Math.min(m.length * 12, 900);
      setTimeout(function() {
        removeTyping();
        addBotMsg(m);
        setTimeout(next, 180);
      }, delay);
    }
    next();
  }

  // ── dispatch ─────────────────────────────────────────
  function dispatch(text, currentState) {
    // off-topic guard
    if (isOffTopic(text) && currentState === 'free_text') {
      playMsgs(
        ["Je suis spécialisé dans les services proposés par notre cabinet, mais je peux vous aider à trouver la meilleure solution pour votre projet. 😊",
         "Avez-vous un besoin en finance d'entreprise — trésorerie, DAF, reporting, levée de fonds ?"],
        function() { showOpts(["Oui, j'ai un besoin finance","Non merci"], 'topic'); state = 'topic'; }
      );
      return;
    }

    // lead capture — email
    if (waitingFor === 'email') {
      var emailRx = /[^\s@]+@[^\s@]+\.[^\s@]+/;
      if (emailRx.test(text)) {
        leadData.email = text;
        waitingFor = 'phone';
        playMsgs(
          ["Merci ! 📧 Et un numéro de téléphone pour vous rappeler directement ? (facultatif — écrivez 'non' si vous préférez)"],
          function() { state = 'capture_phone'; }
        );
      } else {
        playMsgs(
          ["Je n'ai pas reconnu d'adresse email valide. Pourriez-vous réessayer ? (ex : prenom@société.fr)"],
          null
        );
      }
      return;
    }

    // lead capture — phone
    if (waitingFor === 'phone') {
      waitingFor = null;
      var skip = /non|pas|skip|—|-|x/i.test(text);
      if (!skip) leadData.phone = text;
      playMsgs(
        skip
          ? ["Pas de souci ! ✅","Votre email suffit — notre équipe vous contactera sous 24h ouvrées."]
          : ["Parfait, noté ! ✅","Notre équipe vous contactera sous 24h ouvrées."],
        function() {
          var node = FLOWS['confirm_lead']['_default'];
          state = node.next;
          showOpts(node.opts, node.next);
        }
      );
      return;
    }

    var flow = FLOWS[currentState];
    if (!flow) { fallback(); return; }

    // find matching node — exact, then fuzzy
    var node = flow[text] || flow['_default'];
    if (!node) {
      var tLower = text.toLowerCase();
      var key = Object.keys(flow).find(function(k) {
        return k !== '_default' && k.toLowerCase().indexOf(tLower.slice(0, 6)) !== -1;
      });
      node = key ? flow[key] : null;
    }
    if (!node) { fallback(); return; }

    // save need label
    if (node.needLabel) leadData.need = node.needLabel;

    var nextState = node.next || currentState;
    state = nextState;

    // trigger lead capture if next state is capture_email
    if (nextState === 'capture_email') {
      waitingFor = 'email';
      playMsgs(node.msgs && node.msgs.length ? node.msgs : ["Pour que notre équipe vous contacte rapidement, pourriez-vous me laisser votre email professionnel ?"], null);
      return;
    }

    playMsgs(node.msgs || [], function() {
      if (node.action) node.action();
      var opts = node.opts || [];
      if (nextState === 'done' && !node.action) {
        // conversation over — no more options
      } else if (opts.length > 0) {
        showOpts(opts, nextState);
      }
    });
  }

  function fallback() {
    playMsgs(
      ["Je suis spécialisé dans les services de notre cabinet. Puis-je vous aider sur l'un de ces sujets ?"],
      function() {
        showOpts(["Crise de trésorerie","DAF de transition","Structurer ma finance","Levée de fonds"], 'topic');
        state = 'topic';
      }
    );
  }

  // ════════════════════════════════════════════════════════
  //  ▸ MOTEUR LLM — appels API cloud
  // ════════════════════════════════════════════════════════

  // Appel principal — choisit le provider configuré
  async function callLLM(userMessage) {
    if (!LLM_CONFIG.enabled || LLM_CONFIG.apiKey === 'VOTRE_CLE_API_ICI') {
      return null; // LLM non configuré → fallback FLOWS
    }
    try {
      var reply = null;
      if (LLM_CONFIG.provider === 'gemini') {
        reply = await callGemini(userMessage);
      } else if (LLM_CONFIG.provider === 'groq') {
        reply = await callGroq(userMessage);
      }
      return reply;
    } catch(err) {
      console.warn('[Naaxos LLM] Erreur:', err.message);
      return null; // en cas d'erreur → fallback FLOWS
    }
  }

  // ── Gemini (Google AI Studio — gratuit) ────────────────
  async function callGemini(message) {
    var groundedMessage = buildGroundedUserMessage(message);
    // Construire le contenu avec historique
    var contents = llmHistory.map(function(h) {
      return { role: h.role === 'assistant' ? 'model' : 'user',
               parts: [{ text: h.content }] };
    });
    contents.push({ role: 'user', parts: [{ text: groundedMessage }] });

    var res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/'
      + LLM_CONFIG.model + ':generateContent?key=' + LLM_CONFIG.apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: contents,
          generationConfig: { maxOutputTokens: 350, temperature: 0.65 }
        })
      }
    );
    if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
    var data = await res.json();
    var text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini réponse vide');
    return text.trim();
  }

  // ── Groq (API OpenAI-compatible — gratuit) ─────────────
  async function callGroq(message) {
    var groundedMessage = buildGroundedUserMessage(message);
    var messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    llmHistory.forEach(function(h) {
      messages.push({ role: h.role, content: h.content });
    });
    messages.push({ role: 'user', content: groundedMessage });

    var res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LLM_CONFIG.apiKey
      },
      body: JSON.stringify({
        model: LLM_CONFIG.model || 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 350,
        temperature: 0.65
      })
    });
    if (!res.ok) throw new Error('Groq HTTP ' + res.status);
    var data = await res.json();
    var text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq réponse vide');
    return text.trim();
  }

  // ── Traitement de la réponse LLM ───────────────────────
  // Détecte [RDV] → affiche bouton formulaire, strip la balise
  function handleLLMReply(raw, userMsg) {
    var wantsRdv = raw.indexOf('[RDV]') !== -1;
    var clean    = raw.replace(/\[RDV\]/g, '').trim();

    // Stocker dans l'historique (max 10 échanges pour limiter les tokens)
    llmHistory.push({ role: 'user',      content: userMsg });
    llmHistory.push({ role: 'assistant', content: clean  });
    if (llmHistory.length > 20) llmHistory = llmHistory.slice(llmHistory.length - 20);

    // Afficher la réponse
    addBotMsg(clean);

    // Si intent de contact détecté → bouton vers formulaire
    if (wantsRdv) {
      showRdvPrompt();
    }
  }

  // ════════════════════════════════════════════════════════
  //  ▸ FIN MOTEUR LLM
  // ════════════════════════════════════════════════════════

  // ── start ──────────────────────────────────────────
  function startConversation() {
    var flow = FLOWS.welcome;
    state = flow.next;
    playMsgs(flow.msgs, function() {
      showOpts(flow.opts, flow.next);
    });
  }

  // ── option click ───────────────────────────────────
  function handleOption(text, nextState) {
    addUserMsg(text);
    if (text === 'Fermer') { setTimeout(window.toggleChat, 400); return; }
    setTimeout(function() { dispatch(text, nextState || state); }, 280);
  }

  // ── input ──────────────────────────────────────────
  window.onChatKey = function(e) { if (e.key === 'Enter') window.sendMsg(); };
  function showRdvPrompt() {
    setTimeout(function() {
      addBotMsg("Souhaitez-vous qu'un expert vous rappelle ? C'est <strong>gratuit et sans engagement</strong>.");
      clearOpts();
      showOpts(["Prendre rendez-vous →", "Non merci, juste des infos"], 'cta');
    }, 500);
  }
  function renderLocalReply(localReply) {
    if (!localReply) return false;
    addBotMsg(localReply.text);
    if (localReply.rdv) showRdvPrompt();
    return true;
  }
  window.sendMsg = function() {
    var text = input_el.value.trim();
    if (!text) return;
    input_el.value = '';
    addUserMsg(text);

    // Réponse locale basée sur la base de connaissances du site
    var localReply = localKnowledgeReply(text);
    if (localReply && (!LLM_CONFIG.enabled || LLM_CONFIG.apiKey === 'VOTRE_CLE_API_ICI')) {
      addTyping();
      setTimeout(function() {
        removeTyping();
        renderLocalReply(localReply);
      }, 500);
      return;
    }

    if (LLM_CONFIG.enabled && LLM_CONFIG.apiKey !== 'VOTRE_CLE_API_ICI') {
      addTyping();
      callLLM(text).then(function(reply) {
        removeTyping();
        if (reply) { handleLLMReply(reply, text); }
        else if (renderLocalReply(localReply)) {}
        else { dispatch(text, state); }
      }).catch(function() {
        removeTyping();
        if (!renderLocalReply(localReply)) {
          dispatch(text, state);
        }
      });
    } else {
      setTimeout(function() { dispatch(text, state); }, 280);
    }
  };

})(); // end IIFE

/* ========== TURNSTILE (anti-bot) ========== */
// Rendu explicite des widgets après injection de page par le routeur.
var _turnstileWidgets = {}; // containerId -> widgetId

function renderTurnstileWidgets() {
  var cfg = window.NAAXOS_CONFIG || {};
  var siteKey = cfg.TURNSTILE_SITE_KEY;
  if (!window.turnstile || !siteKey || siteKey.indexOf('REMPLACER') !== -1) return;
  document.querySelectorAll('.naaxos-turnstile').forEach(function (el) {
    if (!el.id || _turnstileWidgets[el.id]) return; // déjà rendu
    try {
      _turnstileWidgets[el.id] = window.turnstile.render('#' + el.id, {
        sitekey: siteKey,
        theme: 'auto'
      });
    } catch (e) { /* widget déjà rendu ou Turnstile pas prêt */ }
  });
}
window.renderTurnstileWidgets = renderTurnstileWidgets;

function _turnstileToken(containerId) {
  if (!window.turnstile) return '';
  var wid = _turnstileWidgets[containerId];
  try { return wid ? (window.turnstile.getResponse(wid) || '') : ''; }
  catch (e) { return ''; }
}
function _turnstileReset(containerId) {
  if (!window.turnstile) return;
  var wid = _turnstileWidgets[containerId];
  try { if (wid) window.turnstile.reset(wid); } catch (e) {}
}

/* Appel sécurisé de l'Edge Function (remplace l'INSERT direct côté client) */
async function submitToFunction(type, data, cv) {
  var cfg = window.NAAXOS_CONFIG || {};
  var url = cfg.SUBMIT_FN_URL;
  if (!url) throw new Error('Service de formulaire non configuré (SUBMIT_FN_URL).');
  var body = { type: type, token: data.__token, data: data };
  if (cv) body.cv = cv;
  delete data.__token;
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  var out = {};
  try { out = await resp.json(); } catch (e) {}
  if (!resp.ok || !out.ok) {
    throw new Error(out.error || ('Erreur ' + resp.status));
  }
  return true;
}

/* ========== SUPABASE CONFIG ========== */
// Les identifiants Supabase proviennent de config.js / config.local.js
// (window.SUPABASE_URL et window.SUPABASE_ANON_KEY y sont définis avant ce script).
// Aucune valeur en dur ici.

async function supabaseInsert(table, data) {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    throw new Error("Supabase non configuré. Vérifier config.js");
  }

  const response = await fetch(
    window.SUPABASE_URL + '/rest/v1/' + table,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur Supabase: ' + response.status);
  }

  return true;
}

function _setBtnState(btn, text, disabled) {
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = !!disabled;
}

function _showFormError(errDiv, message) {
  if (!errDiv) return;
  var p = errDiv.querySelector('p');
  if (p) p.textContent = message;
  errDiv.style.display = 'block';
}

/* ---- NEWSLETTER FORM — validation + Supabase ---- */
async function submitNewsletter() {
  const prenom    = (document.getElementById('nlPrenom')||{value:''}).value.trim();
  const email     = (document.getElementById('nlEmail')||{value:''}).value.trim();
  const secteur   = (document.getElementById('nlSecteur')||{value:''}).value;
  const situation = (document.getElementById('nlSituation')||{value:''}).value.trim();
  const errDiv    = document.getElementById('nlError');
  const succDiv   = document.getElementById('nlSuccess');

  // Honeypot : si ce champ invisible est rempli, c'est un bot → succès silencieux, pas d'envoi
  const hp = (document.getElementById('nlWebsite')||{value:''}).value;
  if (hp) { if (succDiv) succDiv.style.display = 'block'; return; }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!prenom || prenom.length > 80 || !emailOk || email.length > 150 ||
      !secteur || !situation || situation.length > 2000) {
    if (errDiv) errDiv.style.display = 'block';
    return;
  }
  if (errDiv) errDiv.style.display = 'none';

  // Jeton anti-bot Turnstile obligatoire
  const token = _turnstileToken('nlTurnstile');
  if (!token) {
    _showFormError(errDiv, '⚠️ Merci de compléter la vérification anti-robot.');
    return;
  }

  const btn = document.getElementById('nlSubmitBtn');
  _setBtnState(btn, 'Envoi en cours…', true);

  try {
    // Écriture via l'Edge Function sécurisée (plus d'INSERT direct côté client)
    await submitToFunction('newsletter', {
      __token: token,
      prenom: prenom,
      email: email,
      secteur: secteur,
      situation: situation
    });

    if (succDiv) succDiv.style.display = 'block';
    if (errDiv) errDiv.style.display = 'none';
    if (btn) { btn.textContent = '✅ Inscription confirmée'; btn.style.background='#22c55e'; }
  } catch(err) {
    console.error('[Naaxos] Newsletter error:', err);
    _turnstileReset('nlTurnstile');
    _setBtnState(btn, "S'abonner à la newsletter →", false);
    _showFormError(errDiv, '⚠️ Erreur : ' + (err && err.message ? err.message : String(err)));
  }
}

// Note : la navigation (y compris pages légales et actualités) est gérée
// par router.js, qui charge pages/<id>.html dans #app et déclenche
// loadArticles() pour la page actualités.

// Force les handlers de clic même si l'inline onclick est ignoré
window.submitNewsletter = submitNewsletter;
window.submitCvForm = submitCvForm;
window.loadArticles = loadArticles;   // utilisé par le bouton « Réessayer » et router.js
window.fetchArticles = fetchArticles;

document.addEventListener('DOMContentLoaded', function () {
  loadArticles();
  // Rendu Turnstile au 1er chargement : l'api.js est async, on tente plusieurs fois
  var _tsTries = 0;
  var _tsTimer = setInterval(function () {
    _tsTries++;
    if (window.turnstile && typeof renderTurnstileWidgets === 'function') {
      renderTurnstileWidgets();
    }
    if (_tsTries > 20) clearInterval(_tsTimer); // ~10 s max
  }, 500);
});
