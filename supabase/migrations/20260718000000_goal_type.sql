-- Goal type for the challenge: "lose" (target below current weight) or
-- "maintain" (target within ±1% of current weight). Stored explicitly because
-- the two allowed target-weight ranges overlap, so the intent can't be
-- reliably derived from the numbers alone — and each drives a different
-- calorie-target formula.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_type TEXT NOT NULL DEFAULT 'lose'
    CHECK (goal_type IN ('lose', 'maintain'));
