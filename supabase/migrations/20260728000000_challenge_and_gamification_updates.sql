-- Follow-up rules: free-tier one-challenge limit, admin Day-1 edits, group
-- cancel-by-agreement, and DELETE policies so the app can refund XP/trophies
-- when a log is reverted below its goal (anti-exploit).

-- ---------------------------------------------------------------------------
-- Premium check (staff count as premium)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_premium_user(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user AND (access_level = 'premium' OR role IN ('admin', 'dev'))
  );
$$;

-- Whether the user has already been through a challenge that actually ran
-- (the free tier is limited to one such challenge, lifetime).
CREATE OR REPLACE FUNCTION public.has_used_free_challenge(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = p_user
      AND cp.status = 'accepted'
      AND c.status IN ('active', 'completed')
  );
$$;

-- ---------------------------------------------------------------------------
-- Refund support: let users delete their own reward rows (anti-exploit)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users delete own achievements" ON public.achievements;
CREATE POLICY "Users delete own achievements" ON public.achievements
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own quest claims" ON public.quest_claims;
CREATE POLICY "Users delete own quest claims" ON public.quest_claims
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- create_challenge / respond_to_challenge — add the free one-challenge rule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_challenge(
  p_mode TEXT,
  p_start_date DATE,
  p_participant_ids UUID[],
  p_rewards JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader UUID := auth.uid();
  v_challenge UUID;
  v_pid UUID;
  v_count INT;
BEGIN
  IF v_leader IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_mode NOT IN ('partner', 'group') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;
  IF public.is_challenge_engaged(v_leader) THEN
    RAISE EXCEPTION 'You already have an active challenge';
  END IF;
  IF NOT public.is_premium_user(v_leader) AND public.has_used_free_challenge(v_leader) THEN
    RAISE EXCEPTION 'Free accounts can join one challenge — go premium for unlimited';
  END IF;

  v_count := coalesce(array_length(p_participant_ids, 1), 0);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Add at least one participant';
  END IF;
  IF p_mode = 'partner' AND v_count <> 1 THEN
    RAISE EXCEPTION 'Partner mode needs exactly one other person';
  END IF;
  IF p_mode = 'group' AND v_count > 5 THEN
    RAISE EXCEPTION 'A group is capped at 6 people';
  END IF;
  IF v_leader = ANY (p_participant_ids) THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_participant_ids) AS x) <> v_count THEN
    RAISE EXCEPTION 'Duplicate participant';
  END IF;

  INSERT INTO public.challenges (leader_id, mode, start_date)
  VALUES (v_leader, p_mode, p_start_date)
  RETURNING id INTO v_challenge;

  INSERT INTO public.challenge_participants (challenge_id, user_id, status, joined_at)
  VALUES (v_challenge, v_leader, 'accepted', now());

  FOREACH v_pid IN ARRAY p_participant_ids LOOP
    INSERT INTO public.challenge_participants (challenge_id, user_id, status)
    VALUES (v_challenge, v_pid, 'invited');
  END LOOP;

  INSERT INTO public.challenge_rewards (challenge_id, award_key, reward_text)
  SELECT v_challenge, key, value
  FROM jsonb_each_text(coalesce(p_rewards, '{}'::jsonb))
  WHERE key IN ('golden_shoe', 'energetic', 'biggest_loser', 'milestone_master', 'overall');

  RETURN v_challenge;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_challenge(p_challenge UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pending INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge AND user_id = v_user AND status = 'invited'
  ) THEN
    RAISE EXCEPTION 'No pending invite for this challenge';
  END IF;

  IF p_accept THEN
    IF public.is_challenge_engaged(v_user) THEN
      RAISE EXCEPTION 'You already have an active challenge';
    END IF;
    IF NOT public.is_premium_user(v_user) AND public.has_used_free_challenge(v_user) THEN
      RAISE EXCEPTION 'Free accounts can join one challenge — go premium for unlimited';
    END IF;
    UPDATE public.challenge_participants
      SET status = 'accepted', joined_at = now()
      WHERE challenge_id = p_challenge AND user_id = v_user;

    SELECT count(*) INTO v_pending FROM public.challenge_participants
      WHERE challenge_id = p_challenge AND status = 'invited';
    IF v_pending = 0 THEN
      UPDATE public.challenges SET status = 'active' WHERE id = p_challenge AND status = 'pending';
    END IF;
  ELSE
    UPDATE public.challenge_participants
      SET status = 'declined'
      WHERE challenge_id = p_challenge AND user_id = v_user;
    UPDATE public.challenges SET status = 'cancelled' WHERE id = p_challenge AND status = 'pending';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancel-by-agreement: every accepted participant must agree to cancel
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_participants ADD COLUMN IF NOT EXISTS wants_cancel BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.vote_cancel_challenge(p_challenge UUID, p_agree BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_accepted INT;
  v_wants INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge AND user_id = v_user AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Not an active participant';
  END IF;

  UPDATE public.challenge_participants
    SET wants_cancel = p_agree
    WHERE challenge_id = p_challenge AND user_id = v_user;

  SELECT count(*) FILTER (WHERE status = 'accepted'),
         count(*) FILTER (WHERE status = 'accepted' AND wants_cancel)
    INTO v_accepted, v_wants
    FROM public.challenge_participants WHERE challenge_id = p_challenge;

  IF v_accepted > 0 AND v_wants = v_accepted THEN
    UPDATE public.challenges SET status = 'cancelled' WHERE id = p_challenge AND status IN ('pending', 'active');
  END IF;
END;
$$;

-- Roster now includes each member's cancel vote. Adding a column to the return
-- type means the old signature must be dropped first (Postgres can't REPLACE it).
DROP FUNCTION IF EXISTS public.challenge_members(UUID);
CREATE OR REPLACE FUNCTION public.challenge_members(p_challenge UUID)
RETURNS TABLE (user_id UUID, username TEXT, status TEXT, is_leader BOOLEAN, joined_at TIMESTAMPTZ, wants_cancel BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cp.user_id, p.username, cp.status, (c.leader_id = cp.user_id) AS is_leader, cp.joined_at, cp.wants_cancel
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  LEFT JOIN public.profiles p ON p.user_id = cp.user_id
  WHERE cp.challenge_id = p_challenge
    AND public.is_challenge_member(p_challenge)
  ORDER BY (c.leader_id = cp.user_id) DESC, p.username;
$$;

-- ---------------------------------------------------------------------------
-- Admin: view + change Day 1 of active/pending challenges
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_challenges()
RETURNS TABLE (id UUID, mode TEXT, status TEXT, start_date DATE, leader_username TEXT, member_count INT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.mode, c.status, c.start_date, p.username,
    (SELECT count(*)::int FROM public.challenge_participants cp WHERE cp.challenge_id = c.id AND cp.status = 'accepted')
  FROM public.challenges c
  LEFT JOIN public.profiles p ON p.user_id = c.leader_id
  WHERE public.is_admin_or_dev() AND c.status IN ('pending', 'active')
  ORDER BY c.start_date;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_challenge_start(p_challenge UUID, p_start_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_dev() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.challenges SET start_date = p_start_date
    WHERE id = p_challenge AND status IN ('pending', 'active');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or not editable';
  END IF;
END;
$$;
