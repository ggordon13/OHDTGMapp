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
 *  - lose:     down to 13% below their current weight (a floor)
 *  - maintain: within ±0.5% of their current weight (a band)
 */
export function targetWeightRange(weight: number, goal: GoalType) {
  return goal === "lose"
    ? { min: round1(weight * 0.87), max: round1(weight) }
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
