# Naaxos — Full digital rebuild (website + database + admin)

> A finance consulting firm's complete digital platform, rebuilt solo and shipped to production. Static front-end, serverless backend, security audited before launch.

**Live site:** https://www.naaxos.fr · **Case study:** https://dub.sh/lilian_miceli

---

## The problem

Naaxos (operational finance — interim CFO, management control, Finance IT) ran an outdated static website: no structured way to collect leads, and content only a developer could change. The brief: rebuild everything — website, database, internal tools — solo, reporting directly to the CEO.

## What I built

A static website (client constraint: no VPS) that powers a real platform:

- **Public site** — services, case studies, dynamic articles, and three forms (appointment requests, job applications with CV upload, newsletter).
- **Structured data** — every form feeds a Supabase (PostgreSQL) database, immediately usable.
- **Admin / CRM** — a Retool workspace on top of Supabase: the CEO writes and publishes articles, tracks applications, manages subscribers, and follows the prospect pipeline — with zero developer dependency.

## Architecture

```
 Visitor ─▶ Static site (HTML/CSS/JS, Ionos)
               │  reads  ▼ published articles (Supabase REST, RLS-protected)
               │  writes ▼ via a serverless Edge Function (CAPTCHA + validation)
            Supabase  ── PostgreSQL (RLS) ── Private Storage (CVs)
               ▲
          Retool admin (CEO) ── CRM · articles · applications · newsletter
```

**Deliberate trade-offs**
- *No VPS, no server to maintain* → serverless backend (Supabase + Edge Functions). Cheap to run, nothing to patch.
- *Retool for the admin* instead of a custom build → the CEO is autonomous in days, not months.
- *Public site and admin fully separated* → the website never holds privileged access.

## Security — audited before launch

I ran a **pentest-style audit** before going live and found a real flaw: with the public API key, anyone could read subscribers and job applications (CVs included) and edit the site's articles — a data-exposure / GDPR risk. Fixed and re-verified with live attack tests:

- **Row Level Security locked down table by table** — anonymous users can only read published articles; all other reads/writes are refused at the database level.
- **Writes moved behind an Edge Function** — server-side validation + CAPTCHA (Cloudflare Turnstile); the privileged key never reaches the browser.
- **CVs in private storage** — type/size checked server-side, not publicly accessible.
- **Hosting hardened** — Apache rules blocking sensitive files + security headers.

Details in [`docs/AUDIT-SECURITE-FINAL-naaxos.md`](docs/AUDIT-SECURITE-FINAL-naaxos.md).

## Tech stack

`HTML` · `CSS` · `JavaScript` (vanilla, SPA router) · `Supabase` (PostgreSQL, REST, RLS, Storage) · `Edge Functions` (Deno/TypeScript) · `Cloudflare Turnstile` · `Retool` · `Apache` · `Ionos`

## Repository layout

```
public_html/            Static site (deployed to Ionos)
  ├─ index.html         SPA shell
  ├─ config.js          Public config (Supabase URL, anon key, function URL)
  ├─ js/                App logic + SPA router
  ├─ pages/             Page fragments loaded by the router
  └─ .htaccess          Routing + security headers
supabase/functions/
  └─ submit-form/       Edge Function: CAPTCHA, validation, CV upload, insert
sql/                    Database setup + security hardening scripts
docs/                   Security audit & deployment notes
```

## What I'd add next

Per-IP rate limiting in the Edge Function, an admin view served from Supabase Auth (to read data without the dashboard), and basic analytics on form conversion.

---

### About

Built by **Lilian Miceli** — I build web products end to end and ship them to production.
[LinkedIn](https://www.linkedin.com/in/lilian-miceli-451ab0235/) · lilianmiceli38@gmail.com

*Note: the public API (anon) key visible in `config.js` is a publishable key, safe to expose by design — its security relies on the Row Level Security policies above. No private keys are in this repository.*
