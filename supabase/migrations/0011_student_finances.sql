CREATE TABLE IF NOT EXISTS public.student_finances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_due_date DATE,
  installment_due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS set_student_finances_updated_at ON public.student_finances;
CREATE TRIGGER set_student_finances_updated_at
  BEFORE UPDATE ON public.student_finances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.student_finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read own finances" ON public.student_finances;
DROP POLICY IF EXISTS "Admins can manage student finances" ON public.student_finances;

CREATE POLICY "Students can read own finances"
  ON public.student_finances FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage student finances"
  ON public.student_finances FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
