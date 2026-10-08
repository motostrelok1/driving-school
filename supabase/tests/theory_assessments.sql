-- Выполнять после 0034 только в тестовой БД с ролями Supabase.
-- Все данные откатываются. Тесты проверяют RPC, ограничения и реальные RLS/grants.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(value BOOLEAN, message TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$ BEGIN
  IF value IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF;
END $$;

CREATE FUNCTION pg_temp.expect_error(statement TEXT, expected_code TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE actual_code TEXT;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_code = RETURNED_SQLSTATE;
  END;
  IF actual_code IS DISTINCT FROM expected_code THEN
    RAISE EXCEPTION 'Expected SQLSTATE %, got % for %', expected_code, actual_code, statement;
  END IF;
END $$;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000033'),
  ('00000000-0000-0000-0000-000000000044');
INSERT INTO public.profiles (id, role) VALUES
  ('00000000-0000-0000-0000-000000000011', 'admin'),
  ('00000000-0000-0000-0000-000000000022', 'student'),
  ('00000000-0000-0000-0000-000000000033', 'student'),
  ('00000000-0000-0000-0000-000000000044', 'instructor')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1','2'], 10, 15, 1, now(), now() + interval '1 day');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1','2'], 10, 15, 1, now(), now() + interval '1 day');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.theory_assessments), 'idempotent assignment');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1','2'], 11, 15, 1, now(), now() + interval '1 day')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000044', 'credit', ARRAY['1'], 10, 15, 1, now(), now() + interval '1 day')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1','1'], 10, 15, 1, now(), now() + interval '1 day')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['99'], 10, 15, 1, now(), now() + interval '1 day')$q$, '23514');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY[]::text[], 10, 15, 1, now(), now() + interval '1 day')$q$, '23514');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 10, 15, 10, now(), now() + interval '1 day')$q$, '23514');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 10, 15, 1, now(), now())$q$, '23514');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 10, 15, 1, now() - interval '2 days', now() - interval '1 day')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'internal_exam', ARRAY[]::text[], 19, 20, 2, now(), now() + interval '1 day')$q$, '23514');

SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000033', 'credit', ARRAY['1'], 10, 15, 1, now(), now() + interval '1 day');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000022', 'internal_exam', ARRAY[]::text[], 20, 20, 2, now(), now() + interval '1 day');
SELECT pg_temp.assert_true((SELECT count(*) = 3 FROM public.theory_assessments), 'admin sees all assignments');
SELECT pg_temp.expect_error($q$UPDATE public.theory_assessments SET question_count = 5$q$, '42501');
SELECT pg_temp.expect_error($q$DELETE FROM public.theory_assessments$q$, '42501');
SELECT pg_temp.expect_error($q$INSERT INTO public.theory_assessments (id) VALUES (gen_random_uuid())$q$, '42501');

RESET ROLE;
INSERT INTO public.theory_assessment_attempts (id, assessment_id, student_id, rules_version,
  question_count, time_limit_minutes, max_errors, question_snapshot, answer_key, expires_at)
SELECT ('00000000-0000-0000-0000-00000000020' || row_number() OVER (ORDER BY id))::uuid,
  id, student_id, rules_version, question_count, time_limit_minutes, max_errors,
  (SELECT jsonb_agg(jsonb_build_object('key', n, 'text', 'Question', 'answers', jsonb_build_array(jsonb_build_object('number', 1, 'text', 'Answer')))) FROM generate_series(1, 10) n),
  (SELECT jsonb_agg(1) FROM generate_series(1, 10)), now() + interval '15 minutes'
FROM public.theory_assessments WHERE kind = 'credit';
INSERT INTO public.theory_attempt_answers (attempt_id, question_index, selected_answer, is_correct)
VALUES ('00000000-0000-0000-0000-000000000201', 0, 1, true);
SELECT pg_temp.expect_error($q$INSERT INTO public.theory_assessment_attempts
  SELECT gen_random_uuid(), assessment_id, student_id, rules_version, question_count, time_limit_minutes,
    max_errors, question_snapshot, answer_key, started_at, expires_at, finished_at, status,
    correct_count, error_count, elapsed_seconds, passed FROM public.theory_assessment_attempts LIMIT 1$q$, '23505');
SELECT pg_temp.expect_error($q$UPDATE public.theory_assessment_attempts SET student_id = '00000000-0000-0000-0000-000000000044'$q$, '23503');
SELECT pg_temp.expect_error($q$UPDATE public.theory_assessment_attempts SET question_snapshot = '[]'$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE public.theory_assessment_attempts SET status = 'completed', passed = true$q$, '23514');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM public.theory_assessments), 'student sees own assignments');
SELECT pg_temp.assert_true((SELECT count(id) = 1 FROM public.theory_assessment_attempts), 'student sees own attempt');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.theory_attempt_answers), 'student sees own answer');
SELECT pg_temp.expect_error($q$SELECT answer_key FROM public.theory_assessment_attempts$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT * FROM public.theory_assessment_attempts$q$, '42501');
SELECT pg_temp.expect_error($q$UPDATE public.theory_assessment_attempts SET passed = true$q$, '42501');
SELECT pg_temp.expect_error($q$INSERT INTO public.theory_assessment_attempts (id) VALUES (gen_random_uuid())$q$, '42501');
SELECT pg_temp.expect_error($q$UPDATE public.theory_attempt_answers SET selected_answer = 2$q$, '42501');
SELECT pg_temp.expect_error($q$DELETE FROM public.theory_attempt_answers$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT public.admin_assign_theory_assessment(gen_random_uuid(),
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 10, 15, 1, now(), now() + interval '1 day')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000103')$q$, 'P0001');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000033', true);
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.theory_assessments), 'second student isolation');
SELECT pg_temp.assert_true((SELECT count(id) = 1 FROM public.theory_assessment_attempts), 'second student attempt isolation');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.theory_attempt_answers), 'no other student answers');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000044', true);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.theory_assessments), 'instructor has no assignments');
SELECT pg_temp.assert_true((SELECT count(id) = 0 FROM public.theory_assessment_attempts), 'instructor has no attempts');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.theory_attempt_answers), 'instructor has no answers');
SELECT pg_temp.expect_error($q$SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000103')$q$, 'P0001');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
SELECT pg_temp.assert_true((SELECT count(id) = 2 FROM public.theory_assessment_attempts), 'admin reads attempts');
SELECT pg_temp.expect_error($q$SELECT answer_key FROM public.theory_assessment_attempts$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000101')$q$, 'P0001');
SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000103');
SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.assert_true((SELECT cancelled_at IS NOT NULL FROM public.theory_assessments
  WHERE id = '00000000-0000-0000-0000-000000000103'), 'cancelled assignment remains in history');

SET LOCAL ROLE anon;
SELECT pg_temp.expect_error($q$SELECT * FROM public.theory_assessments$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000103')$q$, '42501');

ROLLBACK;
