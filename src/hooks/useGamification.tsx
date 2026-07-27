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
  // The trophy "season". Every 100-day finish starts a new one, so the same
  // badge can be earned again — and pay out again — in the next run.
  const runIndex = profile?.current_run ?? 1;

  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const [earnedBadgeKeys, setEarnedBadgeKeys] = useState<Set<string>>(new Set());
  const [achievementsLoaded, setAchievementsLoaded] = useState(false);
  const grantingRef = useRef<Set<string>>(new Set());
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
  // Trophies are scoped to the current run: finishing 100 days rolls the run
  // over, which empties the shelf for the next one (XP is untouched).
  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Gate the grant effect until the new run's shelf has actually loaded, so
    // it can never act on the previous run's set of earned keys.
    setAchievementsLoaded(false);

    (async () => {
      const [claimRes, achRes] = await Promise.all([
        supabase.from("quest_claims").select("period, quest_key").eq("user_id", userId),
        supabase.from("achievements").select("achievement_key").eq("user_id", userId).eq("run_index", runIndex),
      ]);
      if (!active) return;
      if (claimRes.data) {
        setClaims(new Set(claimRes.data.map((c) => claimKey(c.period, c.quest_key))));
      }
      setEarnedBadgeKeys(new Set((achRes.data ?? []).map((a) => a.achievement_key)));
      grantingRef.current = new Set();
      setAchievementsLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [userId, runIndex]);

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

  // Claim every completed-but-unclaimed quest in one shot (daily + weekly). One
  // batch insert + one XP award, so the level-up celebration fires once for the
  // combined total. Guarded by claimingKey like single claims.
  const claimAll = useCallback(
    async (items: { quest: Quest; period: string }[]) => {
      if (!userId || claimingKey) return;
      const pending = items.filter(
        ({ quest, period }) => quest.completed && !claims.has(claimKey(period, quest.key)),
      );
      if (pending.length === 0) return;

      const keys = pending.map(({ quest, period }) => claimKey(period, quest.key));
      setClaimingKey("__all__");
      setClaims((prev) => {
        const n = new Set(prev);
        keys.forEach((k) => n.add(k)); // optimistic
        return n;
      });
      try {
        const { error } = await supabase.from("quest_claims").insert(
          pending.map(({ quest, period }) => ({
            user_id: userId,
            quest_key: quest.key,
            period,
            xp_awarded: quest.xp,
          })),
        );
        if (error) throw error;
        const total = pending.reduce((s, { quest }) => s + quest.xp, 0);
        await awardXp(total);
        toast.success(`+${total} XP · ${pending.length} quest${pending.length === 1 ? "" : "s"} claimed`);
      } catch (error) {
        console.error("claimAll failed", error);
        setClaims((prev) => {
          const n = new Set(prev);
          keys.forEach((k) => n.delete(k));
          return n;
        });
        toast.error("Couldn't claim all quests — try again.");
      } finally {
        setClaimingKey(null);
      }
    },
    [userId, claims, claimingKey, awardXp],
  );

  // Auto-unlock any newly earned badges. Idempotent: the persisted set + an
  // in-flight guard prevent a badge from being granted or XP-awarded twice.
  // NOTE: badges/XP are grant-only here — they are never revoked or refunded
  // from the client (a buggy revoke path once wiped XP totals to 0).
  useEffect(() => {
    // Wait for the profile (and thus the seeded XP total) before writing XP,
    // otherwise a grant fired mid-load could overwrite the stored total with 0.
    if (!userId || !profile || !achievementsLoaded || dayRange.length === 0) return;
    const derived = getEarnedBadges(dayRange, weeklyGoals, {
      startWeight: profile.current_weight,
      targetWeight: profile.target_weight,
    });
    const toGrant = derived.filter((b) => !earnedBadgeKeys.has(b.key) && !grantingRef.current.has(b.key));
    if (toGrant.length === 0) return;

    toGrant.forEach((b) => grantingRef.current.add(b.key));
    (async () => {
      for (const b of toGrant) {
        const { error } = await supabase.from("achievements").insert({
          user_id: userId,
          achievement_key: b.key,
          run_index: runIndex,
          tier: b.tier,
          xp_awarded: b.xp,
        });
        if (!error) {
          // Queue the trophy celebration first, then any level-up it causes.
          pushCelebration({ type: "badge", badge: b });
          await awardXp(b.xp);
        }
      }
      setEarnedBadgeKeys((prev) => {
        const n = new Set(prev);
        toGrant.forEach((b) => n.add(b.key));
        return n;
      });
    })();
  }, [userId, profile, achievementsLoaded, dayRange, weeklyGoals, earnedBadgeKeys, runIndex, awardXp, pushCelebration]);

  // Recovery floor: total_xp should never sit below the XP actually recorded in
  // quest_claims + achievements. If it does (e.g. an earlier bug reset it), raise
  // it back. Only ever raises — never lowers — so it can't clobber a real total,
  // and it no-ops once equal (so it can't loop). Re-runs after the grant effect
  // refills achievements (earnedBadgeKeys changes) to pick up re-granted trophies.
  useEffect(() => {
    if (!userId || !profile || !achievementsLoaded) return;
    let active = true;
    (async () => {
      const [{ data: qc }, { data: ach }] = await Promise.all([
        supabase.from("quest_claims").select("xp_awarded").eq("user_id", userId),
        supabase.from("achievements").select("xp_awarded").eq("user_id", userId),
      ]);
      if (!active) return;
      const floor =
        (qc ?? []).reduce((s, r) => s + (r.xp_awarded ?? 0), 0) +
        (ach ?? []).reduce((s, r) => s + (r.xp_awarded ?? 0), 0);
      if (floor > xpRef.current) {
        xpRef.current = floor;
        setXp(floor);
        await supabase.from("profiles").update({ total_xp: floor, level: levelFromXp(floor) }).eq("user_id", userId);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, profile, achievementsLoaded, earnedBadgeKeys]);

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
    claimAll,
    claimingKey,
    badges: allBadges,
    celebrateMilestone,
    celebrations,
    dismissCelebration,
  };
}
