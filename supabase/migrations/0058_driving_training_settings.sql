-- 0058: School-wide driving lesson settings, managed only by administrator.
CREATE TABLE public.driving_training_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 required_academic_hours integer NOT NULL DEFAULT 56 CHECK (required_academic_hours BETWEEN 1 AND 500),
 required_credits integer NOT NULL DEFAULT 18 CHECK (required_credits BETWEEN 1 AND 500),
 duration_options jsonb NOT NULL DEFAULT '[{"minutes":60,"credits":1},{"minutes":90,"credits":2},{"minutes":120,"credits":3}]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.driving_training_settings(id) VALUES (true);
ALTER TABLE public.driving_training_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driving_training_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.driving_training_settings TO authenticated;
CREATE POLICY driving_training_settings_read ON public.driving_training_settings FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_driving_training_settings(
 target_hours integer,target_credits integer,target_options jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE x jsonb; seen integer[] := ARRAY[]::integer[];
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF target_hours NOT BETWEEN 1 AND 500 OR target_credits NOT BETWEEN 1 AND 500
 OR jsonb_typeof(target_options) IS DISTINCT FROM 'array'
 OR jsonb_array_length(target_options) NOT BETWEEN 1 AND 12
 THEN RAISE EXCEPTION 'Invalid training settings'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(target_options) LOOP
  IF jsonb_typeof(x) <> 'object'
    OR (x->>'minutes') !~ '^[0-9]+$' OR (x->>'credits') !~ '^[0-9]+$'
  THEN RAISE EXCEPTION 'Invalid duration option'; END IF;
  IF (x->>'minutes')::integer NOT BETWEEN 15 AND 240
     OR (x->>'minutes')::integer % 15 <> 0
     OR (x->>'credits')::integer NOT BETWEEN 1 AND 20
     OR (x->>'minutes')::integer=ANY(seen)
  THEN RAISE EXCEPTION 'Invalid or duplicate duration'; END IF;
  seen := array_append(seen,(x->>'minutes')::integer);
 END LOOP;
 UPDATE public.driving_training_settings SET
 required_academic_hours=target_hours,required_credits=target_credits,
 duration_options=target_options,updated_at=now() WHERE id=true;
END; $$;
REVOKE ALL ON FUNCTION public.set_driving_training_settings(integer,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_driving_training_settings(integer,integer,jsonb) TO authenticated;

-- Instructors may only create slots of configured durations.
CREATE OR REPLACE FUNCTION public.create_my_driving_slot(target_start_at timestamptz,target_duration_minutes integer,target_comment text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='instructor')
 OR NOT EXISTS (SELECT 1 FROM public.instructor_schedule_permissions WHERE instructor_id=auth.uid() AND can_manage=true)
 THEN RAISE EXCEPTION 'Schedule management not permitted'; END IF;
 IF target_start_at<=now() OR NOT EXISTS (
  SELECT 1 FROM public.driving_training_settings s,
  jsonb_array_elements(s.duration_options) o WHERE s.id=true
  AND (o->>'minutes')::integer=target_duration_minutes
 ) THEN RAISE EXCEPTION 'Invalid start or duration'; END IF;
 INSERT INTO public.driving_slots(instructor_id,start_at,duration_minutes,status,student_id,comment)
 VALUES(auth.uid(),target_start_at,target_duration_minutes,'open',NULL,left(target_comment,500))
 RETURNING id INTO v_id;
 RETURN v_id;
END; $$;

-- Summary retains completed historic bookings; durations map to current configured credits.
-- Caution: changing credit mappings recomputes history; keep this decision visible in admin UI.
CREATE OR REPLACE FUNCTION public.get_my_driving_progress()
RETURNS TABLE(completed_slots bigint,credited_lessons bigint,remaining_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='student')
 THEN RAISE EXCEPTION 'Student only'; END IF;
 RETURN QUERY
 WITH settings AS (SELECT * FROM public.driving_training_settings WHERE id=true),
 totals AS (
 SELECT count(*)::bigint n,
 coalesce(sum(coalesce((
 SELECT (opt->>'credits')::integer FROM settings s,
 jsonb_array_elements(s.duration_options) opt
 WHERE (opt->>'minutes')::integer=slot.duration_minutes
 ),0)),0)::bigint units
 FROM public.driving_slots slot
 WHERE slot.student_id=auth.uid() AND slot.status='booked'
 AND slot.start_at+make_interval(mins=>slot.duration_minutes)<=now()
 )
 SELECT totals.n,totals.units,greatest(0::bigint,(SELECT required_credits FROM settings)::bigint-totals.units)
 FROM totals;
END; $$;
