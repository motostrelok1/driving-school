-- Run only in the disposable driving-school-test project after migration 0040.
-- Never execute this fixture on production. The entire transaction is rolled back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, description text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',description; END IF; END $$;
INSERT INTO auth.users(id) VALUES
 ('a1040000-0000-0000-0000-000000000001'),
 ('a1040000-0000-0000-0000-000000000002'),
 ('a1040000-0000-0000-0000-000000000003');
INSERT INTO public.profiles(id,role,full_name) VALUES
 ('a1040000-0000-0000-0000-000000000001','admin','Security Test Admin'),
 ('a1040000-0000-0000-0000-000000000002','student','Security Test Student'),
 ('a1040000-0000-0000-0000-000000000003','instructor','Security Test Instructor')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role,full_name=EXCLUDED.full_name;

INSERT INTO public.instructor_students(student_id,instructor_id)
VALUES ('a1040000-0000-0000-0000-000000000002','a1040000-0000-0000-0000-000000000003');

INSERT INTO public.message_threads(id,subject,created_by,is_group)
VALUES ('a1040000-0000-0000-0000-000000000004','Driving test',
 'a1040000-0000-0000-0000-000000000001',true),
 ('a1040000-0000-0000-0000-000000000005','Unrelated chat',
 'a1040000-0000-0000-0000-000000000001',true);
INSERT INTO public.message_thread_participants(thread_id,user_id) VALUES
 ('a1040000-0000-0000-0000-000000000004','a1040000-0000-0000-0000-000000000002'),
 ('a1040000-0000-0000-0000-000000000004','a1040000-0000-0000-0000-000000000003'),
 ('a1040000-0000-0000-0000-000000000005','a1040000-0000-0000-0000-000000000003');
UPDATE public.instructor_chat_tasks
SET status='completed',thread_id='a1040000-0000-0000-0000-000000000004'
WHERE student_id='a1040000-0000-0000-0000-000000000002'
  AND instructor_id='a1040000-0000-0000-0000-000000000003'
  AND status='pending';

DELETE FROM public.instructor_students
WHERE student_id='a1040000-0000-0000-0000-000000000002'
  AND instructor_id='a1040000-0000-0000-0000-000000000003';

SELECT pg_temp.assert_true(NOT EXISTS(
 SELECT 1 FROM public.message_thread_participants
 WHERE thread_id='a1040000-0000-0000-0000-000000000004'
   AND user_id='a1040000-0000-0000-0000-000000000003'
),'former instructor removed from driving chat');
SELECT pg_temp.assert_true(EXISTS(
 SELECT 1 FROM public.message_thread_participants
 WHERE thread_id='a1040000-0000-0000-0000-000000000004'
   AND user_id='a1040000-0000-0000-0000-000000000002'
),'student remains in driving chat');
SELECT pg_temp.assert_true(EXISTS(
 SELECT 1 FROM public.message_thread_participants
 WHERE thread_id='a1040000-0000-0000-0000-000000000005'
   AND user_id='a1040000-0000-0000-0000-000000000003'
),'unrelated chat membership preserved');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1040000-0000-0000-0000-000000000003',true);
SELECT pg_temp.assert_true(
 (SELECT count(*)=0 FROM public.get_my_conversation('a1040000-0000-0000-0000-000000000004')),
 'former instructor cannot access the driving conversation');
RESET ROLE;
ROLLBACK;
