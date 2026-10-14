-- 0051: safe read-only access to current published PDD course for signed-in students.
-- Never expose drafts, revision history, or admin catalog writes.
CREATE OR REPLACE FUNCTION public.get_student_pdd_course()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.section_id, 'title', c.title, 'blocks', r.blocks,
      'revision_id', r.id
    ) ORDER BY c.sort_order, c.section_id), '[]'::jsonb)
  END
  FROM public.pdd_course_catalog c
  JOIN public.pdd_course_publications p ON p.section_id = c.section_id
  JOIN public.pdd_course_published_revisions r
    ON r.id = p.revision_id AND r.section_id = c.section_id
  WHERE NOT c.is_archived;
$$;
REVOKE ALL ON FUNCTION public.get_student_pdd_course() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_pdd_course() TO authenticated;
