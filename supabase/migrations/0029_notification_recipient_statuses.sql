-- Per-recipient delivery/read status for admin notification details.

CREATE OR REPLACE FUNCTION public.get_admin_notification_recipient_statuses(target_thread_id UUID)
RETURNS TABLE (
  recipient_id UUID,
  recipient_name TEXT,
  delivery_status TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.recipient_id,
    p.full_name,
    mr.delivery_status,
    mr.sent_at,
    mr.delivered_at,
    mr.opened_at,
    mr.error_message
  FROM public.message_threads mt
  JOIN public.messages m
    ON m.thread_id = mt.id
   AND m.message_type = 'notification'
  JOIN public.message_recipients mr
    ON mr.message_id = m.id
  LEFT JOIN public.profiles p
    ON p.id = mr.recipient_id
  WHERE mt.id = target_thread_id
    AND public.is_admin(auth.uid())
  ORDER BY COALESCE(p.full_name, mr.recipient_id::text);
$$;

REVOKE ALL ON FUNCTION public.get_admin_notification_recipient_statuses(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_notification_recipient_statuses(UUID) TO authenticated;
