-- Marks the caller's results as seen and finishes the challenge for everyone
-- (the window has ended, so the first member to view results completes it).
CREATE OR REPLACE FUNCTION public.finish_challenge_for_me(p_challenge UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_challenge_member(p_challenge) THEN
    RAISE EXCEPTION 'Not a member of this challenge';
  END IF;

  UPDATE public.challenge_participants
    SET results_seen_at = now()
    WHERE challenge_id = p_challenge AND user_id = v_user AND results_seen_at IS NULL;

  UPDATE public.challenges
    SET status = 'completed'
    WHERE id = p_challenge AND status = 'active';
END;
$$;
