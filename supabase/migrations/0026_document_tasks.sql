-- Document completeness status for admin tasks and user cards.

CREATE OR REPLACE FUNCTION public.get_admin_document_tasks()
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  passport_complete BOOLEAN,
  snils_complete BOOLEAN,
  medical_complete BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS student_id,
    p.full_name,
    (
      NULLIF(btrim(sd.passport_series), '') IS NOT NULL
      AND NULLIF(btrim(sd.passport_number), '') IS NOT NULL
      AND NULLIF(btrim(sd.passport_issued_by), '') IS NOT NULL
      AND sd.passport_issue_date IS NOT NULL
      AND NULLIF(btrim(sd.passport_department_code), '') IS NOT NULL
      AND NULLIF(btrim(sd.passport_birth_place), '') IS NOT NULL
      AND NULLIF(btrim(sd.passport_registration_address), '') IS NOT NULL
    ) AS passport_complete,
    (
      NULLIF(btrim(sd.snils_number), '') IS NOT NULL
      AND NULLIF(btrim(sd.snils_details), '') IS NOT NULL
    ) AS snils_complete,
    (
      NULLIF(btrim(sd.medical_certificate_number), '') IS NOT NULL
      AND sd.medical_certificate_issue_date IS NOT NULL
      AND sd.medical_certificate_valid_until IS NOT NULL
      AND NULLIF(btrim(sd.medical_certificate_issuer), '') IS NOT NULL
      AND NULLIF(btrim(sd.medical_certificate_details), '') IS NOT NULL
    ) AS medical_complete
  FROM public.profiles p
  LEFT JOIN public.student_documents sd ON sd.student_id = p.id
  WHERE public.is_admin(auth.uid())
    AND p.role = 'student'
  ORDER BY p.full_name NULLS LAST, p.id;
$$;

REVOKE ALL ON FUNCTION public.get_admin_document_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_document_tasks() TO authenticated;
