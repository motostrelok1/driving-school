-- Notification statistics for admin history filters and delivery overview.

DROP FUNCTION IF EXISTS public.get_admin_notification_threads();

CREATE FUNCTION public.get_admin_notification_threads()
RETURNS TABLE (
  thread_id UUID,
  subject TEXT,
  is_group BOOLEAN,
  recipient_ids UUID[],
  recipient_names TEXT[],
  body TEXT,
  created_at TIMESTAMPTZ,
  recipient_count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  opened_count BIGINT,
  error_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mt.id,
    mt.subject,
    (mt.is_group OR COUNT(DISTINCT mr.recipient_id) > 1) AS is_group,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT mr.recipient_id), NULL),
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.full_name ORDER BY p.full_name), NULL),
    MAX(m.body) FILTER (WHERE m.message_type = 'notification'),
    MAX(m.created_at),
    COUNT(DISTINCT mr.recipient_id),
    COUNT(*) FILTER (WHERE mr.delivery_status IN ('sent', 'delivered')),
    COUNT(*) FILTER (WHERE mr.delivery_status = 'delivered'),
    COUNT(*) FILTER (WHERE mr.opened_at IS NOT NULL),
    COUNT(*) FILTER (WHERE mr.delivery_status = 'error')
  FROM public.message_threads mt
  JOIN public.messages m
    ON m.thread_id = mt.id
   AND m.message_type = 'notification'
  JOIN public.message_recipients mr
    ON mr.message_id = m.id
  LEFT JOIN public.profiles p
    ON p.id = mr.recipient_id
  WHERE public.is_admin(auth.uid())
  GROUP BY mt.id, mt.subject, mt.is_group
  ORDER BY MAX(m.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_notification_threads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_notification_threads() TO authenticated;
