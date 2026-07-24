import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DailyLog } from "@/lib/mockData";
import {
  ALL_BADGES,
  Badge,
  Quest,
  WeeklyGoals,
  earnedShields,
  getEarnedBadges,
  getLevelProgress,
  levelFromXp,
  getDailyQuests,
  getWeeklyQuests,
  getCurrentWeek,
  getCurrentWeekPeriod,
} from "@/lib/gamification";
import type { UserProfile } from "./useProfile";

interface UseGamificationArgs {
  userId: string | undefined;
  profile: UserProfile | null;
  refetchProfile: () => Promise<void>;
  dayRange: DailyLog[];
  weeklyGoals: WeeklyGoals;
}

const claimKey = (period: string, questKey: string) => `${period}::${questKey}`;

/** A queued full-screen celebration: a freshly unlocked trophy or a level-up. */
export type Celebration =
  | { id: string; type: "badge"; badge: Badge }
  | { id: string; type: "level"; level: number };

export function useGamification({ userId, profile, refetchProfile, dayRange, weeklyGoals }: UseGamificationArgs) {
  const [xp, setXp] = useState(profile?.total_xp ?? 0);
  const xpRef = useRef(profile?.total_xp ?? 0);

  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const [earnedBadgeKeys, setEarnedBadgeKeys] = useState<Set<string>>(new Set());
  const [achievementsLoaded, setAchievementsLoaded] = useState(false);
  const grantingRef = useRef<Set<string>>(new Set());
  const revokingRef = useRef<Set<string>>(new Set());
  const refundingRef = useRef<Set<string>>(new Set());
  const shieldSyncRef = useRef(false);

  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const pushCelebration = useCallback((c: Omit<Celebration, "id">) => {
    setCelebrations((q) => [...q, { ...c, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` } as Celebration]);
  }, []);
  const dismissCelebration = useCallback(() => setCelebrations((q) => q.slice(1)), []);

  // Keep local XP in sync with the DB value whenever the profile is (re)loaded.
  useEffect(() => {
    const v = profile?.total_xp ?? 0;
    xpRef.current = v;
    setXp(v);
  }, [profile?.total_xp]);

  // Load persisted quest claims and unlocked achievements once we have a user.
  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const [claimRes, achRes] = await Promise.all([
        supabase.from("quest_claims").select("period, quest_key").eq("user_id", userId),
        supabase.from("achievements").select("achievement_key").eq("user_id", userId),
      ]);
      if (!active) return;
      if (claimRes.data) {
        setClaims(new Set(claimRes.data.map((c) => claimKey(c.period, c.quest_key))));
      }
      if (achRes.data) {
        setEarnedBadgeKeys(new Set(achRes.data.map((a) => a.achievement_key)));
      }
      setAchievementsLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  // Single funnel for all XP awards; writes the absolute new total so sequential
  // awaited awards accumulate correctly without racing on a stale DB read.
  const awardXp = useCallback(
    async (amount: number) => {
      if (!userId || amount <= 0) return;
      const prev = xpRef.current;
      const next = prev + amount;
      xpRef.current = next;
      setXp(next);
      // Crossing a level threshold earns a full-screen celebration.
      const newLevel = levelFromXp(next);
      if (newLevel > levelFromXp(prev)) {
        pushCelebration({ type: "level", level: newLevel });
      }
      await supabase
        .from("profiles")
        .update({ total_xp: next, level: newLevel })
        .eq("user_id", userId);
    },
    [userId, pushCelebration],
  );

  // Refund path: adjust the XP total down (or up) without a celebration, used
  // when a trophy/quest is revoked because the data no longer meets its goal.
  const adjustXp = useCallback(
    async (delta: number) => {
      if (!userId || delta === 0) return;
      const next = Math.max(0, xpRef.current + delta);
      xpRef.current = next;
      setXp(next);
      const newLevel = levelFromXp(next);
      await supabase.from("profiles").update({ total_xp: next, level: newLevel }).eq("user_id", userId);
    },
    [userId],
  );

  const claimQuest = useCallback(
    async (quest: Quest, period: string) => {
      if (!userId || !quest.completed) return;
      const key = claimKey(period, quest.key);
      if (claims.has(key) || claimingKey) return;

      setClaimingKey(quest.key);
      setClaims((prev) => new Set(prev).add(key)); // optimistic
      try {
        const { error } = await supabase.from("quest_claims").insert({
          user_id: userId,
          quest_key: quest.key,
          period,
          xp_awarded: quest.xp,
        });
        if (error) throw error;
        await awardXp(quest.xp);
        toast.success(`+${quest.xp} XP · ${quest.title}`);
      } catch (error) {
        console.error("claimQuest failed", error);
        setClaims((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        });
        toast.error("Couldn't claim that quest — try again.");
      } finally {
        setClaimingKey(null);
      }
    },
    [userId, claims, claimingKey, awardXp],
  );

  // Auto-unlock newly earned badges, and REVOKE badges whose data no longer
  // qualifies (anti-exploit: log fake data → earn trophy+XP → revert). Idempotent
  // via the persisted set + in-flight guards.
  useEffect(() => {
    // Wait for the profile (and thus the seeded XP total) before writing XP,
    // otherwise a grant fired mid-load could overwrite the stored total with 0.
    if (!userId || !profile || !achievementsLoaded || dayRange.length === 0) return;
    const derived = getEarnedBadges(dayRange, weeklyGoals, {
      startWeight: profile.current_weight,
      targetWeight: profile.target_weight,
    });
    const derivedKeys = new Set(derived.map((b) => b.key));
    const toGrant = derived.filter((b) => !earnedBadgeKeys.has(b.key) && !grantingRef.current.has(b.key));
    const toRevoke = [...earnedBadgeKeys].filter((k) => !derivedKeys.has(k) && !revokingRef.current.has(k));
    if (toGrant.length === 0 && toRevoke.length === 0) return;

    toGrant.forEach((b) => grantingRef.current.add(b.key));
    toRevoke.forEach((k) => revokingRef.current.add(k));
    (async () => {
      for (const b of toGrant) {
        const { error } = await supabase.from("achievements").insert({
          user_id: userId,
          achievement_key: b.key,
          tier: b.tier,
          xp_awarded: b.xp,
        });
        if (!error) {
          // Queue the trophy celebration first, then any level-up it causes.
          pushCelebration({ type: "badge", badge: b });
          await awardXp(b.xp);
        }
      }
      for (const key of toRevoke) {
        const badge = ALL_BADGES.find((b) => b.key === key);
        const { error } = await supabase
          .from("achievements")
          .delete()
          .eq("user_id", userId)
          .eq("achievement_key", key);
        if (!error) {
          if (badge) await adjustXp(-badge.xp);
          toast.error(`Trophy lost: ${badge?.label ?? key} — your data no longer meets it.`);
        }
      }
      setEarnedBadgeKeys((prev) => {
        const n = new Set(prev);
        toGrant.forEach((b) => n.add(b.key));
        toRevoke.forEach((k) => n.delete(k));
        return n;
      });
      toRevoke.forEach((k) => revokingRef.current.delete(k));
    })();
  }, [userId, profile, achievementsLoaded, dayRange, weeklyGoals, earnedBadgeKeys, awardXp, adjustXp, pushCelebration]);

  // Refund quest XP if a claimed quest's data was reverted below its goal.
  // Only the current daily/weekly periods are re-checked (the exploit target).
  useEffect(() => {
    if (!userId || dayRange.length === 0) return;
    const today = dayRange[dayRange.length - 1];
    if (!today) return;
    const dailyPeriod = today.date;
    const weeklyPeriod = getCurrentWeekPeriod(dayRange);
    const questGoals = {
      caloriesMax: weeklyGoals.dailyCalories,
      protein: weeklyGoals.dailyProtein,
      water: weeklyGoals.dailyWater,
      steps: weeklyGoals.dailySteps,
    };
    const scored = [
      ...getDailyQuests(today, questGoals).map((q) => ({ q, period: dailyPeriod })),
      ...getWeeklyQuests(getCurrentWeek(dayRange), weeklyGoals).map((q) => ({ q, period: weeklyPeriod })),
    ];
    const toRefund = scored.filter(
      ({ q, period }) =>
        claims.has(claimKey(period, q.key)) && !q.completed && !refundingRef.current.has(claimKey(period, q.key)),
    );
    if (toRefund.length === 0) return;

    toRefund.forEach(({ q, period }) => refundingRef.current.add(claimKey(period, q.key)));
    (async () => {
      for (const { q, period } of toRefund) {
        const { error } = await supabase
          .from("quest_claims")
          .delete()
          .eq("user_id", userId)
          .eq("period", period)
          .eq("quest_key", q.key);
        if (!error) {
          await adjustXp(-q.xp);
          toast.error(`Refunded ${q.xp} XP — "${q.title}" is no longer complete.`);
        }
      }
      setClaims((prev) => {
        const n = new Set(prev);
        toRefund.forEach(({ q, period }) => n.delete(claimKey(period, q.key)));
        return n;
      });
      toRefund.forEach(({ q, period }) => refundingRef.current.delete(claimKey(period, q.key)));
    })();
  }, [userId, dayRange, weeklyGoals, claims, adjustXp]);

  // Reconcile earned streak shields (deterministic from history → safe to write).
  useEffect(() => {
    if (!userId || !profile || dayRange.length === 0 || shieldSyncRef.current) return;
    const earned = earnedShields(dayRange);
    const stored = profile?.streak_shields ?? 0;
    if (earned > stored) {
      shieldSyncRef.current = true;
      supabase
        .from("profiles")
        .update({ streak_shields: earned })
        .eq("user_id", userId)
        .then(() => refetchProfile())
        .then(() => {
          shieldSyncRef.current = false;
        });
    }
  }, [userId, profile, dayRange, refetchProfile]);

  const celebrateMilestone = useCallback(
    async (weight: number) => {
      if (!userId) return;
      await supabase.from("profiles").update({ last_celebrated_weight: weight }).eq("user_id", userId);
      await awardXp(30);
      await refetchProfile();
    },
    [userId, awardXp, refetchProfile],
  );

  const isClaimed = useCallback((period: string, questKey: string) => claims.has(claimKey(period, questKey)), [claims]);

  // The whole trophy catalog, each flagged unlocked (earned) or still locked.
  const allBadges: (Badge & { unlocked: boolean })[] = ALL_BADGES.map((b) => ({
    ...b,
    unlocked: earnedBadgeKeys.has(b.key),
  }));

  return {
    xp,
    levelProgress: getLevelProgress(xp),
    shields: profile?.streak_shields ?? 0,
    isClaimed,
    claimQuest,
    claimingKey,
    badges: allBadges,
    celebrateMilestone,
    celebrations,
    dismissCelebration,
  };
}
