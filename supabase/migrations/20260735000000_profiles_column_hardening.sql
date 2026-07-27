-- Harden the sensitive profile columns.
--
-- The "Users can update their own profile" policy is row-level, so a user could
-- previously UPDATE their own access_level / role / premium_trial_started_at and
-- self-grant premium or admin. Lock those columns down with column-level
-- privileges and route the only legitimate writes through SECURITY DEFINER
-- functions (which run as the table owner and bypass the revoke).

-- ---------------------------------------------------------------------------
-- Server-side access-level sync (replaces the client's resolve-and-write).
-- Mirrors resolveEffectiveAccessLevel: an active trial, staff role, or an active
-- allowlist premium entry => premium; otherwise free. A missing email or a staff
-- account keeps its current level (never demoted by a lookup gap).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_my_access_level()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT;
  v_role TEXT;
  v_trial TIMESTAMPTZ;
  v_current TEXT;
  v_level TEXT;
  v_has_allow BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email), role, premium_trial_started_at, access_level
    INTO v_email, v_role, v_trial, v_current
    FROM public.profiles WHERE user_id = v_user;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_trial IS NOT NULL AND now() < v_trial + INTERVAL '7 days' THEN
    v_level := 'premium';
  ELSIF v_email IS NULL THEN
    v_level := v_current; -- can't check the allowlist; leave as-is
  ELSIF EXISTS (
    SELECT 1 FROM public.premium_allowlist a
    WHERE lower(a.email) = v_email
      AND a.is_active IS NOT FALSE
      AND lower(a.access_level) = 'premium'
  ) THEN
    v_level := 'premium';
  ELSIF v_role IN ('admin', 'dev') THEN
    v_level := v_current; -- staff premium comes from role, keep stored level
  ELSE
    v_level := 'free';
  END IF;

  IF v_level IS DISTINCT FROM v_current THEN
    UPDATE public.profiles SET access_level = v_level WHERE user_id = v_user;
  END IF;
  RETURN v_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_my_access_level() TO authenticated;

-- ---------------------------------------------------------------------------
-- Founding admin — was a client-side upsert (which self-set role='admin').
-- Now applied server-side by a trigger on the profile row, plus a one-time
-- backfill for the existing row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_founding_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'gordongaming13@gmail.com' THEN
    NEW.role := 'admin';
    NEW.access_level := 'premium';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_founding_admin_trg ON public.profiles;
CREATE TRIGGER grant_founding_admin_trg
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_founding_admin();

UPDATE public.profiles
  SET role = 'admin', access_level = 'premium'
  WHERE lower(email) = 'gordongaming13@gmail.com';

-- ---------------------------------------------------------------------------
-- Lock the sensitive columns from direct client writes. Definer functions and
-- triggers (running as the owner) can still write them; the signup trigger
-- (handle_new_user) and ProfileSetup only touch other columns, so nothing legit
-- breaks. Admin premium grants flow through premium_allowlist, not these columns.
-- ---------------------------------------------------------------------------
REVOKE INSERT (access_level, role, premium_trial_started_at) ON public.profiles FROM authenticated;
REVOKE UPDATE (access_level, role, premium_trial_started_at) ON public.profiles FROM authenticated;
