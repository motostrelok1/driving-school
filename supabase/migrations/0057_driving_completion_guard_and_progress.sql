-- 0057: Completed driving sessions are derived from booked slots after their end time.
-- Only an administrator may edit/delete a completed booking.
-- NOTE: This does not rewrite the historical slot status to "completed":
--       status='booked' remains the source of truth for the booked session.
CREATE OR REPLACE FUNCTION public.protect_finished_driving_slots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF OLD.status='booked'
    AND OLD.student_id IS NOT NULL
    AND OLD.start_at + make_interval(mins => OLD.duration_minutes) <= now()
    AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Completed driving sessions can only be changed by an administrator';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_finished_driving_slots() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_protect_finished_driving_slots ON public.driving_slots;
CREATE TRIGGER trg_protect_finished_driving_slots
BEFORE UPDATE OR DELETE ON public.driving_slots
FOR EACH ROW EXECUTE FUNCTION public.protect_finished_driving_slots();

-- Remove the old permissive "any time on the same Moscow calendar day" release policy.
DROP POLICY IF EXISTS "Students can release own future driving slots" ON public.driving_slots;
CREATE POLICY "Students can release own future driving slots"
ON public.driving_slots FOR UPDATE TO authenticated
USING (auth.uid()=student_id AND status='booked' AND start_at>now())
WITH CHECK (student_id IS NULL AND status='open');

-- The student's summary includes completed bookings regardless of past/current instructor.
-- Future/cancelled slots are excluded. 60/90/120 mins -> 1/2/3 credited sessions.
CREATE OR REPLACE FUNCTION public.get_my_driving_progress()
RETURNS TABLE(completed_slots bigint,credited_lessons bigint,remaining_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='student'
 ) THEN RAISE EXCEPTION 'Student only'; END IF;
 RETURN QUERY
 WITH totals AS (
   SELECT count(*)::bigint AS slot_count,
          coalesce(sum(CASE duration_minutes WHEN 60 THEN 1 WHEN 90 THEN 2 WHEN 120 THEN 3 ELSE 0 END),0)::bigint AS units
   FROM public.driving_slots
   WHERE student_id=auth.uid() AND status='booked'
     AND start_at+make_interval(mins=>duration_minutes)<=now()
 )
 SELECT slot_count, units, greatest(0::bigint,18::bigint-units) FROM totals;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_driving_progress() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_driving_progress() TO authenticated;
