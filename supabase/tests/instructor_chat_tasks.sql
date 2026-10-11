-- ONLY run on a disposable test Supabase database after migration 0039.
-- Do not run on production. Entire fixture is rolled back.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF;
END $$;

INSERT INTO auth.users(id) VALUES
 ('a1020000-0000-0000-0000-000000000001'),
 ('a1020000-0000-0000-0000-000000000002'),
 ('a1020000-0000-0000-0000-000000000003'),
 ('a1020000-0000-0000-0000-000000000004');
INSERT INTO public.profiles(id,role,full_name) VALUES
 ('a1020000-0000-0000-0000-000000000001','admin','Task Test Admin'),
 ('a1020000-0000-0000-0000-000000000002','student','Task Test Student'),
 ('a1020000-0000-0000-0000-000000000003','instructor','Task Test First Instructor'),
 ('a1020000-0000-0000-0000-000000000004','instructor','Task Test Second Instructor');

-- Initial assignment creates exactly one pending task.
INSERT INTO public.instructor_students(student_id,instructor_id)
 VALUES ('a1020000-0000-0000-0000-000000000002','a1020000-0000-0000-0000-000000000003');
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.instructor_chat_tasks
  WHERE student_id='a1020000-0000-0000-0000-000000000002'
    AND instructor_id='a1020000-0000-0000-0000-000000000003'
    AND status='pending' AND notification_status='pending'),
 'initial assignment creates pending task');

-- A repeated assignment to the same pair cannot create another task.
INSERT INTO public.instructor_students(student_id,instructor_id)
 VALUES ('a1020000-0000-0000-0000-000000000002','a1020000-0000-0000-0000-000000000003')
 ON CONFLICT DO NOTHING;
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.instructor_chat_tasks
  WHERE student_id='a1020000-0000-0000-0000-000000000002'),
 'repeated assignment does not create duplicate');

-- Instructor change retires the old task and creates one for the new pair.
DELETE FROM public.instructor_students
 WHERE student_id='a1020000-0000-0000-0000-000000000002';
INSERT INTO public.instructor_students(student_id,instructor_id)
 VALUES ('a1020000-0000-0000-0000-000000000002','a1020000-0000-0000-0000-000000000004');
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.instructor_chat_tasks
  WHERE student_id='a1020000-0000-0000-0000-000000000002'
    AND instructor_id='a1020000-0000-0000-0000-000000000003' AND status='superseded'),
 'previous task becomes superseded');
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.instructor_chat_tasks
  WHERE student_id='a1020000-0000-0000-0000-000000000002'
    AND instructor_id='a1020000-0000-0000-0000-000000000004' AND status='pending'),
 'new instructor receives task');
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.instructor_chat_tasks
  WHERE student_id='a1020000-0000-0000-0000-000000000002' AND status='pending'),
 'one pending task per student');

-- A student cannot directly insert or update task records.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1020000-0000-0000-0000-000000000002',true);
SELECT pg_temp.assert_true(
 (SELECT count(*)=0 FROM public.instructor_chat_tasks),
 'student cannot read admin tasks');

-- Instructor also cannot read tasks.
SELECT set_config('request.jwt.claim.sub','a1020000-0000-0000-0000-000000000004',true);
SELECT pg_temp.assert_true(
 (SELECT count(*)=0 FROM public.instructor_chat_tasks),
 'instructor cannot read admin tasks');

-- Admin can read the one pending task.
SELECT set_config('request.jwt.claim.sub','a1020000-0000-0000-0000-000000000001',true);
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.instructor_chat_tasks WHERE status='pending'
   AND student_id='a1020000-0000-0000-0000-000000000002'),
 'admin sees pending task');

RESET ROLE;
ROLLBACK;
