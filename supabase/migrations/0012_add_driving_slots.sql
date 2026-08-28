CREATE TABLE IF NOT EXISTS public.driving_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked', 'cancelled')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instructor_id, start_at)
);

DROP TRIGGER IF EXISTS set_driving_slots_updated_at ON public.driving_slots;
CREATE TRIGGER set_driving_slots_updated_at
  BEFORE UPDATE ON public.driving_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.driving_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read driving slots" ON public.driving_slots;
CREATE POLICY "Authenticated users can read driving slots"
  ON public.driving_slots FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage driving slots" ON public.driving_slots;
CREATE POLICY "Admins can manage driving slots"
  ON public.driving_slots FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Students can book open driving slots" ON public.driving_slots;
CREATE POLICY "Students can book open driving slots"
  ON public.driving_slots FOR UPDATE
  TO authenticated
  USING (status = 'open' AND student_id IS NULL)
  WITH CHECK (auth.uid() = student_id AND status = 'booked');
