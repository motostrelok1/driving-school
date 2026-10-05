-- Reply-enabled messages and conversation RPCs.

CREATE OR REPLACE FUNCTION public.send_reply(target_thread_id UUID, reply_body TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_message public.messages%ROWTYPE;
  new_message_id UUID;
  admin_id UUID;
BEGIN
  IF length(btrim(reply_body)) = 0 THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  SELECT m.*
  INTO parent_message
  FROM public.messages m
  JOIN public.message_recipients mr ON mr.message_id = m.id
  WHERE m.thread_id = target_thread_id
    AND mr.recipient_id = auth.uid()
    AND m.message_type = 'message'
    AND m.allow_reply = true
  ORDER BY m.created_at
  LIMIT 1;

  IF parent_message.id IS NULL THEN
    RAISE EXCEPTION 'Reply is not allowed';
  END IF;

  SELECT mt.created_by INTO admin_id
  FROM public.message_threads mt
  WHERE mt.id = target_thread_id;

  INSERT INTO public.messages (thread_id, sender_id, body, message_type, allow_reply)
  VALUES (target_thread_id, auth.uid(), btrim(reply_body), 'message', true)
  RETURNING id INTO new_message_id;

  IF admin_id IS NOT NULL THEN
    INSERT INTO public.message_recipients (message_id, recipient_id, delivery_status, sent_at)
    VALUES (new_message_id, admin_id, 'sent', now());
  END IF;

  UPDATE public.message_threads SET updated_at = now() WHERE id = target_thread_id;
  RETURN new_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_reply(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_reply(UUID, TEXT) TO authenticated;

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
      m.sender_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.message_recipients mr
        WHERE mr.message_id = m.id AND mr.recipient_id = auth.uid()
      )
    )
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_my_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_conversation(UUID) TO authenticated;
