CREATE OR REPLACE FUNCTION public.consume_analysis_for_user(_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.subscriptions (user_id, analyses_used, updated_at)
  VALUES (_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET analyses_used = public.subscriptions.analyses_used + 1,
        updated_at = now()
  RETURNING analyses_used;
$$;

CREATE OR REPLACE FUNCTION public.release_analysis_for_user(_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.subscriptions
  SET analyses_used = GREATEST(analyses_used - 1, 0),
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING analyses_used;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_analysis_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_analysis_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_analysis_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_analysis_for_user(uuid) TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO service_role;