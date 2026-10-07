-- Safe deletion of empty study groups.

CREATE OR REPLACE FUNCTION public.delete_empty_group(target_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE group_id = target_group_id
  ) THEN
    RAISE EXCEPTION 'Сначала уберите всех пользователей из группы';
  END IF;

  DELETE FROM public.groups
  WHERE id = target_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Группа не найдена';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_empty_group(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_empty_group(UUID) TO authenticated;
