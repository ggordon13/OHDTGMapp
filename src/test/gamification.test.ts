import { describe, it, expect } from "vitest";
import { DailyLog } from "@/lib/mockData";
import {
  cumulativeXpForLevel,
  levelFromXp,
  getLevelProgress,
  getStreakWithShields,
  earnedShields,
  getWeightMilestones,
  getNewlyCrossedMilestone,
  getDailyQuests,
  getWeeklyWeightAverages,
  weekIndexForDay,
  chunkIntoWeeks,
} from "@/lib/gamification";

const day = (over: Partial<DailyLog>): DailyLog => ({
  date: "2026-01-01",
  day: 1,
  weight: null,
  calories: null,
  protein: null,
  water: null,
  exercise: "",
  steps: null,
  ...over,
});

describe("XP / levels", () => {
  it("uses a triangular cumulative curve up to the cap", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(3)).toBe(300);
    expect(cumulativeXpForLevel(9)).toBe(3600);
  });

  it("caps the per-level step at 800 past level 9", () => {
    const step = (l: number) => cumulativeXpForLevel(l) - cumulativeXpForLevel(l - 1);
    // Still ramping…
    expect(step(9)).toBe(800);
    // …then flat, forever.
    expect(step(10)).toBe(800);
    expect(step(20)).toBe(800);
    expect(step(30)).toBe(800);
    expect(cumulativeXpForLevel(30)).toBe(20400);
  });

  it("never demotes anyone when the curve is lowered", () => {
    // The capped curve must sit at or below the old triangular one at every
    // level, so an existing total_xp can only ever map to the same or a higher
    // level — nobody loses a level or a rank on deploy.
    for (let l = 1; l <= 60; l++) {
      expect(cumulativeXpForLevel(l)).toBeLessThanOrEqual(50 * (l - 1) * l);
    }
  });

  it("keeps ranks a constant 2,400 XP apart past Pathfinder", () => {
    for (const l of [12, 15, 18, 21, 24, 27, 30]) {
      expect(cumulativeXpForLevel(l) - cumulativeXpForLevel(l - 3)).toBe(2400);
    }
  });

  it("derives level from total xp", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
  });

  it("reports progress into the current level", () => {
    const p = getLevelProgress(150);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(50);
    expect(p.xpForNextLevel).toBe(200);
    expect(p.pct).toBe(25);
  });
});

describe("getStreakWithShields", () => {
  it("does not break on an unlogged today", () => {
    const range = [day({ weight: 80 }), day({ weight: 80 }), day({ weight: null })];
    expect(getStreakWithShields(range, 0).streak).toBe(2);
  });

  it("spends a shield to bridge a prior missed day", () => {
    const range = [day({ weight: 80 }), day({ weight: null }), day({ weight: 80 })];
    const result = getStreakWithShields(range, 1);
    expect(result.streak).toBe(2);
    expect(result.shieldsUsed).toBe(1);
    expect(result.protected).toBe(true);
  });

  it("breaks when out of shields", () => {
    const range = [day({ weight: 80 }), day({ weight: null }), day({ weight: 80 })];
    expect(getStreakWithShields(range, 0).streak).toBe(1);
  });
});

describe("earnedShields", () => {
  it("grants one shield per 7 fully-complete days, capped at 3", () => {
    const complete = day({ weight: 80, calories: 1, protein: 1, water: 1, steps: 1, exercise: "None" });
    expect(earnedShields(Array.from({ length: 6 }, () => complete))).toBe(0);
    expect(earnedShields(Array.from({ length: 7 }, () => complete))).toBe(1);
    expect(earnedShields(Array.from({ length: 40 }, () => complete))).toBe(3);
  });
});

describe("weight milestones", () => {
  it("lists 1kg crossings toward a loss goal", () => {
    expect(getWeightMilestones(85, 82)).toEqual([84, 83, 82]);
  });

  it("celebrates only newly crossed milestones", () => {
    expect(getNewlyCrossedMilestone(83.5, 85, 80, null)).toBe(84);
    expect(getNewlyCrossedMilestone(83.5, 85, 80, 84)).toBeNull();
    expect(getNewlyCrossedMilestone(82.9, 85, 80, 84)).toBe(83);
  });
});

describe("daily quests", () => {
  const goals = { caloriesMax: 2000, protein: 150, water: 7, steps: 10000 };
  const loggedQuest = (log: DailyLog | null) =>
    getDailyQuests(log, goals).find((q) => q.key === "daily-logged");

  it("marks the calorie quest complete only within budget", () => {
    const under = getDailyQuests(day({ calories: 1800 }), goals).find((q) => q.key === "daily-calories");
    const over = getDailyQuests(day({ calories: 2200 }), goals).find((q) => q.key === "daily-calories");
    expect(under?.completed).toBe(true);
    expect(over?.completed).toBe(false);
  });

  it("pays the show-up quest for logging at all, with no target to hit", () => {
    expect(loggedQuest(day({ weight: 80 }))?.completed).toBe(true);
    // Way over every target, but they turned up — it still pays.
    expect(loggedQuest(day({ weight: 80, calories: 9000, steps: 0 }))?.completed).toBe(true);
  });

  it("withholds the show-up quest before anything is logged", () => {
    expect(loggedQuest(null)?.completed).toBe(false);
    expect(loggedQuest(day({ calories: 1800 }))?.completed).toBe(false); // no weight yet
  });
});

describe("weekly weight averages", () => {
  const weighIn = (d: number, weight: number) =>
    day({ day: d, date: `2026-01-${String(d).padStart(2, "0")}`, weight });

  it("buckets days into the same weeks as the run chunker", () => {
    // Weeks 1-14 are 7 days; Week 15 is the 2-day tail (Days 99-100).
    const logs = Array.from({ length: 107 }, (_, i) => day({ day: i + 1 }));
    chunkIntoWeeks(logs).forEach((week, i) => {
      for (const d of week) expect(weekIndexForDay(d.day)).toBe(i + 1);
    });
  });

  it("marks the boundaries of the short final week", () => {
    expect(weekIndexForDay(98)).toBe(14);
    expect(weekIndexForDay(99)).toBe(15);
    expect(weekIndexForDay(100)).toBe(15);
    expect(weekIndexForDay(101)).toBe(16);
  });

  it("averages each week's weigh-ins to one decimal", () => {
    const weeks = getWeeklyWeightAverages([
      weighIn(1, 90), weighIn(2, 89), weighIn(3, 88.5),
      weighIn(8, 88), weighIn(9, 87),
    ]);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ week: 1, weight: 89.2, days: 3, firstDate: "2026-01-01", lastDate: "2026-01-03" });
    expect(weeks[1]).toMatchObject({ week: 2, weight: 87.5, days: 2 });
  });

  it("ignores days with no weigh-in and skips empty weeks entirely", () => {
    const weeks = getWeeklyWeightAverages([
      weighIn(1, 90), day({ day: 2, weight: null }),
      // Week 2 logged nothing at all.
      weighIn(15, 86),
    ]);
    expect(weeks.map((w) => w.week)).toEqual([1, 3]);
    expect(weeks[0].days).toBe(1);
  });

  it("works on a trailing window that doesn't start at Day 1", () => {
    // Free users only see their most recent days — the week numbers must still
    // be the run's, not the window's.
    const weeks = getWeeklyWeightAverages([weighIn(22, 84), weighIn(23, 83)]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].week).toBe(4);
  });

  it("returns nothing when no weight was ever logged", () => {
    expect(getWeeklyWeightAverages([day({ day: 1 }), day({ day: 2 })])).toEqual([]);
  });
});
