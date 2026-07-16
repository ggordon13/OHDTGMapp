import { describe, expect, it } from "vitest";
import { isAchieved } from "@/lib/gamification";

describe("isAchieved", () => {
  it("counts a single exercise day per week as enough", () => {
    const avg = {
      calories: 1800,
      protein: 160,
      water: 7,
      steps: 10000,
      exerciseDays: 1,
      totalDays: 7,
    };

    const goals = {
      dailyCalories: 2000,
      dailyProtein: 150,
      dailyWater: 7,
      dailySteps: 10000,
    };

    expect(isAchieved(avg, goals)).toBe(true);
  });
});
