-- Admin user directory: store email on profiles, let staff read/update every
-- profile, and support an admin-proposed Day 1 change the user must approve.

-- 1. Emails on profiles. auth.users isn't readable from the client, so the
--    admin directory needs email mirrored here. Backfill existing rows.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id AND p.email IS DISTINCT FROM u.email;

-- Keep email populated for new signups (extends the existing profile trigger).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. A Day 1 date an admin proposes, awaiting the user's approval on next login.
--    Null means nothing is pending.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_challenge_start_date DATE;

-- 3. Staff check as SECURITY DEFINER so a policy ON profiles can consult
--    profiles without tripping RLS recursion.
CREATE OR REPLACE FUNCTION public.is_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'dev')
  );
$$;

-- 4. Let staff read and update every profile (the directory + Day 1 proposals).
--    Users keep their own owner-only policies; these are additive (OR'd).
DROP POLICY IF EXISTS "Admins and devs can view all profiles" ON public.profiles;
CREATE POLICY "Admins and devs can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin_or_dev());

DROP POLICY IF EXISTS "Admins and devs can update all profiles" ON public.profiles;
CREATE POLICY "Admins and devs can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin_or_dev())
  WITH CHECK (public.is_admin_or_dev());
