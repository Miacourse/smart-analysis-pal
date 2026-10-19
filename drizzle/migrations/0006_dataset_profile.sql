-- Analyse du fichier complet : profil statistique calculé côté client sur
-- l'intégralité du fichier, stocké par conversation, et nombre de lignes.
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS dataset_profile TEXT,
  ADD COLUMN IF NOT EXISTS dataset_rows INTEGER;
