-- Durcissement : les compteurs d'analyses ne doivent être manipulés que par le
-- serveur (service_role). Un utilisateur authentifié pouvait appeler
-- release_analysis() en boucle pour remettre son quota à zéro.

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

REVOKE EXECUTE ON FUNCTION public.consume_analysis() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_analysis() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_analysis_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_analysis_for_user(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_analysis() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_analysis() TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_analysis_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_analysis_for_user(uuid) TO service_role;

-- has_role n'a pas besoin d'être exposée aux visiteurs anonymes.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Bornes de stockage : empêchent un utilisateur authentifié de remplir la base
-- avec des messages, profils ou aperçus démesurés.
ALTER TABLE public.threads
  ADD CONSTRAINT threads_title_length CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT threads_dataset_name_length
    CHECK (dataset_name IS NULL OR char_length(dataset_name) <= 255) NOT VALID,
  ADD CONSTRAINT threads_dataset_preview_length
    CHECK (dataset_preview IS NULL OR char_length(dataset_preview) <= 200000) NOT VALID,
  ADD CONSTRAINT threads_dataset_profile_length
    CHECK (dataset_profile IS NULL OR char_length(dataset_profile) <= 500000) NOT VALID,
  ADD CONSTRAINT threads_dataset_rows_nonnegative
    CHECK (dataset_rows IS NULL OR dataset_rows >= 0) NOT VALID;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant')) NOT VALID,
  ADD CONSTRAINT messages_parts_size CHECK (octet_length(parts::text) <= 500000) NOT VALID;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_analyses_used_nonnegative
    CHECK (analyses_used >= 0) NOT VALID,
  ADD CONSTRAINT subscriptions_bonus_nonnegative
    CHECK (bonus_analyses >= 0) NOT VALID,
  ADD CONSTRAINT subscriptions_comp_plan_check
    CHECK (comp_plan IS NULL OR comp_plan IN ('pro', 'team')) NOT VALID;

-- app_visits est gérée par Lovable Cloud et peut ne pas exister dans certains
-- environnements. On la verrouille si elle est présente.
DO $$
BEGIN
  IF to_regclass('public.app_visits') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_visits ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.app_visits FROM anon, authenticated';
    IF to_regclass('public.app_visits_id_seq') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON SEQUENCE public.app_visits_id_seq FROM anon, authenticated';
    END IF;
    BEGIN
      EXECUTE 'ALTER TABLE public.app_visits ADD CONSTRAINT app_visits_path_length CHECK (char_length(path) <= 200) NOT VALID';
    EXCEPTION WHEN duplicate_object OR undefined_column OR undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'ALTER TABLE public.app_visits ADD CONSTRAINT app_visits_referrer_length CHECK (referrer IS NULL OR char_length(referrer) <= 300) NOT VALID';
    EXCEPTION WHEN duplicate_object OR undefined_column OR undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'ALTER TABLE public.app_visits ADD CONSTRAINT app_visits_country_format CHECK (country IS NULL OR country ~ ''^[A-Z]{2}$'') NOT VALID';
    EXCEPTION WHEN duplicate_object OR undefined_column OR undefined_table THEN NULL;
    END;
  END IF;
END $$;
