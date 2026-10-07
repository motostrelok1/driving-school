-- Control access to the student driving section.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driving_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the currently available driving section for existing students.
UPDATE public.profiles
SET driving_enabled = TRUE
WHERE role = 'student';

COMMENT ON COLUMN public.profiles.driving_enabled IS
  'Whether the student has access to the driving section.';
