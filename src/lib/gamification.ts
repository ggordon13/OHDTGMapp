import { DailyLog } from "@/lib/mockData";
import { formatDateInputValue } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared goal shapes
// ---------------------------------------------------------------------------

// Targets used to score a single day's quests. `caloriesMax` is the ceiling
// (calories are a "stay under" goal); the rest are floors to reach or exceed.
export interface QuestGoals {
  caloriesMax: number;
  protein: number;
  water: number;
  steps: number;
}

// Targets used to score a full week (matches what WeeklyAchievements needs).
export interface WeeklyGoals {
  dailyCalories: number;
  dailyProtein: number;
  dailyWater: number;
  dailySteps: number;
}

// ---------------------------------------------------------------------------
// Day helpers
// ---------------------------------------------------------------------------

const METRIC_KEYS: (keyof DailyLog)[] = ["weight", "calories", "protein", "water", "steps"];

/** A day counts as "logged" once it has a weight — matches the streak metric. */
export function isDayLogged(log: DailyLog): boolean {
  return log.weight != null;
}

/** A day is "complete" when every metric plus an exercise choice is filled in. */
export function isDayComplete(log: DailyLog): boolean {
  const metricsFilled = METRIC_KEYS.every((k) => log[k] != null);
  return metricsFilled && log.exercise != null && log.exercise !== "";
}

function didExercise(log: DailyLog | null): boolean {
  return !!log && !!log.exercise && log.exercise !== "None" && log.exercise !== "";
}

// ---------------------------------------------------------------------------
// XP & levels
//
// Cumulative XP required to *reach* a level is triangular up to level 9 — each
// level costs 100 more than the last (L2=100, L3=300, L4=600, L5=1000, …) — and
// from level 10 on the step is capped at a flat 800 XP.
//
// The cap is the whole point. Uncapped, the step grows without bound (level 30
// alone would cost 2,900 XP), so every rank takes longer than the one before it
// and the late game stalls out. Capped, each rank past Pathfinder costs a flat
// 2,400 XP, so promotions keep arriving on a steady beat however high you climb.
// The early curve is deliberately left alone: the first three ranks are what
// hook a new player, and they were never the problem.
//
// Note that lowering a threshold is always safe — levelFromXp can only return
// the same or a higher level for a given total, so no existing player can lose
// a level or a rank when this changes.
// ---------------------------------------------------------------------------

/** Flat cost of every level once the triangular ramp is over. */
const LEVEL_STEP_CAP = 800;
/** Last level on the triangular part (its own step is exactly the cap). */
const CAP_LEVEL = LEVEL_STEP_CAP / 100 + 1;

export function cumulativeXpForLevel(level: number): number {
  const l = Math.max(1, level);
  if (l <= CAP_LEVEL) return 50 * (l - 1) * l;
  return 50 * (CAP_LEVEL - 1) * CAP_LEVEL + LEVEL_STEP_CAP * (l - CAP_LEVEL);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  pct: number;
}

export function getLevelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.round(xp));
  const level = levelFromXp(safeXp);
  const base = cumulativeXpForLevel(level);
  const next = cumulativeXpForLevel(level + 1);
  const xpIntoLevel = safeXp - base;
  const xpForNextLevel = next - base;
  return {
    level,
    xp: safeXp,
    xpIntoLevel,
    xpForNextLevel,
    pct: Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)),
  };
}

// ---------------------------------------------------------------------------
// Quests (derived from logs + goals; claims are persisted separately)
// ---------------------------------------------------------------------------

export type QuestCategory = "daily" | "weekly";

export interface Quest {
  key: string;
  title: string;
  description: string;
  xp: number;
  category: QuestCategory;
  current: number;
  target: number;
  completed: boolean;
  /**
   * Claim-period key for this quest specifically, overriding its category
   * default. The ⭐ week quest uses it to sit on the last *settled* week rather
   * than the one still in progress.
   */
  period?: string;
}

/** Quests scored against today's entry. `today` is null before anything is logged. */
export function getDailyQuests(today: DailyLog | null, goals: QuestGoals): Quest[] {
  const calories = today?.calories ?? null;
  const protein = today?.protein ?? null;
  const water = today?.water ?? null;
  const steps = today?.steps ?? null;

  return [
    {
      // Participation, not performance. Every other daily quest asks you to hit
      // a target, which is exactly what a struggling user misses — this one only
      // asks them to turn up, so the floor on daily income is never zero.
      key: "daily-logged",
      title: "Show up",
      description: "Log anything at all today",
      xp: 20,
      category: "daily",
      current: today && isDayLogged(today) ? 1 : 0,
      target: 1,
      completed: !!today && isDayLogged(today),
    },
    {
      key: "daily-calories",
      title: "Stay in your calorie budget",
      description: `Keep today under ${goals.caloriesMax.toLocaleString()} kcal`,
      xp: 20,
      category: "daily",
      current: calories ?? 0,
      target: goals.caloriesMax,
      completed: calories != null && calories <= goals.caloriesMax,
    },
    {
      key: "daily-protein",
      title: "Hit your protein",
      description: `Eat at least ${goals.protein}g protein`,
      xp: 20,
      category: "daily",
      current: protein ?? 0,
      target: goals.protein,
      completed: protein != null && protein >= goals.protein,
    },
    {
      key: "daily-water",
      title: "Stay hydrated",
      description: `Drink ${goals.water} glasses of water`,
      xp: 15,
      category: "daily",
      current: water ?? 0,
      target: goals.water,
      completed: water != null && water >= goals.water,
    },
    {
      key: "daily-steps",
      title: "Get your steps in",
      description: `Walk ${goals.steps.toLocaleString()} steps`,
      xp: 15,
      category: "daily",
      current: steps ?? 0,
      target: goals.steps,
      completed: steps != null && steps >= goals.steps,
    },
    {
      key: "daily-exercise",
      title: "Move your body",
      description: "Log any exercise today",
      xp: 15,
      category: "daily",
      current: didExercise(today) ? 1 : 0,
      target: 1,
      completed: didExercise(today),
    },
    {
      key: "daily-complete",
      title: "Full log bonus",
      description: "Fill in every field for today",
      xp: 25,
      category: "daily",
      current: today && isDayComplete(today) ? 1 : 0,
      target: 1,
      completed: !!today && isDayComplete(today),
    },
  ];
}

/**
 * Quests scored against the current (in-progress) week's days.
 *
 * The ⭐ quest is the exception: a star week can only be called once its seven
 * days are done, so it is scored against `settledWeek` — the last completed
 * week — and carries that week's date as its own claim period.
 */
export function getWeeklyQuests(
  weekLogs: DailyLog[],
  goals: WeeklyGoals,
  settledWeek?: DailyLog[] | null,
): Quest[] {
  const daysLogged = weekLogs.filter(isDayLogged).length;
  const hydrationDays = weekLogs.filter((d) => d.water != null && d.water >= goals.dailyWater).length;
  const settled = settledWeek ?? null;
  const starEarned = settled != null && isAchieved(getWeeklyAvg(settled), goals);
  // Normally 5 of 7 days — but Week 15 only has 2, so the bar drops to its
  // length rather than leaving both quests permanently out of reach.
  const daysTarget = Math.min(5, weekLength(weekLogs));

  return [
    {
      key: "weekly-consistency",
      title: "Consistency streak",
      description: `Log at least ${daysTarget} days this week`,
      xp: 50,
      category: "weekly",
      current: daysLogged,
      target: daysTarget,
      completed: daysLogged >= daysTarget,
    },
    {
      key: "weekly-hydration",
      title: "Hydration challenge",
      description: `Hit your water goal on ${daysTarget} days`,
      xp: 40,
      category: "weekly",
      current: hydrationDays,
      target: daysTarget,
      completed: hydrationDays >= daysTarget,
    },
    {
      key: "weekly-star",
      title: "Earn a ⭐ week",
      description: settled
        ? "Your last full week met the achievement targets"
        : "Meet the weekly targets — scored once all 7 days are done",
      xp: 75,
      category: "weekly",
      current: starEarned ? 1 : 0,
      target: 1,
      completed: starEarned,
      // Sits on the week it actually judged, so finishing a star week always
      // leaves exactly one claim behind.
      ...(settled?.[0]?.date ? { period: settled[0].date } : {}),
    },
  ];
}

// ---------------------------------------------------------------------------
// Weekly scoring (shared with the WeeklyAchievements table)
// ---------------------------------------------------------------------------

export interface WeeklyAvg {
  weight: number | null;
  calories: number | null;
  protein: number | null;
  water: number | null;
  steps: number | null;
  exerciseDays: number;
  totalDays: number;
}

export function getWeeklyAvg(week: DailyLog[]): WeeklyAvg {
  const avg = (vals: (number | null)[]) => {
    const valid = vals.filter((v): v is number => v !== null);
    return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
  };
  return {
    weight: avg(week.map((d) => d.weight)),
    calories: avg(week.map((d) => d.calories)),
    protein: avg(week.map((d) => d.protein)),
    water: avg(week.map((d) => d.water)),
    steps: avg(week.map((d) => d.steps)),
    exerciseDays: week.filter((d) => d.exercise && d.exercise !== "None" && d.exercise !== "").length,
    totalDays: week.length,
  };
}

export function isAchieved(avg: WeeklyAvg, goals: WeeklyGoals): boolean {
  const caloriesMet = avg.calories !== null && avg.calories <= goals.dailyCalories;
  const stepsMet = avg.steps !== null && avg.steps >= goals.dailySteps;
  const exerciseMet = avg.exerciseDays >= 1;

  if (caloriesMet) {
    let othersMet = 0;
    if (avg.protein !== null && avg.protein >= goals.dailyProtein) othersMet++;
    if (avg.water !== null && avg.water >= goals.dailyWater) othersMet++;
    if (stepsMet) othersMet++;
    if (exerciseMet) othersMet++;
    return othersMet >= 2;
  }

  return stepsMet && exerciseMet;
}

/** Days in a normal week. */
export const DAYS_PER_WEEK = 7;

/**
 * The full challenge length. Lives here (rather than in the access module) so
 * the pure scoring logic owns it; `@/lib/access` re-exports it as CHALLENGE_DAYS.
 */
export const CHALLENGE_DAYS = 100;

/**
 * Split a run into weeks. 100 days is 14 full weeks plus a 2-day remainder, so
 * the chunking breaks on Day 100: Week 15 is exactly Days 99–100, a short week
 * by design rather than one that spills into overtime. Days logged past Day 100
 * (before the star is claimed) chunk normally after that.
 *
 * Positional, so `logs` is expected to start at Day 1 — as every caller's
 * dayRange does.
 */
export function chunkIntoWeeks(logs: DailyLog[]): DailyLog[][] {
  const weeks: DailyLog[][] = [];
  let i = 0;
  while (i < logs.length) {
    const end = i < CHALLENGE_DAYS ? Math.min(i + DAYS_PER_WEEK, CHALLENGE_DAYS) : i + DAYS_PER_WEEK;
    weeks.push(logs.slice(i, end));
    i = end;
  }
  return weeks;
}

/** The week (chunk of up to 7 days) that today falls in. */
export function getCurrentWeek(dayRange: DailyLog[]): DailyLog[] {
  if (dayRange.length === 0) return [];
  const weeks = chunkIntoWeeks(dayRange);
  return weeks[weeks.length - 1];
}

/** The date string of the first day in the current week — used as a claim period key. */
export function getCurrentWeekPeriod(dayRange: DailyLog[]): string {
  const week = getCurrentWeek(dayRange);
  return week[0]?.date ?? "";
}

// ---------------------------------------------------------------------------
// Week settlement
//
// A ⭐ week is judged once — and only once every one of its days is behind us.
// The verdict lands after 11:59pm on the week's last day, i.e. the moment the
// calendar rolls past it. Until then the week is still in play: no star, no
// trophy, no claim. This keeps a good first half of a week from banking a
// permanent reward that the second half would have undone.
//
// Week 15 is the exception on length, not on timing: it is only 2 days long
// (Days 99–100), so those 2 days are all it needs to be complete — but it still
// waits until Day 100 is over before it is scored.
// ---------------------------------------------------------------------------

/**
 * How many days this week holds once it is whole. Normally 7 — but Week 15 is
 * the 2-day tail of the run (Days 99–100), so it only ever needs those 2.
 */
export function weekLength(week: DailyLog[]): number {
  const first = week[0];
  if (first == null) return DAYS_PER_WEEK;
  const isFinalWeek = first.day > CHALLENGE_DAYS - DAYS_PER_WEEK && first.day <= CHALLENGE_DAYS;
  return isFinalWeek ? CHALLENGE_DAYS - first.day + 1 : DAYS_PER_WEEK;
}

/** Whether a week holds every day that belongs to it. */
export function isWeekWhole(week: DailyLog[]): boolean {
  return week.length > 0 && week.length >= weekLength(week);
}

/** Whether a week's verdict is final: it is whole, and its last day is past. */
export function isWeekSettled(week: DailyLog[], today: string = formatDateInputValue()): boolean {
  if (!isWeekWhole(week)) return false;
  return week[week.length - 1].date < today;
}

/** Just the weeks that can be judged; drops the one still in progress. */
export function settledWeeks(weeks: DailyLog[][], today?: string): DailyLog[][] {
  return weeks.filter((week) => isWeekSettled(week, today));
}

/**
 * The most recent week whose 7 days are complete, or null while the very first
 * week is still running. This is the week a ⭐ verdict applies to.
 */
export function getLastSettledWeek(dayRange: DailyLog[], today?: string): DailyLog[] | null {
  const settled = settledWeeks(chunkIntoWeeks(dayRange), today);
  return settled.length ? settled[settled.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Streak (with shields)
// ---------------------------------------------------------------------------

export interface StreakResult {
  streak: number;
  shieldsUsed: number;
  protected: boolean;
}

/**
 * Streak over the calendar day-range, walking backwards from today. A shield
 * lets a single missed prior day be tolerated instead of breaking the run.
 * Today itself is never counted as a break while it is still unlogged.
 */
export function getStreakWithShields(dayRange: DailyLog[], shields: number): StreakResult {
  let streak = 0;
  let shieldsUsed = 0;
  let shieldsLeft = Math.max(0, shields);

  for (let i = dayRange.length - 1; i >= 0; i--) {
    const isToday = i === dayRange.length - 1;
    if (isDayLogged(dayRange[i])) {
      streak++;
    } else if (isToday) {
      // Today not logged yet — grace, doesn't break the streak.
      continue;
    } else if (shieldsLeft > 0) {
      shieldsLeft--;
      shieldsUsed++;
    } else {
      break;
    }
  }

  return { streak, shieldsUsed, protected: shieldsUsed > 0 };
}

/** Longest run of consecutive logged days anywhere in the range. */
export function getLongestStreak(dayRange: DailyLog[]): number {
  let longest = 0;
  let run = 0;
  for (const log of dayRange) {
    if (isDayLogged(log)) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return longest;
}

export const MAX_SHIELDS = 3;

/**
 * Shields earned deterministically from history: one per 7 fully-logged days,
 * capped at MAX_SHIELDS. Idempotent — recomputing from the same logs always
 * yields the same number, so it can be reconciled to the DB without double-grant.
 */
export function earnedShields(dayRange: DailyLog[]): number {
  const complete = dayRange.filter(isDayComplete).length;
  return Math.min(MAX_SHIELDS, Math.floor(complete / 7));
}

// ---------------------------------------------------------------------------
// Achievements / badges (persisted once earned)
// ---------------------------------------------------------------------------

export type BadgeTier = "bronze" | "silver" | "gold" | "special";

export interface Badge {
  key: string;
  label: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  /** CSS color for text glyphs (e.g. the "★" stars); emoji ignore it. */
  iconColor?: string;
  xp: number;
}

function maxConsecutiveStars(weeks: DailyLog[][], goals: WeeklyGoals): number {
  let longest = 0;
  let run = 0;
  for (const week of weeks) {
    if (isAchieved(getWeeklyAvg(week), goals)) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return longest;
}

function maxConsecutiveProteinWeeks(weeks: DailyLog[][], goals: WeeklyGoals): number {
  let longest = 0;
  let run = 0;
  for (const week of weeks) {
    const avg = getWeeklyAvg(week);
    if (avg.protein != null && avg.protein >= goals.dailyProtein) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return longest;
}

/** A week where every single target was met (not just the 2-of-4 star rule). */
function hasPerfectWeek(weeks: DailyLog[][], goals: WeeklyGoals): boolean {
  return weeks.some((week) => {
    const avg = getWeeklyAvg(week);
    return (
      avg.calories != null && avg.calories <= goals.dailyCalories &&
      avg.protein != null && avg.protein >= goals.dailyProtein &&
      avg.water != null && avg.water >= goals.dailyWater &&
      avg.steps != null && avg.steps >= goals.dailySteps &&
      avg.exerciseDays >= 1
    );
  });
}

/** Extra context for badges that depend on the weight journey. */
export interface BadgeWeightOpts {
  startWeight?: number | null;
  targetWeight?: number | null;
}

interface BadgeContext {
  goals: WeeklyGoals;
  weeks: DailyLog[][];
  loggedDays: number;
  starRun: number;
  totalStars: number;
  longestStreak: number;
  proteinRun: number;
  perfectWeek: boolean;
  reachedTargetWeight: boolean;
  /** Kg moved *toward* the target so far (negative if moving away). */
  weightProgress: number;
}

/** A badge definition plus the predicate that decides when it's earned. */
type BadgeDef = Badge & { earned: (ctx: BadgeContext) => boolean };

// Single source of truth: the full trophy catalog and its unlock rules. The
// `description` doubles as the "how to earn it" hint shown for locked badges.
const BADGE_CATALOG: BadgeDef[] = [
  { key: "first-steps", label: "First Steps", description: "Logged your very first day", tier: "special", icon: "🌱", xp: 25, earned: (c) => c.loggedDays >= 1 },

  // Consecutive-star trio: colored stars matching their tier.
  { key: "star-bronze", label: "Bronze Star", description: "Earned a ⭐ week", tier: "bronze", icon: "★", iconColor: "#8a4a16", xp: 50, earned: (c) => c.starRun >= 1 },
  { key: "star-silver", label: "Silver Star", description: "3 ⭐ weeks in a row", tier: "silver", icon: "★", iconColor: "#f4f6fb", xp: 100, earned: (c) => c.starRun >= 3 },
  { key: "star-gold", label: "Gold Star", description: "6 ⭐ weeks in a row", tier: "gold", icon: "★", iconColor: "#fff3b0", xp: 200, earned: (c) => c.starRun >= 6 },

  // Lifetime-star medallions: cumulative ⭐ weeks, no streak required.
  { key: "medallion-bronze", label: "Bronze Medallion", description: "Earn 4 ⭐ weeks in total", tier: "bronze", icon: "🥉", xp: 75, earned: (c) => c.totalStars >= 4 },
  { key: "medallion-silver", label: "Silver Medallion", description: "Earn 8 ⭐ weeks in total", tier: "silver", icon: "🥈", xp: 150, earned: (c) => c.totalStars >= 8 },
  { key: "medallion-gold", label: "Gold Medallion", description: "Earn 12 ⭐ weeks in total", tier: "gold", icon: "🥇", xp: 250, earned: (c) => c.totalStars >= 12 },
  // 14, not 15: a 100-day run is 14 whole weeks plus a 2-day Week 15, so 15
  // stars demanded a star in the 2-day tail as well. 14 means "every full week
  // of the run was a ⭐ week" — the hardest thing that is actually achievable.
  { key: "virtuoso", label: "Virtuoso", description: "Earn 14 ⭐ weeks in total", tier: "special", icon: "👑", xp: 350, earned: (c) => c.totalStars >= 14 },

  {
    key: "hydration-hero", label: "Hydration Hero", description: "Hit your water goal every logged day of a week", tier: "special", icon: "💧", xp: 60,
    earned: (c) => c.weeks.some((week) => {
      const logged = week.filter(isDayLogged).length;
      const hit = week.filter((d) => d.water != null && d.water >= c.goals.dailyWater).length;
      return logged >= 5 && hit >= logged;
    }),
  },
  {
    key: "step-master", label: "Step Master", description: "Hit your step goal on 5 days in a week", tier: "special", icon: "👟", xp: 60,
    earned: (c) => c.weeks.some((week) => week.filter((d) => d.steps != null && d.steps >= c.goals.dailySteps).length >= 5),
  },
  { key: "protein-master", label: "Protein Master", description: "Hit your protein target 5 weeks in a row", tier: "special", icon: "🥩", xp: 120, earned: (c) => c.proteinRun >= 5 },
  { key: "perfectionist", label: "The Perfectionist", description: "A perfect week — every single target met", tier: "gold", icon: "💯", xp: 150, earned: (c) => c.perfectWeek },
  { key: "iron-streak", label: "Iron Streak", description: "Logged 14 days in a row", tier: "gold", icon: "🔥", xp: 120, earned: (c) => c.longestStreak >= 14 },

  // Turning-up trophies. Everything above is gated behind hitting a target, and
  // seven of them behind ⭐ weeks specifically — so a user who logs faithfully
  // without meeting the weekly bar watches half the case stay grey through the
  // middle of a run. These are earned by showing up, and they deliberately land
  // in the day-20-to-day-100 stretch where nothing else was unlocking.
  { key: "three-week-streak", label: "Three Weeks Strong", description: "Logged 21 days in a row", tier: "silver", icon: "⛓️", xp: 100, earned: (c) => c.longestStreak >= 21 },
  { key: "committed", label: "Committed", description: "Logged 30 days in total", tier: "bronze", icon: "📓", xp: 75, earned: (c) => c.loggedDays >= 30 },
  { key: "halfway-there", label: "Halfway There", description: "Logged 50 days in total", tier: "silver", icon: "🧭", xp: 150, earned: (c) => c.loggedDays >= 50 },
  { key: "century-club", label: "Century Club", description: "Logged 100 days in total", tier: "gold", icon: "💎", xp: 300, earned: (c) => c.loggedDays >= 100 },
  { key: "moving-the-needle", label: "Moving the Needle", description: "Moved 3 kg toward your target", tier: "silver", icon: "📉", xp: 120, earned: (c) => c.weightProgress >= 3 },

  { key: "built-different", label: "Built Different", description: "Reached your target weight", tier: "special", icon: "🗿", xp: 300, earned: (c) => c.reachedTargetWeight },
];

/** The complete trophy catalog (every badge that can ever be earned). */
export const ALL_BADGES: Badge[] = BADGE_CATALOG.map(({ earned: _earned, ...badge }) => badge);

/**
 * Every badge the player currently qualifies for, given their whole history.
 *
 * Week-based trophies are scored on *settled* weeks only. Unlocking is
 * permanent and pays XP, so a week must be over before it can hand one out —
 * otherwise a strong Monday-to-Thursday would bank a trophy the rest of the
 * week no longer deserves.
 */
export function getEarnedBadges(
  dayRange: DailyLog[],
  goals: WeeklyGoals,
  weightOpts?: BadgeWeightOpts,
  today?: string,
): Badge[] {
  const weeks = settledWeeks(chunkIntoWeeks(dayRange), today);
  const totalStars = weeks.filter((w) => isAchieved(getWeeklyAvg(w), goals)).length;

  // "Built Different": the latest logged weight has reached the target, in
  // whichever direction the journey goes (loss or gain).
  const { startWeight, targetWeight } = weightOpts ?? {};
  const weighed = dayRange.filter((d) => d.weight != null);
  const latestWeight = weighed.length ? (weighed[weighed.length - 1].weight as number) : null;
  const reachedTargetWeight =
    startWeight != null && targetWeight != null && latestWeight != null && startWeight !== targetWeight
      ? startWeight > targetWeight
        ? latestWeight <= targetWeight
        : latestWeight >= targetWeight
      : false;

  // Distance travelled toward the target, in whichever direction the goal runs.
  const weightProgress =
    startWeight != null && targetWeight != null && latestWeight != null && startWeight !== targetWeight
      ? startWeight > targetWeight
        ? startWeight - latestWeight
        : latestWeight - startWeight
      : 0;

  const ctx: BadgeContext = {
    goals,
    weeks,
    loggedDays: dayRange.filter(isDayLogged).length,
    starRun: maxConsecutiveStars(weeks, goals),
    totalStars,
    longestStreak: getLongestStreak(dayRange),
    proteinRun: maxConsecutiveProteinWeeks(weeks, goals),
    perfectWeek: hasPerfectWeek(weeks, goals),
    reachedTargetWeight,
    weightProgress,
  };
  return BADGE_CATALOG.filter((b) => b.earned(ctx)).map(({ earned: _earned, ...badge }) => badge);
}

// ---------------------------------------------------------------------------
// Weight milestones
// ---------------------------------------------------------------------------

/**
 * The 1kg milestone crossings between a starting weight and a target. Supports
 * both weight loss (start > target) and gain (start < target). Excludes the
 * starting weight itself; includes the target.
 */
export function getWeightMilestones(startWeight: number, targetWeight: number): number[] {
  const milestones: number[] = [];
  if (startWeight === targetWeight) return milestones;

  if (startWeight > targetWeight) {
    for (let w = Math.floor(startWeight); w >= Math.ceil(targetWeight); w--) {
      if (w < startWeight) milestones.push(w);
    }
  } else {
    for (let w = Math.ceil(startWeight); w <= Math.floor(targetWeight); w++) {
      if (w > startWeight) milestones.push(w);
    }
  }
  return milestones;
}

/**
 * The most significant milestone the latest weight has reached that is beyond
 * what was last celebrated. Returns null when there's nothing new to celebrate.
 */
export function getNewlyCrossedMilestone(
  latestWeight: number | null,
  startWeight: number,
  targetWeight: number,
  lastCelebrated: number | null,
): number | null {
  if (latestWeight == null) return null;
  const milestones = getWeightMilestones(startWeight, targetWeight);
  if (milestones.length === 0) return null;

  const losing = startWeight > targetWeight;
  // Milestones already reached by the current weight.
  const reached = milestones.filter((m) => (losing ? latestWeight <= m : latestWeight >= m));
  if (reached.length === 0) return null;

  // The furthest-progressed milestone reached so far.
  const best = losing ? Math.min(...reached) : Math.max(...reached);

  if (lastCelebrated == null) return best;
  const isNewer = losing ? best < lastCelebrated : best > lastCelebrated;
  return isNewer ? best : null;
}
