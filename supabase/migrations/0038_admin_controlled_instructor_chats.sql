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
