-- 0046: admin-only initial batch publication of missing PDD chapters.
-- Does not modify existing publications or student course routes.
CREATE OR REPLACE FUNCTION public.publish_missing_pdd_course_sections(p_sections jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_section jsonb;
  v_id text;
  v_blocks jsonb;
  v_block jsonb;
  v_question jsonb;
  v_options jsonb;
  v_answer integer;
  v_rev bigint;
  v_added integer := 0;
  v_ids text[] := ARRAY[]::text[];
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_sections) <> 'array' OR jsonb_array_length(p_sections) <> 30 THEN
    RAISE EXCEPTION 'Expected exactly 30 source sections';
  END IF;
  IF pg_column_size(p_sections) > 4000000 THEN
    RAISE EXCEPTION 'Payload too large';
  END IF;
  -- Validate all data before the first write; the entire function is transactional.
  FOR v_section IN SELECT value FROM jsonb_array_elements(p_sections)
  LOOP
    v_id := v_section->>'id';
    v_blocks := v_section->'blocks';
    IF v_id IS NULL OR v_id !~ '^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$'
       OR v_id = ANY(v_ids) THEN
      RAISE EXCEPTION 'Invalid or duplicated section: %', v_id;
    END IF;
    v_ids := array_append(v_ids, v_id);
    IF jsonb_typeof(v_blocks) <> 'array' OR jsonb_array_length(v_blocks) = 0
       OR jsonb_array_length(v_blocks) > 5000 THEN
      RAISE EXCEPTION 'Invalid blocks for %', v_id;
    END IF;
    FOR v_block IN SELECT value FROM jsonb_array_elements(v_blocks)
    LOOP
      IF jsonb_typeof(v_block) <> 'object'
        OR coalesce(v_block->>'type', '') NOT IN
        ('p','h2','topic','motivation','lead','quote','term','example','quiz','img','link') THEN
        RAISE EXCEPTION 'Unsupported block in %', v_id;
      END IF;
      IF v_block->>'type' = 'img' AND
        NOT (coalesce(v_block->>'src','') ~ '^img/[A-Za-z0-9_-]+[.]png$'
          OR coalesce(v_block->>'src','') ~ '^https://[^[:space:]]+/storage/v1/object/public/pdd-course-media/uploads/[A-Za-z0-9_-]+[.](png|jpg|webp)$') THEN
        RAISE EXCEPTION 'Invalid image in %', v_id;
      END IF;
      IF v_block->>'type' = 'link' AND
        NOT (coalesce(v_block->>'url','') ~ '^https://[^[:space:]]+$'
          OR coalesce(v_block->>'url','') ~ '^/admin/pdd/preview[?]section=(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$') THEN
        RAISE EXCEPTION 'Invalid link in %', v_id;
      END IF;
      IF v_block->>'type' = 'quiz' THEN
        IF jsonb_typeof(v_block->'questions') <> 'array'
          OR jsonb_array_length(v_block->'questions') = 0 THEN
          RAISE EXCEPTION 'Empty quiz in %', v_id;
        END IF;
        FOR v_question IN SELECT value FROM jsonb_array_elements(v_block->'questions')
        LOOP
          v_options := v_question->'options';
          IF jsonb_typeof(v_question) <> 'object'
            OR nullif(btrim(v_question->>'q'), '') IS NULL
            OR jsonb_typeof(v_options) <> 'array'
            OR jsonb_array_length(v_options) < 2
            OR jsonb_typeof(v_question->'correct') <> 'number'
            OR (v_question->>'correct') !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid quiz question in %', v_id;
          END IF;
          v_answer := (v_question->>'correct')::integer;
          IF v_answer >= jsonb_array_length(v_options) THEN
            RAISE EXCEPTION 'Invalid quiz answer index in %', v_id;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- Missing only. Lock against per-section publishing RPC before rechecking.
  FOR v_section IN SELECT value FROM jsonb_array_elements(p_sections)
  LOOP
    v_id := v_section->>'id';
    PERFORM pg_advisory_xact_lock(hashtextextended(v_id, 424242));
    IF EXISTS (SELECT 1 FROM public.pdd_course_publications WHERE section_id = v_id) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.pdd_course_published_revisions(section_id, blocks, created_by)
      VALUES (v_id, v_section->'blocks', v_actor) RETURNING id INTO v_rev;
    INSERT INTO public.pdd_course_publications(section_id, revision_id, published_by, published_at)
      VALUES (v_id, v_rev, v_actor, now());
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_missing_pdd_course_sections(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_missing_pdd_course_sections(jsonb) TO authenticated;
