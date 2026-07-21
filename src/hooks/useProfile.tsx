import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveEffectiveAccessLevel } from "@/lib/access";
import { requiresProfileSetup } from "@/lib/profile";
import { useAuth } from "./useAuth";

export interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  age: number | null;
  height_cm: number | null;
  current_weight: number | null;
  target_weight: number | null;
  target_weight_min: number | null;
  target_weight_max: number | null;
  activity_level: string | null;
  gender: string | null;
  /** "lose" | "maintain" — drives the calorie formula and target-weight limits. */
  goal_type: string | null;
  role: string | null;
  access_level: string | null;
  daily_calorie_target: number | null;
  daily_calorie_target_min: number | null;
  daily_calorie_target_max: number | null;
  daily_protein_target: number | null;
  daily_protein_target_min: number | null;
  daily_protein_target_max: number | null;
  daily_water_target: number | null;
  daily_steps_target: number | null;
  challenge_start_date: string | null;
  /** A Day 1 date an admin has proposed, awaiting this user's approval. */
  pending_challenge_start_date: string | null;
  email: string | null;
  /** When target weight / Day 1 were last changed — drives the 30-day premium lock. */
  starting_data_updated_at: string | null;
  // Gamification state (defaulted server-side; may be absent pre-migration)
  total_xp: number | null;
  level: number | null;
  streak_shields: number | null;
  last_celebrated_weight: number | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Failed to load profile", error);
    }

    const effectiveAccessLevel = await resolveEffectiveAccessLevel(user.email, data?.access_level ?? null, data?.role ?? null);
    if (data && effectiveAccessLevel !== data.access_level) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ access_level: effectiveAccessLevel })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Failed to sync effective access level", updateError);
      } else {
        data.access_level = effectiveAccessLevel;
      }
    }

    setProfile(data as UserProfile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!user?.email) return;

    const normalizedEmail = user.email.trim().toLowerCase();
    if (normalizedEmail !== "gordongaming13@gmail.com") return;

    void supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        role: "admin",
        access_level: "premium",
      }, { onConflict: "user_id" })
      .then(({ error }) => {
        if (error) {
          console.error("Failed to sync admin access", error);
          return;
        }
        void fetchProfile();
      });
  }, [fetchProfile, user?.email, user?.id]);

  const isProfileComplete = !requiresProfileSetup(profile);

  return { profile, loading, isProfileComplete, refetch: fetchProfile };
}
