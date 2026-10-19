-- Compteur d'analyses atomique : évite les contournements de la limite gratuite
-- par des requêtes simultanées (read-modify-write non atomique côté application).
CREATE OR REPLACE FUNCTION public.consume_analysis()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.subscriptions (user_id, analyses_used, updated_at)
  VALUES (auth.uid(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET analyses_used = public.subscriptions.analyses_used + 1,
        updated_at = now()
  RETURNING analyses_used;
$$;

-- Libère une analyse réservée mais non aboutie (erreur, annulation).
CREATE OR REPLACE FUNCTION public.release_analysis()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.subscriptions
  SET analyses_used = GREATEST(analyses_used - 1, 0),
      updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING analyses_used;
$$;

GRANT EXECUTE ON FUNCTION public.consume_analysis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_analysis() TO authenticated;
GRANT ALL ON FUNCTION public.consume_analysis() TO service_role;
GRANT ALL ON FUNCTION public.release_analysis() TO service_role;
