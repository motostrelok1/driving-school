-- 0049: allow publishing custom course chapters using the existing safe RPC.
-- Replace the previous section identifier validation, keep all other checks unchanged.
DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('public.publish_pdd_course_section(text)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%Invalid course section%' THEN
    RAISE EXCEPTION 'Unexpected publish function definition: review manually';
  END IF;
  definition := replace(definition,
    $$'^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti)$'$$,
    $$'^(s([1-9]|1[0-9]|2[0-6])|signs|markup|dopusk|neispravnosti|custom_[0-9a-f]{32})$'$$);
  IF definition NOT LIKE '%custom_[0-9a-f]{32}%' THEN
    RAISE EXCEPTION 'Could not extend publication ID validation';
  END IF;
  EXECUTE definition;
END;
$$;
-- All other permissions and published data remain unchanged.
