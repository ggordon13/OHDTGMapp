import { DailyLog } from "@/lib/mockData";
import { Badge, WeeklyGoals, getLongestStreak, isDayComplete, isDayLogged } from "@/lib/gamification";
import { computeAnalytics } from "@/lib/analytics";
import { CHALLENGE_DAYS } from "@/lib/access";
import { formatDateInputValue, parseDateInputValue } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The 100-day run: finishing it, and the report card that gets archived.
// ---------------------------------------------------------------------------

/** A trophy as it is frozen into the archive (no unlock predicate, no state). */
export interface ArchivedBadge {
  key: string;
  label: string;
  description: string;
  tier: string;
  icon: string;
  iconColor?: string;
  xp: number;
}

/** The Day 1 → Day 100 report card stored with a finished run. */
export interface RunSummary {
  /** Day 1 weight — the profile baseline, falling back to the first weigh-in. */
  startWeight: number | null;
  /** Day 100's weight, or the last one logged in the run if Day 100 is blank. */
  endWeight: number | null;
  /** endWeight − startWeight. Negative means weight came off. */
  weightChange: number | null;
  /** Signed change as a percentage of the starting weight. */
  weightChangePct: number | null;
  /** Lightest and heaviest weigh-ins recorded during the run. */
  lowestWeight: number | null;
  highestWeight: number | null;
  /** The goal that was in play, so the archive can judge progress later. */
  targetWeight: number | null;
  targetReached: boolean;
  daysLogged: number;
  daysComplete: number;
  totalDays: number;
  longestStreak: number;
  starWeeks: number;
  /** Weeks that ran their full 7 days — the ones a star could be called on. */
  totalWeeks: number;
  averages: {
    weight: number | null;
    calories: number | null;
    protein: number | null;
    water: number | null;
    steps: number | null;
  };
  exerciseDays: number;
  /** The goals the run was scored against, for context in the archive. */
  goals: WeeklyGoals;
  /** Trophies on the shelf when the run ended. */
  trophyCount: number;
  /** Lifetime XP at the moment the run was finished. */
  xpAtFinish: number;
  /** Level at the moment the run was finished. */
  levelAtFinish: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mean of the non-null numbers, to one decimal, or null when there are none. */
function mean(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (!valid.length) return null;
  return round1(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export interface RunSummaryInput {
  /** The run's days, Day 1 first (the dashboard's dayRange). */
  dayRange: DailyLog[];
  goals: WeeklyGoals;
  /** Baseline weight the run started from (profile.current_weight). */
  startWeight: number | null;
  targetWeight: number | null;
  badges: Badge[];
  xp: number;
  level: number;
  /**
   * Date the run is scored as of — normally {@link runSealDate}, so a run being
   * closed out has every week (Week 15 included) judged. Defaults to the real
   * calendar date.
   */
  asOf?: string;
}

/**
 * The report card for a run. Only the first {@link CHALLENGE_DAYS} days count,
 * so days logged past Day 100 (before the user got around to finishing) never
 * distort the numbers.
 */
export function buildRunSummary({
  dayRange,
  goals,
  startWeight,
  targetWeight,
  badges,
  xp,
  level,
  asOf,
}: RunSummaryInput): RunSummary {
  const days = dayRange.slice(0, CHALLENGE_DAYS);
  const analytics = computeAnalytics(days, goals, asOf);

  const weighed = days.filter((d) => d.weight != null).map((d) => d.weight as number);
  // Day 1 weight: prefer the profile baseline, fall back to the first weigh-in.
  const start = startWeight ?? (weighed.length ? weighed[0] : null);
  // Day 100 weight: the final day if it was weighed, else the last weigh-in.
  const end = weighed.length ? weighed[weighed.length - 1] : null;

  const weightChange = start != null && end != null ? round1(end - start) : null;
  const weightChangePct =
    start != null && end != null && start !== 0 ? Math.round(((end - start) / start) * 1000) / 10 : null;

  // "Reached the goal" in whichever direction the run was heading.
  const targetReached =
    start != null && end != null && targetWeight != null && start !== targetWeight
      ? start > targetWeight
        ? end <= targetWeight
        : end >= targetWeight
      : false;

  return {
    startWeight: start,
    endWeight: end,
    weightChange,
    weightChangePct,
    lowestWeight: weighed.length ? Math.min(...weighed) : null,
    highestWeight: weighed.length ? Math.max(...weighed) : null,
    targetWeight,
    targetReached,
    daysLogged: days.filter(isDayLogged).length,
    daysComplete: days.filter(isDayComplete).length,
    totalDays: days.length,
    longestStreak: getLongestStreak(days),
    starWeeks: analytics.starWeeks,
    totalWeeks: analytics.settledWeeks,
    averages: {
      weight: mean(days.map((d) => d.weight)),
      calories: analytics.averages.calories,
      protein: analytics.averages.protein,
      water: analytics.averages.water,
      steps: analytics.averages.steps,
    },
    exerciseDays: days.filter((d) => d.exercise && d.exercise !== "None" && d.exercise !== "").length,
    goals,
    trophyCount: badges.length,
    xpAtFinish: xp,
    levelAtFinish: level,
  };
}

/** Strip a live badge down to the shape that gets frozen into the archive. */
export function toArchivedBadge(badge: Badge): ArchivedBadge {
  return {
    key: badge.key,
    label: badge.label,
    description: badge.description,
    tier: badge.tier,
    icon: badge.icon,
    ...(badge.iconColor ? { iconColor: badge.iconColor } : {}),
    xp: badge.xp,
  };
}

/**
 * Whether the run has reached its finish line. Day 100 counts — the user locks
 * the run in from here, which is what settles Week 15 (see {@link runSealDate}).
 * Anything past Day 100 counts too, for users who kept logging before claiming.
 */
export function canFinishRun(currentDay: number): boolean {
  return currentDay >= CHALLENGE_DAYS;
}

/**
 * The date a locked-in run is scored "as of": the day after Day 100.
 *
 * Weeks are normally only judged once their last day is over. Locking in is the
 * user declaring Day 100 done — Days 1–100 go read-only, so nothing can change
 * afterwards — which is exactly the condition that lets every week, Week 15
 * included, be settled on the spot rather than waiting for midnight.
 */
export function runSealDate(runEndDate: string): string {
  const d = parseDateInputValue(runEndDate);
  d.setDate(d.getDate() + 1);
  return formatDateInputValue(d);
}

/** How the weight change reads on the report card. */
export function weightVerdict(summary: Pick<RunSummary, "weightChange" | "targetWeight" | "startWeight">): {
  tone: "good" | "bad" | "neutral";
} {
  const { weightChange, targetWeight, startWeight } = summary;
  if (weightChange == null || weightChange === 0) return { tone: "neutral" };
  // Judge against the direction the run was aiming; default to "lower is better".
  const goalIsLoss = targetWeight == null || startWeight == null || targetWeight < startWeight;
  const madeProgress = goalIsLoss ? weightChange < 0 : weightChange > 0;
  return { tone: madeProgress ? "good" : "bad" };
}
