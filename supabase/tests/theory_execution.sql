-- Только тестовая БД, после 0034 и 0035. Все фикстуры откатываются.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value BOOLEAN, message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement TEXT, expected_code TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE actual_code TEXT;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code = RETURNED_SQLSTATE; END;
  IF actual_code IS DISTINCT FROM expected_code THEN RAISE EXCEPTION 'Expected %, got % for %', expected_code, actual_code, statement; END IF;
END $$;
CREATE TEMP TABLE state (key TEXT PRIMARY KEY, payload JSONB);
GRANT ALL ON state TO authenticated;
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000033'), ('00000000-0000-0000-0000-000000000044');
INSERT INTO public.profiles (id, role) VALUES
  ('00000000-0000-0000-0000-000000000011', 'admin'), ('00000000-0000-0000-0000-000000000022', 'student'),
  ('00000000-0000-0000-0000-000000000033', 'student'), ('00000000-0000-0000-0000-000000000044', 'instructor')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
INSERT INTO state SELECT 'import', public.admin_import_theory_questions((SELECT jsonb_agg(jsonb_build_object(
  'ticketNumber', (n - 1) / 20 + 1, 'number', (n - 1) % 20 + 1, 'text', 'Fixture question ' || n,
  'image', NULL, 'answers', jsonb_build_array(jsonb_build_object('number', 1, 'text', 'First', 'correctAnswer', 1),
    jsonb_build_object('number', 2, 'text', 'Second', 'hint', 'Forbidden hint')),
  'correctAnswer', CASE WHEN n = 25 THEN 3 ELSE 1 END)) FROM generate_series(1, 25) n));
SELECT pg_temp.assert_true((SELECT (payload->>'inserted')::INTEGER = 25 AND (payload->>'invalid_keys')::INTEGER = 1 FROM state WHERE key = 'import'), 'draft import detects invalid answer key');
SELECT pg_temp.assert_true((SELECT count(*) = 25 AND count(approved_at) = 0 FROM public.theory_question_bank), 'import never approves');
SELECT pg_temp.assert_true((SELECT correct_answer IS NULL FROM public.theory_question_bank WHERE id = '2-5'), 'invalid key is cleared');
SELECT pg_temp.expect_error($q$SELECT public.admin_save_theory_question('2-5', 'Fixture', '[{"number":1,"text":"A"},{"number":2,"text":"B"}]', 3, ARRAY['1'], true)$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_import_theory_questions('[{"ticketNumber":1,"number":1,"text":"Invalid","answers":[{"number":1,"text":"A"},{"number":1,"text":"B"}]}]')$q$, 'P0001');
SELECT pg_temp.expect_error($q$UPDATE public.theory_question_bank SET approved_at = now()$q$, '42501');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 2, 10, 0, now() - interval '1 minute', now() + interval '1 day');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['2'], 1, 10, 0, now() - interval '1 minute', now() + interval '1 day');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 2, 1, 0, now() + interval '1 day', now() + interval '2 days');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 2, 1, 0, now() - interval '1 minute', now() + interval '1 day');
SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000104');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.theory_question_bank), 'student cannot read draft or keys');
SELECT pg_temp.expect_error($q$SELECT public.student_start_theory_assessment('00000000-0000-0000-0000-000000000101')$q$, 'P0001');
SELECT pg_temp.assert_true((SELECT count(id) = 0 FROM public.theory_assessment_attempts), 'no attempt when bank is empty');
SELECT pg_temp.expect_error($q$SELECT public.admin_import_theory_questions('[]')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.admin_save_theory_question('1-1', 'Fixture', '[]', 1, ARRAY['1'], true)$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public._theory_attempt_payload(gen_random_uuid())$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT public._finish_theory_attempt(gen_random_uuid(), false)$q$, '42501');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
SELECT public.admin_save_theory_question(id, question_text, answers, correct_answer, ARRAY['1'], true)
  FROM public.theory_question_bank WHERE ticket_number = 1;
SELECT pg_temp.assert_true((SELECT count(*) = 20 FROM public.theory_question_bank WHERE approved_at IS NOT NULL), 'only approved questions selectable');
INSERT INTO state SELECT 'reimport', public.admin_import_theory_questions('[{"ticketNumber":1,"number":1,"text":"Overwrite attempt","answers":[{"number":1,"text":"Changed A"},{"number":2,"text":"Changed B"}],"correctAnswer":2}]');
SELECT pg_temp.assert_true((SELECT question_text = 'Fixture question 1' AND correct_answer = 1 AND approved_at IS NOT NULL FROM public.theory_question_bank WHERE id = '1-1'), 'reimport preserves reviewed bank');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
SELECT pg_temp.expect_error($q$SELECT public.student_start_theory_assessment('00000000-0000-0000-0000-000000000102')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_start_theory_assessment('00000000-0000-0000-0000-000000000103')$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_start_theory_assessment('00000000-0000-0000-0000-000000000104')$q$, 'P0001');
INSERT INTO state SELECT 'started', public.student_start_theory_assessment('00000000-0000-0000-0000-000000000101');
INSERT INTO state SELECT 'replayed', public.student_start_theory_assessment('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.assert_true((SELECT a.payload->'attempt'->>'id' = b.payload->'attempt'->>'id' FROM state a, state b WHERE a.key = 'started' AND b.key = 'replayed'), 'one stable attempt');
SELECT pg_temp.assert_true((SELECT count(id) = 1 FROM public.theory_assessment_attempts), 'no duplicate attempt');
SELECT pg_temp.assert_true((SELECT jsonb_array_length(payload->'attempt'->'question_snapshot') = 2 AND payload->'attempt'->>'status' = 'running' FROM state WHERE key = 'started'), 'exact question count');
SELECT pg_temp.assert_true((SELECT payload::TEXT NOT LIKE '%answer_key%' AND payload::TEXT NOT LIKE '%correctAnswer%' AND payload::TEXT NOT LIKE '%Forbidden hint%' FROM state WHERE key = 'started'), 'safe snapshot strips answers metadata and hints');
SELECT pg_temp.expect_error($q$SELECT public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 99, 1)$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 0, 99)$q$, 'P0001');
INSERT INTO state SELECT 'answered', public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 0, 1);
SELECT public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 0, 1);
SELECT pg_temp.assert_true((SELECT count(id) = 1 FROM public.theory_attempt_answers), 'answer replay is idempotent');
SELECT pg_temp.assert_true((SELECT payload::TEXT NOT LIKE '%is_correct%' FROM state WHERE key = 'answered'), 'no correctness feedback while running');
SELECT pg_temp.expect_error($q$SELECT is_correct FROM public.theory_attempt_answers$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 0, 2)$q$, 'P0001');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000033', true);
SELECT pg_temp.expect_error($q$SELECT public.get_my_theory_attempt((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'))$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 1, 1)$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_finish_theory_attempt((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'))$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_start_theory_assessment('00000000-0000-0000-0000-000000000101')$q$, 'P0001');
SELECT pg_temp.assert_true((SELECT jsonb_array_length(public.get_my_theory_assessments()->'items') = 0), 'overview isolation');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
SELECT pg_temp.expect_error($q$SELECT public.admin_cancel_theory_assessment('00000000-0000-0000-0000-000000000101')$q$, 'P0001');
SELECT public.admin_save_theory_question(id, 'Changed bank after start', answers, 2, ARRAY['1'], true)
  FROM public.theory_question_bank WHERE approved_at IS NOT NULL;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
INSERT INTO state SELECT 'restored', public.get_my_theory_attempt((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'));
SELECT pg_temp.assert_true((SELECT jsonb_array_length(payload->'answers') = 1 AND payload::TEXT NOT LIKE '%Changed bank%' FROM state WHERE key = 'restored'), 'answers and snapshot survive reload and bank changes');
INSERT INTO state SELECT 'passed', public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 1, 1);
SELECT pg_temp.assert_true((SELECT payload->'attempt'->>'status' = 'completed' AND (payload->'attempt'->>'passed')::BOOLEAN AND (payload->'attempt'->>'correct_count')::INTEGER = 2 AND (payload->'attempt'->>'error_count')::INTEGER = 0 FROM state WHERE key = 'passed'), 'server scores frozen key');
SELECT public.student_finish_theory_attempt((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'));
SELECT public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'started'), 1, 2);
SELECT pg_temp.assert_true((SELECT passed AND correct_count = 2 FROM public.theory_assessment_attempts), 'finished results immutable');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000105',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 2, 1, 0, now() - interval '1 minute', now() + interval '30 seconds');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000106',
  '00000000-0000-0000-0000-000000000022', 'credit', ARRAY['1'], 2, 1, 0, now() - interval '1 minute', now() + interval '1 day');
SELECT public.admin_assign_theory_assessment('00000000-0000-0000-0000-000000000107',
  '00000000-0000-0000-0000-000000000022', 'internal_exam', ARRAY[]::TEXT[], 20, 20, 2, now() - interval '1 minute', now() + interval '1 day');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
INSERT INTO state SELECT 'early', public.student_start_theory_assessment('00000000-0000-0000-0000-000000000105');
SELECT pg_temp.assert_true((SELECT (s.payload->'attempt'->>'expires_at')::TIMESTAMPTZ = t.deadline_at FROM state s, public.theory_assessments t WHERE s.key = 'early' AND t.id = '00000000-0000-0000-0000-000000000105'), 'deadline caps timer');
INSERT INTO state SELECT 'failed', public.student_finish_theory_attempt((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'early'));
SELECT pg_temp.assert_true((SELECT NOT (payload->'attempt'->>'passed')::BOOLEAN AND (payload->'attempt'->>'error_count')::INTEGER = 2 FROM state WHERE key = 'failed'), 'unanswered are errors');
INSERT INTO state SELECT 'expiring', public.student_start_theory_assessment('00000000-0000-0000-0000-000000000106');
INSERT INTO state SELECT 'exam', public.student_start_theory_assessment('00000000-0000-0000-0000-000000000107');
SELECT pg_temp.assert_true((SELECT jsonb_array_length(payload->'attempt'->'question_snapshot') = 20 FROM state WHERE key = 'exam'), 'standard exam has twenty distinct questions');

RESET ROLE;
UPDATE public.theory_assessment_attempts SET started_at = clock_timestamp() - interval '2 minutes', expires_at = clock_timestamp() - interval '1 minute'
  WHERE id = (SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'expiring');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
INSERT INTO state SELECT 'expired', public.student_answer_theory_question((SELECT (payload->'attempt'->>'id')::UUID FROM state WHERE key = 'expiring'), 0, 2);
SELECT pg_temp.assert_true((SELECT payload->'attempt'->>'status' = 'expired' AND NOT (payload->'attempt'->>'passed')::BOOLEAN AND jsonb_array_length(payload->'answers') = 0 FROM state WHERE key = 'expired'), 'late answer rejected and timeout scored');
INSERT INTO state SELECT 'expired_replay', public.student_start_theory_assessment('00000000-0000-0000-0000-000000000106');
SELECT pg_temp.assert_true((SELECT a.payload->'attempt'->>'id' = b.payload->'attempt'->>'id' FROM state a, state b WHERE a.key = 'expiring' AND b.key = 'expired_replay'), 'expired attempt is not restarted');
SELECT pg_temp.assert_true((SELECT public.get_my_theory_assessments()::TEXT NOT LIKE '%question_snapshot%'), 'overview has no heavy snapshots');
SELECT pg_temp.expect_error($q$SELECT public.claim_theory_assignment_notification('00000000-0000-0000-0000-000000000103')$q$, '42501');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000044', true);
SELECT pg_temp.expect_error($q$SELECT public.get_my_theory_assessments()$q$, 'P0001');
SELECT pg_temp.expect_error($q$SELECT public.student_start_theory_assessment('00000000-0000-0000-0000-000000000103')$q$, 'P0001');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.theory_question_bank), 'instructor cannot read bank');
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error($q$SELECT public.get_my_theory_assessments()$q$, '42501');
SELECT pg_temp.expect_error($q$SELECT * FROM public.theory_question_bank$q$, '42501');
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.claim_theory_assignment_notification('00000000-0000-0000-0000-000000000103')), 'service claims once');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.claim_theory_assignment_notification('00000000-0000-0000-0000-000000000103')), 'lease prevents duplicate notification');
ROLLBACK;
