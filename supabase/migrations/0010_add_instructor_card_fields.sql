ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instructor_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS instructor_age INTEGER,
  ADD COLUMN IF NOT EXISTS instructor_rating NUMERIC(2, 1),
  ADD COLUMN IF NOT EXISTS instructor_car TEXT,
  ADD COLUMN IF NOT EXISTS instructor_car_year INTEGER,
  ADD COLUMN IF NOT EXISTS instructor_car_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS instructor_reviews_rating NUMERIC(2, 1),
  ADD COLUMN IF NOT EXISTS instructor_review_text TEXT;
