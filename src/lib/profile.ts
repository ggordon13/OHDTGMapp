export function requiresProfileSetup(profile: { age?: number | null; activity_level?: string | null } | null) {
  return profile?.age == null || profile?.activity_level == null;
}
