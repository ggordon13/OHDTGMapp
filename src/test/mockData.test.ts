import { describe, it, expect } from "vitest";
import { buildDayRange } from "@/lib/mockData";

describe("buildDayRange", () => {
  it("keeps the starting date unchanged when generating the daily range", () => {
    const range = buildDayRange("2026-06-16", "2026-06-16", []);

    expect(range[0]?.date).toBe("2026-06-16");
  });
});
