-- 0052: per-user read status for published PDD sections, separate from exams.
CREATE TABLE IF NOT EXISTS public.pdd_section_read_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id text NOT NULL REFERENCES public.pdd_course_catalog(section_id),
  first_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id)
);
ALTER TABLE public.pdd_section_read_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdd_section_read_progress FROM anon;
GRANT SELECT, INSERT ON public.pdd_section_read_progress TO authenticated;
DROP POLICY IF EXISTS pdd_read_own_select ON public.pdd_section_read_progress;
CREATE POLICY pdd_read_own_select ON public.pdd_section_read_progress
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS pdd_read_own_insert ON public.pdd_section_read_progress;
CREATE POLICY pdd_read_own_insert ON public.pdd_section_read_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
-- No client UPDATE/DELETE privileges: completed sections cannot be overwritten
-- or accidentally reset by another user.
