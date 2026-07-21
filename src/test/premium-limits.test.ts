import { describe, expect, it } from "vitest";
import { canEditStartingData, historyDayLimit, FREE_HISTORY_DAYS, STARTING_DATA_LOCK_DAYS } from "@/lib/access";

describe("historyDayLimit", () => {
  it("caps free users to the trailing free window", () => {
    expect(historyDayLimit("free", "user")).toBe(FREE_HISTORY_DAYS);
    expect(historyDayLimit(null, null)).toBe(FREE_HISTORY_DAYS);
  });

  it("gives premium users and staff unlimited history", () => {
    expect(historyDayLimit("premium", "user")).toBeNull();
    expect(historyDayLimit("free", "admin")).toBeNull();
    expect(historyDayLimit("free", "dev")).toBeNull();
  });
});

describe("canEditStartingData", () => {
  const now = new Date("2026-07-21T00:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  it("blocks free users outright", () => {
    const state = canEditStartingData("free", "user", null, now);
    expect(state.allowed).toBe(false);
    expect(state.reason).toMatch(/premium/i);
  });

  it("always allows staff regardless of level or recency", () => {
    expect(canEditStartingData("free", "admin", daysAgo(0), now).allowed).toBe(true);
    expect(canEditStartingData("free", "dev", daysAgo(1), now).allowed).toBe(true);
  });

  it("allows a premium user who has never changed it", () => {
    expect(canEditStartingData("premium", "user", null, now).allowed).toBe(true);
  });

  it("blocks a premium user inside the 30-day window and reports days left", () => {
    const state = canEditStartingData("premium", "user", daysAgo(10), now);
    expect(state.allowed).toBe(false);
    expect(state.reason).toMatch(/20 days/);
    expect(state.nextAllowedAt).toBeInstanceOf(Date);
  });

  it("allows a premium user once the window has fully elapsed", () => {
    expect(canEditStartingData("premium", "user", daysAgo(STARTING_DATA_LOCK_DAYS), now).allowed).toBe(true);
    expect(canEditStartingData("premium", "user", daysAgo(STARTING_DATA_LOCK_DAYS + 1), now).allowed).toBe(true);
  });

  it("treats an unparseable timestamp as no prior change", () => {
    expect(canEditStartingData("premium", "user", "not-a-date", now).allowed).toBe(true);
  });
});
