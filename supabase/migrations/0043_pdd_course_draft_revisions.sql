-- 0043: immutable snapshot history of PDD draft changes.
CREATE TABLE IF NOT EXISTS public.pdd_course_draft_revisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id TEXT NOT NULL CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$'),
  blocks JSONB NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  saved_by UUID REFERENCES auth.users(id),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_kind TEXT NOT NULL CHECK (change_kind IN ('save', 'delete'))
);

CREATE INDEX IF NOT EXISTS pdd_course_draft_revisions_section_date
  ON public.pdd_course_draft_revisions(section_id, saved_at DESC, id DESC);
ALTER TABLE public.pdd_course_draft_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdd_course_draft_revisions FROM anon, authenticated;
GRANT SELECT ON public.pdd_course_draft_revisions TO authenticated;

DROP POLICY IF EXISTS "pdd_draft_revision_admin_read" ON public.pdd_course_draft_revisions;
CREATE POLICY "pdd_draft_revision_admin_read" ON public.pdd_course_draft_revisions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_pdd_course_draft_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.pdd_course_draft_revisions(section_id, blocks, saved_by, change_kind)
      VALUES (OLD.section_id, OLD.blocks, OLD.updated_by, 'delete');
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.blocks IS NOT DISTINCT FROM NEW.blocks THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pdd_course_draft_revisions(section_id, blocks, saved_by, change_kind)
    VALUES (NEW.section_id, NEW.blocks, NEW.updated_by, 'save');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_pdd_course_draft_revision ON public.pdd_course_drafts;
CREATE TRIGGER record_pdd_course_draft_revision
  AFTER INSERT OR UPDATE OR DELETE ON public.pdd_course_drafts
  FOR EACH ROW EXECUTE FUNCTION public.record_pdd_course_draft_revision();

-- Snapshot all drafts that already exist at the time migration is applied.
INSERT INTO public.pdd_course_draft_revisions(section_id, blocks, saved_by, change_kind)
SELECT section_id, blocks, updated_by, 'save' FROM public.pdd_course_drafts;
