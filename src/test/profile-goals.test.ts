import { describe, it, expect } from "vitest";
import { targetWeightRange, recommendedTargetRange } from "@/lib/profile";

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
