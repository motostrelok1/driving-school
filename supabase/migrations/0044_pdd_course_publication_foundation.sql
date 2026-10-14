-- 0044: prepare versioned PDD publication storage. No student routes are switched.
CREATE TABLE IF NOT EXISTS public.pdd_course_publications (
  section_id TEXT PRIMARY KEY
    CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$'),
  revision_id BIGINT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.pdd_course_published_revisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id TEXT NOT NULL
    CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$'),
  blocks JSONB NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  source_draft_revision_id BIGINT REFERENCES public.pdd_course_draft_revisions(id)
);
CREATE INDEX IF NOT EXISTS pdd_course_published_revisions_section_idx
  ON public.pdd_course_published_revisions(section_id, id DESC);

ALTER TABLE public.pdd_course_publications
  DROP CONSTRAINT IF EXISTS pdd_course_publications_revision_id_fkey;
ALTER TABLE public.pdd_course_publications
  ADD CONSTRAINT pdd_course_publications_revision_id_fkey
  FOREIGN KEY (revision_id) REFERENCES public.pdd_course_published_revisions(id);

ALTER TABLE public.pdd_course_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdd_course_published_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdd_course_publications FROM anon, authenticated;
REVOKE ALL ON public.pdd_course_published_revisions FROM anon, authenticated;
GRANT SELECT ON public.pdd_course_publications TO authenticated;
GRANT SELECT ON public.pdd_course_published_revisions TO authenticated;

DROP POLICY IF EXISTS "pdd_publications_admin_select" ON public.pdd_course_publications;
CREATE POLICY "pdd_publications_admin_select" ON public.pdd_course_publications
 FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "pdd_publication_versions_admin_select" ON public.pdd_course_published_revisions;
CREATE POLICY "pdd_publication_versions_admin_select" ON public.pdd_course_published_revisions
 FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Never allow client-side modifications of published snapshots or pointers.
-- A subsequent reviewed migration will introduce an admin-only atomic publish
-- function with validation, history and rollback.
COMMENT ON TABLE public.pdd_course_publications IS
  'Staging only: not consumed by student routes until rollout is explicitly approved.';
