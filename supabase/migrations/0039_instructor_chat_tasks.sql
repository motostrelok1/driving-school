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
