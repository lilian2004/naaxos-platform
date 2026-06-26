/**
 * NAAXOS - Configuration (COMMITABLE - aucun secret réel ici)
 * ===========================================================
 * Les valeurs sensibles (clés Supabase / Groq) sont placeholders ci-dessous
 * et surchargées au chargement par `config.local.js` (non commité).
 * Voir `config.local.example.js` pour le modèle à recopier.
 *
 * Generated: 28 mai 2026
 */

window.NAAXOS_CONFIG = {

  // ======================================
  // SUPABASE (Newsletter + CVs + Articles)
  // → vraies valeurs dans config.local.js
  // ======================================
  SUPABASE_URL: 'https://wooycgszlpiqkyjpwuoc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_UmMzFwhFd1PLOJ5ws33boA_iwHMMhh3',

  // Edge Function qui traite les formulaires (écriture sécurisée côté serveur)
  SUBMIT_FN_URL: 'https://wooycgszlpiqkyjpwuoc.supabase.co/functions/v1/submit-form',

  // Cloudflare Turnstile — clé SITE (publique, OK côté client).
  // ⚠️ Remplace par ta vraie clé site après création du compte Turnstile.
  TURNSTILE_SITE_KEY: '0x4AAAAAADjTzPbT-hNUYZ0Y',

  // Tables Supabase requises:
  // - newsletter (prenom, email, secteur, situation, date_created)
  // - candidatures (prenom, nom, email, poste, disponibilite, cv_base64, cv_filename, cv_mimetype)
  // - articles (OPTIONNEL - id, slug, titre, contenu, date_created, auteur) - sinon articles locaux


  // ======================================
  // CHAT IA (LLM Groq - Optionnel)
  // → La clé Groq NE vit PLUS dans le navigateur : elle est stockée comme
  //   secret de l'Edge Function "chat-proxy" (supabase secrets set GROQ_API_KEY=...).
  //   Le site appelle uniquement ce proxy, qui ajoute la clé côté serveur.
  // ======================================
  CHAT_FN_URL: 'https://wooycgszlpiqkyjpwuoc.supabase.co/functions/v1/chat-proxy',
  GROQ_ENABLED: false, // Mettre true pour activer le chat (après déploiement du proxy)


  // ======================================
  // CONFIGURATION GÉNÉRALE
  // ======================================
  SITE_NAME: 'Naaxos',
  SITE_URL: 'https://www.naaxos.fr',
  CONTACT_EMAIL: 'contact@naaxos.fr',

  // Timeouts (ms)
  FETCH_TIMEOUT: 10000,
  FORM_SUBMIT_TIMEOUT: 15000,

  // Limits
  MAX_CV_SIZE_MB: 5,
  MAX_MESSAGE_LENGTH: 5000,

  // Debug mode
  DEBUG: false // Mettre true pour logs console détaillés
};

// ================================================
// SURCHARGE PAR LES SECRETS LOCAUX (config.local.js, non commité)
// ================================================
if (window.NAAXOS_SECRETS) {
  Object.assign(window.NAAXOS_CONFIG, window.NAAXOS_SECRETS);
} else {
  console.warn('⚠️  config.local.js absent : valeurs placeholder utilisées (copier config.local.example.js).');
}

// ================================================
// ALIAS GLOBALES (pour compatibilité code existant)
// ================================================
window.SUPABASE_URL = window.NAAXOS_CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.NAAXOS_CONFIG.SUPABASE_ANON_KEY;

window.LLM_CONFIG = {
  enabled: window.NAAXOS_CONFIG.GROQ_ENABLED,
  provider: 'groq',
  fnUrl: window.NAAXOS_CONFIG.CHAT_FN_URL // proxy backend ; la clé reste côté serveur
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Initialiser Supabase
 */
function initSupabase() {
  if (!window.NAAXOS_CONFIG.SUPABASE_URL || !window.NAAXOS_CONFIG.SUPABASE_ANON_KEY) {
    console.warn('⚠️  Supabase not configured');
    return false;
  }

  // Configuration globale pour script.js
  window.SUPABASE_URL = window.NAAXOS_CONFIG.SUPABASE_URL;
  window.SUPABASE_ANON_KEY = window.NAAXOS_CONFIG.SUPABASE_ANON_KEY;
  return true;
}

/**
 * Initialiser Groq LLM
 */
function initGroq() {
  if (!window.NAAXOS_CONFIG.GROQ_ENABLED) {
    return false;
  }

  if (!window.LLM_CONFIG.fnUrl) {
    console.warn('⚠️  CHAT_FN_URL (proxy backend) non configurée');
    return false;
  }
  return true;
}

/**
 * Log de démarrage
 */
function logConfig() {
  if (!window.NAAXOS_CONFIG.DEBUG) return;

  console.log('%c🚀 NAAXOS Configuration Loaded', 'color: #26325A; font-size: 14px; font-weight: bold;');
  console.table({
    'Site': window.NAAXOS_CONFIG.SITE_NAME,
    'URL': window.NAAXOS_CONFIG.SITE_URL,
    'Email': window.NAAXOS_CONFIG.CONTACT_EMAIL,
    'Supabase': window.NAAXOS_CONFIG.SUPABASE_URL ? '✓ Configuré' : '✗ Manquant',
    'Groq LLM': window.NAAXOS_CONFIG.GROQ_ENABLED ? '✓ Activé' : '✗ Désactivé',
    'Mode Debug': window.NAAXOS_CONFIG.DEBUG ? '✓ ON' : '✗ OFF'
  });
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', function() {
  initSupabase();
  initGroq();
  logConfig();
});
