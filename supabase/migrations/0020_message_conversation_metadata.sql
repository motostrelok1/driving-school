-- Extend fast message list with conversation metadata.
DROP FUNCTION IF EXISTS public.get_my_messages();

CREATE FUNCTION public.get_my_messages()
RETURNS TABLE (
  recipient_id UUID,
  message_id UUID,
  delivery_status TEXT,
  created_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  body TEXT,
  message_created_at TIMESTAMPTZ,
  subject TEXT,
  thread_id UUID,
  message_type TEXT,
  allow_reply BOOLEAN,
  sender_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mr.id, mr.message_id, mr.delivery_status, mr.created_at, mr.opened_at,
    m.body, m.created_at, mt.subject, m.thread_id, m.message_type, m.allow_reply, m.sender_id
  FROM public.message_recipients mr
  JOIN public.messages m ON m.id = mr.message_id
  LEFT JOIN public.message_threads mt ON mt.id = m.thread_id
  WHERE mr.recipient_id = auth.uid()
  ORDER BY mr.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_messages() TO authenticated;
