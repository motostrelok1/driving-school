-- Admin conversation RPC: return a full thread only to admins.
CREATE OR REPLACE FUNCTION public.get_admin_conversation(target_thread_id UUID)
RETURNS TABLE (
  message_id UUID,
  sender_id UUID,
  sender_name TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  allow_reply BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, p.full_name, m.body, m.created_at, m.allow_reply
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.thread_id = target_thread_id
    AND public.is_admin(auth.uid())
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_admin_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_conversation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reply_to_thread(target_thread_id UUID, reply_body TEXT, target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_message_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(btrim(reply_body)) = 0 THEN RAISE EXCEPTION 'Message body is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE thread_id = target_thread_id AND message_type = 'message') THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  INSERT INTO public.messages (thread_id, sender_id, body, message_type, allow_reply)
  VALUES (target_thread_id, auth.uid(), btrim(reply_body), 'message', true)
  RETURNING id INTO new_message_id;

  INSERT INTO public.message_recipients (message_id, recipient_id, delivery_status, sent_at)
  VALUES (new_message_id, target_user_id, 'sent', now());

  UPDATE public.message_threads SET updated_at = now() WHERE id = target_thread_id;
  RETURN new_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reply_to_thread(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reply_to_thread(UUID, TEXT, UUID) TO authenticated;
