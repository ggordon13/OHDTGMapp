import { describe, expect, it } from "vitest";
import { requiresProfileSetup } from "../lib/profile";

describe("requiresProfileSetup", () => {
  it("returns false when the profile already has the required details", () => {
    expect(requiresProfileSetup({ age: 28, activity_level: "lightly_active" } as any)).toBe(false);
  });

  it("returns true for a first-time profile that is still missing setup data", () => {
    expect(requiresProfileSetup(null)).toBe(true);
    expect(requiresProfileSetup({ age: null, activity_level: null } as any)).toBe(true);
  });
});
