import { describe, expect, it } from "vitest";
import { DailyLog } from "@/lib/mockData";
import {
  WeeklyGoals,
  chunkIntoWeeks,
  getEarnedBadges,
  getLastSettledWeek,
  getWeeklyQuests,
  isWeekSettled,
  isWeekWhole,
  settledWeeks,
  weekLength,
} from "@/lib/gamification";
import { computeAnalytics } from "@/lib/analytics";
import { formatDateInputValue } from "@/lib/utils";

const goals: WeeklyGoals = { dailyCalories: 2000, dailyProtein: 150, dailyWater: 7, dailySteps: 10000 };

/** A day that clears every target, so any full week of them is a ⭐ week. */
const perfectDay = (i: number): DailyLog => ({
  date: `2026-02-${String(i + 1).padStart(2, "0")}`,
  day: i + 1,
  weight: 80,
  calories: 1800,
  protein: 160,
  water: 8,
  exercise: "Strength Training",
  steps: 12000,
});

const run = (days: number) => Array.from({ length: days }, (_, i) => perfectDay(i));

describe("isWeekSettled", () => {
  it("settles a 7-day week only once day 7 is in the past", () => {
    const week = run(7); // Feb 1 → Feb 7
    expect(isWeekSettled(week, "2026-02-07")).toBe(false); // still day 7
    expect(isWeekSettled(week, "2026-02-08")).toBe(true); // 11:59pm passed
  });

  it("never settles a week short of 7 days", () => {
    expect(isWeekSettled(run(6), "2026-03-01")).toBe(false);
    expect(isWeekSettled(run(1), "2026-03-01")).toBe(false);
    expect(isWeekSettled([], "2026-03-01")).toBe(false);
  });

  it("drops only the week in progress from a run", () => {
    // 10 days on Feb 10: week 1 (Feb 1–7) is done, week 2 (Feb 8–10) is live.
    const weeks = chunkIntoWeeks(run(10));
    expect(weeks).toHaveLength(2);
    expect(settledWeeks(weeks, "2026-02-10")).toHaveLength(1);
  });
});

describe("getLastSettledWeek", () => {
  it("is null while the very first week is still running", () => {
    expect(getLastSettledWeek(run(5), "2026-02-05")).toBeNull();
    expect(getLastSettledWeek(run(7), "2026-02-07")).toBeNull();
  });

  it("returns the most recently finished week", () => {
    const week = getLastSettledWeek(run(10), "2026-02-10");
    expect(week).not.toBeNull();
    expect(week?.[0].date).toBe("2026-02-01");
    expect(week?.[6].date).toBe("2026-02-07");
  });
});

describe("the ⭐ week quest", () => {
  it("cannot be completed before any week has finished", () => {
    const days = run(4);
    const star = getWeeklyQuests(days, goals, getLastSettledWeek(days, "2026-02-04")).find(
      (q) => q.key === "weekly-star",
    );
    expect(star?.completed).toBe(false);
    expect(star?.period).toBeUndefined();
    expect(star?.description).toContain("once all 7 days are done");
  });

  it("completes on the finished week and claims against that week's period", () => {
    const days = run(10);
    const star = getWeeklyQuests(days, goals, getLastSettledWeek(days, "2026-02-10")).find(
      (q) => q.key === "weekly-star",
    );
    expect(star?.completed).toBe(true);
    expect(star?.period).toBe("2026-02-01"); // the settled week, not the live one
  });

  it("leaves the progressive weekly quests on the week in progress", () => {
    const days = run(10);
    const quests = getWeeklyQuests(days.slice(7), goals, getLastSettledWeek(days, "2026-02-10"));
    const consistency = quests.find((q) => q.key === "weekly-consistency");
    expect(consistency?.period).toBeUndefined(); // falls back to the live period
    expect(consistency?.current).toBe(3);
  });
});

describe("week-based trophies", () => {
  it("withholds the Bronze Star until the first week is over", () => {
    const keys = (days: DailyLog[], today: string) =>
      getEarnedBadges(days, goals, undefined, today).map((b) => b.key);

    // Seven perfect days, but it is still day 7 — nothing is decided yet.
    expect(keys(run(7), "2026-02-07")).not.toContain("star-bronze");
    // The calendar rolls over and the week is judged.
    expect(keys(run(7), "2026-02-08")).toContain("star-bronze");
  });

  it("does not award a week trophy off a strong partial week", () => {
    // Five perfect days into week 1 would satisfy Step Master and Hydration
    // Hero on the old mid-week scoring; now the week has to end first.
    const keys = getEarnedBadges(run(5), goals, undefined, "2026-02-05").map((b) => b.key);
    expect(keys).not.toContain("step-master");
    expect(keys).not.toContain("hydration-hero");
    expect(keys).toContain("first-steps"); // day-based trophies are unaffected
  });

  it("still counts consecutive stars across finished weeks", () => {
    const keys = getEarnedBadges(run(21), goals, undefined, "2026-02-22").map((b) => b.key);
    expect(keys).toContain("star-silver"); // 3 finished ⭐ weeks in a row
  });
});

describe("turning-up trophies", () => {
  // Logs faithfully, hits nothing. The weight is in — so the day counts and the
  // streak runs — but every target is missed, so no ⭐ week can ever settle and
  // none of the achievement-gated trophies are reachable. This is the user the
  // volume/streak trophies exist for.
  const slackerRun = (days: number, weightAt: (i: number) => number = (i) => 85 - i * 0.15): DailyLog[] =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date(2026, 1, 1);
      d.setDate(d.getDate() + i);
      return {
        date: formatDateInputValue(d),
        day: i + 1,
        weight: weightAt(i),
        calories: 3200, // over budget
        protein: 40, // under target
        water: 1, // under target
        exercise: "None",
        steps: 1200, // under target
      };
    });

  /** Badge keys as of the day after the run ends, so every week has settled. */
  const keysAfter = (days: DailyLog[], weightOpts?: { startWeight: number; targetWeight: number }) => {
    const end = new Date(2026, 1, 1);
    end.setDate(end.getDate() + days.length + 1);
    return getEarnedBadges(days, goals, weightOpts, formatDateInputValue(end)).map((b) => b.key);
  };

  it("unlocks without a single ⭐ week", () => {
    const keys = keysAfter(slackerRun(30));
    expect(keys).toContain("committed");
    expect(keys).toContain("three-week-streak");
    // The point of the exercise: nothing target-gated is within reach.
    expect(keys).not.toContain("star-bronze");
    expect(keys).not.toContain("step-master");
    expect(keys).not.toContain("hydration-hero");
    expect(keys).not.toContain("perfectionist");
  });

  it("steps up with days logged", () => {
    expect(keysAfter(slackerRun(20))).not.toContain("committed");
    expect(keysAfter(slackerRun(30))).not.toContain("halfway-there");
    expect(keysAfter(slackerRun(50))).toContain("halfway-there");
    expect(keysAfter(slackerRun(100))).toContain("century-club");
  });

  it("credits weight progress in whichever direction the goal runs", () => {
    // Losing: 85 → 80.65 is 4.35 kg toward a 75 kg target.
    expect(keysAfter(slackerRun(30), { startWeight: 85, targetWeight: 75 })).toContain("moving-the-needle");
    // Gaining: 60 → 64.35 is 4.35 kg toward a 70 kg target.
    expect(
      keysAfter(slackerRun(30, (i) => 60 + i * 0.15), { startWeight: 60, targetWeight: 70 }),
    ).toContain("moving-the-needle");
  });

  it("does not credit weight moving away from the target", () => {
    // Target is 75 but they gained — progress is negative, not 4.35.
    expect(
      keysAfter(slackerRun(30, (i) => 85 + i * 0.15), { startWeight: 85, targetWeight: 75 }),
    ).not.toContain("moving-the-needle");
  });
});

describe("Week 15 — the 2-day tail of the run", () => {
  // Day 1 is 2026-02-01, so Day N is 2026-02-01 + (N-1). Day 99 → 2026-05-10,
  // Day 100 → 2026-05-11.
  const fullRun = (days: number) =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date(2026, 1, 1);
      d.setDate(d.getDate() + i);
      return { ...perfectDay(0), date: formatDateInputValue(d), day: i + 1 };
    });

  it("chunks Days 99–100 into their own week instead of spilling past Day 100", () => {
    const weeks = chunkIntoWeeks(fullRun(100));
    expect(weeks).toHaveLength(15);
    expect(weeks[13]).toHaveLength(7); // Wk 14 = Days 92–98
    expect(weeks[14]).toHaveLength(2); // Wk 15 = Days 99–100
    expect(weeks[14][0].day).toBe(99);
    expect(weeks[14][1].day).toBe(100);
  });

  it("keeps overtime days in their own weeks after Day 100", () => {
    const weeks = chunkIntoWeeks(fullRun(104));
    expect(weeks).toHaveLength(16);
    expect(weeks[14].map((d) => d.day)).toEqual([99, 100]);
    expect(weeks[15].map((d) => d.day)).toEqual([101, 102, 103, 104]);
  });

  it("needs only its 2 days to be whole", () => {
    const weeks = chunkIntoWeeks(fullRun(100));
    expect(weekLength(weeks[14])).toBe(2);
    expect(weekLength(weeks[13])).toBe(7);
    expect(isWeekWhole(weeks[14])).toBe(true);
    // Day 99 alone is still mid-week.
    expect(isWeekWhole(chunkIntoWeeks(fullRun(99))[14])).toBe(false);
  });

  it("is still only scored once Day 100 is over", () => {
    const wk15 = chunkIntoWeeks(fullRun(100))[14];
    expect(isWeekSettled(wk15, "2026-05-11")).toBe(false); // Day 100 itself
    expect(isWeekSettled(wk15, "2026-05-12")).toBe(true); // the morning after
  });

  it("makes Virtuoso reachable off the 14 whole weeks alone", () => {
    // Days 1–98: every full week is a ⭐ week, Week 15 not yet played.
    const keys = getEarnedBadges(fullRun(98), goals, undefined, "2026-05-10").map((b) => b.key);
    expect(keys).toContain("virtuoso");
  });

  it("does not hand Virtuoso out early", () => {
    // 13 settled ⭐ weeks (Days 1–91) is one short.
    const keys = getEarnedBadges(fullRun(91), goals, undefined, "2026-05-03").map((b) => b.key);
    expect(keys).toContain("medallion-gold"); // 12 stars, so the tier below lands
    expect(keys).not.toContain("virtuoso");
  });

  it("scales the day-count quests down so they stay reachable", () => {
    const wk15 = chunkIntoWeeks(fullRun(100))[14];
    const quests = getWeeklyQuests(wk15, goals);
    expect(quests.find((q) => q.key === "weekly-consistency")?.target).toBe(2);
    expect(quests.find((q) => q.key === "weekly-hydration")?.target).toBe(2);
    // A normal week keeps the usual 5-of-7 bar.
    expect(getWeeklyQuests(run(7), goals).find((q) => q.key === "weekly-consistency")?.target).toBe(5);
  });

  it("can earn a star, so a full run has 15 scorable weeks", () => {
    const a = computeAnalytics(fullRun(100), goals, "2026-05-12");
    expect(a.weeks).toBe(15);
    expect(a.settledWeeks).toBe(15);
    expect(a.starWeeks).toBe(15);
    expect(a.weekly[14].totalDays).toBe(2);
    expect(a.weekly[14].star).toBe(true);
  });
});

describe("analytics week rows", () => {
  it("flags the live week as unsettled and leaves it starless", () => {
    const a = computeAnalytics(run(10), goals, "2026-02-10");
    expect(a.weeks).toBe(2);
    expect(a.settledWeeks).toBe(1);
    expect(a.starWeeks).toBe(1);
    expect(a.weekly[0].settled).toBe(true);
    expect(a.weekly[0].star).toBe(true);
    expect(a.weekly[1].settled).toBe(false);
    expect(a.weekly[1].star).toBe(false);
  });
});
