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
