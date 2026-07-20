import { useState } from "react";
import { Trophy, Check, Flame, Star, ChevronDown, Utensils, Beef, Droplets, Footprints, Dumbbell, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
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

/** One goal condition, shown as a compact labelled chip. */
const Cond = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <span className="game-tag inline-flex items-baseline gap-1.5 px-2 py-1">
    <Icon className="h-3 w-3 shrink-0 translate-y-0.5 text-[hsl(24,55%,42%)]" />
    <span className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-[11px] font-bold text-card-foreground">{value}</span>
  </span>
);

const WeeklyAchievements = ({ logs, goals }: WeeklyAchievementsProps) => {
  const [showRules, setShowRules] = useState(true);
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

        {/* How a ⭐ week is earned. Mirrors isAchieved(): either the calorie
            route with 2 extras, or the steps + exercise fallback. */}
        <div className="rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)]">
          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            aria-expanded={showRules}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
          >
            <span className="font-display text-xs font-bold uppercase tracking-wide text-card-foreground">
              ⭐ How to earn a star week
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showRules ? "rotate-180" : ""}`}
            />
          </button>

          {showRules && (
            <div className="space-y-3 border-t-2 border-[hsl(33,28%,68%)] px-3 py-3">
              {/* Route 1 */}
              <div className="space-y-1.5">
                <p className="font-display text-[11px] font-bold uppercase tracking-wide text-[hsl(70,45%,32%)]">
                  Option 1 — stay in your calorie budget
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Cond icon={Utensils} label="Avg calories" value={`≤ ${goals.dailyCalories.toLocaleString()}`} />
                  <span className="text-[11px] font-bold text-muted-foreground">plus any 2 of:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Cond icon={Beef} label="Protein" value={`≥ ${goals.dailyProtein}g`} />
                  <Cond icon={Droplets} label="Water" value={`≥ ${goals.dailyWater} glasses`} />
                  <Cond icon={Footprints} label="Steps" value={`≥ ${goals.dailySteps.toLocaleString()}`} />
                  <Cond icon={Dumbbell} label="Exercise" value="≥ 1 day" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-[hsl(33,28%,68%)]" />
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-[hsl(33,28%,68%)]" />
              </div>

              {/* Route 2 */}
              <div className="space-y-1.5">
                <p className="font-display text-[11px] font-bold uppercase tracking-wide text-[hsl(70,45%,32%)]">
                  Option 2 — over budget? Move instead
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Cond icon={Footprints} label="Steps" value={`≥ ${goals.dailySteps.toLocaleString()}`} />
                  <span className="text-[11px] font-bold text-muted-foreground">and</span>
                  <Cond icon={Dumbbell} label="Exercise" value="≥ 1 day" />
                </div>
              </div>

              {/* Tiers */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t-2 border-[hsl(33,28%,68%)] pt-2.5">
                <span className="font-display text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Stack star weeks in a row:
                </span>
                <span className="text-[11px] font-bold text-card-foreground">🥉 1–2</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-[11px] font-bold text-card-foreground">🥈 3–5</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-[11px] font-bold text-card-foreground">🥇 6+</span>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[hsl(33,28%,60%)]">
                <th className="px-2 py-2 text-left font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Week</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Cal</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Prot</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Water</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Weight</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps</th>
                <th className="px-2 py-2 text-right font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Exer</th>
                <th className="px-2 py-2 text-center font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">Star</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ avg, achieved, tier }, wi) => {
                const prevAvg = wi > 0 ? rows[wi - 1].avg : null;
                const weightTrend = avg.weight !== null && prevAvg?.weight !== null
                  ? avg.weight > prevAvg.weight
                    ? "up"
                    : avg.weight < prevAvg.weight
                      ? "down"
                      : "flat"
                  : null;
                const weightColor = weightTrend === "up"
                  ? "text-[hsl(6,62%,42%)]" // red for weight increase
                  : weightTrend === "down" || weightTrend === "flat"
                    ? "text-[hsl(84,45%,28%)]" // green for weight decrease or flat
                    : "text-muted-foreground/70";

                return (
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
                    <td className={`px-2 py-2 text-right font-display text-[11px] font-semibold ${weightColor}`}>
                      <div className="inline-flex items-center gap-1">
                        {avg.weight?.toFixed(1) ?? "—"} kg
                        {weightTrend === "up" && <TrendingUp className="h-3 w-3" />}
                        {weightTrend === "down" && <TrendingDown className="h-3 w-3" />}
                      </div>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </GamePanel>
  );
};

export default WeeklyAchievements;
