-- Back-office administrateur : plan offert (indépendant de Stripe) et bonus d'analyses.
-- Ces colonnes ne sont écrites que par le service_role via les fonctions admin ;
-- l'utilisateur ne peut pas les modifier (aucune policy UPDATE, policy INSERT retirée en 0004).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS comp_plan TEXT,
  ADD COLUMN IF NOT EXISTS comp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bonus_analyses INTEGER NOT NULL DEFAULT 0;
