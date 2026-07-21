-- Usernames must be unique across users, case-insensitively ("John" == "john").
-- Partial index so the many existing NULL usernames don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_ci
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Availability check for the signup/profile form. SECURITY DEFINER so an
-- authenticated user can test a name without being able to read other users'
-- rows (it only ever returns a boolean). Excludes the caller's own row so
-- keeping your current nickname doesn't read as "taken".
CREATE OR REPLACE FUNCTION public.is_username_available(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(trim(candidate))
      AND user_id <> auth.uid()
  );
$$;
