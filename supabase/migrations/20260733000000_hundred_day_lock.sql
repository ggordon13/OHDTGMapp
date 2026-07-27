-- Locking in Day 100
--
-- Week 15 (Days 99–100) would normally only be scored once Day 100 is over.
-- Locking in lets the user close the books on Day 100 itself: they declare the
-- run finished, Days 1–100 become read-only, and every week — Week 15 included
-- — is scored from that moment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS run_locked_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.run_locked_at IS
  'When the current 100-day run was locked in. Non-null means Days 1-100 are final and the run is scored as complete. Cleared when the next run starts.';

-- Rolling into the next run clears the lock, so the fresh Day 1 is editable
-- again. Same body as before otherwise.
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
    -- ...and its days are editable again.
    run_locked_at            = NULL,
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
