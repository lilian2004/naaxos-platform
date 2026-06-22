# Naaxos — Full digital rebuild (website + database + admin)

> A finance consulting firm's complete digital presence — website, database, CRM — rebuilt solo, production-ready (client go-live pending). Static front-end, serverless backend, security-audited before launch.

**Demo:** https://naaxos-demo-lilian.netlify.app *(client go-live pending)* · **Case study:** https://dub.sh/Naaxos-platform

---

## The problem

Naaxos (operational finance — interim CFO, management control, Finance IT) ran an outdated static website: a frozen showcase, leads lost in email inboxes, and content only a developer could change. The brief: rebuild everything — website, database, internal tools — solo, reporting directly to the CEO. April → June 2026; built production-ready, client go-live pending.

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

## Tech stack

`HTML` · `CSS` · `JavaScript` (vanilla, SPA router) · `Supabase` (PostgreSQL, REST, RLS, Storage) · `Edge Functions` (Deno/TypeScript) · `Cloudflare Turnstile` · `Retool` · `Apache` · `Ionos`

## Result

Built solo and delivered to the client in June 2026 — production-ready, client go-live pending. Designed to remove the firm's developer dependency:

- **Publishing an article:** ask a developer and wait → 5 minutes, by the CEO herself
- **Incoming leads:** lost in email inboxes → captured and tracked in a structured CRM
- **Tooling:** scattered across emails and spreadsheets → one Retool workspace (CRM, applications, newsletter, articles)

> 💬 "Lilian took over our entire digital presence — website, database, internal tools — and delivered everything solo, end to end, in three months. He quickly understands business needs and turns them into concrete solutions."
> — Céline Pontier, CEO of Naaxos

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

> This is a client project — the repo documents the architecture and decisions rather than offering a one-command setup (it's tied to Naaxos's Supabase project and host).

## What I'd add next

Per-IP rate limiting in the Edge Function, an admin view served from Supabase Auth (to read data without the dashboard), and basic analytics on form conversion.

---

### About

Built by **Lilian Miceli** — I take work off a founder's plate and ship it to production, solo.
[LinkedIn](https://www.linkedin.com/in/lilian-miceli-451ab0235/) · lilianmiceli38@gmail.com

*Note: the public API (anon) key in `config.js` is a publishable key, safe to expose by design — its security relies on the Row Level Security policies above. No private keys are in this repository.*
