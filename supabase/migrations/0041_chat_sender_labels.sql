-- Return sender names and roles only for conversations the current user is allowed to read.
-- Keep legacy get_my_conversation unchanged for existing clients.
CREATE OR REPLACE FUNCTION public.get_my_conversation_with_senders(target_thread_id UUID)
RETURNS TABLE (
  message_id UUID,
  sender_id UUID,
  body TEXT,
  created_at TIMESTAMPTZ,
  allow_reply BOOLEAN,
  sender_name TEXT,
  sender_role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.body, m.created_at, m.allow_reply,
         p.full_name::text, p.role::text
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.thread_id = target_thread_id
    AND (
      EXISTS (
        SELECT 1 FROM public.message_thread_participants participant
        WHERE participant.thread_id = target_thread_id
          AND participant.user_id = auth.uid()
      )
      OR public.is_admin(auth.uid())
    )
  ORDER BY m.created_at, m.id;
$$;
REVOKE ALL ON FUNCTION public.get_my_conversation_with_senders(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_conversation_with_senders(UUID) TO authenticated;
