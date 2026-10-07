-- Store OneSignal Event Stream events for idempotent delivery tracking.

CREATE TABLE IF NOT EXISTS public.onesignal_message_events (
  event_id UUID PRIMARY KEY,
  event_kind TEXT NOT NULL,
  onesignal_message_id TEXT NOT NULL,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id TEXT,
  device_type TEXT,
  event_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onesignal_message_events_message_idx
  ON public.onesignal_message_events(onesignal_message_id);

CREATE INDEX IF NOT EXISTS onesignal_message_events_recipient_idx
  ON public.onesignal_message_events(recipient_id, event_at DESC);

ALTER TABLE public.onesignal_message_events ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: this table is written only by the server-side
-- Event Stream endpoint using the service-role key.
