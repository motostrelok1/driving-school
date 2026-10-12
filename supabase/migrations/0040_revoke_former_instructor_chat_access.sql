-- Revoke access to admin-created driving conversations when a student's instructor is unassigned.
-- Past messages remain in the former instructor's notification history if already addressed to them,
-- but the former instructor can no longer read the thread or send new replies.
CREATE OR REPLACE FUNCTION public.revoke_former_instructor_chat_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On UPDATE, only act when the instructor/student pair actually changes.
  IF TG_OP = 'UPDATE'
     AND OLD.student_id IS NOT DISTINCT FROM NEW.student_id
     AND OLD.instructor_id IS NOT DISTINCT FROM NEW.instructor_id THEN
    RETURN NEW;
  END IF;

  -- Preserve access if the same assignment still exists (e.g. duplicate rows).
  IF EXISTS (
    SELECT 1 FROM public.instructor_students
    WHERE student_id = OLD.student_id AND instructor_id = OLD.instructor_id
  ) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Scope revocation strictly to conversations created through admin chat tasks.
  -- Do not alter unrelated personal chats or group conversations.
  DELETE FROM public.message_thread_participants p
  USING public.instructor_chat_tasks task
  WHERE task.thread_id = p.thread_id
    AND task.student_id = OLD.student_id
    AND task.instructor_id = OLD.instructor_id
    AND task.status = 'completed'
    AND p.user_id = OLD.instructor_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_former_instructor_chat_access() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_revoke_former_instructor_chat_access ON public.instructor_students;
CREATE TRIGGER trg_revoke_former_instructor_chat_access
  AFTER DELETE OR UPDATE OF student_id, instructor_id ON public.instructor_students
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_former_instructor_chat_access();
