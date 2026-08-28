DROP POLICY IF EXISTS "Students can read their instructors profiles" ON public.profiles;

CREATE POLICY "Students can read their instructors profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_students
      WHERE student_id = auth.uid() AND instructor_id = profiles.id
    )
  );
