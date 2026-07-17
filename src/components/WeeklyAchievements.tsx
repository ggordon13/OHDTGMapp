import { Trophy, Check, Flame, Star } from "lucide-react";
import { DailyLog } from "@/lib/mockData";
import { WeeklyGoals, getWeeklyAvg, isAchieved, chunkIntoWeeks } from "@/lib/gamification";
import GamePanel from "@/components/game/GamePanel";
import { cn } from "@/lib/utils";

interface WeeklyAchievementsProps {
  logs: DailyLog[];
  goals: WeeklyGoals;
}

/** A metric reading: met targets get a green check-pill, misses stay muted. */
const MetricCell = ({ value, met }: { value: string; met: boolean }) =>
  met ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(84,46%,45%)]/20 px-1.5 py-0.5 font-display text-[11px] font-bold text-[hsl(84,45%,28%)]">
      <Check className="h-3 w-3" strokeWidth={3.5} />
      {value}
    </span>
  ) : (
    <span className="font-display text-[11px] font-semibold text-muted-foreground/70">{value}</span>
  );

const tierMedal: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };

const WeeklyAchievements = ({ logs, goals }: WeeklyAchievementsProps) => {
  const weeks = chunkIntoWeeks(logs);

  // Running count of consecutive ⭐ weeks, so each qualifying week can show a
  // Bronze/Silver/Gold tier the same way the Trophy Case awards them.
  let starRun = 0;
  let bestRun = 0;
  const rows = weeks.map((week) => {
    const avg = getWeeklyAvg(week);
    const achieved = isAchieved(avg, goals);
    starRun = achieved ? starRun + 1 : 0;
    bestRun = Math.max(bestRun, starRun);
    const tier = !achieved ? null : starRun >= 6 ? "gold" : starRun >= 3 ? "silver" : "bronze";
    return { avg, achieved, tier };
  });

  const starWeeks = rows.filter((r) => r.achieved).length;
  const currentStreak = starRun; // trailing run after the loop
  const topTier = bestRun >= 6 ? "gold" : bestRun >= 3 ? "silver" : bestRun >= 1 ? "bronze" : null;

  return (
    <GamePanel
      title="Weekly Achievements"
      icon={<Trophy className="h-4 w-4" />}
      color="teal"
      right={
        <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {starWeeks}/{rows.length} ⭐
        </span>
      }
    >
      <div className="space-y-3">
        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="game-tag flex items-center gap-2 px-2.5 py-2">
            <Star className="h-4 w-4 shrink-0 fill-[hsl(40,90%,55%)] text-[hsl(40,90%,45%)]" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-none text-card-foreground">{starWeeks}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Star weeks</p>
            </div>
          </div>
          <div className="game-tag flex items-center gap-2 px-2.5 py-2">
            <Flame className="h-4 w-4 shrink-0 text-[hsl(24,85%,52%)]" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-none text-card-foreground">{currentStreak}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Current streak</p>
            </div>
          </div>
          <div className="game-tag flex items-center gap-2 px-2.5 py-2">
            <span className="text-lg leading-none">{topTier ? tierMedal[topTier] : "⭕"}</span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold capitalize leading-tight text-card-foreground">{topTier ?? "None"}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Best tier</p>
            </div>
          </div>
        </div>

        <p className="game-tag px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-muted-foreground">
          ⭐ = Avg calories ≤ {goals.dailyCalories} + 2 of: protein ≥ {goals.dailyProtein}g, water ≥ {goals.dailyWater} glasses, steps ≥ {goals.dailySteps.toLocaleString()}, exercise ≥ 1 day/week · a streak of ⭐ weeks earns 🥉→🥈→🥇
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
                <th className="px-2 py-2 text-center font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Star</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ avg, achieved, tier }, wi) => (
                <tr
                  key={wi}
                  className={cn(
                    "border-b border-[hsl(33,28%,72%)] transition-colors last:border-0 hover:bg-[hsl(36,38%,80%)]/40",
                    achieved && "bg-[hsl(84,44%,52%)]/12",
                  )}
                >
                  <td className="px-2 py-2 font-display text-xs font-bold text-card-foreground">Wk {wi + 1}</td>
                  <td className="px-2 py-2 text-right">
                    <MetricCell value={avg.calories?.toFixed(0) ?? "—"} met={avg.calories !== null && avg.calories <= goals.dailyCalories} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricCell value={`${avg.protein?.toFixed(0) ?? "—"}g`} met={avg.protein !== null && avg.protein >= goals.dailyProtein} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricCell value={`${avg.water?.toFixed(0) ?? "—"}gl`} met={avg.water !== null && avg.water >= goals.dailyWater} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricCell value={avg.steps?.toFixed(0) ?? "—"} met={avg.steps !== null && avg.steps >= goals.dailySteps} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricCell value={`${avg.exerciseDays}/${avg.totalDays}d`} met={avg.exerciseDays >= 1} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {achieved && tier ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full border-2 border-[hsl(40,65%,32%)] bg-gradient-to-b from-[hsl(44,92%,62%)] to-[hsl(38,85%,48%)] px-1.5 py-0.5 text-xs shadow-[0_2px_0_hsl(38,65%,32%)]">
                        ⭐{tierMedal[tier]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">⭕</span>
                    )}
                  </td>
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
