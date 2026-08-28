-- Allow students to browse and choose registered instructors.
DROP POLICY IF EXISTS "Authenticated users can read instructor profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read instructor profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (role = 'instructor');

DROP POLICY IF EXISTS "Students can choose own instructor" ON public.instructor_students;
CREATE POLICY "Students can choose own instructor"
  ON public.instructor_students FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can change own instructor" ON public.instructor_students;
CREATE POLICY "Students can change own instructor"
  ON public.instructor_students FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);
