-- Atomic instructor reassignment and cancellation of future booked lessons.
CREATE OR REPLACE FUNCTION public.reassign_student_instructor(target_student_id UUID, target_instructor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  previous_instructors UUID[];
  cancelled JSONB := '[]'::jsonb;
  replaced BOOLEAN;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = target_student_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_student_id AND role = 'student' AND driving_enabled = TRUE)
    THEN RAISE EXCEPTION 'Ученик не найден или доступ к вождению закрыт'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_instructor_id AND role = 'instructor')
    THEN RAISE EXCEPTION 'Инструктор не найден'; END IF;

  SELECT COALESCE(array_agg(instructor_id), ARRAY[]::UUID[])
  INTO previous_instructors FROM public.instructor_students WHERE student_id = target_student_id;

  IF cardinality(previous_instructors) = 1 AND previous_instructors[1] = target_instructor_id THEN
    RETURN jsonb_build_object('changed', false, 'replaced', false, 'cancelled_slots', cancelled);
  END IF;
  replaced := cardinality(previous_instructors) > 0;

  IF replaced THEN
    WITH released AS (
      UPDATE public.driving_slots SET student_id = NULL, status = 'open'
      WHERE student_id = target_student_id AND status = 'booked' AND start_at >= now()
      RETURNING id, start_at
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'start_at', start_at)), '[]'::jsonb)
    INTO cancelled FROM released;
  END IF;

  DELETE FROM public.instructor_students WHERE student_id = target_student_id;
  INSERT INTO public.instructor_students (instructor_id, student_id) VALUES (target_instructor_id, target_student_id);
  RETURN jsonb_build_object('changed', true, 'replaced', replaced, 'cancelled_slots', cancelled);
END;
$$;
REVOKE ALL ON FUNCTION public.reassign_student_instructor(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reassign_student_instructor(UUID, UUID) TO authenticated;
