import { describe, expect, it } from "vitest";
import { topBy, overallWinner } from "@/lib/challenge";
import type { LeaderboardRow } from "@/hooks/useChallenge";

const row = (over: Partial<LeaderboardRow>): LeaderboardRow => ({
  user_id: "u",
  username: "u",
  xp_window: 0,
  weight_start: null,
  weight_end: null,
  pct_weight_loss: null,
  avg_steps: 0,
  exercise_days: 0,
  ...over,
});

describe("topBy", () => {
  it("returns the row with the highest positive metric", () => {
    const rows = [
      row({ user_id: "a", avg_steps: 4000 }),
      row({ user_id: "b", avg_steps: 9000 }),
      row({ user_id: "c", avg_steps: 6000 }),
    ];
    expect(topBy(rows, "avg_steps")?.user_id).toBe("b");
  });

  it("returns null when nobody has a positive value", () => {
    const rows = [row({ user_id: "a", avg_steps: 0 }), row({ user_id: "b", avg_steps: 0 })];
    expect(topBy(rows, "avg_steps")).toBeNull();
  });

  it("ignores null metrics (e.g. no weight logged)", () => {
    const rows = [row({ user_id: "a", pct_weight_loss: null }), row({ user_id: "b", pct_weight_loss: 3.2 })];
    expect(topBy(rows, "pct_weight_loss")?.user_id).toBe("b");
  });
});

describe("overallWinner (partner tiebreak)", () => {
  it("picks whoever holds the most special awards", () => {
    // a: steps + exercise + biggest loser (3), b: xp only (1)
    const rows = [
      row({ user_id: "a", xp_window: 100, avg_steps: 9000, exercise_days: 10, pct_weight_loss: 5 }),
      row({ user_id: "b", xp_window: 999, avg_steps: 1000, exercise_days: 1, pct_weight_loss: 1 }),
    ];
    expect(overallWinner(rows)?.user_id).toBe("a");
  });

  it("breaks a 2-2 award tie by higher XP (rows are XP-sorted)", () => {
    // a: steps + xp (2), b: exercise + weight (2). a has higher xp → a wins.
    const rows = [
      row({ user_id: "a", xp_window: 500, avg_steps: 9000, exercise_days: 1, pct_weight_loss: 1 }),
      row({ user_id: "b", xp_window: 300, avg_steps: 1000, exercise_days: 10, pct_weight_loss: 9 }),
    ];
    expect(overallWinner(rows)?.user_id).toBe("a");
  });

  it("returns null when there are no awards to give", () => {
    const rows = [row({ user_id: "a" }), row({ user_id: "b" })];
    expect(overallWinner(rows)).toBeNull();
  });
});
