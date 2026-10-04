-- Message and notification storage foundation
-- Supabase is the source of truth; OneSignal is only the push transport.

CREATE TABLE public.message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  message_type TEXT NOT NULL DEFAULT 'notification'
    CHECK (message_type IN ('notification', 'message')),
  allow_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT replyable_messages_are_messages
    CHECK (NOT allow_reply OR message_type = 'message')
);

CREATE TABLE public.message_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_status TEXT NOT NULL DEFAULT 'sending'
    CHECK (delivery_status IN ('sending', 'sent', 'delivered', 'error')),
  onesignal_notification_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, recipient_id)
);

CREATE INDEX message_threads_created_by_idx ON public.message_threads(created_by);
CREATE INDEX messages_thread_created_idx ON public.messages(thread_id, created_at);
CREATE INDEX messages_sender_idx ON public.messages(sender_id);
CREATE INDEX message_recipients_recipient_created_idx
  ON public.message_recipients(recipient_id, created_at DESC);
CREATE INDEX message_recipients_message_idx ON public.message_recipients(message_id);
CREATE INDEX message_recipients_unread_idx
  ON public.message_recipients(recipient_id, opened_at)
  WHERE opened_at IS NULL;

DROP TRIGGER IF EXISTS set_message_threads_updated_at ON public.message_threads;
CREATE TRIGGER set_message_threads_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_message_recipients_updated_at ON public.message_recipients;
CREATE TRIGGER set_message_recipients_updated_at
  BEFORE UPDATE ON public.message_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

-- Admins can manage the whole messaging system.
CREATE POLICY "Admins can manage message threads"
  ON public.message_threads FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage messages"
  ON public.messages FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage message recipients"
  ON public.message_recipients FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Recipients can read only messages addressed to them.
CREATE POLICY "Recipients can read own message recipients"
  ON public.message_recipients FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Recipients can read own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_recipients mr
      WHERE mr.message_id = messages.id
        AND mr.recipient_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can read own message threads"
  ON public.message_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.message_recipients mr ON mr.message_id = m.id
      WHERE m.thread_id = message_threads.id
        AND mr.recipient_id = auth.uid()
    )
  );

-- A recipient may only mark their own message as opened.
-- Other delivery fields remain server/admin managed.
CREATE OR REPLACE FUNCTION public.mark_message_opened(target_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_recipients
  SET opened_at = COALESCE(opened_at, now())
  WHERE message_id = target_message_id
    AND recipient_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_message_opened(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_message_opened(UUID) TO authenticated;
