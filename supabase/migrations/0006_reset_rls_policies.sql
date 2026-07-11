-- Replace every legacy RLS policy. This migration is safe to run after the
-- earlier migrations and removes recursive queries against public.profiles.

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Instructors can read their students profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Instructors can read their students profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_students
      WHERE instructor_id = auth.uid() AND student_id = profiles.id
    )
  );
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "All authenticated can read groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "All authenticated can read groups"
  ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage groups"
  ON public.groups FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Instructors can read their students" ON public.instructor_students;
DROP POLICY IF EXISTS "Students can read their instructors" ON public.instructor_students;
DROP POLICY IF EXISTS "Admins can manage instructor_students" ON public.instructor_students;
CREATE POLICY "Instructors can read their students"
  ON public.instructor_students FOR SELECT USING (auth.uid() = instructor_id);
CREATE POLICY "Students can read their instructors"
  ON public.instructor_students FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins can manage instructor_students"
  ON public.instructor_students FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Students can read own lessons" ON public.lessons;
DROP POLICY IF EXISTS "Instructors can read their lessons" ON public.lessons;
DROP POLICY IF EXISTS "Instructors can update their lessons" ON public.lessons;
DROP POLICY IF EXISTS "Admins can manage lessons" ON public.lessons;
CREATE POLICY "Students can read own lessons"
  ON public.lessons FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Instructors can read their lessons"
  ON public.lessons FOR SELECT USING (auth.uid() = instructor_id);
CREATE POLICY "Instructors can update their lessons"
  ON public.lessons FOR UPDATE
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Admins can manage lessons"
  ON public.lessons FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
