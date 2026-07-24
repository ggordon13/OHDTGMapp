import type { AwardKey, LeaderboardRow } from "@/hooks/useChallenge";

/** The four special awards and which leaderboard metric decides each. */
export const AWARD_META: {
  key: Exclude<AwardKey, "overall">;
  label: string;
  icon: string;
  desc: string;
  metric: keyof LeaderboardRow;
}[] = [
  { key: "golden_shoe", label: "Golden Shoe", icon: "👟", desc: "Highest avg steps", metric: "avg_steps" },
  { key: "energetic", label: "The Energetic", icon: "🔥", desc: "Most exercise", metric: "exercise_days" },
  { key: "biggest_loser", label: "The Biggest Loser", icon: "📉", desc: "Most % weight lost", metric: "pct_weight_loss" },
  { key: "milestone_master", label: "The Milestone Master", icon: "⭐", desc: "Most XP", metric: "xp_window" },
];

/** The row with the highest positive value for a metric, or null (no winner yet). */
export function topBy(rows: LeaderboardRow[], metric: keyof LeaderboardRow): LeaderboardRow | null {
  let best: LeaderboardRow | null = null;
  let bestVal = -Infinity;
  for (const r of rows) {
    const v = r[metric] as number | null;
    if (v == null) continue;
    if (v > bestVal) {
      bestVal = v;
      best = r;
    }
  }
  return bestVal > 0 ? best : null;
}

/**
 * Partner/overall winner: most special awards, ties broken by higher XP.
 * `rows` must already be sorted by XP descending (as the RPC returns them).
 */
export function overallWinner(rows: LeaderboardRow[]): LeaderboardRow | null {
  const counts = new Map<string, number>();
  for (const a of AWARD_META) {
    const w = topBy(rows, a.metric);
    if (w) counts.set(w.user_id, (counts.get(w.user_id) ?? 0) + 1);
  }
  let best: LeaderboardRow | null = null;
  let bestCount = -1;
  for (const r of rows) {
    const c = counts.get(r.user_id) ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = r;
    }
  }
  return bestCount > 0 ? best : null;
}
