import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DailyLog } from "@/lib/mockData";

export function useDailyLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (data) {
      setLogs(data.map((d) => ({
        date: d.date,
        day: d.day_number,
        weight: d.weight,
        calories: d.calories,
        protein: d.protein,
        water: d.water,
        exercise: d.exercise ?? "None",
        steps: d.steps,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const addLog = async (entry: DailyLog) => {
    if (!user) return;
    await supabase.from("daily_logs").insert({
      user_id: user.id,
      date: entry.date,
      day_number: entry.day,
      weight: entry.weight,
      calories: entry.calories,
      protein: entry.protein,
      water: entry.water,
      exercise: entry.exercise,
      steps: entry.steps,
    });
    await fetchLogs();
  };

  const updateLogs = async (updated: DailyLog[]) => {
    if (!user) return;
    const rows = updated.map((log) => ({
      user_id: user.id,
      date: log.date,
      day_number: log.day,
      weight: log.weight,
      calories: log.calories,
      protein: log.protein,
      water: log.water,
      exercise: log.exercise,
      steps: log.steps,
    }));
    await supabase.from("daily_logs").upsert(rows, { onConflict: "user_id,date" });
    await fetchLogs();
  };

  return { logs, loading, addLog, updateLogs };
}
