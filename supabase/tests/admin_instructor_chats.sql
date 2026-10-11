-- Run ONLY on a disposable Supabase test database after migration 0038.
-- Uses synthetic accounts, checks role permissions, and rolls back all changes.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(ok BOOLEAN, label TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF;
END;
$$;

CREATE FUNCTION pg_temp.expect_rejected(command TEXT, label TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE command;
    RAISE EXCEPTION 'Assertion failed: % (unexpected success)', label USING ERRCODE = 'ZX001';
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN RAISE;
    WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- Keep all fixture IDs isolated from production accounts.
INSERT INTO auth.users(id) VALUES
 ('a1010000-0000-0000-0000-000000000001'),
 ('a1010000-0000-0000-0000-000000000002'),
 ('a1010000-0000-0000-0000-000000000003'),
 ('a1010000-0000-0000-0000-000000000004'),
 ('a1010000-0000-0000-0000-000000000005');

INSERT INTO public.profiles(id,role,full_name) VALUES
 ('a1010000-0000-0000-0000-000000000001','admin','Test Admin'),
 ('a1010000-0000-0000-0000-000000000002','student','Test Student'),
 ('a1010000-0000-0000-0000-000000000003','instructor','Test Instructor'),
 ('a1010000-0000-0000-0000-000000000004','student','Other Student'),
 ('a1010000-0000-0000-0000-000000000005','instructor','Other Instructor');

INSERT INTO public.instructor_students(student_id,instructor_id) VALUES
 ('a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000003');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1010000-0000-0000-0000-000000000002',true);
SELECT pg_temp.expect_rejected(
  $q$SELECT public.create_admin_student_instructor_chat('a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000003')$q$,
  'student cannot create chat'
);

SELECT set_config('request.jwt.claim.sub','a1010000-0000-0000-0000-000000000003',true);
SELECT pg_temp.expect_rejected(
  $q$SELECT public.create_admin_student_instructor_chat('a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000003')$q$,
  'instructor cannot create chat'
);

SELECT set_config('request.jwt.claim.sub','a1010000-0000-0000-0000-000000000001',true);
SELECT pg_temp.expect_rejected(
  $q$SELECT public.create_admin_student_instructor_chat('a1010000-0000-0000-0000-000000000004','a1010000-0000-0000-0000-000000000003')$q$,
  'admin cannot connect an unrelated student'
);
SELECT pg_temp.expect_rejected(
  $q$SELECT public.create_admin_student_instructor_chat('a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000005')$q$,
  'admin cannot connect an unrelated instructor'
);
SELECT pg_temp.expect_rejected(
  $q$SELECT public.create_admin_student_instructor_chat('a1010000-0000-0000-0000-000000000003','a1010000-0000-0000-0000-000000000002')$q$,
  'admin cannot swap roles'
);

CREATE TEMP TABLE pg_temp.created_chat(thread_id UUID);
INSERT INTO pg_temp.created_chat SELECT public.create_admin_student_instructor_chat(
 'a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000003'
);
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.message_threads mt JOIN pg_temp.created_chat tc ON mt.id=tc.thread_id
  WHERE mt.created_by='a1010000-0000-0000-0000-000000000001' AND mt.is_group),
 'admin creates group thread'
);
SELECT pg_temp.assert_true(
 (SELECT count(*)=2 FROM public.message_thread_participants p JOIN pg_temp.created_chat tc ON tc.thread_id=p.thread_id
  WHERE p.user_id IN ('a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000003')),
 'both student and instructor are participants'
);
SELECT pg_temp.assert_true(
 (SELECT count(*)=2 FROM public.message_recipients mr JOIN public.messages m ON mr.message_id=m.id
  JOIN pg_temp.created_chat tc ON tc.thread_id=m.thread_id),
 'initial message is addressed to both participants'
);
SELECT pg_temp.assert_true(
 (SELECT thread_id FROM pg_temp.created_chat) = public.create_admin_student_instructor_chat(
  'a1010000-0000-0000-0000-000000000002','a1010000-0000-0000-0000-000000000003'),
 'same pair reuses existing thread'
);
SELECT pg_temp.assert_true(
 (SELECT count(*)=1 FROM public.message_threads mt JOIN pg_temp.created_chat tc ON tc.thread_id=mt.id),
 'duplicate request does not add another thread'
);
RESET ROLE;
ROLLBACK;
