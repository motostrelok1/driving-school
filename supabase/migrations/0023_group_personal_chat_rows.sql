-- Collapse historical one-to-one threads into one logical chat row per user.

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
  WITH personal_threads AS (
    SELECT
      p.user_id,
      pr.full_name,
      mt.id AS thread_id,
      mt.subject,
      lm.body AS last_message,
      lm.created_at AS last_at,
      (
        SELECT COUNT(*)
        FROM public.message_recipients mr
        JOIN public.messages um ON um.id = mr.message_id
        WHERE um.thread_id = mt.id
          AND mr.recipient_id = auth.uid()
          AND mr.opened_at IS NULL
      ) AS unread_count
    FROM public.message_threads mt
    JOIN public.message_thread_participants p ON p.thread_id = mt.id
    JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT m.body, m.created_at
      FROM public.messages m
      WHERE m.thread_id = mt.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true
    WHERE public.is_admin(auth.uid())
      AND mt.is_group = false
  ),
  personal_grouped AS (
    SELECT DISTINCT ON (user_id)
      thread_id,
      COALESCE(full_name, subject) AS subject,
      false AS is_group,
      ARRAY[user_id] AS participant_ids,
      ARRAY[full_name] AS participant_names,
      last_message,
      last_at,
      SUM(unread_count) OVER (PARTITION BY user_id) AS unread_count
    FROM personal_threads
    ORDER BY user_id, last_at DESC NULLS LAST
  ),
  group_threads AS (
    SELECT
      mt.id AS thread_id,
      mt.subject,
      true AS is_group,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.user_id), NULL) AS participant_ids,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT pr.full_name), NULL) AS participant_names,
      lm.body AS last_message,
      lm.created_at AS last_at,
      (
        SELECT COUNT(*)
        FROM public.message_recipients mr
        JOIN public.messages um ON um.id = mr.message_id
        WHERE um.thread_id = mt.id
          AND mr.recipient_id = auth.uid()
          AND mr.opened_at IS NULL
      ) AS unread_count
    FROM public.message_threads mt
    LEFT JOIN public.message_thread_participants p ON p.thread_id = mt.id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT m.body, m.created_at
      FROM public.messages m
      WHERE m.thread_id = mt.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true
    WHERE public.is_admin(auth.uid())
      AND mt.is_group = true
    GROUP BY mt.id, mt.subject, lm.body, lm.created_at
  )
  SELECT * FROM personal_grouped
  UNION ALL
  SELECT * FROM group_threads
  ORDER BY last_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_admin_chat_threads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_chat_threads() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_personal_conversation(target_user_id UUID)
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
  JOIN public.message_threads mt ON mt.id = m.thread_id
  JOIN public.message_thread_participants tp ON tp.thread_id = mt.id
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE public.is_admin(auth.uid())
    AND mt.is_group = false
    AND tp.user_id = target_user_id
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_admin_personal_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_personal_conversation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_admin_personal_chat_opened(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.message_recipients mr
  SET opened_at = COALESCE(mr.opened_at, now())
  FROM public.messages m
  JOIN public.message_threads mt ON mt.id = m.thread_id
  JOIN public.message_thread_participants tp ON tp.thread_id = mt.id
  WHERE mr.message_id = m.id
    AND mr.recipient_id = auth.uid()
    AND mt.is_group = false
    AND tp.user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_admin_personal_chat_opened(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_admin_personal_chat_opened(UUID) TO authenticated;
