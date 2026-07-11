CREATE OR REPLACE FUNCTION public.account_email_exists(email_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(trim(email_to_check))
  );
$$;

REVOKE ALL ON FUNCTION public.account_email_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_email_exists(TEXT) TO anon, authenticated;
