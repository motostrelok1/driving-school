-- Student identity and medical document details for admin use.

CREATE TABLE IF NOT EXISTS public.student_documents (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  passport_series TEXT,
  passport_number TEXT,
  passport_issued_by TEXT,
  passport_issue_date DATE,
  passport_department_code TEXT,
  passport_birth_place TEXT,
  passport_registration_address TEXT,
  snils_number TEXT,
  snils_details TEXT,
  medical_certificate_number TEXT,
  medical_certificate_issue_date DATE,
  medical_certificate_valid_until DATE,
  medical_certificate_issuer TEXT,
  medical_certificate_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_student_documents_updated_at ON public.student_documents;
CREATE TRIGGER set_student_documents_updated_at
  BEFORE UPDATE ON public.student_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read student documents" ON public.student_documents;
CREATE POLICY "Admins can read student documents"
  ON public.student_documents FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage student documents" ON public.student_documents;
CREATE POLICY "Admins can manage student documents"
  ON public.student_documents FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
