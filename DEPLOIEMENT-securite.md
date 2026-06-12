# Déploiement — sécurisation des formulaires Naaxos

Ce guide finit la mise en sécurité : les formulaires n'écrivent plus directement dans Supabase, ils passent par une **Edge Function** protégée par un **CAPTCHA Cloudflare Turnstile**, et les **CV vont dans un bucket privé**.

Suis les étapes **dans l'ordre**. Compte ~30 min.

---

## Récapitulatif des fichiers livrés

| Fichier | Rôle | Où il va |
|---|---|---|
| `naaxos-securite.sql` | RLS de base (déjà exécuté ✅) | Supabase SQL Editor |
| `naaxos-securite-v2.sql` | Bucket privé + retrait insert anon + colonne `cv_path` | Supabase SQL Editor |
| `supabase/functions/submit-form/index.ts` | Edge Function (vérif CAPTCHA, validation, upload CV, insert) | Déployée via CLI Supabase |
| `public_html/...` (config.js, index.html, js/script.js, js/router.js, pages/accueil.html, pages/rejoindre.html, .htaccess) | Front modifié | Upload FTP sur Ionos |

---

## Étape 1 — Créer le CAPTCHA Cloudflare Turnstile

1. Va sur https://dash.cloudflare.com/ → menu **Turnstile** → **Add widget**.
2. Nom : `naaxos`. **Hostnames** : `naaxos.fr` et `www.naaxos.fr` (et `localhost` si tu testes en local).
3. Widget type : **Managed** (recommandé).
4. Tu obtiens **2 clés** :
   - **Site Key** (publique) → commence souvent par `0x4AAA...`
   - **Secret Key** (privée) → à ne JAMAIS mettre dans le site.

5. Colle la **Site Key** dans `public_html/config.js`, à la place de `0x_REMPLACER_PAR_TA_CLE_SITE_TURNSTILE` :
   ```js
   TURNSTILE_SITE_KEY: '0x4AAA...ta_vraie_cle_site',
   ```
   La **Secret Key**, garde-la pour l'étape 3.

---

## Étape 2 — Installer la CLI Supabase et se connecter

Sur ton ordinateur (Terminal) :

```bash
# Installation (macOS via Homebrew ; sinon voir supabase.com/docs/guides/cli)
brew install supabase/tap/supabase

# Connexion (ouvre le navigateur)
supabase login

# Lier le projet (récupère l'ID dans Dashboard → Project Settings → General)
cd /chemin/vers/le/dossier/framer
supabase link --project-ref wooycgszlpiqkyjpwuoc
```

---

## Étape 3 — Déclarer les secrets de la fonction

```bash
# Clé secrète Turnstile (étape 1)
supabase secrets set TURNSTILE_SECRET='0x4AAA...ta_secret_key'

# Origine autorisée (CORS)
supabase secrets set ALLOWED_ORIGIN='https://www.naaxos.fr'
```

> `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis **automatiquement** au runtime — ne les déclare pas toi-même.

---

## Étape 4 — Déployer l'Edge Function

Le fichier est déjà à `supabase/functions/submit-form/index.ts`.

```bash
# --no-verify-jwt : le formulaire est public ; la barrière, c'est Turnstile (pas un JWT)
supabase functions deploy submit-form --no-verify-jwt
```

Vérifie l'URL obtenue, elle doit correspondre à `SUBMIT_FN_URL` dans `config.js` :
`https://wooycgszlpiqkyjpwuoc.supabase.co/functions/v1/submit-form`

---

## Étape 5 — Exécuter le SQL v2

Dans **Supabase → SQL Editor**, colle et exécute **`naaxos-securite-v2.sql`**.
Il crée le bucket privé `cv`, ajoute la colonne `cv_path`, et retire le droit d'insertion à l'anonyme (désormais tout passe par la fonction).

> ⚠️ À faire **après** le déploiement de la fonction (étape 4), sinon les formulaires seront cassés entre les deux étapes.

---

## Étape 6 — Redéployer le site sur Ionos

Upload (FTP/SFTP) le contenu de `public_html/` vers ton hébergement Ionos. Fichiers modifiés :
`config.js`, `index.html`, `js/script.js`, `js/router.js`, `pages/accueil.html`, `pages/rejoindre.html`, `.htaccess`.

**N'uploade pas** `config.local.js` ni `config.local.example.js` (inutiles ; le `.htaccess` les bloque de toute façon).

---

## Étape 7 — Vérifier

**Sur le site en ligne :**
- Page d'accueil : le widget Turnstile apparaît au-dessus du bouton « S'abonner ». Inscris-toi → message de confirmation, et la ligne apparaît dans Supabase (table `newsletter`).
- Page « Rejoindre » : envoie une candidature avec un vrai PDF → succès, et le CV apparaît dans **Storage → bucket `cv`**, la ligne dans `candidatures` (avec `cv_path` rempli, plus de base64).

**Côté attaquant (console F12, doit échouer) :**
```js
const U=window.SUPABASE_URL, K=window.SUPABASE_ANON_KEY;
const H={apikey:K,Authorization:'Bearer '+K,'Content-Type':'application/json'};
// INSERT direct sans passer par la fonction → doit être REFUSÉ (401/403)
fetch(`${U}/rest/v1/newsletter`,{method:'POST',headers:H,body:'{"prenom":"x","email":"x@x.co","secteur":"x","situation":"x"}'}).then(r=>r.status).then(console.log);
// Appel de la fonction sans token Turnstile → doit renvoyer 403
fetch(window.NAAXOS_CONFIG.SUBMIT_FN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"type":"newsletter","data":{}}'}).then(r=>r.status).then(console.log);
```

Préviens-moi quand c'est déployé : **je relance la batterie de tests d'attaque** pour confirmer que l'écriture directe est bien fermée et que seule la fonction (avec CAPTCHA) fonctionne.

---

## Pour lire un CV plus tard (toi, admin)

Les CV sont dans un bucket **privé** : pas d'URL publique. Pour en télécharger un, génère une URL signée temporaire depuis le Dashboard (Storage → cv → clic sur le fichier → *Get URL* / *Download*), ou via la CLI. Personne d'autre n'y a accès avec la clé publique du site.

---

## Lexique express

- **RLS (Row Level Security)** : règles Postgres qui décident, ligne par ligne, qui peut lire/écrire. C'est ta vraie serrure.
- **Clé `anon` / publishable** : clé publique du site, sans pouvoir si le RLS est bien réglé.
- **Clé `service_role`** : clé toute-puissante, **uniquement** côté serveur (ici, dans la fonction). Jamais dans le navigateur.
- **Edge Function** : petit bout de code serveur hébergé par Supabase ; c'est lui qui détient `service_role` et applique CAPTCHA + validation.
- **Turnstile** : CAPTCHA de Cloudflare qui distingue humains et bots.
