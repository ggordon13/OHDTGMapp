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
  it("uses a triangular cumulative curve", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(3)).toBe(300);
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
  it("marks the calorie quest complete only within budget", () => {
    const goals = { caloriesMax: 2000, protein: 150, water: 7, steps: 10000 };
    const under = getDailyQuests(day({ calories: 1800 }), goals).find((q) => q.key === "daily-calories");
    const over = getDailyQuests(day({ calories: 2200 }), goals).find((q) => q.key === "daily-calories");
    expect(under?.completed).toBe(true);
    expect(over?.completed).toBe(false);
  });
});
