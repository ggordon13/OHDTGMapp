-- Gamification layer: XP / levels, streak shields, weight-milestone tracking,
-- plus quest-claim and achievement ledgers. All additive & safely defaulted so
-- existing users lose no data and keep working if this is applied incrementally.

-- 1. Extend profiles with player state (all defaulted, backfill-safe)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_shields INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_celebrated_weight NUMERIC;

-- 2. Quest claims: one row per (user, period, quest) enforces "claim once".
--    period = the day (YYYY-MM-DD) for daily quests, or the week's start date
--    for weekly quests. Doubles as a permanent quest-completion history.
CREATE TABLE IF NOT EXISTS public.quest_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL,
  period TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, period, quest_key)
);

-- 3. Achievements: durable badge shelf. One row per (user, achievement) so a
--    badge unlocks exactly once and its XP is awarded exactly once.
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  tier TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

-- 4. Row level security cloned from the existing daily_logs / profiles policies
ALTER TABLE public.quest_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quest claims"
  ON public.quest_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own quest claims"
  ON public.quest_claims FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own achievements"
  ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements"
  ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
