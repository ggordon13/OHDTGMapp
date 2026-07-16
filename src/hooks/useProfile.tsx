import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  daily_calorie_target: number | null;
  daily_calorie_target_min: number | null;
  daily_calorie_target_max: number | null;
  daily_protein_target: number | null;
  daily_protein_target_min: number | null;
  daily_protein_target_max: number | null;
  daily_water_target: number | null;
  daily_steps_target: number | null;
  challenge_start_date: string | null;
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
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    setProfile(data as UserProfile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  const isProfileComplete = !requiresProfileSetup(profile);

  return { profile, loading, isProfileComplete, refetch: fetchProfile };
}
