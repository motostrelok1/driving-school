CREATE TABLE IF NOT EXISTS public.instructor_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instructor_id, student_id)
);

ALTER TABLE public.instructor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read instructor reviews" ON public.instructor_reviews;
CREATE POLICY "Authenticated users can read instructor reviews"
  ON public.instructor_reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Students can review after completed practice lesson" ON public.instructor_reviews;
CREATE POLICY "Students can review after completed practice lesson"
  ON public.instructor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.lessons
      WHERE lessons.student_id = auth.uid()
        AND lessons.instructor_id = instructor_reviews.instructor_id
        AND lessons.type = 'practice'
        AND lessons.status = 'completed'
    )
  );

DROP POLICY IF EXISTS "Students can update own instructor review" ON public.instructor_reviews;
CREATE POLICY "Students can update own instructor review"
  ON public.instructor_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.lessons
      WHERE lessons.student_id = auth.uid()
        AND lessons.instructor_id = instructor_reviews.instructor_id
        AND lessons.type = 'practice'
        AND lessons.status = 'completed'
    )
  );
