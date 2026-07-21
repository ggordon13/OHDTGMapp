import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/lib/analytics";
import type { DailyLog } from "@/lib/mockData";
import type { WeeklyGoals } from "@/lib/gamification";

const goals: WeeklyGoals = { dailyCalories: 2000, dailyProtein: 150, dailyWater: 7, dailySteps: 10000 };

function day(i: number, weight: number | null, over: Partial<DailyLog> = {}): DailyLog {
  return {
    date: `2026-02-${String(i).padStart(2, "0")}`,
    day: i,
    weight,
    calories: 1800,
    protein: 160,
    water: 8,
    exercise: "Strength Training",
    steps: 11000,
    ...over,
  };
}

describe("computeAnalytics", () => {
  it("summarizes weight journey, averages, and weekly rows", () => {
    // Two full weeks: week 1 averages ~85, week 2 ~83 → a downward trend.
    const week1 = Array.from({ length: 7 }, (_, i) => day(i + 1, 85));
    const week2 = Array.from({ length: 7 }, (_, i) => day(i + 8, 83));
    const a = computeAnalytics([...week1, ...week2], goals);

    expect(a.totalDays).toBe(14);
    expect(a.daysLogged).toBe(14);
    expect(a.weeks).toBe(2);
    expect(a.weight).not.toBeNull();
    expect(a.weight!.start).toBe(85);
    expect(a.weight!.latest).toBe(83);
    expect(a.weight!.change).toBe(-2);

    // Every day meets calories+protein+steps+exercise, so both weeks are stars.
    expect(a.starWeeks).toBe(2);

    expect(a.weekly[0].weightTrend).toBeNull(); // no prior week
    expect(a.weekly[1].weightTrend).toBe("down");

    expect(a.averages.calories).toBe(1800);
    expect(a.averages.protein).toBe(160);
  });

  it("handles an empty / weightless history without crashing", () => {
    const a = computeAnalytics([], goals);
    expect(a.weight).toBeNull();
    expect(a.starWeeks).toBe(0);
    expect(a.weekly).toHaveLength(0);
    expect(a.averages.steps).toBeNull();
  });

  it("marks a rising week as an upward trend", () => {
    const week1 = Array.from({ length: 7 }, (_, i) => day(i + 1, 80));
    const week2 = Array.from({ length: 7 }, (_, i) => day(i + 8, 82));
    const a = computeAnalytics([...week1, ...week2], goals);
    expect(a.weekly[1].weightTrend).toBe("up");
    expect(a.weight!.change).toBe(2);
  });
});
