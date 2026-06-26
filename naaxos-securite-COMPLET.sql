-- =====================================================================
--  NAAXOS — Durcissement sécurité Supabase (script UNIQUE, complet)
--  ---------------------------------------------------------------------
--  Remplace l'exécution successive de naaxos-securite.sql + v2.
--  À coller dans : Supabase Dashboard → SQL Editor → Run.
--  Idempotent : réexécutable sans casse.
--
--  OBJECTIF (défense en profondeur — protection "en amont") :
--   • Le navigateur (clé anon/publishable) NE PEUT PLUS écrire dans les
--     tables. Toute écriture passe par l'Edge Function "submit-form"
--     (clé service_role, côté serveur).
--   • Même si quelqu'un attaque l'API REST directement avec la clé anon,
--     le RLS refuse l'INSERT et des contraintes CHECK valident les données.
--   • Les CV sont dans un bucket PRIVÉ, jamais lisibles publiquement.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Activer + forcer le RLS (refuse tout par défaut)
-- ---------------------------------------------------------------------
ALTER TABLE public.newsletter   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles     ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.newsletter   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.articles     FORCE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- 2. Repartir d'une base propre : supprimer toutes les policies existantes
--    (y compris les anciennes "Allow anonymous inserts")
-- ---------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('newsletter','candidatures','articles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 3. Policies minimales pour le rôle anonyme (clé publique du site)
--    → AUCUN droit d'écriture. L'écriture se fait via l'Edge Function.
-- ---------------------------------------------------------------------

-- NEWSLETTER   : aucune policy anon → INSERT/SELECT/UPDATE/DELETE refusés.
-- CANDIDATURES : aucune policy anon → idem (CV jamais lisibles publiquement).
-- (On ne crée volontairement aucune policy "anon" sur ces deux tables.)

-- ARTICLES : le blog est public en lecture. On ajoute une colonne "statut"
-- pour ne publier que les articles validés, puis on autorise la lecture anon.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'publié';

CREATE POLICY "anon_read_published_articles"
  ON public.articles
  FOR SELECT TO anon
  USING (statut = 'publié');

-- Écriture des articles : réservée au service_role (Edge Function / Dashboard).
-- Le rôle service_role contourne le RLS, donc aucune policy n'est nécessaire.


-- ---------------------------------------------------------------------
-- 4. Contraintes de validation (s'appliquent même via l'API REST directe)
-- ---------------------------------------------------------------------

-- NEWSLETTER
ALTER TABLE public.newsletter
  DROP CONSTRAINT IF EXISTS nl_email_format,
  DROP CONSTRAINT IF EXISTS nl_prenom_len,
  DROP CONSTRAINT IF EXISTS nl_situation_len;
ALTER TABLE public.newsletter
  ADD CONSTRAINT nl_email_format   CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT nl_prenom_len     CHECK (char_length(prenom) BETWEEN 1 AND 80),
  ADD CONSTRAINT nl_situation_len  CHECK (char_length(coalesce(situation,'')) <= 2000);

-- CANDIDATURES (taille du CV en base64 : ~5 Mo réels ≈ 7 000 000 caractères)
ALTER TABLE public.candidatures
  DROP CONSTRAINT IF EXISTS cand_email_format,
  DROP CONSTRAINT IF EXISTS cand_nom_len,
  DROP CONSTRAINT IF EXISTS cand_prenom_len,
  DROP CONSTRAINT IF EXISTS cand_cv_size;
ALTER TABLE public.candidatures
  ADD CONSTRAINT cand_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT cand_nom_len      CHECK (char_length(nom) BETWEEN 1 AND 80),
  ADD CONSTRAINT cand_prenom_len   CHECK (char_length(prenom) BETWEEN 1 AND 80),
  ADD CONSTRAINT cand_cv_size      CHECK (char_length(coalesce(cv_base64,'')) < 7000000);


-- ---------------------------------------------------------------------
-- 5. Anti-doublon : un même email ne peut s'inscrire qu'une fois
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_newsletter_email
  ON public.newsletter (lower(email));


-- ---------------------------------------------------------------------
-- 6. CV : bucket privé + colonne cv_path
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv', 'cv', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Supprimer d'éventuelles policies trop ouvertes sur le bucket cv
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND qual ILIKE '%cv%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Référence au fichier dans le bucket (remplace cv_base64, rendu facultatif)
ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS cv_path text;
ALTER TABLE public.candidatures
  ALTER COLUMN cv_base64 DROP NOT NULL;


-- =====================================================================
--  VÉRIFICATION POST-EXÉCUTION
--  Depuis la console F12 du site (clé anon), ceci doit TOUT échouer :
--   - INSERT direct newsletter   → 401/403
--   - INSERT direct candidatures  → 401/403
--   - lire les abonnés / CV       → [] ou 401
--   - modifier un article         → 401/403
--  Et doivent fonctionner :
--   - lecture des articles publiés
--   - le formulaire du site (via l'Edge Function submit-form)
-- =====================================================================
