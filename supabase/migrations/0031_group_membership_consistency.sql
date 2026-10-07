-- Delete a study group and release all assigned users.

CREATE OR REPLACE FUNCTION public.delete_group_and_unassign(target_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.profiles
  SET group_id = NULL
  WHERE group_id = target_group_id;

  DELETE FROM public.groups
  WHERE id = target_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Группа не найдена';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_group_and_unassign(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_group_and_unassign(UUID) TO authenticated;
