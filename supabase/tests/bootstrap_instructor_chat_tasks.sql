-- ONLY FOR EMPTY driving-school-test Supabase project. NEVER execute on production.
-- Minimal dependencies for PR #102 SQL tests. Do not rerun on an initialized database.
BEGIN;

-- ===== 0001_initial.sql =====
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Groups (учебные группы)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'B',
  start_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles (расширение auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
  full_name TEXT,
  phone TEXT,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Instructor-student relationships
CREATE TABLE IF NOT EXISTS public.instructor_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instructor_id, student_id)
);

-- Lessons (расписание занятий)
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'theory' CHECK (type IN ('theory', 'practice')),
  start_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_lessons_updated_at ON public.lessons;
CREATE TRIGGER set_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to create profile after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role TEXT;
  default_full_name TEXT;
BEGIN
  default_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  default_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, default_role, default_full_name)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Instructors can read their students profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_students
      WHERE instructor_id = auth.uid() AND student_id = public.profiles.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Groups policies
CREATE POLICY "All authenticated can read groups"
  ON public.groups FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage groups"
  ON public.groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Instructor-students policies
CREATE POLICY "Instructors can read their students"
  ON public.instructor_students FOR SELECT
  USING (auth.uid() = instructor_id);

CREATE POLICY "Students can read their instructors"
  ON public.instructor_students FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage instructor_students"
  ON public.instructor_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Lessons policies
CREATE POLICY "Students can read own lessons"
  ON public.lessons FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Instructors can read their lessons"
  ON public.lessons FOR SELECT
  USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their lessons"
  ON public.lessons FOR UPDATE
  USING (auth.uid() = instructor_id);

CREATE POLICY "Admins can manage lessons"
  ON public.lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ===== 0002_fix_rls_recursion.sql =====
-- Fix recursive RLS policies on profiles table

-- Create a security definer function to check admin role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Drop old recursive policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Instructors can read their students profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Recreate non-recursive SELECT policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Instructors can read their students profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_students
      WHERE instructor_id = auth.uid() AND student_id = public.profiles.id
    )
  );

-- Recreate non-recursive UPDATE policies
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Recreate non-recursive INSERT policy
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- ===== 0003_fix_is_admin_function.sql =====
-- Fix is_admin function to accept user_id parameter

-- Drop admin policies that depend on the old function first
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Drop the old function without parameters (CASCADE removes dependent policies)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create corrected function that takes user_id as parameter
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Recreate admin policies to use the corrected function
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- ===== 0006_reset_rls_policies.sql =====
-- Replace every legacy RLS policy. This migration is safe to run after the
-- earlier migrations and removes recursive queries against public.profiles.

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Instructors can read their students profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Instructors can read their students profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_students
      WHERE instructor_id = auth.uid() AND student_id = profiles.id
    )
  );
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "All authenticated can read groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "All authenticated can read groups"
  ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage groups"
  ON public.groups FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Instructors can read their students" ON public.instructor_students;
DROP POLICY IF EXISTS "Students can read their instructors" ON public.instructor_students;
DROP POLICY IF EXISTS "Admins can manage instructor_students" ON public.instructor_students;
CREATE POLICY "Instructors can read their students"
  ON public.instructor_students FOR SELECT USING (auth.uid() = instructor_id);
CREATE POLICY "Students can read their instructors"
  ON public.instructor_students FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins can manage instructor_students"
  ON public.instructor_students FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Students can read own lessons" ON public.lessons;
DROP POLICY IF EXISTS "Instructors can read their lessons" ON public.lessons;
DROP POLICY IF EXISTS "Instructors can update their lessons" ON public.lessons;
DROP POLICY IF EXISTS "Admins can manage lessons" ON public.lessons;
CREATE POLICY "Students can read own lessons"
  ON public.lessons FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Instructors can read their lessons"
  ON public.lessons FOR SELECT USING (auth.uid() = instructor_id);
CREATE POLICY "Instructors can update their lessons"
  ON public.lessons FOR UPDATE
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Admins can manage lessons"
  ON public.lessons FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ===== 0017_message_storage.sql =====
-- Message and notification storage foundation
-- Supabase is the source of truth; OneSignal is only the push transport.

CREATE TABLE public.message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  message_type TEXT NOT NULL DEFAULT 'notification'
    CHECK (message_type IN ('notification', 'message')),
  allow_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT replyable_messages_are_messages
    CHECK (NOT allow_reply OR message_type = 'message')
);

CREATE TABLE public.message_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_status TEXT NOT NULL DEFAULT 'sending'
    CHECK (delivery_status IN ('sending', 'sent', 'delivered', 'error')),
  onesignal_notification_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, recipient_id)
);

CREATE INDEX message_threads_created_by_idx ON public.message_threads(created_by);
CREATE INDEX messages_thread_created_idx ON public.messages(thread_id, created_at);
CREATE INDEX messages_sender_idx ON public.messages(sender_id);
CREATE INDEX message_recipients_recipient_created_idx
  ON public.message_recipients(recipient_id, created_at DESC);
CREATE INDEX message_recipients_message_idx ON public.message_recipients(message_id);
CREATE INDEX message_recipients_unread_idx
  ON public.message_recipients(recipient_id, opened_at)
  WHERE opened_at IS NULL;

DROP TRIGGER IF EXISTS set_message_threads_updated_at ON public.message_threads;
CREATE TRIGGER set_message_threads_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_message_recipients_updated_at ON public.message_recipients;
CREATE TRIGGER set_message_recipients_updated_at
  BEFORE UPDATE ON public.message_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

-- Admins can manage the whole messaging system.
CREATE POLICY "Admins can manage message threads"
  ON public.message_threads FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage messages"
  ON public.messages FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage message recipients"
  ON public.message_recipients FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Recipients can read only messages addressed to them.
CREATE POLICY "Recipients can read own message recipients"
  ON public.message_recipients FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Recipients can read own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_recipients mr
      WHERE mr.message_id = messages.id
        AND mr.recipient_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can read own message threads"
  ON public.message_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.message_recipients mr ON mr.message_id = m.id
      WHERE m.thread_id = message_threads.id
        AND mr.recipient_id = auth.uid()
    )
  );

-- A recipient may only mark their own message as opened.
-- Other delivery fields remain server/admin managed.
CREATE OR REPLACE FUNCTION public.mark_message_opened(target_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_recipients
  SET opened_at = COALESCE(opened_at, now())
  WHERE message_id = target_message_id
    AND recipient_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_message_opened(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_message_opened(UUID) TO authenticated;

-- ===== 0022_chat_inbox_groups.sql =====
-- Chat inbox, unread state and group conversations.

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.message_thread_participants (
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_thread_participants_user_idx
  ON public.message_thread_participants(user_id, thread_id);

ALTER TABLE public.message_thread_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage message thread participants" ON public.message_thread_participants;
CREATE POLICY "Admins can manage message thread participants"
  ON public.message_thread_participants FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can read own thread membership" ON public.message_thread_participants;
CREATE POLICY "Users can read own thread membership"
  ON public.message_thread_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Backfill participants for existing reply-enabled conversations.
INSERT INTO public.message_thread_participants (thread_id, user_id)
SELECT DISTINCT m.thread_id, mr.recipient_id
FROM public.messages m
JOIN public.message_recipients mr ON mr.message_id = m.id
WHERE m.thread_id IS NOT NULL
  AND m.message_type = 'message'
  AND NOT public.is_admin(mr.recipient_id)
ON CONFLICT DO NOTHING;

-- Admin chat list: one row per thread, with participants, last message and unread count.
CREATE OR REPLACE FUNCTION public.get_admin_chat_threads()
RETURNS TABLE (
  thread_id UUID,
  subject TEXT,
  is_group BOOLEAN,
  participant_ids UUID[],
  participant_names TEXT[],
  last_message TEXT,
  last_at TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH thread_data AS (
    SELECT
      mt.id,
      mt.subject,
      mt.is_group,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.user_id), NULL) AS participant_ids,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT pr.full_name), NULL) AS participant_names
    FROM public.message_threads mt
    JOIN public.messages m ON m.thread_id = mt.id AND m.message_type = 'message'
    LEFT JOIN public.message_thread_participants p ON p.thread_id = mt.id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE public.is_admin(auth.uid())
    GROUP BY mt.id, mt.subject, mt.is_group
  )
  SELECT
    td.id,
    td.subject,
    td.is_group,
    td.participant_ids,
    td.participant_names,
    lm.body,
    lm.created_at,
    (
      SELECT COUNT(*)
      FROM public.message_recipients mr
      JOIN public.messages um ON um.id = mr.message_id
      WHERE um.thread_id = td.id
        AND mr.recipient_id = auth.uid()
        AND mr.opened_at IS NULL
    )
  FROM thread_data td
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at
    FROM public.messages m
    WHERE m.thread_id = td.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  ORDER BY lm.created_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_admin_chat_threads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_chat_threads() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_thread_opened(target_thread_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_recipients mr
  SET opened_at = COALESCE(mr.opened_at, now())
  FROM public.messages m
  WHERE mr.message_id = m.id
    AND m.thread_id = target_thread_id
    AND mr.recipient_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_thread_opened(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_thread_opened(UUID) TO authenticated;

-- Conversation members can see the whole chat, including messages between other group members.
CREATE OR REPLACE FUNCTION public.get_my_conversation(target_thread_id UUID)
RETURNS TABLE (
  message_id UUID,
  sender_id UUID,
  body TEXT,
  created_at TIMESTAMPTZ,
  allow_reply BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.body, m.created_at, m.allow_reply
  FROM public.messages m
  WHERE m.thread_id = target_thread_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.message_thread_participants p
        WHERE p.thread_id = target_thread_id
          AND p.user_id = auth.uid()
      )
      OR public.is_admin(auth.uid())
    )
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_my_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_conversation(UUID) TO authenticated;

-- ===== 0038_admin_controlled_instructor_chats.sql =====
-- Admin-controlled three-party conversations (admin + student + assigned instructor).
-- Existing chats remain unchanged; no bot permissions or API access are granted.
CREATE OR REPLACE FUNCTION public.create_admin_student_instructor_chat(
  target_student_id UUID,
  target_instructor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_thread_id UUID;
  initial_message_id UUID;
  student_name TEXT;
  instructor_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an administrator can create a conversation';
  END IF;
  SELECT full_name INTO student_name
  FROM public.profiles WHERE id = target_student_id AND role = 'student';
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
  SELECT full_name INTO instructor_name
  FROM public.profiles WHERE id = target_instructor_id AND role = 'instructor';
  IF NOT FOUND THEN RAISE EXCEPTION 'Instructor not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.instructor_students
    WHERE student_id = target_student_id AND instructor_id = target_instructor_id
  ) THEN
    RAISE EXCEPTION 'Instructor is not assigned to this student';
  END IF;

  -- Serialize creation requests for the same pair to avoid duplicate chats.
  PERFORM pg_advisory_xact_lock(hashtextextended(target_student_id::text || ':' || target_instructor_id::text, 0));
  SELECT mt.id INTO new_thread_id
  FROM public.message_threads mt
  WHERE mt.created_by IS NOT NULL
    AND mt.is_group = TRUE
    AND EXISTS (SELECT 1 FROM public.message_thread_participants p
      WHERE p.thread_id = mt.id AND p.user_id = target_student_id)
    AND EXISTS (SELECT 1 FROM public.message_thread_participants p
      WHERE p.thread_id = mt.id AND p.user_id = target_instructor_id)
    AND (SELECT count(*) FROM public.message_thread_participants p WHERE p.thread_id = mt.id) = 2
    AND mt.subject = 'Вождение: ' || COALESCE(student_name, 'Ученик') || ' — ' || COALESCE(instructor_name, 'Инструктор')
  ORDER BY mt.created_at DESC LIMIT 1;
  IF FOUND THEN RETURN new_thread_id; END IF;

  INSERT INTO public.message_threads(subject, created_by, is_group)
  VALUES ('Вождение: ' || COALESCE(student_name, 'Ученик') || ' — ' || COALESCE(instructor_name, 'Инструктор'),
          auth.uid(), TRUE)
  RETURNING id INTO new_thread_id;

  INSERT INTO public.message_thread_participants(thread_id,user_id)
  VALUES (new_thread_id,target_student_id),(new_thread_id,target_instructor_id);

  INSERT INTO public.messages(thread_id,sender_id,body,message_type,allow_reply)
  VALUES (new_thread_id,auth.uid(),'Переписка с администратором и инструктором открыта.','message',TRUE)
  RETURNING id INTO initial_message_id;

  INSERT INTO public.message_recipients(message_id,recipient_id,delivery_status,sent_at)
  VALUES (initial_message_id,target_student_id,'sent',now()),
         (initial_message_id,target_instructor_id,'sent',now());
  RETURN new_thread_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_admin_student_instructor_chat(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_student_instructor_chat(UUID,UUID) TO authenticated;

-- ===== 0039_instructor_chat_tasks.sql =====
-- Create a pending admin chat activation task when a student selects an instructor.
CREATE TABLE public.instructor_chat_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','superseded')),
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','processing','sent','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  thread_id UUID REFERENCES public.message_threads(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX instructor_chat_tasks_one_pending_per_student
 ON public.instructor_chat_tasks(student_id) WHERE status='pending';
CREATE INDEX instructor_chat_tasks_pending_notifications
 ON public.instructor_chat_tasks(student_id,notification_status) WHERE status='pending';
ALTER TABLE public.instructor_chat_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read instructor chat tasks"
 ON public.instructor_chat_tasks FOR SELECT TO authenticated
 USING (public.is_admin(auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.instructor_chat_tasks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_instructor_chat_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE public.instructor_chat_tasks
      SET status='superseded' WHERE student_id=OLD.student_id AND status='pending';
    RETURN OLD;
  END IF;
  UPDATE public.instructor_chat_tasks
    SET status='superseded'
    WHERE student_id=NEW.student_id AND status='pending'
      AND instructor_id<>NEW.instructor_id;
  INSERT INTO public.instructor_chat_tasks(student_id,instructor_id)
    VALUES(NEW.student_id,NEW.instructor_id)
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_track_instructor_chat_task ON public.instructor_students;
CREATE TRIGGER trg_track_instructor_chat_task
 AFTER INSERT OR DELETE ON public.instructor_students
 FOR EACH ROW EXECUTE FUNCTION public.track_instructor_chat_task();
REVOKE ALL ON FUNCTION public.track_instructor_chat_task() FROM PUBLIC;

-- Admin-only task completion, verifies the chat represents this student/instructor pair.
CREATE OR REPLACE FUNCTION public.complete_instructor_chat_task(target_task_id UUID, target_thread_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task_row public.instructor_chat_tasks%ROWTYPE;
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO task_row FROM public.instructor_chat_tasks WHERE id=target_task_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending task not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.message_threads mt
  WHERE mt.id=target_thread_id AND mt.created_by IS NOT NULL AND public.is_admin(mt.created_by)
  AND EXISTS(SELECT 1 FROM public.message_thread_participants p WHERE p.thread_id=mt.id AND p.user_id=task_row.student_id)
  AND EXISTS(SELECT 1 FROM public.message_thread_participants p WHERE p.thread_id=mt.id AND p.user_id=task_row.instructor_id))
  THEN RAISE EXCEPTION 'Chat participants not valid'; END IF;
 UPDATE public.instructor_chat_tasks SET status='completed',completed_at=now(),thread_id=target_thread_id WHERE id=target_task_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_instructor_chat_task(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_instructor_chat_task(UUID,UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_instructor_chat_task_notifications(target_student_id UUID)
RETURNS SETOF public.instructor_chat_tasks LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.instructor_chat_tasks t SET notification_status='processing'
 WHERE id IN (SELECT id FROM public.instructor_chat_tasks WHERE student_id=target_student_id
  AND status='pending' AND notification_status='pending' FOR UPDATE SKIP LOCKED)
 RETURNING t.*;
$$;
REVOKE ALL ON FUNCTION public.claim_instructor_chat_task_notifications(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instructor_chat_task_notifications(UUID) TO service_role;

COMMIT;
