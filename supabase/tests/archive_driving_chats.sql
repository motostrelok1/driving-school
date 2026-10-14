-- Run ONLY on disposable driving-school-test after migration 0042.
-- Do NOT run on production. All changes are rolled back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok BOOLEAN, label TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
INSERT INTO auth.users(id) VALUES
 ('a1060000-0000-0000-0000-000000000001'),
 ('a1060000-0000-0000-0000-000000000002'),
 ('a1060000-0000-0000-0000-000000000003');
INSERT INTO public.profiles(id,role,full_name) VALUES
 ('a1060000-0000-0000-0000-000000000001','admin','Archive Test Admin'),
 ('a1060000-0000-0000-0000-000000000002','student','Archive Test Student'),
 ('a1060000-0000-0000-0000-000000000003','instructor','Archive Test Instructor')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role,full_name=EXCLUDED.full_name;
INSERT INTO public.instructor_students(student_id,instructor_id)
 VALUES ('a1060000-0000-0000-0000-000000000002','a1060000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1060000-0000-0000-0000-000000000001',true);
CREATE TEMP TABLE archive_test_threads (id UUID);
INSERT INTO archive_test_threads
 SELECT public.create_admin_student_instructor_chat(
 'a1060000-0000-0000-0000-000000000002','a1060000-0000-0000-0000-000000000003');
SELECT public.complete_instructor_chat_task(
 (SELECT id FROM public.instructor_chat_tasks
  WHERE student_id='a1060000-0000-0000-0000-000000000002' AND status='pending'),
 (SELECT id FROM archive_test_threads));
RESET ROLE;
DELETE FROM public.instructor_students
 WHERE student_id='a1060000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true(
 (SELECT closed_at IS NOT NULL FROM public.message_threads WHERE id=(SELECT id FROM archive_test_threads)),
 'old thread archived');
SELECT pg_temp.assert_true(
 (SELECT count(*)=2 FROM public.message_thread_participants WHERE thread_id=(SELECT id FROM archive_test_threads)),
 'student and instructor keep read access');
DO $$
BEGIN
 BEGIN
  INSERT INTO public.messages(thread_id,sender_id,body,message_type,allow_reply)
  VALUES((SELECT id FROM archive_test_threads),'a1060000-0000-0000-0000-000000000001','Should be rejected','message',true);
  RAISE EXCEPTION 'Archived chat unexpectedly accepted a message';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Conversation is archived%' THEN RAISE; END IF;
 END;
END $$;
INSERT INTO public.instructor_students(student_id,instructor_id)
 VALUES ('a1060000-0000-0000-0000-000000000002','a1060000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1060000-0000-0000-0000-000000000001',true);
CREATE TEMP TABLE archive_test_new_threads (id UUID);
INSERT INTO archive_test_new_threads
 SELECT public.create_admin_student_instructor_chat(
 'a1060000-0000-0000-0000-000000000002','a1060000-0000-0000-0000-000000000003');
SELECT pg_temp.assert_true(
 (SELECT id FROM archive_test_threads) <> (SELECT id FROM archive_test_new_threads),
 'same instructor must start NEW chat');
SELECT pg_temp.assert_true(
 (SELECT closed_at IS NOT NULL FROM public.message_threads WHERE id=(SELECT id FROM archive_test_threads)),
 'old chat remains archived after reselect');
RESET ROLE;
ROLLBACK;
