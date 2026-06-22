-- =====================================================================
--  NAAXOS — Durcissement sécurité Supabase
--  À coller dans : Supabase Dashboard → SQL Editor → Run
--
--  Ce script :
--   1. Active le RLS sur les 3 tables (refuse tout par défaut)
--   2. Supprime les policies trop permissives
--   3. Recrée des policies minimales : anon peut seulement INSÉRER
--      (formulaires) et LIRE les articles publiés
--   4. Ajoute des contraintes de format/taille qui s'appliquent même
--      si quelqu'un tape l'API REST directement
--   5. Empêche le flood du même email (index unique)
--
--  Exécute-le en une fois. Idempotent (réexécutable sans casse).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Voir l'existant (optionnel — décommente pour inspecter avant)
-- ---------------------------------------------------------------------
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies WHERE schemaname = 'public';


-- ---------------------------------------------------------------------
-- 1. Activer RLS partout
-- ---------------------------------------------------------------------
ALTER TABLE public.newsletter   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles     ENABLE ROW LEVEL SECURITY;

-- Forcer le RLS même pour le propriétaire de la table (ceinture + bretelles)
ALTER TABLE public.newsletter   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.articles     FORCE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- 2. Supprimer TOUTES les policies existantes sur ces 3 tables
--    (on repart d'une base propre — bloc dynamique)
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
-- 3. Policies minimales pour le rôle anonyme (clé publishable du site)
-- ---------------------------------------------------------------------

-- NEWSLETTER : anon peut seulement INSÉRER. Pas de lecture/màj/suppression.
CREATE POLICY "anon_insert_newsletter"
  ON public.newsletter
  FOR INSERT TO anon
  WITH CHECK (true);

-- CANDIDATURES : anon peut seulement INSÉRER. Les CV ne sont JAMAIS lisibles publiquement.
CREATE POLICY "anon_insert_candidatures"
  ON public.candidatures
  FOR INSERT TO anon
  WITH CHECK (true);

-- ARTICLES : anon peut seulement LIRE les articles publiés. Écriture interdite.
-- (adapte la valeur 'publié' si ta colonne statut utilise un autre libellé)
CREATE POLICY "anon_read_published_articles"
  ON public.articles
  FOR SELECT TO anon
  USING (statut = 'publié');

-- NB : pour LIRE tes propres abonnés / candidatures / CV, passe par le
-- Dashboard Supabase (rôle service_role, hors navigateur) ou une page
-- admin protégée par Supabase Auth avec des policies "TO authenticated".


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

-- CANDIDATURES (y compris taille du CV en base64 : ~5 Mo réels ≈ 7 000 000 caractères)
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
-- 5. Anti-flood : un même email ne peut s'inscrire qu'une fois
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_newsletter_email
  ON public.newsletter (lower(email));


-- =====================================================================
--  VÉRIFICATION POST-EXÉCUTION
--  Après avoir lancé ce script, ces requêtes (depuis la console F12 du
--  site, avec la clé anon) doivent TOUTES échouer ou renvoyer vide :
--
--   - lire les abonnés      → [] ou 401   (avant : renvoyait les emails)
--   - modifier un article   → 401/403     (avant : 200 + modif acceptée)
--   - lire les candidatures → [] ou 401
--
--  Je peux relancer ces tests pour toi une fois le script exécuté.
-- =====================================================================
