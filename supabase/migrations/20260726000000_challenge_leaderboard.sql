-- Challenge leaderboard: per-participant aggregates over the challenge's date
-- window. SECURITY DEFINER so it can read every member's logs/XP, but gated on
-- membership and returns only aggregates (never raw rows).
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(p_challenge UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  xp_window INT,
  weight_start NUMERIC,
  weight_end NUMERIC,
  pct_weight_loss NUMERIC,
  avg_steps NUMERIC,
  exercise_days INT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  IF NOT public.is_challenge_member(p_challenge) THEN
    RETURN; -- non-members get nothing
  END IF;

  SELECT c.start_date, (c.start_date + (c.duration_days - 1))
    INTO v_start, v_end
    FROM public.challenges c WHERE c.id = p_challenge;
  IF v_start IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH parts AS (
    SELECT cp.user_id
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge AND cp.status = 'accepted'
  ),
  xp AS (
    SELECT prt.user_id,
      coalesce((SELECT sum(qc.xp_awarded) FROM public.quest_claims qc
                WHERE qc.user_id = prt.user_id
                  AND qc.claimed_at >= v_start::timestamptz
                  AND qc.claimed_at < (v_end + 1)::timestamptz), 0)
      + coalesce((SELECT sum(a.xp_awarded) FROM public.achievements a
                WHERE a.user_id = prt.user_id
                  AND a.created_at >= v_start::timestamptz
                  AND a.created_at < (v_end + 1)::timestamptz), 0) AS xp_window
    FROM parts prt
  ),
  wstart AS (
    SELECT DISTINCT ON (dl.user_id) dl.user_id, dl.weight
    FROM public.daily_logs dl JOIN parts prt ON prt.user_id = dl.user_id
    WHERE dl.date BETWEEN v_start AND v_end AND dl.weight IS NOT NULL
    ORDER BY dl.user_id, dl.date ASC
  ),
  wend AS (
    SELECT DISTINCT ON (dl.user_id) dl.user_id, dl.weight
    FROM public.daily_logs dl JOIN parts prt ON prt.user_id = dl.user_id
    WHERE dl.date BETWEEN v_start AND v_end AND dl.weight IS NOT NULL
    ORDER BY dl.user_id, dl.date DESC
  ),
  steps AS (
    SELECT dl.user_id, avg(dl.steps)::numeric AS avg_steps
    FROM public.daily_logs dl JOIN parts prt ON prt.user_id = dl.user_id
    WHERE dl.date BETWEEN v_start AND v_end AND dl.steps IS NOT NULL
    GROUP BY dl.user_id
  ),
  ex AS (
    SELECT dl.user_id, count(*)::int AS exercise_days
    FROM public.daily_logs dl JOIN parts prt ON prt.user_id = dl.user_id
    WHERE dl.date BETWEEN v_start AND v_end
      AND dl.exercise IS NOT NULL AND dl.exercise NOT IN ('', 'None')
    GROUP BY dl.user_id
  )
  SELECT
    prt.user_id,
    pr.username,
    coalesce(xp.xp_window, 0)::int AS xp_window,
    ws.weight AS weight_start,
    we.weight AS weight_end,
    CASE
      WHEN ws.weight IS NOT NULL AND we.weight IS NOT NULL AND ws.weight <> 0
      THEN round(((ws.weight - we.weight) / ws.weight * 100)::numeric, 1)
      ELSE NULL
    END AS pct_weight_loss,
    coalesce(round(st.avg_steps, 0), 0) AS avg_steps,
    coalesce(ex.exercise_days, 0) AS exercise_days
  FROM parts prt
  JOIN public.profiles pr ON pr.user_id = prt.user_id
  LEFT JOIN xp ON xp.user_id = prt.user_id
  LEFT JOIN wstart ws ON ws.user_id = prt.user_id
  LEFT JOIN wend we ON we.user_id = prt.user_id
  LEFT JOIN steps st ON st.user_id = prt.user_id
  LEFT JOIN ex ON ex.user_id = prt.user_id
  ORDER BY coalesce(xp.xp_window, 0) DESC, pct_weight_loss DESC NULLS LAST;
END;
$$;
