-- 0048: allow stable custom section IDs in existing versioned course tables.
-- No destructive edits, no student route changes.
ALTER TABLE public.pdd_course_drafts DROP CONSTRAINT IF EXISTS pdd_course_drafts_section_id_check;
ALTER TABLE public.pdd_course_drafts ADD CONSTRAINT pdd_course_drafts_section_id_check CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$');
ALTER TABLE public.pdd_course_draft_revisions DROP CONSTRAINT IF EXISTS pdd_course_draft_revisions_section_id_check;
ALTER TABLE public.pdd_course_draft_revisions ADD CONSTRAINT pdd_course_draft_revisions_section_id_check CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$');
ALTER TABLE public.pdd_course_publications DROP CONSTRAINT IF EXISTS pdd_course_publications_section_id_check;
ALTER TABLE public.pdd_course_publications ADD CONSTRAINT pdd_course_publications_section_id_check CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$');
ALTER TABLE public.pdd_course_published_revisions DROP CONSTRAINT IF EXISTS pdd_course_published_revisions_section_id_check;
ALTER TABLE public.pdd_course_published_revisions ADD CONSTRAINT pdd_course_published_revisions_section_id_check CHECK (section_id ~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$');

-- The existing publish/rollback RPCs use a fixed whitelist. Replace only the
-- section validation in a later migration after separately reviewing their full
-- validation semantics. New sections remain drafts until then.
