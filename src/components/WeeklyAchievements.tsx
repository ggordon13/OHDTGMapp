import { Trophy } from "lucide-react";
import { DailyLog } from "@/lib/mockData";
import { WeeklyGoals, getWeeklyAvg, isAchieved, chunkIntoWeeks } from "@/lib/gamification";
import GamePanel from "@/components/game/GamePanel";

interface WeeklyAchievementsProps {
  logs: DailyLog[];
  goals: WeeklyGoals;
}

const MetricCell = ({ value, unit, met }: { value: string; unit: string; met: boolean }) => (
  <span className={`text-xs font-bold ${met ? "text-[hsl(84,45%,32%)]" : "text-muted-foreground"}`}>
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
    <GamePanel title="Weekly Achievements" icon={<Trophy className="h-4 w-4" />} color="teal">
      <div className="space-y-3">
        <p className="game-tag px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
          ⭐ = Avg calories ≤ {goals.dailyCalories} + 2 of: protein ≥ {goals.dailyProtein}g, water ≥ {goals.dailyWater} glasses, steps ≥ {goals.dailySteps.toLocaleString()}, exercise ≥ 1 day/week · streak of ⭐ weeks earns 🥉→🥈→🥇
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[hsl(33,28%,60%)]">
                <th className="px-2 py-2 text-left font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Week</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Cal</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Prot</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Water</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Exer</th>
                <th className="px-2 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ avg, achieved, tier }, wi) => (
                <tr key={wi} className="border-b border-[hsl(33,28%,68%)] last:border-0">
                  <td className="px-2 py-2 font-display text-xs font-bold text-muted-foreground">Wk {wi + 1}</td>
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
    </GamePanel>
  );
};

export default WeeklyAchievements;
