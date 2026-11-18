-- Les anciennes RPC de quota sont encore exécutables par anon/authenticated
-- sur la base distante : un utilisateur peut appeler release_analysis() en
-- boucle pour remettre son compteur à zéro. On les réserve au service_role.
-- On ne supprime pas les fonctions pour éviter toute dépendance éventuelle.

DO $$
BEGIN
  IF to_regprocedure('public.consume_analysis()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.consume_analysis() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.release_analysis()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.release_analysis() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public.consume_analysis_for_user(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.consume_analysis_for_user(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consume_analysis_for_user(uuid) TO service_role';
  END IF;

  IF to_regprocedure('public.release_analysis_for_user(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.release_analysis_for_user(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.release_analysis_for_user(uuid) TO service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
