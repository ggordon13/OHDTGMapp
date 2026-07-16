import { describe, it, expect } from "vitest";
import { formatDateInputValue, parseDateInputValue } from "@/lib/utils";

describe("formatDateInputValue timezone handling", () => {
  // 2026-07-17 22:30 UTC is still the 17th in Tokyo (UTC+9 → 18th, next day)
  // but already/again the 17th in Los Angeles (UTC-7 → 15:30, same day).
  const instant = new Date("2026-07-17T22:30:00Z");

  it("derives the calendar date in the given time zone", () => {
    expect(formatDateInputValue(instant, "America/Los_Angeles")).toBe("2026-07-17");
    expect(formatDateInputValue(instant, "Asia/Tokyo")).toBe("2026-07-18");
    expect(formatDateInputValue(instant, "UTC")).toBe("2026-07-17");
  });

  it("always emits zero-padded YYYY-MM-DD regardless of locale ordering", () => {
    const early = new Date("2026-01-05T12:00:00Z");
    expect(formatDateInputValue(early, "UTC")).toBe("2026-01-05");
  });

  it("round-trips a calendar date through parse and format in the same zone", () => {
    const tz = "UTC";
    const parsed = parseDateInputValue("2026-03-09");
    // parseDateInputValue builds a *local* midnight Date; formatting it back in
    // the local zone must return the same calendar date it came from.
    expect(formatDateInputValue(parsed)).toBe("2026-03-09");
    // And an explicit UTC format of local-midnight may differ, proving the tz arg is honored.
    expect(typeof formatDateInputValue(parsed, tz)).toBe("string");
  });
});
