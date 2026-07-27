-- Shareable challenge invite links.
--
-- Turns a challenge into an acquisition channel: the leader creates a group
-- (optionally with nobody pre-invited), shares a link, and anyone who opens it —
-- including people who have to sign up first — can join. The leader then starts
-- the challenge when the roster looks good.

-- create_challenge: allow a group to start with 0 pre-invites (fill it via link).
-- Partner mode still requires exactly one other person.
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

  FOREACH v_pid IN ARRAY coalesce(p_participant_ids, ARRAY[]::UUID[]) LOOP
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

-- Minimal, unauthenticated-friendly preview for the /join page. Deliberately not
-- gated on membership: a prospective joiner needs to see what they're joining.
CREATE OR REPLACE FUNCTION public.challenge_invite_info(p_challenge UUID)
RETURNS TABLE (
  id UUID,
  mode TEXT,
  status TEXT,
  start_date DATE,
  duration_days INT,
  leader_username TEXT,
  accepted_count INT,
  capacity INT,
  is_member BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    c.id, c.mode, c.status, c.start_date, c.duration_days,
    lp.username,
    (SELECT count(*)::int FROM public.challenge_participants cp
       WHERE cp.challenge_id = c.id AND cp.status = 'accepted'),
    CASE WHEN c.mode = 'partner' THEN 2 ELSE 6 END,
    EXISTS (SELECT 1 FROM public.challenge_participants cp
       WHERE cp.challenge_id = c.id AND cp.user_id = auth.uid())
  FROM public.challenges c
  LEFT JOIN public.profiles lp ON lp.user_id = c.leader_id
  WHERE c.id = p_challenge;
$$;

-- Join a pending challenge via its link, as an accepted member (opening the link
-- IS the opt-in). Enforces the same eligibility as accepting an invite.
CREATE OR REPLACE FUNCTION public.join_challenge_by_link(p_challenge UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_mode TEXT;
  v_status TEXT;
  v_accepted INT;
  v_cap INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT mode, status INTO v_mode, v_status
    FROM public.challenges WHERE id = p_challenge FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'This challenge is no longer open to join';
  END IF;

  -- Already in (or previously invited): idempotent, just make sure they're in.
  IF EXISTS (SELECT 1 FROM public.challenge_participants
             WHERE challenge_id = p_challenge AND user_id = v_user) THEN
    UPDATE public.challenge_participants
      SET status = 'accepted', joined_at = coalesce(joined_at, now())
      WHERE challenge_id = p_challenge AND user_id = v_user AND status <> 'accepted';
    RETURN;
  END IF;

  IF public.is_challenge_engaged(v_user) THEN
    RAISE EXCEPTION 'You already have an active challenge';
  END IF;
  IF NOT public.is_premium_user(v_user) AND public.has_used_free_challenge(v_user) THEN
    RAISE EXCEPTION 'Free accounts can join one challenge — go premium for unlimited';
  END IF;

  v_cap := CASE WHEN v_mode = 'partner' THEN 2 ELSE 6 END;
  SELECT count(*) INTO v_accepted FROM public.challenge_participants
    WHERE challenge_id = p_challenge AND status = 'accepted';
  IF v_accepted >= v_cap THEN
    RAISE EXCEPTION 'This challenge is full';
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, user_id, status, joined_at)
  VALUES (p_challenge, v_user, 'accepted', now());
END;
$$;

-- Leader flips a pending challenge live once the roster is set (link-based
-- challenges have no invites to auto-trigger activation). Stragglers who were
-- invited but never accepted are dropped.
CREATE OR REPLACE FUNCTION public.start_challenge(p_challenge UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_leader UUID;
  v_accepted INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT leader_id INTO v_leader
    FROM public.challenges WHERE id = p_challenge AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or already started';
  END IF;
  IF v_leader <> v_user THEN
    RAISE EXCEPTION 'Only the leader can start the challenge';
  END IF;

  SELECT count(*) INTO v_accepted FROM public.challenge_participants
    WHERE challenge_id = p_challenge AND status = 'accepted';
  IF v_accepted < 2 THEN
    RAISE EXCEPTION 'Need at least 2 people to start';
  END IF;

  UPDATE public.challenge_participants
    SET status = 'declined'
    WHERE challenge_id = p_challenge AND status = 'invited';
  UPDATE public.challenges SET status = 'active' WHERE id = p_challenge;
END;
$$;

GRANT EXECUTE ON FUNCTION public.challenge_invite_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_challenge(UUID) TO authenticated;
