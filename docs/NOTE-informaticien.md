# Note de passation — Mise en ligne du site Naaxos

**Pour** : l'informaticien en charge du déploiement
**De** : Lilian
**Date** : 12 juin 2026
**Objet** : déploiement d'une version majeure du site (sécurité + contenu + design + photos)

---

## Résumé

Le site a reçu un gros lot de changements, prêts dans `public_html/`. Une partie est déjà en place côté Supabase (sécurité). **Il reste à uploader le front sur Ionos.** Tant que ce n'est pas fait, les formulaires en ligne renvoient une erreur (voir « Point de vigilance » en bas).

---

## A. Déjà fait côté back-end (Supabase) — rien à faire

- **Row Level Security** verrouillé sur `newsletter`, `candidatures`, `articles`.
- **Edge Function `submit-form`** déployée (CAPTCHA Turnstile + validation serveur + insert via service_role).
- **Bucket Storage privé `cv`** pour les candidatures.
- Scripts SQL `naaxos-securite.sql` et `naaxos-securite-v2.sql` exécutés.
- Secrets posés (`TURNSTILE_SECRET`, `ALLOWED_ORIGIN`).

## B. À faire — uploader `public_html/` sur Ionos (FTP/SFTP)

### Fichiers modifiés à pousser
- `config.js` — ajout de l'URL de l'Edge Function + clé site Turnstile (clé publique, OK).
- `index.html` — chargement du script Turnstile.
- `css/style.css` — **nouvelle charte couleurs** (bleu `#262a5a`, violet `#a98feb`) + styles bannières, LinkedIn équipe.
- `js/script.js` — formulaires via Edge Function, cas clients mis à jour, honeypot.
- `js/router.js` — rendu Turnstile après navigation.
- `.htaccess` — blocage fichiers sensibles + en-têtes de sécurité.
- `pages/accueil.html` — bannière header + honeypot.
- `pages/cabinet.html` — image bannière, photos équipe, liens LinkedIn, Céline retirée.
- `pages/rejoindre.html` — image bannière, honeypot, textes (temps plein, poste contrôle de gestion).
- `pages/realisations.html` — cas clients mis à jour (titres, BFR).
- `pages/secteurs.html` — reformulation « mission de contrôle de gestion ».
- `pages/contact.html` — couleurs.
- `pages/actualites.html` — couleurs.

### Nouveaux dossiers d'images à pousser (IMPORTANT — sinon images cassées)
- `assets/carroussel/` → `Accueil.jpg`, `Cabinet.jpg`, `Rejoindre.jpg`
- `assets/cabinet/` → `Pierre_maxime.jpg`, `Nicolas.jpg`

> ⚠️ Les noms de dossiers et de fichiers sont **sensibles à la casse** sur le serveur. Respecter exactement : `carroussel` (deux « s »), `Pierre_maxime.jpg`, etc.

### À NE PAS uploader
- `config.local.js`, `config.local.example.js` (inutiles ; bloqués par `.htaccess`).
- Les fichiers à la racine du dépôt hors `public_html/` (README, `.sql`, docs d'audit, fichiers d'aperçu `apercu-*.html`) — ils ne font pas partie du site live.

### Points de vigilance à l'upload
1. **Bien transférer le `.htaccess`** (activer « afficher les fichiers cachés » dans le client FTP).
2. Vérifier que `config.js` contient :
   - `SUBMIT_FN_URL: 'https://wooycgszlpiqkyjpwuoc.supabase.co/functions/v1/submit-form'`
   - `TURNSTILE_SITE_KEY: '0x4AAAAAADjTzPbT-hNUYZ0Y'`

## C. Vérifications après déploiement

- Page d'accueil : bannière en haut + couleurs violettes + widget Turnstile au-dessus du bouton « S'abonner ». Inscription test → ligne dans Supabase `newsletter`.
- Page cabinet : bannière, **2 membres** (Pierre-Maxime, Nicolas) avec photos et boutons LinkedIn.
- Page rejoindre : bannière + envoi d'une candidature avec un PDF → fichier dans Storage `cv`, ligne dans `candidatures`.
- Page réalisations : cas « Révision des actifs financiers » et « Transformation SAP » présents.
- Contrôle attaquant (console F12) — doit échouer :
  ```js
  const U=window.SUPABASE_URL,K=window.SUPABASE_ANON_KEY;
  const H={apikey:K,Authorization:'Bearer '+K,'Content-Type':'application/json'};
  fetch(`${U}/rest/v1/newsletter`,{method:'POST',headers:H,body:'{"prenom":"x","email":"x@x.co","secteur":"x","situation":"x"}'}).then(r=>r.status).then(console.log); // attendu : 401
  ```

## D. Point de vigilance — fenêtre de bascule

Tant que ce front n'est pas en ligne, **les formulaires du site live renvoient une erreur** (base déjà verrouillée, ancien code encore en place). À déployer dès que possible, idéalement hors heures de trafic.

## E. En cas de problème de formulaire après upload

- Console du navigateur → erreur retournée par la fonction.
- Logs : Dashboard Supabase → Edge Functions → `submit-form` → Logs.
- Causes fréquentes : `ALLOWED_ORIGIN` ≠ origine réelle (`https://www.naaxos.fr`), ou clé site Turnstile incorrecte dans `config.js`.

---

## Documents de référence (à la racine du projet)
`AUDIT-SECURITE-FINAL-naaxos.md`, `DEPLOIEMENT-securite.md`, `naaxos-securite.sql`, `naaxos-securite-v2.sql`, `supabase/functions/submit-form/index.ts` (déjà déployée).
