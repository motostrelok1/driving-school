-- Persist contact phone from auth metadata for newly registered users.
-- Existing users are left unchanged and can be updated by an administrator.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role TEXT;
  default_full_name TEXT;
  default_phone TEXT;
BEGIN
  default_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  default_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  default_phone := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');

  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (NEW.id, default_role, default_full_name, default_phone)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
