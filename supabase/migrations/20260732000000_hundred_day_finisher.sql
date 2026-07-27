-- 100-Day Finisher
--
-- Finishing the 100-day challenge earns a permanent golden star and starts a
-- fresh run: the trophy case resets while XP and levels keep accumulating for
-- the life of the account. Every finished run is archived (stats + the trophies
-- that were on the shelf at the time) so it can be re-opened from the star.

-- 1. Profile counters. `finisher_count` = golden stars beside the name.
--    `current_run` = which run the live trophy case belongs to (1-based).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS finisher_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_run INTEGER NOT NULL DEFAULT 1;

-- 2. Trophies become per-run. Existing rows belong to run 1, so the uniqueness
--    rule widens from (user, badge) to (user, run, badge): a badge unlocks —
--    and pays out its XP — once per run instead of once per account.
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS run_index INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_user_id_achievement_key_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.achievements'::regclass
      AND conname = 'achievements_user_run_key_uniq'
  ) THEN
    ALTER TABLE public.achievements
      ADD CONSTRAINT achievements_user_run_key_uniq UNIQUE (user_id, run_index, achievement_key);
  END IF;
END $$;

-- 3. The finisher archive: one row per completed 100-day run. `summary` holds
--    the Day 1 vs Day 100 numbers, `badges` the trophy case as it stood.
CREATE TABLE IF NOT EXISTS public.hundred_day_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, run_number)
);

ALTER TABLE public.hundred_day_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hundred_day_runs'
      AND policyname = 'Users can view their own finished runs'
  ) THEN
    CREATE POLICY "Users can view their own finished runs"
      ON public.hundred_day_runs FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Finishing is one transaction: archive the run, award the star, roll the
--    trophy season over, and re-base the profile onto the next Day 1. Written
--    as a SECURITY DEFINER RPC so a half-applied restart is impossible, and so
--    a legitimate restart bypasses the 30-day starting-data lock.
CREATE OR REPLACE FUNCTION public.finish_hundred_day_run(
  p_start_date DATE,
  p_end_date DATE,
  p_summary JSONB,
  p_badges JSONB,
  p_new_start DATE,
  p_current_weight NUMERIC,
  p_goal_type TEXT,
  p_target_weight NUMERIC,
  p_target_weight_min NUMERIC,
  p_target_weight_max NUMERIC,
  p_calorie_target INTEGER,
  p_calorie_min INTEGER,
  p_calorie_max INTEGER,
  p_protein_target INTEGER,
  p_protein_min INTEGER,
  p_protein_max INTEGER,
  p_water_target INTEGER,
  p_steps_target INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_run INTEGER;
  v_archived UUID;
  v_stars INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT current_run INTO v_run FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'No profile for this user';
  END IF;

  INSERT INTO public.hundred_day_runs (user_id, run_number, start_date, end_date, summary, badges)
  VALUES (
    v_user, v_run, p_start_date, p_end_date,
    COALESCE(p_summary, '{}'::jsonb), COALESCE(p_badges, '[]'::jsonb)
  )
  ON CONFLICT (user_id, run_number) DO NOTHING
  RETURNING id INTO v_archived;

  -- This run was already archived (double submit / retry after a dropped
  -- response): leave the star count and the profile exactly as they are.
  IF v_archived IS NULL THEN
    SELECT finisher_count INTO v_stars FROM public.profiles WHERE user_id = v_user;
    RETURN v_stars;
  END IF;

  UPDATE public.profiles SET
    finisher_count           = finisher_count + 1,
    current_run              = current_run + 1,
    challenge_start_date     = p_new_start,
    current_weight           = p_current_weight,
    goal_type                = COALESCE(p_goal_type, goal_type),
    target_weight            = p_target_weight,
    target_weight_min        = p_target_weight_min,
    target_weight_max        = p_target_weight_max,
    daily_calorie_target     = p_calorie_target,
    daily_calorie_target_min = p_calorie_min,
    daily_calorie_target_max = p_calorie_max,
    daily_protein_target     = p_protein_target,
    daily_protein_target_min = p_protein_min,
    daily_protein_target_max = p_protein_max,
    daily_water_target       = p_water_target,
    daily_steps_target       = p_steps_target,
    -- The new run starts from a new baseline, so weight milestones re-arm.
    last_celebrated_weight   = NULL,
    starting_data_updated_at = now()
  WHERE user_id = v_user
  RETURNING finisher_count INTO v_stars;

  -- Seed the new Day 1 with the starting weight, without clobbering anything
  -- the user may have already logged on that date.
  INSERT INTO public.daily_logs (user_id, date, day_number, weight)
  VALUES (v_user, p_new_start, 1, p_current_weight)
  ON CONFLICT (user_id, date) DO UPDATE
    SET weight = EXCLUDED.weight, day_number = 1;

  RETURN v_stars;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_hundred_day_run(
  DATE, DATE, JSONB, JSONB, DATE, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC,
  INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
) TO authenticated;
