-- =====================================================================
--  NAAXOS — Sécurité v2 : passage par l'Edge Function
--  À exécuter APRÈS naaxos-securite.sql et APRÈS avoir déployé la
--  fonction "submit-form".
--
--  Désormais, les écritures passent par l'Edge Function (clé service_role,
--  côté serveur). Le navigateur n'a donc plus besoin d'insérer directement
--  → on RETIRE le droit d'insertion à l'anonyme. Il ne lui reste que la
--  lecture des articles publiés.
--
--  À coller dans : Supabase Dashboard → SQL Editor → Run
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Bucket privé pour les CV
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv', 'cv', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Aucune policy "anon" sur storage.objects pour ce bucket :
-- → personne ne peut lire ni écrire les CV avec la clé publique.
-- L'Edge Function (service_role) contourne le RLS et reste le seul accès.
-- Par sécurité, on supprime d'éventuelles policies trop ouvertes sur le bucket cv :
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


-- ---------------------------------------------------------------------
-- 2. Colonne cv_path (référence au fichier dans le bucket)
--    Remplace l'usage de cv_base64 (qu'on garde nullable le temps de la
--    transition, mais qui ne sera plus alimentée).
-- ---------------------------------------------------------------------
ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS cv_path text;

-- Rendre cv_base64 facultative (l'Edge Function ne la remplit plus)
ALTER TABLE public.candidatures
  ALTER COLUMN cv_base64 DROP NOT NULL;


-- ---------------------------------------------------------------------
-- 3. Retirer le droit d'INSERT à l'anonyme (tout passe par l'Edge Function)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_newsletter"   ON public.newsletter;
DROP POLICY IF EXISTS "anon_insert_candidatures" ON public.candidatures;

-- On conserve uniquement la lecture publique des articles publiés :
-- (policy "anon_read_published_articles" créée dans naaxos-securite.sql — inchangée)


-- =====================================================================
--  VÉRIFICATION POST-EXÉCUTION (console F12 du site, clé anon)
--   - INSERT direct newsletter  → doit échouer (401/403)
--   - INSERT direct candidatures → doit échouer (401/403)
--   - lecture articles publiés   → doit fonctionner
--   - le formulaire du site (via Edge Function) → doit fonctionner
--
--  Je peux relancer ces tests pour toi.
-- =====================================================================
