import { ReactNode } from "react";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import TrophyHex from "@/components/game/TrophyHex";
import { ArchivedBadge, RunSummary, weightVerdict } from "@/lib/hundredDay";
import { cn } from "@/lib/utils";

interface RunReportProps {
  summary: RunSummary;
  badges: ArchivedBadge[];
  className?: string;
}

const fmt = (n: number | null | undefined, unit = "", decimals = 0): string =>
  n == null ? "—" : `${decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString()}${unit}`;

const fmtWeight = (n: number | null | undefined): string => (n == null ? "—" : `${Math.round(n * 10) / 10} kg`);

const Tile = ({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: "good" | "bad" | "neutral" }) => (
  <div className="game-tag px-2.5 py-1.5">
    <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p
      className={cn(
        "font-display text-sm font-bold",
        tone === "good" && "text-[hsl(84,45%,28%)]",
        tone === "bad" && "text-[hsl(6,62%,42%)]",
        tone === "neutral" && "text-card-foreground",
      )}
    >
      {value}
    </p>
  </div>
);

/**
 * The Day 1 → Day 100 report card for a run: the weight story up top, the
 * consistency and average numbers below it, then the trophies that were on the
 * shelf when the run closed. Shared by the finish celebration and the archive.
 */
const RunReport = ({ summary, badges, className }: RunReportProps) => {
  const { tone } = weightVerdict(summary);
  const change = summary.weightChange;
  const pct = summary.weightChangePct;
  const TrendIcon = tone === "good" ? TrendingDown : tone === "bad" ? TrendingUp : Minus;

  // Percentage is shown as a magnitude with a "lost/gained" word, so it reads
  // the same whether the goal was to lose or to hold steady.
  const pctLabel = pct == null ? "—" : `${Math.abs(pct).toFixed(1)}%`;
  const directionWord = change == null || change === 0 ? "change" : change < 0 ? "lost" : "gained";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Day 1 vs Day 100 */}
      <div className="rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)] p-3">
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Day 1</p>
            <p className="font-display text-xl font-bold text-card-foreground">{fmtWeight(summary.startWeight)}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="text-center">
            <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Day 100</p>
            <p className="font-display text-xl font-bold text-card-foreground">{fmtWeight(summary.endWeight)}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 font-display text-xs font-bold",
              tone === "good" && "border-[hsl(84,45%,28%)] bg-[hsl(84,42%,88%)] text-[hsl(84,45%,26%)]",
              tone === "bad" && "border-[hsl(6,55%,45%)] bg-[hsl(6,60%,92%)] text-[hsl(6,62%,40%)]",
              tone === "neutral" && "border-[hsl(33,28%,55%)] bg-[hsl(37,40%,88%)] text-muted-foreground",
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {change == null ? "No weigh-ins" : `${change > 0 ? "+" : ""}${change} kg`}
          </span>
          <span className="game-tag px-2.5 py-0.5 font-display text-xs font-bold text-card-foreground">
            {pctLabel} of body weight {directionWord}
          </span>
          {summary.targetReached && (
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-[hsl(33,78%,26%)] bg-gradient-to-b from-[hsl(44,95%,66%)] to-[hsl(36,88%,48%)] px-2.5 py-0.5 font-display text-xs font-bold text-[hsl(28,60%,16%)]">
              🎯 Target reached
            </span>
          )}
        </div>
      </div>

      {/* Consistency */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Days logged" value={`${summary.daysLogged}/${summary.totalDays}`} />
        <Tile label="Full logs" value={`${summary.daysComplete}/${summary.totalDays}`} />
        <Tile label="Longest streak" value={`${summary.longestStreak} days`} />
        <Tile label="⭐ Weeks" value={`${summary.starWeeks}/${summary.totalWeeks}`} />
      </div>

      {/* Daily averages over the run */}
      <div>
        <p className="mb-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Daily averages
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Weight" value={fmtWeight(summary.averages.weight)} />
          <Tile label="Calories" value={fmt(summary.averages.calories, " kcal")} />
          <Tile label="Protein" value={fmt(summary.averages.protein, " g")} />
          <Tile label="Water" value={fmt(summary.averages.water, " glasses", 1)} />
          <Tile label="Steps" value={fmt(summary.averages.steps)} />
          <Tile label="Exercise days" value={`${summary.exerciseDays}`} />
        </div>
      </div>

      {/* Weight extremes + where the level sat when the run closed */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Lowest" value={fmtWeight(summary.lowestWeight)} />
        <Tile label="Highest" value={fmtWeight(summary.highestWeight)} />
        <Tile label="Target was" value={fmtWeight(summary.targetWeight)} />
        <Tile label="Finished at" value={`Lv ${summary.levelAtFinish} · ${summary.xpAtFinish.toLocaleString()} XP`} />
      </div>

      {/* The trophy case as it stood when the run ended */}
      <div>
        <p className="mb-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Trophies won ({badges.length})
        </p>
        {badges.length === 0 ? (
          <p className="text-sm font-semibold text-muted-foreground">
            No trophies this run — the next 100 days are a clean slate.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {badges.map((b) => (
              <div key={b.key} className="flex flex-col items-center gap-1 text-center" title={b.description}>
                <TrophyHex tier={b.tier} icon={b.icon} iconColor={b.iconColor} size="h-11 w-11 text-xl" />
                <span className="font-display text-[9px] font-semibold leading-tight text-card-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RunReport;
