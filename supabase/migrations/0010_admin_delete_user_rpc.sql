CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id_to_delete UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators can delete users';
  END IF;

  IF user_id_to_delete = auth.uid() THEN
    RAISE EXCEPTION 'Administrators cannot delete their own account';
  END IF;

  DELETE FROM auth.users
  WHERE id = user_id_to_delete;

  DELETE FROM public.profiles
  WHERE id = user_id_to_delete;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
