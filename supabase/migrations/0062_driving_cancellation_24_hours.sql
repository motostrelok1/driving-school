-- 0062: Student cancellations are allowed only more than 24 hours before start.
-- Works for direct PostgREST updates and SECURITY DEFINER instructor-change RPCs.
-- Administrators retain authority to handle documented illness exceptions.
CREATE OR REPLACE FUNCTION public.protect_finished_driving_slots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF OLD.status='booked' AND OLD.student_id IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
  IF OLD.start_at + make_interval(mins=>OLD.duration_minutes) <= now() THEN
   RAISE EXCEPTION 'Completed driving sessions can only be changed by an administrator';
  END IF;
  IF OLD.start_at <= now() + interval '24 hours' THEN
   RAISE EXCEPTION 'Cancellations less than 24 hours before start require administrator approval';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
-- The existing trigger from 0057 remains installed and calls this replaced function.

DROP POLICY IF EXISTS "Students can release own future driving slots" ON public.driving_slots;
CREATE POLICY "Students can release own future driving slots"
ON public.driving_slots FOR UPDATE TO authenticated
USING (auth.uid()=student_id AND status='booked' AND start_at>now()+interval '24 hours')
WITH CHECK (student_id IS NULL AND status='open');
