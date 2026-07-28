-- Show the leader's rewards on the invite-link preview.
--
-- Someone deciding whether to join should see what's actually on the line. The
-- rewards ride along with the rest of the preview: challenge_rewards isn't
-- readable by a non-member, and a second round trip would only add a flicker.

-- The return type gains a column, so REPLACE won't do — drop and recreate.
DROP FUNCTION IF EXISTS public.challenge_invite_info(UUID);

CREATE FUNCTION public.challenge_invite_info(p_challenge UUID)
RETURNS TABLE (
  id UUID,
  mode TEXT,
  status TEXT,
  start_date DATE,
  duration_days INT,
  leader_username TEXT,
  accepted_count INT,
  capacity INT,
  is_member BOOLEAN,
  rewards JSONB
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
       WHERE cp.challenge_id = c.id AND cp.user_id = auth.uid()),
    -- Only rewards the leader actually filled in, in the order the app lists them.
    coalesce((
      SELECT jsonb_agg(
               jsonb_build_object('award_key', r.award_key, 'reward_text', r.reward_text)
               ORDER BY array_position(
                 ARRAY['golden_shoe', 'energetic', 'biggest_loser', 'milestone_master', 'overall'],
                 r.award_key
               )
             )
      FROM public.challenge_rewards r
      WHERE r.challenge_id = c.id AND coalesce(btrim(r.reward_text), '') <> ''
    ), '[]'::jsonb)
  FROM public.challenges c
  LEFT JOIN public.profiles lp ON lp.user_id = c.leader_id
  WHERE c.id = p_challenge;
$$;

GRANT EXECUTE ON FUNCTION public.challenge_invite_info(UUID) TO authenticated;
