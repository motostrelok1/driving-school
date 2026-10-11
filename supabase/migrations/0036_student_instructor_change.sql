-- Student instructor change: atomic cancellation and unassignment.
CREATE OR REPLACE FUNCTION public.student_begin_instructor_change()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE cancelled JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
  WITH released AS (
    UPDATE public.driving_slots SET student_id = NULL, status = 'open'
    WHERE student_id = auth.uid() AND status = 'booked' AND start_at >= now()
    RETURNING id, start_at
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'start_at', start_at)), '[]'::jsonb)
  INTO cancelled FROM released;
  DELETE FROM public.instructor_students WHERE student_id = auth.uid();
  RETURN jsonb_build_object('cancelled_slots', cancelled);
END;
$$;
REVOKE ALL ON FUNCTION public.student_begin_instructor_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_begin_instructor_change() TO authenticated;

CREATE OR REPLACE FUNCTION public.student_choose_instructor(target_instructor_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND driving_enabled = TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Driving access is not enabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_instructor_id AND role = 'instructor') THEN
    RAISE EXCEPTION 'Instructor not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.driving_slots WHERE student_id = auth.uid() AND status = 'booked' AND start_at >= now())
  THEN RAISE EXCEPTION 'Cancel future bookings before changing instructor'; END IF;
  DELETE FROM public.instructor_students WHERE student_id = auth.uid();
  INSERT INTO public.instructor_students(instructor_id,student_id) VALUES(target_instructor_id,auth.uid());
  RETURN jsonb_build_object('instructor_id', target_instructor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.student_choose_instructor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_choose_instructor(UUID) TO authenticated;
