-- Fast recipient message history without nested PostgREST RLS joins.
CREATE OR REPLACE FUNCTION public.get_my_messages()
RETURNS TABLE (
  recipient_id UUID,
  message_id UUID,
  delivery_status TEXT,
  created_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  body TEXT,
  message_created_at TIMESTAMPTZ,
  subject TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.id,
    mr.message_id,
    mr.delivery_status,
    mr.created_at,
    mr.opened_at,
    m.body,
    m.created_at,
    mt.subject
  FROM public.message_recipients mr
  JOIN public.messages m ON m.id = mr.message_id
  LEFT JOIN public.message_threads mt ON mt.id = m.thread_id
  WHERE mr.recipient_id = auth.uid()
  ORDER BY mr.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_messages() TO authenticated;
