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
import { getRank, type Rank } from "@/lib/ranks";
import { track } from "@/lib/telemetry";
import type { UserProfile } from "./useProfile";

interface UseGamificationArgs {
  userId: string | undefined;
  profile: UserProfile | null;
  refetchProfile: () => Promise<void>;
  dayRange: DailyLog[];
  weeklyGoals: WeeklyGoals;
  /**
   * The date week settlement is judged against. Normally today; once a run is
   * locked in it's the day after Day 100, so the run's final week counts.
   */
  scoringDate?: string;
}

const claimKey = (period: string, questKey: string) => `${period}::${questKey}`;

interface RpcResult {
  data: number | null;
  error: { message: string } | null;
}

/**
 * XP is server-authoritative: the client can no longer write total_xp or insert
 * quest_claims / achievements (see 20260740000000_security_hardening.sql). These
 * RPCs recompute eligibility and the XP value on the server and return what was
 * actually banked — 0 when the reward was already held.
 *
 * Typed loosely because the generated Supabase types lag behind new migrations.
 * It has to stay a *call on* `supabase` — pulling `supabase.rpc` out into a bare
 * const detaches it from its receiver, and supabase-js throws on the undefined
 * `this` before the request is ever built.
 */
const rpc = (fn: string, args?: Record<string, unknown>): Promise<RpcResult> =>
  supabase.rpc(fn as never, args as never) as unknown as Promise<RpcResult>;

/** A queued full-screen celebration: a trophy unlock, a level-up, or a rank-up. */
export type Celebration =
  | { id: string; type: "badge"; badge: Badge }
  | { id: string; type: "level"; level: number }
  | { id: string; type: "rank"; rank: Rank };

export function useGamification({
  userId,
  profile,
  refetchProfile,
  dayRange,
  weeklyGoals,
  scoringDate,
}: UseGamificationArgs) {
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

  // Mirrors a server-side award into local state and fires the celebrations.
  // The XP itself was already banked by the RPC that returned `amount` — this
  // never writes to the database (those columns are revoked from clients).
  const applyXp = useCallback(
    (amount: number) => {
      if (!userId || amount <= 0) return;
      const prev = xpRef.current;
      const next = prev + amount;
      xpRef.current = next;
      setXp(next);
      // Crossing a level threshold earns a full-screen celebration — and if that
      // level also crosses a rank threshold, a rank-up takeover follows it.
      const prevLevel = levelFromXp(prev);
      const newLevel = levelFromXp(next);
      if (newLevel > prevLevel) {
        pushCelebration({ type: "level", level: newLevel });
        track("level_up", { level: newLevel });
        const newRank = getRank(newLevel);
        if (newRank.key !== getRank(prevLevel).key) {
          pushCelebration({ type: "rank", rank: newRank });
          track("rank_up", { rank: newRank.key, level: newLevel });
        }
      }
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
        // The server re-derives eligibility and the XP value from the logs; the
        // quest's client-side xp is display only.
        const { data, error } = await rpc("claim_quest", { p_quest_key: quest.key, p_period: period });
        if (error) throw error;
        const banked = data ?? 0;
        applyXp(banked);
        track("quest_claimed", { quest: quest.key, xp: banked });
        toast.success(`+${banked} XP · ${quest.title}`);
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
    [userId, claims, claimingKey, applyXp],
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
        // One RPC per quest (each validates its own eligibility), but a single
        // applyXp at the end so a multi-level jump still celebrates once.
        let total = 0;
        let failed = 0;
        for (const { quest, period } of pending) {
          const { data, error } = await rpc("claim_quest", { p_quest_key: quest.key, p_period: period });
          if (error) {
            failed++;
            // Roll this one back locally; the rest of the batch still stands.
            setClaims((prev) => {
              const n = new Set(prev);
              n.delete(claimKey(period, quest.key));
              return n;
            });
            continue;
          }
          total += data ?? 0;
        }
        if (total === 0 && failed > 0) throw new Error("no quests could be claimed");
        applyXp(total);
        const claimed = pending.length - failed;
        track("quests_claimed_all", { count: claimed, xp: total });
        toast.success(`+${total} XP · ${claimed} quest${claimed === 1 ? "" : "s"} claimed`);
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
    [userId, claims, claimingKey, applyXp],
  );

  // Auto-unlock any newly earned badges. Idempotent: the persisted set + an
  // in-flight guard prevent a badge from being granted or XP-awarded twice.
  // NOTE: badges/XP are grant-only here — they are never revoked or refunded
  // from the client (a buggy revoke path once wiped XP totals to 0).
  useEffect(() => {
    // Wait for the profile (and thus the seeded XP total) before writing XP,
    // otherwise a grant fired mid-load could overwrite the stored total with 0.
    if (!userId || !profile || !achievementsLoaded || dayRange.length === 0) return;
    const derived = getEarnedBadges(
      dayRange,
      weeklyGoals,
      { startWeight: profile.current_weight, targetWeight: profile.target_weight },
      scoringDate,
    );
    const toGrant = derived.filter((b) => !earnedBadgeKeys.has(b.key) && !grantingRef.current.has(b.key));
    if (toGrant.length === 0) return;

    toGrant.forEach((b) => grantingRef.current.add(b.key));
    (async () => {
      for (const b of toGrant) {
        const { data, error } = await rpc("grant_achievement", {
          p_key: b.key,
          p_tier: b.tier,
          p_run: runIndex,
        });
        if (!error) {
          // Queue the trophy celebration first, then any level-up it causes.
          pushCelebration({ type: "badge", badge: b });
          applyXp(data ?? 0);
        }
      }
      setEarnedBadgeKeys((prev) => {
        const n = new Set(prev);
        toGrant.forEach((b) => n.add(b.key));
        return n;
      });
    })();
  }, [
    userId,
    profile,
    achievementsLoaded,
    dayRange,
    weeklyGoals,
    earnedBadgeKeys,
    runIndex,
    scoringDate,
    applyXp,
    pushCelebration,
  ]);

  // Recovery floor: total_xp should never sit below the XP actually recorded in
  // quest_claims + achievements. If it does (e.g. an earlier bug reset it), raise
  // it back. Only ever raises — never lowers — so it can't clobber a real total,
  // and it no-ops once equal (so it can't loop). Re-runs after the grant effect
  // refills achievements (earnedBadgeKeys changes) to pick up re-granted trophies.
  useEffect(() => {
    if (!userId || !profile || !achievementsLoaded) return;
    let active = true;
    (async () => {
      // The server does the sum and the write; it only ever raises the total.
      const { data, error } = await rpc("sync_my_xp");
      if (!active || error || data == null) return;
      if (data > xpRef.current) {
        xpRef.current = data;
        setXp(data);
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

  /**
   * Grant every trophy the run qualifies for as of `asOf`, then report the full
   * unlocked set. Called when a 100-day run is locked in on Day 100 itself: the
   * final week is settled by that act, so anything it unlocks has to be paid out
   * before the trophy case is archived and reset for the next run.
   *
   * Deliberately silent — the finish modal is already on screen, so a queued
   * full-screen celebration would fight with it.
   */
  const sealBadges = useCallback(
    async (asOf: string): Promise<Badge[]> => {
      if (!userId || !profile) return [];
      const derived = getEarnedBadges(
        dayRange,
        weeklyGoals,
        { startWeight: profile.current_weight, targetWeight: profile.target_weight },
        asOf,
      );
      const toGrant = derived.filter((b) => !earnedBadgeKeys.has(b.key) && !grantingRef.current.has(b.key));
      if (toGrant.length === 0) return derived;

      toGrant.forEach((b) => grantingRef.current.add(b.key));
      for (const b of toGrant) {
        const { data, error } = await rpc("grant_achievement", {
          p_key: b.key,
          p_tier: b.tier,
          p_run: runIndex,
        });
        if (!error) applyXp(data ?? 0);
      }
      setEarnedBadgeKeys((prev) => {
        const n = new Set(prev);
        toGrant.forEach((b) => n.add(b.key));
        return n;
      });
      return derived;
    },
    [userId, profile, dayRange, weeklyGoals, earnedBadgeKeys, runIndex, applyXp],
  );

  const celebrateMilestone = useCallback(
    async (weight: number) => {
      if (!userId) return;
      // The server verifies the crossing against the user's own logs and goal
      // direction, records last_celebrated_weight, and banks the bonus.
      const { data } = await rpc("award_milestone_xp", { p_weight: weight });
      applyXp(data ?? 0);
      await refetchProfile();
    },
    [userId, applyXp, refetchProfile],
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
    sealBadges,
    celebrateMilestone,
    celebrations,
    dismissCelebration,
  };
}
