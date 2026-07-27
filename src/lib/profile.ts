export function requiresProfileSetup(profile: { age?: number | null; activity_level?: string | null } | null) {
  return profile?.age == null || profile?.activity_level == null;
}

// ---------------------------------------------------------------------------
// Username / nickname
// ---------------------------------------------------------------------------

/** The public nickname shown on the dashboard and in the admin directory. */
export const USERNAME_MAX_LENGTH = 16;

/**
 * Letters and numbers only, with at most one single space in between — no
 * leading, trailing, or consecutive spaces.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9]+( [A-Za-z0-9]+)?$/;

/** Human-readable statement of the rule, for form hints and errors. */
export const USERNAME_RULE_HINT =
  "Up to 16 letters and numbers, with at most one space in between.";

/** Whether a nickname (already trimmed) satisfies every rule. */
export function isValidUsername(username: string): boolean {
  return username.length >= 1 && username.length <= USERNAME_MAX_LENGTH && USERNAME_PATTERN.test(username);
}

/** Challenge goal: shed weight, or hold it steady. */
export type GoalType = "lose" | "maintain";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The target weight a user is allowed to pick, based on their goal:
 *  - lose:     between 13% and 2% below their current weight (the 2% cap keeps
 *              the deficit calc valid — a target too close to now is rejected)
 *  - maintain: within ±0.5% of their current weight (a band)
 */
export function targetWeightRange(weight: number, goal: GoalType) {
  return goal === "lose"
    ? { min: round1(weight * 0.87), max: round1(weight * 0.98) }
    : { min: round1(weight * 0.995), max: round1(weight * 1.005) };
}

/**
 * What the app suggests when the user would rather not pick a number. Losing
 * aims for a 9–13% drop; maintaining is simply the allowed ±0.5% band.
 */
export function recommendedTargetRange(weight: number, goal: GoalType) {
  return goal === "lose"
    ? { min: round1(weight * 0.87), max: round1(weight * 0.91) }
    : targetWeightRange(weight, "maintain");
}

// ---------------------------------------------------------------------------
// Daily targets
// ---------------------------------------------------------------------------

const activityMultipliers: Record<string, number> = {
  sedentary: 1.3,
  lightly_active: 1.45,
  very_active: 1.7,
};

export interface DailyTargets {
  calorieMin: number;
  calorieMax: number;
  proteinMin: number;
  proteinMax: number;
  water: number;
  steps: number;
}

/**
 * The daily calorie / protein / water / step targets derived from a user's
 * body stats and goal. Shared by first-time setup, profile updates, and the
 * restart form shown when a 100-day run is finished, so all three agree.
 */
export function calculateTargets(
  age: number,
  heightCm: number,
  weight: number,
  gender: string,
  activity: string,
  goal: GoalType,
  targetWeight: number,
  useRecommended: boolean,
): DailyTargets {
  // Mifflin-St Jeor BMR
  const bmr = gender === "male"
    ? (10 * weight + 6.25 * heightCm - 5 * age + 5)
    : (10 * weight + 6.25 * heightCm - 5 * age - 161);

  const multiplier = activityMultipliers[activity] || 1.45;
  const tdee = bmr * multiplier;

  // Deficit percentages (of body mass) for the losing plan. The recommended
  // range uses fixed 0.13% / 0.09%. A manually-picked target instead scales the
  // deficit by how far the goal is from the current weight, ±0.02.
  const lossFraction = (weight - targetWeight) / weight;
  const aggressivePct = useRecommended ? 0.13 : lossFraction + 0.02;
  const moderatePct = useRecommended ? 0.09 : lossFraction - 0.02;

  // Losing runs a deficit sized off body mass; maintaining sits in a narrow
  // band around TDEE so weight holds steady.
  const calorieMin = goal === "lose"
    ? Math.round(tdee - (weight * aggressivePct * 7700 / 100)) // aggressive
    : Math.round(tdee - (weight * 7));
  const calorieMax = goal === "lose"
    ? Math.round(tdee - (weight * moderatePct * 7700 / 100)) // moderate
    : Math.round(tdee - (weight * 4));

  // Protein targets
  const proteinMin = Math.round(weight * 1.3);
  const proteinMax = Math.round(weight * 1.8);

  // Fixed daily hydration goal (glasses) — matches the dashboard water target.
  const water = 7;

  // Steps based on activity
  const stepsMap: Record<string, number> = {
    sedentary: 4000,
    lightly_active: 6000,
    very_active: 8000,
  };

  return {
    calorieMin,
    calorieMax,
    proteinMin,
    proteinMax,
    water,
    steps: stepsMap[activity] || 6000,
  };
}
