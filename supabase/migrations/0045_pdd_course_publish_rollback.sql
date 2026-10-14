-- 0045: atomic admin-only publication and rollback for the NEW PDD course.
-- Published pointers are staging data: existing student routes are NOT switched.
CREATE OR REPLACE FUNCTION public.publish_pdd_course_section(p_section_id text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (select auth.uid());
  v_blocks jsonb;
  v_revision bigint;
  v_item jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_section_id !~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$' THEN
    RAISE EXCEPTION 'Invalid course section';
  END IF;

  -- Serialize publication for the same section across concurrent requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_section_id, 424242));
  SELECT blocks INTO v_blocks FROM public.pdd_course_drafts
    WHERE section_id = p_section_id;
  IF v_blocks IS NULL OR jsonb_typeof(v_blocks) <> 'array' OR jsonb_array_length(v_blocks) = 0 THEN
    RAISE EXCEPTION 'Save a non-empty draft before publishing';
  END IF;
  IF jsonb_array_length(v_blocks) > 5000 OR pg_column_size(v_blocks) > 4000000 THEN
    RAISE EXCEPTION 'Draft exceeds publication limits';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_blocks)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR COALESCE(v_item->>'type', '') NOT IN
      ('p','h2','topic','motivation','lead','quote','term','example','quiz','img','link') THEN
      RAISE EXCEPTION 'Unsupported course block';
    END IF;
    IF v_item->>'type' = 'img' AND
       NOT (COALESCE(v_item->>'src','') ~ '^img/[A-Za-z0-9_-]+[.]png$'
            OR COALESCE(v_item->>'src','') ~ '^https://[^[:space:]]+/storage/v1/object/public/pdd-course-media/uploads/[A-Za-z0-9_-]+[.](png|jpg|webp)$') THEN
      RAISE EXCEPTION 'Invalid image path';
    END IF;
    IF v_item->>'type' = 'link' AND
       NOT (COALESCE(v_item->>'url','') ~ '^https://[^[:space:]]+$'
          OR COALESCE(v_item->>'url','') ~ '^/admin/pdd/preview[?]section=(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$') THEN
      RAISE EXCEPTION 'Invalid link';
    END IF;
  END LOOP;

  INSERT INTO public.pdd_course_published_revisions(section_id, blocks, created_by)
    VALUES (p_section_id, v_blocks, v_actor) RETURNING id INTO v_revision;
  INSERT INTO public.pdd_course_publications(section_id, revision_id, published_by, published_at)
    VALUES (p_section_id, v_revision, v_actor, now())
    ON CONFLICT (section_id) DO UPDATE
    SET revision_id = EXCLUDED.revision_id, published_by = EXCLUDED.published_by,
        published_at = EXCLUDED.published_at;
  RETURN v_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_pdd_course_section(p_section_id text, p_revision_id bigint)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (select auth.uid());
  v_blocks jsonb;
  v_revision bigint;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_section_id, 424242));
  SELECT blocks INTO v_blocks FROM public.pdd_course_published_revisions
    WHERE section_id = p_section_id AND id = p_revision_id;
  IF v_blocks IS NULL THEN
    RAISE EXCEPTION 'Published revision does not belong to this section';
  END IF;
  -- Rollback itself creates a new immutable revision; earlier snapshots remain.
  INSERT INTO public.pdd_course_published_revisions(section_id, blocks, created_by)
    VALUES (p_section_id, v_blocks, v_actor) RETURNING id INTO v_revision;
  INSERT INTO public.pdd_course_publications(section_id, revision_id, published_by, published_at)
    VALUES (p_section_id, v_revision, v_actor, now())
    ON CONFLICT (section_id) DO UPDATE
    SET revision_id = EXCLUDED.revision_id, published_by = EXCLUDED.published_by,
        published_at = EXCLUDED.published_at;
  RETURN v_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_pdd_course_section(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_pdd_course_section(text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_pdd_course_section(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_pdd_course_section(text,bigint) TO authenticated;
