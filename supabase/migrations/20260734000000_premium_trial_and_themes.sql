-- Cosmetic themes + a one-time 7-day premium trial.
--
-- Themes are a premium perk: free users get the basic palettes, premium unlocks
-- the rest. The selected theme is stored per-profile; premium-only themes fall
-- back to the default at render time when the user isn't premium (so a theme
-- picked during a trial reverts automatically once the trial ends).

-- Selected cosmetic theme key (from the client theme catalog in src/lib/themes.ts).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'oak';

-- When the one-time 7-day premium trial was started. NULL = never started.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_trial_started_at TIMESTAMPTZ;

-- Premium now also covers an active trial window (7 days from the start). Staff
-- and paid (access_level='premium') users are premium as before.
CREATE OR REPLACE FUNCTION public.is_premium_user(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user
      AND (
        access_level = 'premium'
        OR role IN ('admin', 'dev')
        OR (premium_trial_started_at IS NOT NULL
            AND now() < premium_trial_started_at + INTERVAL '7 days')
      )
  );
$$;

-- Start the one-time trial: stamps the start only if it was never set before,
-- so it can't be reset/re-rolled. Returns the effective start timestamp.
CREATE OR REPLACE FUNCTION public.start_premium_trial()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_started TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT premium_trial_started_at INTO v_started
    FROM public.profiles WHERE user_id = v_user FOR UPDATE;

  IF v_started IS NULL THEN
    UPDATE public.profiles SET premium_trial_started_at = now()
      WHERE user_id = v_user
      RETURNING premium_trial_started_at INTO v_started;
  END IF;

  RETURN v_started;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_premium_trial() TO authenticated;
