-- ===========================================================================
-- Security hardening.
--
-- Closes four issues found in review:
--   1. CRITICAL  any user could become admin by editing their own profile email
--   2. CRITICAL  every paying customer's email was readable by anyone
--   3. HIGH      XP was client-authoritative, so challenges were cheatable
--   4. MEDIUM    the waitlist accepted unbounded anonymous writes
--
-- The pattern behind 1 and 3 is the same: a SECURITY DEFINER trigger or an
-- ownership-only RLS policy trusting a value the client controls. Anything
-- that grants privilege or score must derive it server-side.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. CRITICAL — privilege escalation via profiles.email
--
-- `grant_founding_admin` fired BEFORE UPDATE OF email and set role='admin' for
-- a hardcoded address. profiles.email had no UNIQUE constraint and was not in
-- the column REVOKE list, and the trigger is SECURITY DEFINER so it ran as the
-- table owner — meaning any authenticated user could PATCH their own row with
-- that email and be promoted to admin + premium.
--
-- The founding admin was already granted by the one-off UPDATE in
-- 20260735000000, so the trigger has no remaining job. Email identity comes
-- from auth.users via handle_new_user; the client never needs to write it.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS grant_founding_admin_trg ON public.profiles;
DROP FUNCTION IF EXISTS public.grant_founding_admin();

REVOKE INSERT (email) ON public.profiles FROM authenticated;
REVOKE UPDATE (email) ON public.profiles FROM authenticated;

-- Undo the exploit, narrowly.
--
-- An account that used it has profiles.email set to the founding address while
-- its real auth.users email is something else. Matching on exactly that leaves
-- legitimately-appointed staff alone — including any whose profiles.email is
-- NULL or merely stale, which a broader "profile email must match auth" rule
-- would have wrongly demoted.
--
-- Review before trusting it:
--   SELECT p.user_id, p.email AS profile_email, u.email AS auth_email, p.role
--     FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
--    WHERE p.role IN ('admin','dev');
UPDATE public.profiles p
   SET role = 'user',
       access_level = 'free',
       email = u.email
  FROM auth.users u
 WHERE u.id = p.user_id
   AND lower(coalesce(p.email, '')) = 'gordongaming13@gmail.com'
   AND lower(coalesce(u.email, '')) <> 'gordongaming13@gmail.com';

-- Belt and braces: an email can no longer be pointed at another account's.
--
-- Attempted, not required. Duplicate or stale profile emails predating this
-- migration would otherwise abort the whole transaction and leave the actual
-- security fixes unapplied — a failed index is the lesser problem, so it is
-- reported and skipped. Resolve the duplicates and re-run to get the index.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci
    ON public.profiles (lower(email)) WHERE email IS NOT NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE WARNING 'profiles_email_unique_ci not created: duplicate emails exist. Find them with: '
    'SELECT lower(email), count(*) FROM public.profiles WHERE email IS NOT NULL '
    'GROUP BY 1 HAVING count(*) > 1;';
END $$;


-- ---------------------------------------------------------------------------
-- 2. CRITICAL — premium_allowlist leaked every customer's email
--
-- `USING (is_active = true)` with no TO clause applies to PUBLIC, which
-- includes anon. Since the anon key ships in the client bundle, anyone could
-- GET /rest/v1/premium_allowlist?select=email and dump the customer list.
--
-- resolveEffectiveAccessLevel only ever needs the caller's own row, so scope
-- the policy to that. Admin management keeps its own FOR ALL policy.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view active premium allowlist entries" ON public.premium_allowlist;

CREATE POLICY "Users can check their own allowlist entry"
  ON public.premium_allowlist
  FOR SELECT
  TO authenticated
  USING (is_active = true AND lower(email) = lower(auth.jwt() ->> 'email'));


-- ---------------------------------------------------------------------------
-- 3. HIGH — XP was client-authoritative
--
-- profiles.total_xp/level were directly writable, and quest_claims /
-- achievements validated only ownership: xp_awarded, quest_key and period were
-- all attacker-chosen. Since challenge_leaderboard ranks on the sum of
-- quest_claims.xp_awarded in the window, any member could win any challenge.
--
-- Fix: XP values live in server-owned catalogs, eligibility is recomputed from
-- daily_logs, and the only write paths are the SECURITY DEFINER functions
-- below. Direct client writes are revoked.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quest_catalog (
  quest_key TEXT PRIMARY KEY,
  category  TEXT NOT NULL CHECK (category IN ('daily', 'weekly')),
  xp        INT  NOT NULL CHECK (xp BETWEEN 0 AND 500)
);

INSERT INTO public.quest_catalog (quest_key, category, xp) VALUES
  ('daily-logged',       'daily',  20),
  ('daily-calories',     'daily',  20),
  ('daily-protein',      'daily',  20),
  ('daily-water',        'daily',  15),
  ('daily-steps',        'daily',  15),
  ('daily-exercise',     'daily',  15),
  ('daily-complete',     'daily',  25),
  ('weekly-consistency', 'weekly', 50),
  ('weekly-hydration',   'weekly', 40),
  ('weekly-star',        'weekly', 75)
ON CONFLICT (quest_key) DO UPDATE SET category = EXCLUDED.category, xp = EXCLUDED.xp;

-- Badge XP + the set of keys that may ever be granted. Keep in step with
-- ALL_BADGES in src/lib/gamification.ts — src/test/badge-catalog-sync.test.ts
-- fails the build if they drift.
CREATE TABLE IF NOT EXISTS public.badge_catalog (
  achievement_key TEXT PRIMARY KEY,
  xp              INT NOT NULL CHECK (xp BETWEEN 0 AND 500)
);

INSERT INTO public.badge_catalog (achievement_key, xp) VALUES
  ('first-steps',        25),
  ('star-bronze',        50),
  ('star-silver',       100),
  ('star-gold',         200),
  ('medallion-bronze',   75),
  ('medallion-silver',  150),
  ('medallion-gold',    250),
  ('virtuoso',          350),
  ('hydration-hero',     60),
  ('step-master',        60),
  ('protein-master',    120),
  ('perfectionist',     150),
  ('iron-streak',       120),
  ('three-week-streak', 100),
  ('committed',          75),
  ('halfway-there',     150),
  ('century-club',      300),
  ('moving-the-needle', 120),
  ('built-different',   300)
ON CONFLICT (achievement_key) DO UPDATE SET xp = EXCLUDED.xp;

ALTER TABLE public.quest_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_catalog ENABLE ROW LEVEL SECURITY;
-- Readable (the UI shows XP values); never writable by clients.
CREATE POLICY "catalog is public read" ON public.quest_catalog FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "badge catalog is public read" ON public.badge_catalog FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.quest_catalog FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.badge_catalog FROM anon, authenticated;


-- Raise total_xp to the sum of what has actually been banked. Only ever
-- raises, so it can't clobber a real total, and it no-ops once equal.
CREATE OR REPLACE FUNCTION public.sync_my_xp()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_floor INT;
  v_now   INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT coalesce((SELECT sum(xp_awarded) FROM public.quest_claims WHERE user_id = v_user), 0)
       + coalesce((SELECT sum(xp_awarded) FROM public.achievements WHERE user_id = v_user), 0)
    INTO v_floor;

  SELECT total_xp INTO v_now FROM public.profiles WHERE user_id = v_user;
  IF v_now IS NULL THEN RETURN NULL; END IF;

  IF v_floor > v_now THEN
    UPDATE public.profiles
       SET total_xp = v_floor,
           level = public.level_from_xp(v_floor)
     WHERE user_id = v_user;
    RETURN v_floor;
  END IF;
  RETURN v_now;
END;
$$;

-- Mirrors levelFromXp/cumulativeXpForLevel: triangular to level 9, then a flat
-- 800 XP per level. Kept in SQL so the server can maintain profiles.level.
CREATE OR REPLACE FUNCTION public.level_from_xp(p_xp INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_level INT := 1;
  v_cum   INT;
BEGIN
  LOOP
    v_level := v_level + 1;
    IF v_level <= 9 THEN
      v_cum := 50 * (v_level - 1) * v_level;
    ELSE
      v_cum := 3600 + 800 * (v_level - 9);
    END IF;
    IF v_cum > coalesce(p_xp, 0) THEN
      RETURN v_level - 1;
    END IF;
    IF v_level > 10000 THEN  -- hard stop; can't be reached in practice
      RETURN v_level;
    END IF;
  END LOOP;
END;
$$;


-- Claim one quest. Returns the XP actually banked (0 if already claimed).
-- Raises if the quest isn't real or the user hasn't earned it.
CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_key TEXT, p_period TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_category   TEXT;
  v_xp         INT;
  v_date       DATE;
  v_run_start  DATE;
  v_day100     DATE;
  v_week_end   DATE;
  v_week_len   INT;
  v_target     INT;
  v_cal_max    NUMERIC;
  v_pro_min    NUMERIC;
  v_water_goal NUMERIC := 7;   -- fixed daily hydration goal (glasses)
  v_steps_goal NUMERIC;
  v_ok         BOOLEAN := false;
  v_log        public.daily_logs%ROWTYPE;
  v_a_cal      NUMERIC; v_a_pro NUMERIC; v_a_water NUMERIC; v_a_steps NUMERIC;
  v_ex_days    INT; v_others INT;
  v_inserted   INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT category, xp INTO v_category, v_xp
    FROM public.quest_catalog WHERE quest_key = p_quest_key;
  IF v_category IS NULL THEN RAISE EXCEPTION 'Unknown quest %', p_quest_key; END IF;

  BEGIN
    v_date := p_period::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid period %', p_period;
  END;

  -- Clients send their own local date, which can be a day ahead of the server.
  IF v_date > (current_date + 1) THEN RAISE EXCEPTION 'Period is in the future'; END IF;

  SELECT challenge_start_date,
         coalesce(daily_calorie_target_max, daily_calorie_target, 2000),
         coalesce(daily_protein_target_min, daily_protein_target, 150),
         coalesce(daily_steps_target, 10000)
    INTO v_run_start, v_cal_max, v_pro_min, v_steps_goal
    FROM public.profiles WHERE user_id = v_user;

  IF v_category = 'daily' THEN
    SELECT * INTO v_log FROM public.daily_logs WHERE user_id = v_user AND date = v_date;

    v_ok := CASE p_quest_key
      WHEN 'daily-logged'   THEN v_log.weight IS NOT NULL
      WHEN 'daily-calories' THEN v_log.calories IS NOT NULL AND v_log.calories <= v_cal_max
      WHEN 'daily-protein'  THEN v_log.protein  IS NOT NULL AND v_log.protein  >= v_pro_min
      WHEN 'daily-water'    THEN v_log.water    IS NOT NULL AND v_log.water    >= v_water_goal
      WHEN 'daily-steps'    THEN v_log.steps    IS NOT NULL AND v_log.steps    >= v_steps_goal
      WHEN 'daily-exercise' THEN coalesce(v_log.exercise, '') NOT IN ('', 'None')
      WHEN 'daily-complete' THEN v_log.weight IS NOT NULL AND v_log.calories IS NOT NULL
                             AND v_log.protein IS NOT NULL AND v_log.water IS NOT NULL
                             AND v_log.steps IS NOT NULL AND coalesce(v_log.exercise, '') <> ''
      ELSE false
    END;
  ELSE
    -- Weeks are 7-day chunks from Day 1, with the last one clipped at Day 100.
    v_day100  := v_run_start + 99;
    v_week_end := v_date + 6;
    IF v_date <= v_day100 AND v_week_end > v_day100 THEN v_week_end := v_day100; END IF;
    v_week_len := (v_week_end - v_date) + 1;
    v_target   := least(5, v_week_len);

    IF p_quest_key = 'weekly-consistency' THEN
      SELECT count(*) >= v_target INTO v_ok FROM public.daily_logs
       WHERE user_id = v_user AND date BETWEEN v_date AND v_week_end AND weight IS NOT NULL;

    ELSIF p_quest_key = 'weekly-hydration' THEN
      SELECT count(*) >= v_target INTO v_ok FROM public.daily_logs
       WHERE user_id = v_user AND date BETWEEN v_date AND v_week_end AND water >= v_water_goal;

    ELSIF p_quest_key = 'weekly-star' THEN
      -- A star is only judged once every day of the week is behind us.
      IF v_week_end >= current_date THEN
        RAISE EXCEPTION 'That week is not settled yet';
      END IF;
      SELECT round(avg(calories)::numeric, 1), round(avg(protein)::numeric, 1),
             round(avg(water)::numeric, 1),    round(avg(steps)::numeric, 1),
             count(*) FILTER (WHERE coalesce(exercise, '') NOT IN ('', 'None'))
        INTO v_a_cal, v_a_pro, v_a_water, v_a_steps, v_ex_days
        FROM public.daily_logs
       WHERE user_id = v_user AND date BETWEEN v_date AND v_week_end;

      IF v_a_cal IS NOT NULL AND v_a_cal <= v_cal_max THEN
        v_others := (CASE WHEN v_a_pro   IS NOT NULL AND v_a_pro   >= v_pro_min    THEN 1 ELSE 0 END)
                  + (CASE WHEN v_a_water IS NOT NULL AND v_a_water >= v_water_goal THEN 1 ELSE 0 END)
                  + (CASE WHEN v_a_steps IS NOT NULL AND v_a_steps >= v_steps_goal THEN 1 ELSE 0 END)
                  + (CASE WHEN v_ex_days >= 1 THEN 1 ELSE 0 END);
        v_ok := v_others >= 2;
      ELSE
        v_ok := (v_a_steps IS NOT NULL AND v_a_steps >= v_steps_goal) AND v_ex_days >= 1;
      END IF;
    END IF;
  END IF;

  IF NOT v_ok THEN RAISE EXCEPTION 'Quest % is not complete for %', p_quest_key, p_period; END IF;

  INSERT INTO public.quest_claims (user_id, quest_key, period, xp_awarded)
  VALUES (v_user, p_quest_key, p_period, v_xp)
  ON CONFLICT (user_id, period, quest_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN 0; END IF;  -- already claimed

  UPDATE public.profiles
     SET total_xp = total_xp + v_xp,
         level    = public.level_from_xp(total_xp + v_xp)
   WHERE user_id = v_user;

  RETURN v_xp;
END;
$$;


-- Grant a trophy. XP comes from the catalog, never the client. Returns the XP
-- banked, or 0 when it was already held.
--
-- NOTE: unlike quests, the earn *condition* is still evaluated client-side —
-- replicating getEarnedBadges (streaks, star runs, perfect weeks) in SQL is a
-- larger job. The catalog bounds the damage completely: a determined user can
-- unlock trophies they haven't earned, but only real ones, only once each, and
-- for no more XP than the full legitimate set is worth. Trophy XP is excluded
-- from challenge_leaderboard, so this cannot affect a challenge result.
CREATE OR REPLACE FUNCTION public.grant_achievement(p_key TEXT, p_tier TEXT DEFAULT NULL, p_run INT DEFAULT 1)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_xp       INT;
  v_inserted INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT xp INTO v_xp FROM public.badge_catalog WHERE achievement_key = p_key;
  IF v_xp IS NULL THEN RAISE EXCEPTION 'Unknown achievement %', p_key; END IF;

  INSERT INTO public.achievements (user_id, achievement_key, run_index, tier, xp_awarded)
  VALUES (v_user, p_key, p_run, p_tier, v_xp)
  ON CONFLICT (user_id, achievement_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN 0; END IF;

  UPDATE public.profiles
     SET total_xp = total_xp + v_xp,
         level    = public.level_from_xp(total_xp + v_xp)
   WHERE user_id = v_user;

  RETURN v_xp;
END;
$$;


-- Weight-milestone bonus. Verifies the crossing against the user's own logs
-- and their goal direction, and is idempotent per milestone.
CREATE OR REPLACE FUNCTION public.award_milestone_xp(p_weight NUMERIC)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_start   NUMERIC;
  v_target  NUMERIC;
  v_last    NUMERIC;
  v_latest  NUMERIC;
  v_xp      INT := 30;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT current_weight, target_weight, last_celebrated_weight
    INTO v_start, v_target, v_last
    FROM public.profiles WHERE user_id = v_user;
  IF v_start IS NULL OR v_target IS NULL OR v_start = v_target THEN RETURN 0; END IF;
  IF v_last IS NOT DISTINCT FROM p_weight THEN RETURN 0; END IF;

  SELECT weight INTO v_latest FROM public.daily_logs
   WHERE user_id = v_user AND weight IS NOT NULL ORDER BY date DESC LIMIT 1;
  IF v_latest IS NULL THEN RETURN 0; END IF;

  -- The milestone must sit between the baseline and the target, and the latest
  -- logged weight must actually have reached it.
  IF v_start > v_target THEN
    IF NOT (p_weight < v_start AND p_weight >= v_target AND v_latest <= p_weight) THEN RETURN 0; END IF;
  ELSE
    IF NOT (p_weight > v_start AND p_weight <= v_target AND v_latest >= p_weight) THEN RETURN 0; END IF;
  END IF;

  UPDATE public.profiles
     SET last_celebrated_weight = p_weight,
         total_xp = total_xp + v_xp,
         level    = public.level_from_xp(total_xp + v_xp)
   WHERE user_id = v_user;

  RETURN v_xp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_quest(TEXT, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_achievement(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_milestone_xp(NUMERIC)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_xp()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.level_from_xp(INT)               TO authenticated;

-- The functions above are now the only write paths.
--
-- DELETE goes too, even though it looks harmless: total_xp is incremented on
-- grant and never decremented, so a client that could delete its own rows could
-- delete-and-reclaim the same quest forever. Nothing in the app deletes these
-- (the 100-day rollover scopes trophies by run_index rather than removing them,
-- and account deletion runs as the service role via the delete-account
-- function), so the policies below were unused as well as unsafe.
DROP POLICY IF EXISTS "Users delete own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users delete own quest claims" ON public.quest_claims;

REVOKE INSERT, UPDATE, DELETE ON public.quest_claims FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.achievements FROM authenticated;
REVOKE UPDATE (total_xp, level, last_celebrated_weight) ON public.profiles FROM authenticated;


-- ---------------------------------------------------------------------------
-- 4. MEDIUM — unbounded anonymous writes to the waitlist
--
-- `WITH CHECK (true)` for anon with no shape or length limit: anyone could
-- script millions of rows. This bounds each row; rate limiting still wants a
-- bot check in front of the form.
-- ---------------------------------------------------------------------------

DELETE FROM public.waitlist_emails
 WHERE email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(email) > 254;

ALTER TABLE public.waitlist_emails
  DROP CONSTRAINT IF EXISTS waitlist_email_shape;
ALTER TABLE public.waitlist_emails
  ADD CONSTRAINT waitlist_email_shape
  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) BETWEEN 6 AND 254);
