-- Track automatic driving lesson reminders and prevent duplicates.

CREATE TABLE IF NOT EXISTS public.driving_lesson_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.driving_slots(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT '24h',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS driving_lesson_reminders_student_idx
  ON public.driving_lesson_reminders(student_id, sent_at DESC);

ALTER TABLE public.driving_lesson_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.driving_lesson_reminders FROM PUBLIC;
REVOKE ALL ON public.driving_lesson_reminders FROM authenticated;

COMMENT ON TABLE public.driving_lesson_reminders IS
  'Idempotency log for automatic reminders about upcoming driving lessons.';
