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

/**
 * Youngest age the app will create an account for.
 *
 * 13 is the floor set by COPPA (US) and the lowest digital-consent age GDPR
 * Art. 8 permits a member state to choose; several set 16, so check the
 * jurisdictions you actually operate in before treating this as sufficient.
 * A gamified weight-loss product aimed at children is also a problem well
 * beyond the legal one.
 */
export const MIN_SIGNUP_AGE = 13;

/** Challenge goal: shed weight, or hold it steady. */
export type GoalType = "lose" | "maintain";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Lowest BMI this app will ever help someone aim for.
 *
 * 18.5 is the bottom of the WHO "healthy" band. The per-run percentage limits
 * below are *relative*, so on their own they ratchet: 13% off, then 13% off
 * that, and after a few 100-day runs the app would happily coach someone into
 * being underweight. This is the absolute floor that stops it.
 */
export const MIN_HEALTHY_BMI = 18.5;

/** Weight in kg at the healthy-BMI floor for a given height. */
export function minHealthyWeight(heightCm: number | null | undefined): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return round1(MIN_HEALTHY_BMI * m * m);
}

/**
 * The target weight a user is allowed to pick, based on their goal:
 *  - lose:     between 13% and 2% below their current weight (the 2% cap keeps
 *              the deficit calc valid — a target too close to now is rejected)
 *  - maintain: within ±0.5% of their current weight (a band)
 *
 * When a height is known the lower bound is additionally clamped to the healthy
 * BMI floor, so no run can set a target below it. If someone is already at or
 * under that floor, `min` meets `max` and the only permitted "loss" target is
 * the smallest one — the UI should steer them to maintain instead.
 */
export function targetWeightRange(weight: number, goal: GoalType, heightCm?: number | null) {
  if (goal !== "lose") {
    return { min: round1(weight * 0.995), max: round1(weight * 1.005) };
  }
  const max = round1(weight * 0.98);
  const floor = minHealthyWeight(heightCm);
  const min = floor != null ? round1(Math.max(weight * 0.87, floor)) : round1(weight * 0.87);
  return { min: Math.min(min, max), max };
}

/**
 * Is this person already at or below the healthy-BMI floor? Losing further is
 * not something the app should be helping with.
 */
export function isAtOrBelowHealthyFloor(weight: number, heightCm: number | null | undefined): boolean {
  const floor = minHealthyWeight(heightCm);
  return floor != null && weight <= floor;
}

/**
 * Lowest daily calorie target the app will ever display. The widely-cited
 * "not below this without medical supervision" figures are 1,200 kcal for women
 * and 1,500 for men; the deficit maths can otherwise go lower for a heavy user
 * on an aggressive target.
 */
export function minSafeCalories(gender: string): number {
  return gender === "male" ? 1500 : 1200;
}

/**
 * What the app suggests when the user would rather not pick a number. Losing
 * aims for a 9–13% drop; maintaining is simply the allowed ±0.5% band.
 */
export function recommendedTargetRange(weight: number, goal: GoalType, heightCm?: number | null) {
  if (goal !== "lose") return targetWeightRange(weight, "maintain");
  const allowed = targetWeightRange(weight, "lose", heightCm);
  // Never recommend below what's permitted — the BMI floor wins.
  return {
    min: Math.max(round1(weight * 0.87), allowed.min),
    max: Math.max(round1(weight * 0.91), allowed.min),
  };
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
  //
  // Both bounds are then floored: the deficit formula is proportional to body
  // mass, so for a heavy person with an aggressive target it can land under
  // 1,000 kcal — below the level generally considered safe without medical
  // supervision, and not something this app should ever put on screen.
  const rawMin = goal === "lose"
    ? Math.round(tdee - (weight * aggressivePct * 7700 / 100)) // aggressive
    : Math.round(tdee - (weight * 7));
  const rawMax = goal === "lose"
    ? Math.round(tdee - (weight * moderatePct * 7700 / 100)) // moderate
    : Math.round(tdee - (weight * 4));

  const floor = minSafeCalories(gender);
  const calorieMin = Math.max(rawMin, floor);
  const calorieMax = Math.max(rawMax, floor);

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
