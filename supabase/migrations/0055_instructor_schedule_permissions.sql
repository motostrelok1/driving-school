-- 0055. Instructor schedule delegation: OFF by default.
-- Scope: creating and deleting OWN open, unbooked slots only.
CREATE TABLE IF NOT EXISTS public.instructor_schedule_permissions (
 instructor_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 can_manage boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instructor_schedule_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_schedule_permissions FROM anon, authenticated;
GRANT SELECT ON public.instructor_schedule_permissions TO authenticated;
DROP POLICY IF EXISTS instructor_schedule_permissions_read ON public.instructor_schedule_permissions;
CREATE POLICY instructor_schedule_permissions_read ON public.instructor_schedule_permissions
 FOR SELECT TO authenticated USING (instructor_id=auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_instructor_schedule_permission(target_instructor_id uuid, allow_manage boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only administrator can change permissions'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=target_instructor_id AND role='instructor')
 THEN RAISE EXCEPTION 'Instructor not found'; END IF;
 INSERT INTO public.instructor_schedule_permissions(instructor_id,can_manage,updated_at)
 VALUES(target_instructor_id,allow_manage,now())
 ON CONFLICT(instructor_id) DO UPDATE SET can_manage=EXCLUDED.can_manage,updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.set_instructor_schedule_permission(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_instructor_schedule_permission(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_my_driving_slot(target_start_at timestamptz,target_duration_minutes integer,target_comment text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='instructor')
 OR NOT EXISTS (SELECT 1 FROM public.instructor_schedule_permissions WHERE instructor_id=auth.uid() AND can_manage=true)
 THEN RAISE EXCEPTION 'Schedule management not permitted'; END IF;
 IF target_start_at <= now() OR target_duration_minutes NOT IN (60,90,120)
 THEN RAISE EXCEPTION 'Invalid start or duration'; END IF;
 INSERT INTO public.driving_slots(instructor_id,start_at,duration_minutes,status,student_id,comment)
 VALUES(auth.uid(),target_start_at,target_duration_minutes,'open',NULL,left(target_comment,500))
 RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_my_driving_slot(timestamptz,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_my_driving_slot(timestamptz,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_driving_slot(target_slot_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_deleted uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='instructor')
 OR NOT EXISTS (SELECT 1 FROM public.instructor_schedule_permissions WHERE instructor_id=auth.uid() AND can_manage=true)
 THEN RAISE EXCEPTION 'Schedule management not permitted'; END IF;
 DELETE FROM public.driving_slots
 WHERE id=target_slot_id AND instructor_id=auth.uid() AND student_id IS NULL
  AND status='open' AND start_at>now()
 RETURNING id INTO v_deleted;
 RETURN v_deleted IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.delete_my_driving_slot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_my_driving_slot(uuid) TO authenticated;
