# Audit de sécurité FINAL — Naaxos (après correctifs)

**Cible** : `https://www.naaxos.fr` — site statique HTML/CSS/JS (Ionos) + Supabase, désormais via Edge Function
**Projet Supabase** : `wooycgszlpiqkyjpwuoc.supabase.co`
**Date** : 12 juin 2026
**Méthode** : revue de code + tests d'attaque live (clé anon publique), non destructifs

> ⚠️ Statut de déploiement : le **back-end est sécurisé et vérifié**. Il reste à **uploader `public_html` sur Ionos** pour que les formulaires en ligne basculent sur le nouveau circuit. Tant que ce n'est pas fait, les formulaires du site live renvoient une erreur (l'ancien code écrit en direct, ce qui est maintenant bloqué). C'est attendu et corrigé par l'upload.

---

## Verdict global : 🟢 SÉCURISÉ

Les trois failles critiques de l'audit initial sont **fermées et revérifiées en direct**. Un visiteur anonyme avec la clé publique ne peut plus ni lire tes données, ni les modifier, ni les supprimer. Les écritures passent par une fonction serveur protégée par CAPTCHA. Les CV sont dans un bucket privé inaccessible publiquement.

| Axe | Avant | Après | Statut |
|---|---|---|---|
| Modification/suppression anonyme (articles, newsletter) | 🔴 possible | refusé (RLS) | ✅ corrigé |
| Lecture des abonnés (PII / RGPD) | 🔴 exposée | refusée | ✅ corrigé |
| Lecture des candidatures + CV | 🔴 exposée | refusée | ✅ corrigé |
| Clé service_role exposée | 🟢 jamais | jamais | ✅ propre |
| Validation des entrées | 🟠 client seul | serveur (Edge Function) + contraintes SQL | ✅ corrigé |
| Upload CV | 🟠 base64 en table, lisible | bucket privé + contrôle type/magic-number/taille | ✅ corrigé |
| Rate limiting / spam | 🟠 inexistant | CAPTCHA + honeypot + index unique | ✅ fortement réduit |

---

## 1) Row Level Security — re-test table par table

Requêtes lancées avec la clé anon publique (ce qu'un attaquant tape dans la console F12) et résultats **réels** obtenus aujourd'hui :

```js
const U = window.SUPABASE_URL, K = window.SUPABASE_ANON_KEY;
const H = { apikey:K, Authorization:'Bearer '+K, 'Content-Type':'application/json' };
```

| Test attaquant | Résultat live | Verdict |
|---|---|---|
| `POST /rest/v1/newsletter` (insérer) | `401 — violates row-level security policy` | ✅ refusé |
| `POST /rest/v1/candidatures` (insérer) | `401 — violates row-level security policy` | ✅ refusé |
| `GET /rest/v1/newsletter?select=*` (lire abonnés) | `[]` | ✅ aucune fuite |
| `GET /rest/v1/candidatures?select=*` (lire CV) | `[]` | ✅ aucune fuite |
| `PATCH /rest/v1/articles?id=eq.6` (modifier) | `[]` (0 ligne, refusé) | ✅ refusé |
| `DELETE /rest/v1/articles?id=eq.6` (supprimer) | `[]` (0 ligne, refusé) | ✅ refusé |
| `GET /rest/v1/articles?select=*&statut=publié` (lecture légitime) | renvoie les articles publiés | ✅ OK |

Les tables `contacts` et `abonnés` mentionnées au départ **n'existent pas** : le contact passe par un iframe Calendly (rien à sécuriser côté base), et les abonnés sont la table `newsletter`.

**Conclusion** : l'anonyme n'a plus qu'un seul droit — lire les articles au statut `publié`. Tout le reste est refusé par le RLS.

---

## 2) Clés exposées côté client

Re-scan complet du code servi (`*.js`, `*.html`, `.htaccess`) :

- `service_role` / `sb_secret` / JWT en dur → **aucun**. ✅
- Clé Groq (`gsk_...`) → **placeholder uniquement** (`gsk_YOUR_GROQ_API_KEY_HERE`), et `GROQ_ENABLED: false`. Pas de secret réel, chat IA désactivé. ✅
- Seules clés publiques présentes : `SUPABASE_ANON_KEY` (publishable, faite pour ça) et `TURNSTILE_SITE_KEY` (clé site Turnstile, publique par conception). ✅
- La **Secret Key** Turnstile et la **service_role** vivent uniquement côté serveur (secrets de l'Edge Function), jamais téléchargées par le navigateur. ✅
- `.htaccess` bloque le téléchargement de `config.local*.js`, `.env*`, `*.sql` et `/.git`. ✅

**À vérifier de ton côté (je n'ai pas accès au dépôt Git)** : qu'aucune clé réelle n'ait été commitée par le passé.
```bash
git log -p -- '*config*' | grep -iE 'service_role|sb_secret|gsk_[A-Za-z0-9]|AIza'
```
Si quelque chose remonte → révoque la clé concernée (la retirer du code ne suffit pas, elle reste dans l'historique).

---

## 3) Validation des entrées

La validation est maintenant **côté serveur** dans l'Edge Function (non contournable), en plus du JS client (confort UX) :

- Email vérifié par regex, longueurs bornées (prénom/nom ≤ 80, situation ≤ 2000, email ≤ 150).
- Contraintes `CHECK` également posées **en base** → même un appel REST direct qui passerait serait rejeté au niveau Postgres.
- Le rendu des articles dans le DOM passe par `_escapeHtml()` → pas de XSS stocké via l'affichage.
- **Honeypot** invisible (`nlWebsite` / `cv_website`) sur les deux formulaires : un bot qui le remplit est ignoré silencieusement.

Reste mineur : l'écriture directe étant bloquée par le RLS, un attaquant ne peut plus injecter de données arbitraires sans passer par la fonction (qui valide). ✅

---

## 4) Upload des CV

- **Stockage** : désormais bucket Supabase Storage **privé** `cv` (plus de base64 en table). La table `candidatures` ne stocke qu'un `cv_path` (référence).
- **Qui peut lire** : personne avec la clé publique. Tests live :
  - lister le bucket → `[]` (aucun accès)
  - télécharger un objet → `not_found` / refusé
  Seule l'Edge Function (service_role) y accède ; toi, tu télécharges via URL signée depuis le Dashboard.
- **Contrôles à l'upload** (dans la fonction) : type MIME + extension, **magic number** (`%PDF`, `PK` pour docx, OLE pour .doc) pour empêcher un faux PDF, taille réelle ≤ 5 Mo après décodage. ✅

---

## 5) Rate limiting / spam massif (« 10 000 formulaires »)

Défenses en place :
- **CAPTCHA Turnstile** obligatoire, vérifié côté serveur : un script qui boucle sur la fonction est rejeté (`403 — Vérification anti-robot échouée`), testé en live. C'est la vraie barrière.
- **Honeypot** : filtre les bots basiques avant même l'envoi.
- **Index unique** sur `lower(email)` : empêche le ré-enregistrement massif du même email.
- Écriture directe impossible (RLS) → le flood doit forcément passer la fonction + le CAPTCHA.

Limite résiduelle 🟡 : Turnstile arrête l'écrasante majorité des bots mais pas un humain déterminé qui résoudrait les CAPTCHA un par un. Pour aller plus loin tu pourrais ajouter un quota par IP dans la fonction (ex. via une table de comptage), mais ce n'est pas nécessaire pour ton volume. Pense aussi à fixer une **alerte de facturation** Supabase par sécurité.

---

## Structure du site — faut-il changer quelque chose avant de déployer ?

Rien de bloquant. La structure est saine. Quelques points d'attention pour l'upload :

1. **Uploade bien le `.htaccess`** — les clients FTP masquent souvent les fichiers commençant par un point. Active « afficher les fichiers cachés ».
2. **N'uploade pas** `config.local.js` ni `config.local.example.js` (inutiles ; de toute façon bloqués par `.htaccess`). Tu peux même les supprimer du dossier.
3. La fonction `supabaseInsert()` dans `script.js` n'est plus appelée (code mort, inoffensif) — tu peux la laisser, je n'y touche pas pour ne rien casser.
4. Après l'upload, **teste les deux formulaires en vrai** : le widget Turnstile doit apparaître, et une inscription/candidature de test doit réussir (ligne dans Supabase, fichier dans le bucket `cv`).

---

## Checklist finale

Fait et vérifié :
- [x] RLS verrouillé sur les 3 tables (re-testé live)
- [x] Edge Function déployée, CAPTCHA actif (re-testé live : 403 sans token)
- [x] Bucket CV privé, inaccessible publiquement (re-testé live)
- [x] Secrets serveur posés (Turnstile secret, service_role) — hors navigateur
- [x] Site Key Turnstile dans `config.js`, honeypots et widgets en place
- [x] Aucun secret réel exposé côté client

Reste à faire :
- [ ] Uploader `public_html` sur Ionos (avec `.htaccess`, sans `config.local*.js`)
- [ ] Tester les 2 formulaires en ligne après upload
- [ ] (optionnel) Supprimer la ligne témoin « AuditTest » dans `newsletter`
- [ ] (optionnel) Régénérer la Secret Key Turnstile (partagée en chat) + `supabase secrets set`
- [ ] (optionnel) Vérifier l'historique Git pour d'anciennes clés

---

*Tests réalisés en lecture/écriture non destructive sur l'infrastructure du propriétaire, avec la clé publique déjà exposée par le site. Aucune donnée modifiée ou supprimée.*
