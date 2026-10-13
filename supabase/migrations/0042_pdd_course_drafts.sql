-- 0042: private course drafts, separate from published pdd_articles.
CREATE TABLE IF NOT EXISTS public.pdd_course_drafts (
  section_id TEXT PRIMARY KEY CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$'),
  blocks JSONB NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdd_course_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdd_course_drafts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdd_course_drafts TO authenticated;

DROP POLICY IF EXISTS "pdd_course_drafts_admin_select" ON public.pdd_course_drafts;
CREATE POLICY "pdd_course_drafts_admin_select" ON public.pdd_course_drafts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "pdd_course_drafts_admin_insert" ON public.pdd_course_drafts;
CREATE POLICY "pdd_course_drafts_admin_insert" ON public.pdd_course_drafts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND updated_by = auth.uid());
DROP POLICY IF EXISTS "pdd_course_drafts_admin_update" ON public.pdd_course_drafts;
CREATE POLICY "pdd_course_drafts_admin_update" ON public.pdd_course_drafts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()) AND updated_by = auth.uid());
DROP POLICY IF EXISTS "pdd_course_drafts_admin_delete" ON public.pdd_course_drafts;
CREATE POLICY "pdd_course_drafts_admin_delete" ON public.pdd_course_drafts
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_pdd_course_draft()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS touch_pdd_course_drafts ON public.pdd_course_drafts;
CREATE TRIGGER touch_pdd_course_drafts BEFORE UPDATE ON public.pdd_course_drafts
FOR EACH ROW EXECUTE FUNCTION public.touch_pdd_course_draft();
