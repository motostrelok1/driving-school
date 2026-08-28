ALTER TABLE public.driving_slots
  DROP CONSTRAINT IF EXISTS driving_slots_status_check;

ALTER TABLE public.driving_slots
  ADD CONSTRAINT driving_slots_status_check
  CHECK (status IN ('open', 'booked', 'reserved', 'cancelled'));
