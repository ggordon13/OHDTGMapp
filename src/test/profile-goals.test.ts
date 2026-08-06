import { describe, it, expect } from "vitest";
import {
  targetWeightRange,
  recommendedTargetRange,
  minHealthyWeight,
  isAtOrBelowHealthyFloor,
  minSafeCalories,
  calculateTargets,
  MIN_HEALTHY_BMI,
} from "@/lib/profile";

describe("targetWeightRange", () => {
  it("lets a losing user pick between 13% and 2% below their current weight", () => {
    const r = targetWeightRange(100, "lose");
    expect(r.min).toBe(87);
    expect(r.max).toBe(98); // at most 2% below current
  });

  it("keeps a maintaining user within ±0.5% of their current weight", () => {
    const r = targetWeightRange(100, "maintain");
    expect(r.min).toBe(99.5);
    expect(r.max).toBe(100.5);
  });

  it("rounds bounds to one decimal", () => {
    expect(targetWeightRange(76, "lose").min).toBe(66.1);
    expect(targetWeightRange(76, "maintain")).toEqual({ min: 75.6, max: 76.4 });
  });
});

describe("recommendedTargetRange", () => {
  it("suggests a 9–13% drop for losing", () => {
    expect(recommendedTargetRange(100, "lose")).toEqual({ min: 87, max: 91 });
  });

  it("matches the allowed band for maintaining", () => {
    expect(recommendedTargetRange(100, "maintain")).toEqual(targetWeightRange(100, "maintain"));
  });
});

// ---------------------------------------------------------------------------
// Safety floors.
//
// The percentage limits above are *relative*, so on their own they ratchet:
// 13% off, then 13% off that, and after a few 100-day runs the app would coach
// someone into being underweight. These are the absolute limits that stop it.
// ---------------------------------------------------------------------------

describe("healthy-weight floor", () => {
  it("computes the BMI 18.5 weight for a height", () => {
    // 1.75 m → 18.5 × 1.75² = 56.65 kg
    expect(minHealthyWeight(175)).toBeCloseTo(56.7, 1);
    expect(MIN_HEALTHY_BMI).toBe(18.5);
  });

  it("returns null without a height, so the relative rules still apply", () => {
    expect(minHealthyWeight(null)).toBeNull();
    expect(targetWeightRange(100, "lose")).toEqual({ min: 87, max: 98 });
  });

  it("clamps a losing target to the floor instead of 13% below", () => {
    // 60 kg at 1.75 m: 13% below is 52.2, under the 56.7 floor.
    const r = targetWeightRange(60, "lose", 175);
    expect(r.min).toBeCloseTo(56.7, 1);
    expect(r.min).toBeGreaterThan(60 * 0.87);
  });

  it("leaves a heavier user's range untouched", () => {
    // 100 kg at 1.75 m: 13% below is 87, well clear of the floor.
    expect(targetWeightRange(100, "lose", 175)).toEqual({ min: 87, max: 98 });
  });

  it("never recommends below the floor either", () => {
    expect(recommendedTargetRange(60, "lose", 175).min).toBeGreaterThanOrEqual(
      minHealthyWeight(175)!,
    );
  });

  it("flags someone already at or under the floor", () => {
    expect(isAtOrBelowHealthyFloor(55, 175)).toBe(true);
    expect(isAtOrBelowHealthyFloor(80, 175)).toBe(false);
    // No height means no judgement to make.
    expect(isAtOrBelowHealthyFloor(40, null)).toBe(false);
  });
});

describe("calorie floor", () => {
  it("never targets below the safe minimum", () => {
    // A heavy user on an aggressive deficit is where the maths goes lowest.
    const t = calculateTargets(30, 160, 130, "female", "sedentary", "lose", 113, true);
    expect(t.calorieMin).toBeGreaterThanOrEqual(minSafeCalories("female"));
    expect(t.calorieMax).toBeGreaterThanOrEqual(minSafeCalories("female"));
  });

  it("uses the higher floor for men", () => {
    expect(minSafeCalories("male")).toBe(1500);
    expect(minSafeCalories("female")).toBe(1200);
  });

  it("leaves normal targets alone", () => {
    const t = calculateTargets(30, 175, 85, "male", "moderate", "lose", 74, true);
    expect(t.calorieMax).toBeGreaterThan(minSafeCalories("male"));
  });
});
