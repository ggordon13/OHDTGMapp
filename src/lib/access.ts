import { supabase } from "@/integrations/supabase/client";

export type AccessRole = "user" | "admin" | "dev";
export type AccessLevel = "free" | "premium";

export interface PremiumAllowlistEntry {
  id?: string;
  email: string;
  access_level: AccessLevel;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface PremiumAccessContext {
  accessLevel?: string | null;
  role?: string | null;
  userEmail?: string | null;
  allowlistEmails?: PremiumAllowlistEntry[] | null;
}

// ---------------------------------------------------------------------------
// Premium limits
// ---------------------------------------------------------------------------

/** How many trailing weeks of history a free user can see and log. */
export const FREE_HISTORY_WEEKS = 3;

/** A week is 7 days — the trailing window a free user is capped to. */
export const FREE_HISTORY_DAYS = FREE_HISTORY_WEEKS * 7;

/** Premium users may re-edit locked starting data once per this many days. */
export const STARTING_DATA_LOCK_DAYS = 30;

export type RequestStatus = "pending" | "approved" | "rejected";

export interface PremiumRequest {
  id: string;
  user_id: string;
  email: string;
  status: RequestStatus;
  note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export function normalizeRole(role?: string | null): AccessRole {
  const normalized = role?.trim().toLowerCase();
  if (normalized === "admin" || normalized === "dev") return normalized;
  return "user";
}

export function normalizeAccessLevel(level?: string | null): AccessLevel {
  const normalized = level?.trim().toLowerCase();
  return normalized === "premium" ? "premium" : "free";
}

export function canManageAccess(role?: string | null): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "admin" || normalizedRole === "dev";
}

export function isPremiumAccessGranted(context: PremiumAccessContext): boolean {
  const normalizedLevel = normalizeAccessLevel(context.accessLevel);
  if (normalizedLevel === "premium") return true;

  const normalizedEmail = context.userEmail?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return (context.allowlistEmails ?? []).some((entry) => {
    if (!entry.is_active && entry.is_active !== undefined && entry.is_active !== null) return false;
    return entry.email.trim().toLowerCase() === normalizedEmail && normalizeAccessLevel(entry.access_level) === "premium";
  });
}

/**
 * The number of trailing days of history a user may view and log, or null for
 * unlimited. Free users are capped to the last {@link FREE_HISTORY_WEEKS} weeks;
 * premium users and staff (admin/dev) get the full history.
 */
export function historyDayLimit(accessLevel?: string | null, role?: string | null): number | null {
  if (canManageAccess(role)) return null;
  if (normalizeAccessLevel(accessLevel) === "premium") return null;
  return FREE_HISTORY_DAYS;
}

export interface StartingDataEditState {
  /** Whether the user may change target weight / Day 1 right now. */
  allowed: boolean;
  /** Why it's blocked, phrased for display. Empty when allowed. */
  reason: string;
  /** When a premium user's 30-day lock next lifts, if that's the blocker. */
  nextAllowedAt?: Date;
}

/**
 * Whether a user can edit the "starting data" fields (target weight and Day 1
 * date). Staff are unrestricted; free users can never change them; premium
 * users may change them once every {@link STARTING_DATA_LOCK_DAYS} days.
 */
export function canEditStartingData(
  accessLevel?: string | null,
  role?: string | null,
  startingDataUpdatedAt?: string | null,
  now: Date = new Date(),
): StartingDataEditState {
  if (canManageAccess(role)) return { allowed: true, reason: "" };

  if (normalizeAccessLevel(accessLevel) !== "premium") {
    return { allowed: false, reason: "Changing your target weight or Day 1 date is a premium feature." };
  }

  if (!startingDataUpdatedAt) return { allowed: true, reason: "" };

  const last = new Date(startingDataUpdatedAt);
  if (Number.isNaN(last.getTime())) return { allowed: true, reason: "" };

  const nextAllowedAt = new Date(last.getTime() + STARTING_DATA_LOCK_DAYS * 24 * 60 * 60 * 1000);
  if (now >= nextAllowedAt) return { allowed: true, reason: "" };

  const daysLeft = Math.ceil((nextAllowedAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return {
    allowed: false,
    reason: `You can change your target weight or Day 1 date again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
    nextAllowedAt,
  };
}

export function getAccessBadgeLabel(role?: string | null, accessLevel?: string | null): string {
  const normalizedRole = normalizeRole(role);
  const normalizedAccessLevel = normalizeAccessLevel(accessLevel);

  if (normalizedRole === "admin") {
    return normalizedAccessLevel === "premium" ? "Admin • Premium" : "Admin • Free";
  }

  if (normalizedRole === "dev") {
    return normalizedAccessLevel === "premium" ? "Dev • Premium" : "Dev • Free";
  }

  return normalizedAccessLevel === "premium" ? "Premium" : "Free";
}

/**
 * The access level a user should actually have right now.
 *
 * The allowlist is authoritative: losing an active premium entry demotes the
 * user back to free. Two deliberate exceptions — a failed lookup keeps the
 * current level (a network blip must not strip access), and admins/devs keep
 * theirs, since their premium is granted by role rather than by the allowlist.
 */
export async function resolveEffectiveAccessLevel(
  userEmail: string | null | undefined,
  profileAccessLevel?: string | null,
  role?: string | null,
): Promise<AccessLevel> {
  const currentLevel = normalizeAccessLevel(profileAccessLevel);

  const normalizedEmail = userEmail?.trim().toLowerCase();
  if (!normalizedEmail) return currentLevel;

  const { data, error } = await supabase.from("premium_allowlist").select("email, access_level, is_active").eq("email", normalizedEmail).maybeSingle();
  if (error) return currentLevel;

  const hasActivePremiumEntry =
    !!data && data.is_active !== false && normalizeAccessLevel(data.access_level) === "premium";
  if (hasActivePremiumEntry) return "premium";

  if (canManageAccess(role)) return currentLevel;

  return "free";
}
