import { Trophy } from "lucide-react";
import { DailyLog } from "@/lib/mockData";
import { WeeklyGoals, getWeeklyAvg, isAchieved, chunkIntoWeeks } from "@/lib/gamification";

interface WeeklyAchievementsProps {
  logs: DailyLog[];
  goals: WeeklyGoals;
}

const MetricCell = ({ value, unit, met }: { value: string; unit: string; met: boolean }) => (
  <span className={`text-xs ${met ? "text-primary font-semibold" : "text-muted-foreground"}`}>
    {value}{unit}
  </span>
);

const WeeklyAchievements = ({ logs, goals }: WeeklyAchievementsProps) => {
  const weeks = chunkIntoWeeks(logs);

  // Running count of consecutive ⭐ weeks, so each qualifying week can show a
  // Bronze/Silver/Gold tier the same way the Trophy Case awards them.
  let starRun = 0;
  const rows = weeks.map((week) => {
    const avg = getWeeklyAvg(week);
    const achieved = isAchieved(avg, goals);
    starRun = achieved ? starRun + 1 : 0;
    const tier = !achieved ? null : starRun >= 6 ? "🥇" : starRun >= 3 ? "🥈" : "🥉";
    return { avg, achieved, tier };
  });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">Weekly Achievements</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        ⭐ = Avg calories ≤ {goals.dailyCalories} + 2 of: protein ≥ {goals.dailyProtein}g, water ≥ {goals.dailyWater} glasses, steps ≥ {goals.dailySteps.toLocaleString()}, exercise ≥ 1 day/week · streak of ⭐ weeks earns 🥉→🥈→🥇
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Week</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Cal</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Prot</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Water</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Steps</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Exer</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ avg, achieved, tier }, wi) => (
              <tr key={wi} className="border-b last:border-0">
                <td className="px-2 py-2 text-xs text-muted-foreground">Wk {wi + 1}</td>
                <td className="px-2 py-2 text-right">
                  <MetricCell value={avg.calories?.toFixed(0) ?? "—"} unit="" met={avg.calories !== null && avg.calories <= goals.dailyCalories} />
                </td>
                <td className="px-2 py-2 text-right">
                  <MetricCell value={avg.protein?.toFixed(0) ?? "—"} unit="g" met={avg.protein !== null && avg.protein >= goals.dailyProtein} />
                </td>
                <td className="px-2 py-2 text-right">
                  <MetricCell value={avg.water?.toFixed(0) ?? "—"} unit=" gl" met={avg.water !== null && avg.water >= goals.dailyWater} />
                </td>
                <td className="px-2 py-2 text-right">
                  <MetricCell value={avg.steps?.toFixed(0) ?? "—"} unit="" met={avg.steps !== null && avg.steps >= goals.dailySteps} />
                </td>
                <td className="px-2 py-2 text-right">
                  <MetricCell value={`${avg.exerciseDays}/${avg.totalDays}`} unit="d" met={avg.exerciseDays >= 1} />
                </td>
                <td className="px-2 py-2 text-center text-lg">{achieved ? `⭐${tier}` : "⭕"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WeeklyAchievements;
