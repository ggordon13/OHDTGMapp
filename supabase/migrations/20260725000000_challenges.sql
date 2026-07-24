-- 30-day multiplayer Challenge: tables, RLS, and the definer RPCs that drive
-- invitations and acceptance. Cross-user writes (inviting others, activating a
-- challenge) go through SECURITY DEFINER functions so per-user RLS stays tight.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('partner', 'group')),
  start_date DATE NOT NULL,
  duration_days INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  joined_at TIMESTAMPTZ,
  -- Set when the user has seen the results reveal, so it only fires once.
  results_seen_at TIMESTAMPTZ,
  -- Set when the user finished their Day-30 data (drives the completion modal).
  completed_at TIMESTAMPTZ,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS challenge_participants_user_idx ON public.challenge_participants (user_id);

CREATE TABLE IF NOT EXISTS public.challenge_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  award_key TEXT NOT NULL CHECK (award_key IN ('golden_shoe', 'energetic', 'biggest_loser', 'milestone_master', 'overall')),
  reward_text TEXT,
  UNIQUE (challenge_id, award_key)
);

-- ---------------------------------------------------------------------------
-- Helper / lookup functions (SECURITY DEFINER, scalar — mirrors is_admin_or_dev)
-- ---------------------------------------------------------------------------

-- Whether the caller participates in a challenge. Used by RLS on the challenge
-- tables so a policy can consult challenge_participants without recursion.
CREATE OR REPLACE FUNCTION public.is_challenge_member(p_challenge UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge AND user_id = auth.uid()
  );
$$;

-- Resolve an invitee's username OR email to a user_id, without exposing the
-- profiles table to the caller. Returns null when no such user exists.
CREATE OR REPLACE FUNCTION public.resolve_challenge_user(identifier TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT user_id FROM public.profiles
  WHERE lower(username) = lower(trim(identifier))
     OR lower(email) = lower(trim(identifier))
  LIMIT 1;
$$;

-- Whether the caller is already committed to an unfinished challenge (the
-- "one active challenge at a time" rule).
CREATE OR REPLACE FUNCTION public.is_challenge_engaged(p_user UUID)
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
      AND c.status IN ('pending', 'active')
  );
$$;

-- ---------------------------------------------------------------------------
-- Mutating RPCs (SECURITY DEFINER — needed to write rows for other users)
-- ---------------------------------------------------------------------------

-- Create a challenge, invite participants, and store rewards, atomically.
-- p_rewards is a { award_key: reward_text } JSON object.
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

-- Accept or decline an invite. Accepting all invites activates the challenge;
-- any decline cancels it.
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

-- Roster for a challenge: participant usernames + status, for members only.
-- Lets members see each other's nicknames without opening up the profiles table.
CREATE OR REPLACE FUNCTION public.challenge_members(p_challenge UUID)
RETURNS TABLE (user_id UUID, username TEXT, status TEXT, is_leader BOOLEAN, joined_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cp.user_id, p.username, cp.status, (c.leader_id = cp.user_id) AS is_leader, cp.joined_at
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  LEFT JOIN public.profiles p ON p.user_id = cp.user_id
  WHERE cp.challenge_id = p_challenge
    AND public.is_challenge_member(p_challenge)
  ORDER BY (c.leader_id = cp.user_id) DESC, p.username;
$$;

-- Leader cancels a pending/active challenge.
CREATE OR REPLACE FUNCTION public.cancel_challenge(p_challenge UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  UPDATE public.challenges SET status = 'cancelled'
    WHERE id = p_challenge AND leader_id = v_user AND status IN ('pending', 'active');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot cancel this challenge';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS — reads for members; all writes flow through the definer RPCs above,
-- except a user updating their own participant row (results_seen/completed).
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their challenges" ON public.challenges;
CREATE POLICY "Members can view their challenges" ON public.challenges
  FOR SELECT USING (leader_id = auth.uid() OR public.is_challenge_member(id));

DROP POLICY IF EXISTS "Members can view participants" ON public.challenge_participants;
CREATE POLICY "Members can view participants" ON public.challenge_participants
  FOR SELECT USING (public.is_challenge_member(challenge_id));

DROP POLICY IF EXISTS "Users update their own participant row" ON public.challenge_participants;
CREATE POLICY "Users update their own participant row" ON public.challenge_participants
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view rewards" ON public.challenge_rewards;
CREATE POLICY "Members can view rewards" ON public.challenge_rewards
  FOR SELECT USING (public.is_challenge_member(challenge_id));
