DROP POLICY IF EXISTS "Students can release own future driving slots" ON public.driving_slots;
CREATE POLICY "Students can release own future driving slots"
  ON public.driving_slots FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    AND status = 'booked'
    AND start_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow')
  )
  WITH CHECK (
    student_id IS NULL
    AND status = 'open'
  );
