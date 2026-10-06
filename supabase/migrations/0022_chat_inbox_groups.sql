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
