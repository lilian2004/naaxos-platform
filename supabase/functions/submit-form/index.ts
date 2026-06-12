// =====================================================================
//  NAAXOS — Edge Function "submit-form"
//  Point d'entrée unique et sécurisé pour les formulaires du site.
//
//  Rôle : le navigateur n'écrit PLUS directement dans Supabase.
//  Il appelle cette fonction, qui :
//    1. vérifie le jeton Cloudflare Turnstile (anti-bot)
//    2. valide les champs côté serveur (non contournable)
//    3. pour une candidature : range le CV dans un bucket PRIVÉ
//    4. insère la ligne avec la clé service_role (jamais exposée au client)
//
//  Secrets attendus (supabase secrets set ...) :
//    - TURNSTILE_SECRET        : clé secrète Cloudflare Turnstile
//    - ALLOWED_ORIGIN          : https://www.naaxos.fr  (optionnel, défaut ci-dessous)
//  Fournis automatiquement par le runtime Edge :
//    - SUPABASE_URL
//    - SUPABASE_SERVICE_ROLE_KEY
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://www.naaxos.fr";

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// --- Vérification du jeton Turnstile auprès de Cloudflare ---
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) {
    console.error("TURNSTILE_SECRET manquant");
    return false;
  }
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const data = await r.json();
    return data.success === true;
  } catch (e) {
    console.error("Erreur vérif Turnstile:", e);
    return false;
  }
}

// --- Client Supabase avec service_role (bypass RLS, côté serveur uniquement) ---
function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }

  const { type, token, data, cv } = payload ?? {};
  const ip = req.headers.get("CF-Connecting-IP") ?? req.headers.get("x-forwarded-for");

  // 1. Anti-bot : jeton Turnstile obligatoire
  if (!token || !(await verifyTurnstile(String(token), ip))) {
    return json({ error: "Vérification anti-robot échouée. Réessayez." }, 403);
  }

  const db = admin();

  // ------------------------------------------------------------------
  //  NEWSLETTER
  // ------------------------------------------------------------------
  if (type === "newsletter") {
    const prenom = str(data?.prenom);
    const email = str(data?.email).toLowerCase();
    const secteur = str(data?.secteur);
    const situation = str(data?.situation);

    if (!prenom || prenom.length > 80) return json({ error: "Prénom invalide" }, 422);
    if (!EMAIL_RE.test(email) || email.length > 150) return json({ error: "Email invalide" }, 422);
    if (!secteur) return json({ error: "Secteur requis" }, 422);
    if (!situation || situation.length > 2000) return json({ error: "Situation invalide" }, 422);

    const { error } = await db.from("newsletter").insert({
      prenom, email, secteur, situation, date_created: new Date().toISOString(),
    });

    // Doublon d'email (index unique) → on répond OK sans révéler l'info
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      console.error("Insert newsletter:", error);
      return json({ error: "Erreur enregistrement" }, 500);
    }
    return json({ ok: true });
  }

  // ------------------------------------------------------------------
  //  CANDIDATURE (+ CV dans bucket privé)
  // ------------------------------------------------------------------
  if (type === "candidature") {
    const prenom = str(data?.prenom);
    const nom = str(data?.nom);
    const email = str(data?.email).toLowerCase();
    const poste = str(data?.poste);
    const dispo = str(data?.disponibilite);

    if (!prenom || prenom.length > 80) return json({ error: "Prénom invalide" }, 422);
    if (!nom || nom.length > 80) return json({ error: "Nom invalide" }, 422);
    if (!EMAIL_RE.test(email) || email.length > 150) return json({ error: "Email invalide" }, 422);
    if (!poste) return json({ error: "Poste requis" }, 422);
    if (!dispo) return json({ error: "Disponibilité requise" }, 422);

    // --- Validation du CV ---
    const filename = str(cv?.filename);
    const mimetype = str(cv?.mimetype);
    const b64 = str(cv?.base64);
    if (!b64) return json({ error: "CV manquant" }, 422);

    const allowedMime = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const extOk = /\.(pdf|doc|docx)$/i.test(filename);
    if (!allowedMime.includes(mimetype) && !extOk) {
      return json({ error: "Format de CV non autorisé (PDF, DOC, DOCX)" }, 422);
    }

    // Décodage base64 → octets + contrôle de taille réelle (max 5 Mo)
    let bytes: Uint8Array;
    try {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return json({ error: "CV illisible" }, 422);
    }
    if (bytes.length > 5 * 1024 * 1024) {
      return json({ error: "CV trop volumineux (max 5 Mo)" }, 422);
    }
    // Contrôle "magic number" : un vrai PDF commence par %PDF, un DOCX par PK (zip)
    const head = String.fromCharCode(...bytes.slice(0, 4));
    const looksPdf = head.startsWith("%PDF");
    const looksZip = head.startsWith("PK"); // docx/xlsx = archive zip
    const looksDoc = bytes[0] === 0xd0 && bytes[1] === 0xcf; // ancien .doc (OLE)
    if (!looksPdf && !looksZip && !looksDoc) {
      return json({ error: "Le fichier ne correspond pas à un CV valide" }, 422);
    }

    // --- Upload dans le bucket privé "cv" ---
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const ext = (safeName.match(/\.(pdf|docx?|)$/i)?.[1] || "pdf").toLowerCase();
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await db.storage.from("cv").upload(path, bytes, {
      contentType: mimetype || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      console.error("Upload CV:", upErr);
      return json({ error: "Erreur à l'envoi du CV" }, 500);
    }

    // --- Insertion de la candidature (référence au fichier, plus de base64) ---
    const { error } = await db.from("candidatures").insert({
      prenom, nom, email, poste, disponibilite: dispo,
      cv_filename: filename, cv_mimetype: mimetype, cv_path: path,
      date_created: new Date().toISOString(),
    });
    if (error) {
      console.error("Insert candidature:", error);
      // rollback best-effort du fichier orphelin
      await db.storage.from("cv").remove([path]);
      return json({ error: "Erreur enregistrement candidature" }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: "Type de formulaire inconnu" }, 400);
});
