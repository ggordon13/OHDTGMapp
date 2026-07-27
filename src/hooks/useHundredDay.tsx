import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import type { ArchivedBadge, RunSummary } from "@/lib/hundredDay";
import type { GoalType } from "@/lib/profile";
import type { DailyTargets } from "@/lib/profile";

/** One archived 100-day run — the record behind a golden star. */
export interface FinishedRun {
  id: string;
  runNumber: number;
  startDate: string;
  endDate: string;
  completedAt: string;
  summary: RunSummary;
  badges: ArchivedBadge[];
}

/** Everything the restart form collects for the run that comes next. */
export interface RestartPlan {
  /** The new Day 1 (YYYY-MM-DD). May be today or a future date. */
  newStartDate: string;
  startWeight: number;
  goalType: GoalType;
  targetWeight: number;
  /** Set only when the user opted into the recommended band. */
  targetWeightMin: number | null;
  targetWeightMax: number | null;
  targets: DailyTargets;
}

export interface FinishRunInput {
  /** The finished run's Day 1 and Day 100 (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  summary: RunSummary;
  badges: ArchivedBadge[];
  restart: RestartPlan;
}

/**
 * The finisher archive: every completed 100-day run, plus the one call that
 * closes a run out. Finishing is a single server-side transaction, so the star,
 * the archive row and the re-based profile can never drift apart.
 */
export function useHundredDay(userId: string | undefined) {
  const [runs, setRuns] = useState<FinishedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const fetchRuns = useCallback(async () => {
    if (!userId) {
      setRuns([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("hundred_day_runs")
      .select("*")
      .eq("user_id", userId)
      .order("run_number", { ascending: true });

    if (error) console.error("Failed to load finished runs", error);

    setRuns(
      (data ?? []).map((r) => ({
        id: r.id,
        runNumber: r.run_number,
        startDate: r.start_date,
        endDate: r.end_date,
        completedAt: r.completed_at,
        summary: (r.summary ?? {}) as unknown as RunSummary,
        badges: (Array.isArray(r.badges) ? r.badges : []) as unknown as ArchivedBadge[],
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void fetchRuns();
  }, [fetchRuns]);

  const finishRun = useCallback(
    async ({ startDate, endDate, summary, badges, restart }: FinishRunInput): Promise<boolean> => {
      if (!userId || finishing) return false;
      setFinishing(true);
      try {
        const { error } = await supabase.rpc("finish_hundred_day_run", {
          p_start_date: startDate,
          p_end_date: endDate,
          p_summary: summary as unknown as Json,
          p_badges: badges as unknown as Json,
          p_new_start: restart.newStartDate,
          p_current_weight: restart.startWeight,
          p_goal_type: restart.goalType,
          p_target_weight: restart.targetWeight,
          p_target_weight_min: restart.targetWeightMin,
          p_target_weight_max: restart.targetWeightMax,
          p_calorie_target: restart.targets.calorieMax,
          p_calorie_min: restart.targets.calorieMin,
          p_calorie_max: restart.targets.calorieMax,
          p_protein_target: restart.targets.proteinMin,
          p_protein_min: restart.targets.proteinMin,
          p_protein_max: restart.targets.proteinMax,
          p_water_target: restart.targets.water,
          p_steps_target: restart.targets.steps,
        });
        if (error) throw error;
        await fetchRuns();
        return true;
      } catch (error) {
        console.error("finishRun failed", error);
        toast.error("Couldn't finish your challenge — please try again.");
        return false;
      } finally {
        setFinishing(false);
      }
    },
    [userId, finishing, fetchRuns],
  );

  return { runs, loading, finishing, finishRun, refetch: fetchRuns };
}
