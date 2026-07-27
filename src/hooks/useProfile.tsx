import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requiresProfileSetup } from "@/lib/profile";
import { clearPendingWhopCheckout, hasPendingWhopCheckout } from "@/lib/whop";
import { useAuth } from "./useAuth";

/** How long to keep checking for premium after a user returns from Whop. */
const CHECKOUT_POLL_INTERVAL_MS = 5000;
const CHECKOUT_POLL_ATTEMPTS = 24;

export interface UserProfile {
  display_name: string | null;
  /** Public nickname shown on the dashboard and admin directory. */
  username: string | null;
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
  /** Golden stars earned — one per finished 100-day run. */
  finisher_count: number | null;
  /** Which run the live trophy case belongs to (1-based). */
  current_run: number | null;
  /**
   * When the current run was locked in. Non-null means Days 1–100 are final:
   * the log is read-only and every week (including the 2-day Week 15) is scored.
   */
  run_locked_at: string | null;
  /** Selected cosmetic theme key (premium themes revert to default when free). */
  theme: string | null;
  /** When the one-time 7-day premium trial was started, if ever. */
  premium_trial_started_at: string | null;
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

    // Reconcile the effective access level server-side (allowlist + trial + role).
    // access_level is a locked column, so only this SECURITY DEFINER RPC may write
    // it — the client can no longer self-grant premium. It returns the level so
    // the UI reflects it immediately.
    if (data) {
      const { data: level, error: syncError } = await supabase.rpc("sync_my_access_level");
      if (syncError) {
        console.error("Failed to sync effective access level", syncError);
      } else if (level) {
        data.access_level = level;
      }
    }

    setProfile(data as UserProfile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  // Coming back from a Whop checkout, premium arrives via the webhook a moment
  // later. Poll (and re-check on tab focus) so the upgrade lands without a reload.
  useEffect(() => {
    if (!user?.id || !hasPendingWhopCheckout()) return;

    if (profile?.access_level === "premium") {
      if (clearPendingWhopCheckout()) toast.success("Premium unlocked. Welcome in! 👑");
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (attempts > CHECKOUT_POLL_ATTEMPTS) {
        clearPendingWhopCheckout();
        window.clearInterval(interval);
        return;
      }
      void fetchProfile();
    }, CHECKOUT_POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchProfile();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchProfile, profile?.access_level, user?.id]);

  const isProfileComplete = !requiresProfileSetup(profile);

  return { profile, loading, isProfileComplete, refetch: fetchProfile };
}
