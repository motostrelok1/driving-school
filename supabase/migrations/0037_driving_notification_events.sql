-- Immutable snapshot of booking/cancellation transitions for authenticated student notifications.
CREATE TABLE public.driving_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.driving_slots(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id),
  start_at TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('booked', 'cancelled')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX driving_notification_events_pending_idx
  ON public.driving_notification_events (student_id, status, created_at);
ALTER TABLE public.driving_notification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driving_notification_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_driving_slot_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'booked' AND OLD.student_id IS NOT NULL
     AND (NEW.status <> 'booked' OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
    INSERT INTO public.driving_notification_events(student_id, slot_id, instructor_id, start_at, event_type)
    VALUES (OLD.student_id, OLD.id, OLD.instructor_id, OLD.start_at, 'cancelled');
  END IF;
  IF NEW.status = 'booked' AND NEW.student_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'booked'
       OR OLD.student_id IS DISTINCT FROM NEW.student_id) THEN
    INSERT INTO public.driving_notification_events(student_id, slot_id, instructor_id, start_at, event_type)
    VALUES (NEW.student_id, NEW.id, NEW.instructor_id, NEW.start_at, 'booked');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_driving_slot_notification ON public.driving_slots;
CREATE TRIGGER trg_driving_slot_notification
AFTER INSERT OR UPDATE ON public.driving_slots
FOR EACH ROW EXECUTE FUNCTION public.queue_driving_slot_notification();
REVOKE ALL ON FUNCTION public.queue_driving_slot_notification() FROM PUBLIC;
