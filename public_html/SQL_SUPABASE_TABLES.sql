-- ========================================================
-- NAAXOS - Tables Supabase (SQL prêt à exécuter)
-- ========================================================
--
-- Exécuter ce SQL dans Supabase:
-- 1. Aller à: supabase.com → Votre projet → SQL Editor
-- 2. Créer nouvelle requête
-- 3. Copier-coller ce contenu
-- 4. Exécuter les requêtes
--
-- ========================================================

-- ========================================================
-- TABLE 1: NEWSLETTER (OBLIGATOIRE)
-- ========================================================
CREATE TABLE IF NOT EXISTS newsletter (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  secteur TEXT NOT NULL,
  situation TEXT NOT NULL,
  date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer Row Level Security
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;

-- Politique: Permettre les insertions (anonyme)
CREATE POLICY "Allow anonymous inserts" ON newsletter
  FOR INSERT WITH CHECK (true);

-- Politique: Permettre la lecture (optionnel, pour admin)
CREATE POLICY "Allow reads for authenticated users" ON newsletter
  FOR SELECT USING (auth.role() = 'authenticated');

-- Index sur email pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);

-- ========================================================
-- TABLE 2: CANDIDATURES (OBLIGATOIRE)
-- ========================================================
CREATE TABLE IF NOT EXISTS candidatures (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  poste TEXT NOT NULL,
  disponibilite TEXT NOT NULL,
  cv_base64 TEXT NOT NULL,
  cv_filename TEXT NOT NULL,
  cv_mimetype TEXT NOT NULL,
  date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer Row Level Security
ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;

-- Politique: Permettre les insertions (anonyme)
CREATE POLICY "Allow anonymous inserts" ON candidatures
  FOR INSERT WITH CHECK (true);

-- Politique: Permettre la lecture (optionnel, pour admin)
CREATE POLICY "Allow reads for authenticated users" ON candidatures
  FOR SELECT USING (auth.role() = 'authenticated');

-- Index sur email pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_candidatures_email ON candidatures(email);

-- ========================================================
-- TABLE 3: ARTICLES (OPTIONNEL - pour blog dynamique)
-- ========================================================
CREATE TABLE IF NOT EXISTS articles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug TEXT NOT NULL UNIQUE,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  auteur TEXT,
  date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Politique: Permettre la lecture à tout le monde
CREATE POLICY "Allow public reads" ON articles
  FOR SELECT USING (true);

-- Politique: Permettre l'écriture aux utilisateurs authentifiés (pour admin)
CREATE POLICY "Allow authenticated writes" ON articles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Index sur slug pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date_created DESC);

-- ========================================================
-- BONUS: TABLE CONTACTS (optionnel pour formulaire contact)
-- ========================================================
-- Décommenter si vous avez un formulaire contact
--
-- CREATE TABLE IF NOT EXISTS contacts (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   nom TEXT NOT NULL,
--   email TEXT NOT NULL,
--   telephone TEXT,
--   message TEXT NOT NULL,
--   lu BOOLEAN DEFAULT FALSE,
--   date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
--
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow inserts" ON contacts FOR INSERT WITH CHECK (true);

-- ========================================================
-- VÉRIFICATION FINALE
-- ========================================================

-- Voir les tables créées:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- Voir les colonnes d'une table:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'newsletter'
-- ORDER BY ordinal_position;

-- ========================================================
-- NOTES IMPORTANTES
-- ========================================================
--
-- 1. RLS (Row Level Security) est ACTIVÉ
--    - Les politiques permettent les insertions anonymes
--    - Les lectures nécessitent authentification (admin)
--
-- 2. Les colonnes created_at/updated_at sont optionnelles
--    - Vous pouvez les supprimer si vous utilisez date_created
--
-- 3. Les UNIQUEs sur email:
--    - newsletter: empêche les doublons
--    - candidatures: permet les doublons (même personne, plusieurs fois)
--
-- 4. Index créés pour performance:
--    - Recherche rapide par email
--    - Articles triés par date
--
-- 5. Si vous n'utilisez pas la table articles:
--    - Supprimer le CREATE TABLE articles
--    - Les articles locaux seront utilisés automatiquement
--
-- ========================================================
-- CONFIGURATION SÉCURITÉ (IMPORTANT)
-- ========================================================
--
-- Dans Supabase, Configuration → Authentification → Providers:
--
-- 1. Email/Password: DÉSACTIVER (optionnel)
-- 2. Anonymous: ACTIVER (pour les formulaires)
-- 3. JWT Secret: À conserver confidentiel
--
-- ========================================================
--
-- Une fois exécuté avec succès:
-- ✅ Copier config.example.js → config.js
-- ✅ Remplir SUPABASE_URL et SUPABASE_ANON_KEY
-- ✅ Tester les formulaires
-- ✅ Vérifier les données dans Supabase
--
-- ========================================================
