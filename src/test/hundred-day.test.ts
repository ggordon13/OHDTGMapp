import { describe, expect, it } from "vitest";
import { DailyLog } from "@/lib/mockData";
import { Badge, WeeklyGoals } from "@/lib/gamification";
import { buildRunSummary, canFinishRun, runSealDate, toArchivedBadge, weightVerdict } from "@/lib/hundredDay";
import { formatDateInputValue } from "@/lib/utils";

const goals: WeeklyGoals = {
  dailyCalories: 2000,
  dailyProtein: 150,
  dailyWater: 7,
  dailySteps: 10000,
};

/** `days` sequential days from Jan 1 2026, with per-day overrides by index. */
const buildRun = (days: number, over: (i: number) => Partial<DailyLog> = () => ({})): DailyLog[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(2026, 0, 1);
    d.setDate(d.getDate() + i);
    return {
      date: formatDateInputValue(d),
      day: i + 1,
      weight: null,
      calories: null,
      protein: null,
      water: null,
      exercise: "",
      steps: null,
      ...over(i),
    };
  });

describe("canFinishRun", () => {
  it("opens on Day 100 and stays open past it", () => {
    expect(canFinishRun(99)).toBe(false);
    expect(canFinishRun(100)).toBe(true);
    expect(canFinishRun(137)).toBe(true);
  });

  it("is closed before the run has started", () => {
    expect(canFinishRun(0)).toBe(false);
  });
});

describe("runSealDate", () => {
  it("is the day after Day 100, so locking in settles every week", () => {
    expect(runSealDate("2026-05-11")).toBe("2026-05-12");
  });

  it("rolls over month and year boundaries", () => {
    expect(runSealDate("2026-01-31")).toBe("2026-02-01");
    expect(runSealDate("2026-12-31")).toBe("2027-01-01");
  });

  it("settles the run's 2-day final week", () => {
    // Day 1 = 2026-02-01 → Day 100 = 2026-05-11.
    const dayRange = buildRun(100);
    const sealed = buildRunSummary({
      dayRange,
      goals,
      startWeight: 80,
      targetWeight: 74,
      badges: [],
      xp: 0,
      level: 1,
      asOf: runSealDate(dayRange[99].date),
    });
    // 14 full weeks + the 2-day Week 15, all judged.
    expect(sealed.totalWeeks).toBe(15);
  });
});

describe("buildRunSummary", () => {
  it("reports Day 1 vs the final weight, the change and the percentage", () => {
    // 90 kg on Day 1 easing down to 81 kg by Day 100 — a 10% drop.
    const dayRange = buildRun(100, (i) => ({ weight: 90 - (i * 9) / 99 }));
    const summary = buildRunSummary({
      dayRange,
      goals,
      startWeight: 90,
      targetWeight: 81,
      badges: [],
      xp: 4200,
      level: 10,
    });

    expect(summary.startWeight).toBe(90);
    expect(summary.endWeight).toBe(81);
    expect(summary.weightChange).toBe(-9);
    expect(summary.weightChangePct).toBe(-10);
    expect(summary.targetReached).toBe(true);
    expect(summary.totalDays).toBe(100);
    expect(summary.levelAtFinish).toBe(10);
    expect(summary.xpAtFinish).toBe(4200);
  });

  it("ignores days logged past Day 100", () => {
    // Day 101+ sit far above the goal; they must not move the numbers.
    const dayRange = buildRun(110, (i) => ({ weight: i < 100 ? 80 : 200 }));
    const summary = buildRunSummary({
      dayRange,
      goals,
      startWeight: 80,
      targetWeight: 74,
      badges: [],
      xp: 0,
      level: 1,
    });

    expect(summary.totalDays).toBe(100);
    expect(summary.endWeight).toBe(80);
    expect(summary.highestWeight).toBe(80);
  });

  it("falls back to the first weigh-in when there is no profile baseline", () => {
    const dayRange = buildRun(100, (i) => ({ weight: i === 0 ? null : 70 + i }));
    const summary = buildRunSummary({
      dayRange,
      goals,
      startWeight: null,
      targetWeight: null,
      badges: [],
      xp: 0,
      level: 1,
    });

    expect(summary.startWeight).toBe(71); // Day 2's weight — the first one logged
    expect(summary.targetReached).toBe(false);
  });

  it("averages only the days that carry a value", () => {
    const dayRange = buildRun(100, (i) => (i < 10 ? { calories: 2000, steps: 12000 } : {}));
    const summary = buildRunSummary({
      dayRange,
      goals,
      startWeight: 80,
      targetWeight: 74,
      badges: [],
      xp: 0,
      level: 1,
    });

    expect(summary.averages.calories).toBe(2000);
    expect(summary.averages.steps).toBe(12000);
    expect(summary.averages.protein).toBeNull();
  });

  it("counts consistency: logged days, full logs, streak and exercise", () => {
    const dayRange = buildRun(100, (i) =>
      i < 20
        ? { weight: 80, calories: 1900, protein: 160, water: 8, steps: 11000, exercise: "Sports" }
        : {},
    );
    const summary = buildRunSummary({
      dayRange,
      goals,
      startWeight: 80,
      targetWeight: 74,
      badges: [],
      xp: 0,
      level: 1,
    });

    expect(summary.daysLogged).toBe(20);
    expect(summary.daysComplete).toBe(20);
    expect(summary.longestStreak).toBe(20);
    expect(summary.exerciseDays).toBe(20);
  });

  it("handles a run with nothing logged at all", () => {
    const summary = buildRunSummary({
      dayRange: buildRun(100),
      goals,
      startWeight: null,
      targetWeight: null,
      badges: [],
      xp: 0,
      level: 1,
    });

    expect(summary.endWeight).toBeNull();
    expect(summary.weightChange).toBeNull();
    expect(summary.weightChangePct).toBeNull();
    expect(summary.lowestWeight).toBeNull();
    expect(summary.daysLogged).toBe(0);
  });

  it("counts a gain toward the goal when the target is above the start", () => {
    const dayRange = buildRun(100, () => ({ weight: 66 }));
    const summary = buildRunSummary({
      dayRange,
      goals,
      startWeight: 60,
      targetWeight: 65,
      badges: [],
      xp: 0,
      level: 1,
    });

    expect(summary.weightChange).toBe(6);
    expect(summary.targetReached).toBe(true);
    expect(weightVerdict(summary).tone).toBe("good");
  });
});

describe("weightVerdict", () => {
  it("reads weight coming off as progress on a losing goal", () => {
    expect(weightVerdict({ weightChange: -4, startWeight: 90, targetWeight: 82 }).tone).toBe("good");
    expect(weightVerdict({ weightChange: 4, startWeight: 90, targetWeight: 82 }).tone).toBe("bad");
  });

  it("is neutral with no change or no weigh-ins", () => {
    expect(weightVerdict({ weightChange: 0, startWeight: 90, targetWeight: 82 }).tone).toBe("neutral");
    expect(weightVerdict({ weightChange: null, startWeight: null, targetWeight: null }).tone).toBe("neutral");
  });
});

describe("toArchivedBadge", () => {
  const badge: Badge = {
    key: "star-gold",
    label: "Gold Star",
    description: "6 ⭐ weeks in a row",
    tier: "gold",
    icon: "★",
    iconColor: "#fff3b0",
    xp: 200,
  };

  it("freezes a live badge into the archive shape", () => {
    expect(toArchivedBadge(badge)).toEqual({
      key: "star-gold",
      label: "Gold Star",
      description: "6 ⭐ weeks in a row",
      tier: "gold",
      icon: "★",
      iconColor: "#fff3b0",
      xp: 200,
    });
  });

  it("omits iconColor when the badge has none", () => {
    const { iconColor: _drop, ...plain } = badge;
    expect(toArchivedBadge(plain)).not.toHaveProperty("iconColor");
  });

  it("drops any extra runtime state, like the unlocked flag", () => {
    const archived = toArchivedBadge({ ...badge, unlocked: true } as Badge & { unlocked: boolean });
    expect(archived).not.toHaveProperty("unlocked");
  });
});
