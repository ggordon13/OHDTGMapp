import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ChallengeMode = "partner" | "group";
export type ChallengeStatus = "pending" | "active" | "completed" | "cancelled";
export type AwardKey = "golden_shoe" | "energetic" | "biggest_loser" | "milestone_master" | "overall";

export interface ChallengeRow {
  id: string;
  leader_id: string;
  mode: ChallengeMode;
  start_date: string;
  duration_days: number;
  status: ChallengeStatus;
  created_at: string;
}

export interface ChallengeMember {
  user_id: string;
  username: string | null;
  status: "invited" | "accepted" | "declined";
  is_leader: boolean;
  joined_at: string | null;
  wants_cancel: boolean;
}

export interface ChallengeReward {
  award_key: AwardKey;
  reward_text: string | null;
}

export interface ChallengeView {
  challenge: ChallengeRow;
  members: ChallengeMember[];
  rewards: ChallengeReward[];
  /** The current user's own status in this challenge. */
  myStatus: "invited" | "accepted" | "declined";
  /** Whether the current user is the leader. */
  isLeader: boolean;
  resultsSeenAt: string | null;
  completedAt: string | null;
}

export interface CreateChallengeInput {
  mode: ChallengeMode;
  startDate: string;
  participantIds: string[];
  rewards: Partial<Record<AwardKey, string>>;
}

export interface LeaderboardRow {
  user_id: string;
  username: string | null;
  xp_window: number;
  weight_start: number | null;
  weight_end: number | null;
  pct_weight_loss: number | null;
  avg_steps: number;
  exercise_days: number;
}

/**
 * Loads the caller's current challenge (the one they've committed to) plus any
 * pending invites, and exposes the invite/create/respond actions. Refreshes on
 * load and after each action (poll-based, like PremiumRequests).
 */
export function useChallenge() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<ChallengeView | null>(null);
  const [invites, setInvites] = useState<ChallengeView[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    if (!user) {
      setCurrent(null);
      setInvites([]);
      setLoading(false);
      return;
    }

    const { data: myRows } = await supabase
      .from("challenge_participants")
      .select("challenge_id, status, results_seen_at, completed_at")
      .eq("user_id", user.id);

    const rows = myRows ?? [];
    if (rows.length === 0) {
      setCurrent(null);
      setInvites([]);
      setLoading(false);
      return;
    }

    const ids = rows.map((r) => r.challenge_id);
    const [{ data: challenges }, { data: rewards }, memberLists] = await Promise.all([
      supabase.from("challenges").select("*").in("id", ids),
      supabase.from("challenge_rewards").select("*").in("challenge_id", ids),
      Promise.all(ids.map((id) => supabase.rpc("challenge_members", { p_challenge: id }))),
    ]);

    const membersByChallenge = new Map<string, ChallengeMember[]>();
    ids.forEach((id, i) => membersByChallenge.set(id, (memberLists[i].data ?? []) as ChallengeMember[]));

    const views: ChallengeView[] = (challenges ?? []).map((c) => {
      const row = rows.find((r) => r.challenge_id === c.id);
      return {
        challenge: c as ChallengeRow,
        members: membersByChallenge.get(c.id) ?? [],
        rewards: ((rewards ?? []).filter((r) => r.challenge_id === c.id) as ChallengeReward[]),
        myStatus: (row?.status ?? "invited") as ChallengeView["myStatus"],
        isLeader: c.leader_id === user.id,
        resultsSeenAt: row?.results_seen_at ?? null,
        completedAt: row?.completed_at ?? null,
      };
    });

    setInvites(views.filter((v) => v.myStatus === "invited" && v.challenge.status === "pending"));

    // The challenge the user is engaged in: an ongoing one (pending/active), or
    // a just-finished one whose results were revealed today (so results linger
    // for the rest of the day). Prefer the ongoing one if somehow both exist.
    const todayStr = new Date().toISOString().slice(0, 10);
    const seenToday = (ts: string | null) => ts != null && ts.slice(0, 10) === todayStr;
    const engaged = views.filter(
      (v) =>
        v.myStatus === "accepted" &&
        (v.challenge.status === "pending" ||
          v.challenge.status === "active" ||
          (v.challenge.status === "completed" && seenToday(v.resultsSeenAt))),
    );
    setCurrent(
      engaged.find((v) => v.challenge.status !== "completed") ??
        engaged.find((v) => v.challenge.status === "completed") ??
        null,
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void fetchChallenges();
  }, [fetchChallenges]);

  /** Resolve an invitee identifier (username or email) to a user id, or null. */
  const resolveUser = useCallback(async (identifier: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc("resolve_challenge_user", { identifier });
    if (error) return null;
    return (data as string | null) ?? null;
  }, []);

  const create = useCallback(
    async (input: CreateChallengeInput) => {
      const { error } = await supabase.rpc("create_challenge", {
        p_mode: input.mode,
        p_start_date: input.startDate,
        p_participant_ids: input.participantIds,
        p_rewards: input.rewards,
      });
      if (error) throw error;
      await fetchChallenges();
    },
    [fetchChallenges],
  );

  const respond = useCallback(
    async (challengeId: string, accept: boolean) => {
      const { error } = await supabase.rpc("respond_to_challenge", { p_challenge: challengeId, p_accept: accept });
      if (error) throw error;
      await fetchChallenges();
    },
    [fetchChallenges],
  );

  const cancel = useCallback(
    async (challengeId: string) => {
      const { error } = await supabase.rpc("cancel_challenge", { p_challenge: challengeId });
      if (error) throw error;
      await fetchChallenges();
    },
    [fetchChallenges],
  );

  /** Cast (or withdraw) a vote to cancel an active challenge; all must agree. */
  const voteCancel = useCallback(
    async (challengeId: string, agree: boolean) => {
      const { error } = await supabase.rpc("vote_cancel_challenge", { p_challenge: challengeId, p_agree: agree });
      if (error) throw error;
      await fetchChallenges();
    },
    [fetchChallenges],
  );

  const getLeaderboard = useCallback(async (challengeId: string): Promise<LeaderboardRow[]> => {
    const { data, error } = await supabase.rpc("challenge_leaderboard", { p_challenge: challengeId });
    if (error) return [];
    return (data ?? []) as LeaderboardRow[];
  }, []);

  /** Mark the caller's Day-30 data as finished (drives the completion modal, once). */
  const markCompleted = useCallback(
    async (challengeId: string) => {
      if (!user) return;
      await supabase
        .from("challenge_participants")
        .update({ completed_at: new Date().toISOString() })
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id)
        .is("completed_at", null);
      await fetchChallenges();
    },
    [user, fetchChallenges],
  );

  /** Mark results as seen (and finish the challenge for everyone). */
  const markResultsSeen = useCallback(
    async (challengeId: string) => {
      await supabase.rpc("finish_challenge_for_me", { p_challenge: challengeId });
      await fetchChallenges();
    },
    [fetchChallenges],
  );

  return {
    current,
    invites,
    loading,
    refetch: fetchChallenges,
    resolveUser,
    create,
    respond,
    cancel,
    voteCancel,
    getLeaderboard,
    markCompleted,
    markResultsSeen,
  };
}
