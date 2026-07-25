-- Free-tier anti-cheat: a challenge that includes any free (non-premium) member
-- cannot be cancelled — everyone must finish all 30 days.
--
-- Why: a cancelled challenge does NOT count against the free one-challenge limit
-- (has_used_free_challenge only counts active/completed). Without this, a free
-- user could cancel and rejoin indefinitely, cheating the once-per-account rule
-- and re-rolling their run. The create form warns the leader about this up front.

-- vote_cancel_challenge now refuses when any accepted member is on the free tier.
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

  -- Locked to full term when any accepted member is free (anti-cheat).
  IF p_agree AND EXISTS (
    SELECT 1 FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge AND cp.status = 'accepted'
      AND NOT public.is_premium_user(cp.user_id)
  ) THEN
    RAISE EXCEPTION 'This challenge includes a free member and can''t be cancelled — finish all 30 days.';
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

-- Roster now also reports each member's premium tier, so the UI can hide the
-- cancel control for non-cancellable challenges. New column in the return type
-- => the old signature must be dropped first (Postgres can't REPLACE it).
DROP FUNCTION IF EXISTS public.challenge_members(UUID);
CREATE OR REPLACE FUNCTION public.challenge_members(p_challenge UUID)
RETURNS TABLE (user_id UUID, username TEXT, status TEXT, is_leader BOOLEAN, joined_at TIMESTAMPTZ, wants_cancel BOOLEAN, is_premium BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cp.user_id, p.username, cp.status, (c.leader_id = cp.user_id) AS is_leader,
         cp.joined_at, cp.wants_cancel, public.is_premium_user(cp.user_id) AS is_premium
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  LEFT JOIN public.profiles p ON p.user_id = cp.user_id
  WHERE cp.challenge_id = p_challenge
    AND public.is_challenge_member(p_challenge)
  ORDER BY (c.leader_id = cp.user_id) DESC, p.username;
$$;

-- Resolve an invitee AND report their tier, so the create form can warn the
-- leader when the roster will include a free member (=> non-cancellable).
DROP FUNCTION IF EXISTS public.resolve_challenge_invitee(TEXT);
CREATE OR REPLACE FUNCTION public.resolve_challenge_invitee(identifier TEXT)
RETURNS TABLE (user_id UUID, username TEXT, is_premium BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.user_id, p.username, public.is_premium_user(p.user_id) AS is_premium
  FROM public.profiles p
  WHERE lower(p.username) = lower(trim(identifier))
     OR lower(p.email) = lower(trim(identifier))
  LIMIT 1;
$$;
