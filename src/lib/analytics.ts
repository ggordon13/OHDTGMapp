import { DailyLog } from "@/lib/mockData";
import {
  WeeklyGoals,
  chunkIntoWeeks,
  getWeeklyAvg,
  isAchieved,
  isDayLogged,
} from "@/lib/gamification";

// ---------------------------------------------------------------------------
// Progress analytics — the numbers behind the premium report / export.
// Everything here is derived from the same logs + goals the dashboard uses, so
// the export can never drift from what the user sees on screen.
// ---------------------------------------------------------------------------

export interface WeeklyBreakdownRow {
  week: number;
  weight: number | null;
  /** Weight vs the previous logged week: rose, held/fell, or no comparison. */
  weightTrend: "up" | "down" | null;
  calories: number | null;
  protein: number | null;
  water: number | null;
  steps: number | null;
  exerciseDays: number;
  totalDays: number;
  star: boolean;
}

export interface WeightAnalytics {
  start: number;
  latest: number;
  change: number;
  min: number;
  max: number;
}

export interface AnalyticsSummary {
  daysLogged: number;
  totalDays: number;
  weeks: number;
  starWeeks: number;
  /** Null until at least one weight has been logged. */
  weight: WeightAnalytics | null;
  averages: {
    calories: number | null;
    protein: number | null;
    water: number | null;
    steps: number | null;
  };
  goals: WeeklyGoals;
  weekly: WeeklyBreakdownRow[];
}

/** Mean of the non-null numbers, rounded to one decimal, or null if none. */
function mean(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

export function computeAnalytics(logs: DailyLog[], goals: WeeklyGoals): AnalyticsSummary {
  const weeks = chunkIntoWeeks(logs);

  let prevWeight: number | null = null;
  const weekly: WeeklyBreakdownRow[] = weeks.map((week, i) => {
    const avg = getWeeklyAvg(week);
    const weightTrend: "up" | "down" | null =
      avg.weight === null || prevWeight === null ? null : avg.weight > prevWeight ? "up" : "down";
    if (avg.weight !== null) prevWeight = avg.weight;
    return {
      week: i + 1,
      weight: avg.weight,
      weightTrend,
      calories: avg.calories,
      protein: avg.protein,
      water: avg.water,
      steps: avg.steps,
      exerciseDays: avg.exerciseDays,
      totalDays: avg.totalDays,
      star: isAchieved(avg, goals),
    };
  });

  const weighed = logs.filter((l) => l.weight != null).map((l) => l.weight as number);
  const weight: WeightAnalytics | null = weighed.length
    ? {
        start: weighed[0],
        latest: weighed[weighed.length - 1],
        change: Math.round((weighed[weighed.length - 1] - weighed[0]) * 10) / 10,
        min: Math.min(...weighed),
        max: Math.max(...weighed),
      }
    : null;

  return {
    daysLogged: logs.filter(isDayLogged).length,
    totalDays: logs.length,
    weeks: weeks.length,
    starWeeks: weekly.filter((w) => w.star).length,
    weight,
    averages: {
      calories: mean(logs.map((l) => l.calories)),
      protein: mean(logs.map((l) => l.protein)),
      water: mean(logs.map((l) => l.water)),
      steps: mean(logs.map((l) => l.steps)),
    },
    goals,
    weekly,
  };
}
