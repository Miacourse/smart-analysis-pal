-- Les écritures sur subscriptions passent désormais exclusivement par des
-- fonctions SECURITY DEFINER (consume_analysis / release_analysis) ou par le
-- service_role (admin). On retire la possibilité pour un utilisateur authentifié
-- d'insérer/modifier lui-même sa ligne (plan, statut, compteur falsifiables).
DROP POLICY IF EXISTS "Users insert own subscription" ON public.subscriptions;
