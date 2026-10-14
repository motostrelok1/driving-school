-- Archive admin-created driving chats permanently when an instructor assignment ends.
-- All participants retain read-only history; archived chats can never be reopened.
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- The old 0040 trigger deleted instructor membership. Replace it with archival.
DROP TRIGGER IF EXISTS trg_revoke_former_instructor_chat_access ON public.instructor_students;

CREATE OR REPLACE FUNCTION public.archive_driving_chat_after_unassignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE'
     AND OLD.student_id IS NOT DISTINCT FROM NEW.student_id
     AND OLD.instructor_id IS NOT DISTINCT FROM NEW.instructor_id THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.instructor_students
    WHERE student_id=OLD.student_id AND instructor_id=OLD.instructor_id
  ) THEN
    UPDATE public.message_threads mt SET closed_at=COALESCE(mt.closed_at,now())
    FROM public.instructor_chat_tasks t
    WHERE t.thread_id=mt.id AND t.status='completed'
      AND t.student_id=OLD.student_id AND t.instructor_id=OLD.instructor_id
      AND mt.closed_at IS NULL;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_driving_chat_after_unassignment() FROM PUBLIC;
CREATE TRIGGER trg_archive_driving_chat_after_unassignment
 AFTER DELETE OR UPDATE OF student_id,instructor_id ON public.instructor_students
 FOR EACH ROW EXECUTE FUNCTION public.archive_driving_chat_after_unassignment();

-- Repair chats where 0040 previously removed the former instructor.
-- Close all completed chats whose original instructor is no longer assigned.
UPDATE public.message_threads mt SET closed_at=COALESCE(mt.closed_at,now())
FROM public.instructor_chat_tasks t
WHERE t.thread_id=mt.id AND t.status='completed'
 AND NOT EXISTS (SELECT 1 FROM public.instructor_students isr
  WHERE isr.student_id=t.student_id AND isr.instructor_id=t.instructor_id)
 AND mt.closed_at IS NULL;

INSERT INTO public.message_thread_participants(thread_id,user_id)
SELECT DISTINCT t.thread_id,t.instructor_id FROM public.instructor_chat_tasks t
JOIN public.message_threads mt ON mt.id=t.thread_id
WHERE t.status='completed' AND t.thread_id IS NOT NULL AND mt.closed_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Enforce read-only history even for service-role writers.
CREATE OR REPLACE FUNCTION public.reject_archived_thread_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.thread_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.message_threads WHERE id=NEW.thread_id AND closed_at IS NOT NULL
 ) THEN
   RAISE EXCEPTION 'Conversation is archived and read-only';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_archived_thread_message() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_reject_archived_thread_message ON public.messages;
CREATE TRIGGER trg_reject_archived_thread_message
 BEFORE INSERT ON public.messages
 FOR EACH ROW EXECUTE FUNCTION public.reject_archived_thread_message();

-- An admin may reuse only an ACTIVE chat of the currently assigned pair.
CREATE OR REPLACE FUNCTION public.create_admin_student_instructor_chat(
 target_student_id UUID,target_instructor_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_thread_id UUID; initial_message_id UUID; student_name TEXT; instructor_name TEXT;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
   RAISE EXCEPTION 'Only an administrator can create a conversation';
 END IF;
 SELECT full_name INTO student_name FROM public.profiles WHERE id=target_student_id AND role='student';
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
 SELECT full_name INTO instructor_name FROM public.profiles WHERE id=target_instructor_id AND role='instructor';
 IF NOT FOUND THEN RAISE EXCEPTION 'Instructor not found'; END IF;
 -- Lock before checking the assignment so parallel calls are serialized.
 PERFORM pg_advisory_xact_lock(hashtextextended(target_student_id::text || ':' || target_instructor_id::text,0));
 IF NOT EXISTS (SELECT 1 FROM public.instructor_students
  WHERE student_id=target_student_id AND instructor_id=target_instructor_id)
 THEN RAISE EXCEPTION 'Instructor is not assigned to this student'; END IF;

 SELECT mt.id INTO new_thread_id
 FROM public.message_threads mt
 JOIN public.instructor_chat_tasks t ON t.thread_id=mt.id AND t.status='completed'
 WHERE t.student_id=target_student_id AND t.instructor_id=target_instructor_id
  AND mt.closed_at IS NULL
 ORDER BY mt.created_at DESC LIMIT 1;
 IF FOUND THEN RETURN new_thread_id; END IF;

 INSERT INTO public.message_threads(subject,created_by,is_group)
 VALUES ('Вождение: ' || COALESCE(student_name,'Ученик') || ' — ' ||
   COALESCE(instructor_name,'Инструктор'),auth.uid(),true)
 RETURNING id INTO new_thread_id;
 INSERT INTO public.message_thread_participants(thread_id,user_id)
 VALUES (new_thread_id,target_student_id),(new_thread_id,target_instructor_id);
 INSERT INTO public.messages(thread_id,sender_id,body,message_type,allow_reply)
 VALUES (new_thread_id,auth.uid(),'Переписка с администратором и инструктором открыта.','message',true)
 RETURNING id INTO initial_message_id;
 INSERT INTO public.message_recipients(message_id,recipient_id,delivery_status,sent_at)
 VALUES (initial_message_id,target_student_id,'sent',now()),
        (initial_message_id,target_instructor_id,'sent',now());
 RETURN new_thread_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_admin_student_instructor_chat(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_student_instructor_chat(UUID,UUID) TO authenticated;
