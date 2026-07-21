import { useMemo, type ReactNode } from "react";
import { BarChart3, FileDown, FileText, Lock, TrendingDown, TrendingUp, Star, Footprints, Beef, Droplets, Flame } from "lucide-react";
import { toast } from "sonner";
import { DailyLog } from "@/lib/mockData";
import { WeeklyGoals } from "@/lib/gamification";
import { computeAnalytics } from "@/lib/analytics";
import { exportAnalyticsCsv, exportAnalyticsPdf, type ExportMeta } from "@/lib/export";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";

interface DataAnalyticsProps {
  logs: DailyLog[];
  goals: WeeklyGoals;
  userName: string;
  /** Premium/staff may view the numbers and export; free users see a locked teaser. */
  canExport: boolean;
  /** Rendered inside the locked state (the "Get Premium" request button). */
  lockedSlot?: ReactNode;
}

const Tile = ({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: "good" | "bad" }) => (
  <div className="game-tag flex items-center gap-2 px-2.5 py-2">
    <span className="shrink-0">{icon}</span>
    <div className="min-w-0">
      <p
        className={
          "font-display text-base font-bold leading-none " +
          (tone === "good" ? "text-[hsl(84,45%,28%)]" : tone === "bad" ? "text-[hsl(0,65%,42%)]" : "text-card-foreground")
        }
      >
        {value}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  </div>
);

const DataAnalytics = ({ logs, goals, userName, canExport, lockedSlot }: DataAnalyticsProps) => {
  const analytics = useMemo(() => computeAnalytics(logs, goals), [logs, goals]);

  const meta = useMemo<ExportMeta>(() => {
    const logged = logs.filter((l) => l.weight != null || l.calories != null || l.steps != null);
    return {
      name: userName,
      generatedOn: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      rangeStart: logged[0]?.date ?? null,
      rangeEnd: logged[logged.length - 1]?.date ?? null,
    };
  }, [logs, userName]);

  const handleExport = (kind: "csv" | "pdf") => {
    try {
      if (kind === "csv") exportAnalyticsCsv(analytics, meta);
      else exportAnalyticsPdf(analytics, meta);
      toast.success(`Exported your ${kind.toUpperCase()} report 📄`);
    } catch (err) {
      console.error("Export failed", err);
      toast.error("Sorry — the export failed. Please try again.");
    }
  };

  if (!canExport) {
    return (
      <GamePanel title="Analytics & Export" icon={<BarChart3 className="h-4 w-4" />} color="purple">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(268,42%,60%)]/15">
            <Lock className="h-6 w-6 text-[hsl(268,42%,50%)]" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-card-foreground">
              Progress analytics is a premium feature
            </p>
            <p className="mx-auto max-w-sm text-xs font-semibold text-muted-foreground">
              Unlock full trend stats plus one-click CSV and PDF reports of your whole journey.
            </p>
          </div>
          {lockedSlot}
        </div>
      </GamePanel>
    );
  }

  const w = analytics.weight;
  const changeTone = w ? (w.change <= 0 ? "good" : "bad") : undefined;

  return (
    <GamePanel
      title="Analytics & Export"
      icon={<BarChart3 className="h-4 w-4" />}
      color="purple"
      right={
        <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {analytics.daysLogged} days logged
        </span>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile
            icon={
              w && w.change <= 0 ? (
                <TrendingDown className="h-4 w-4 text-[hsl(84,45%,35%)]" />
              ) : (
                <TrendingUp className="h-4 w-4 text-[hsl(0,65%,50%)]" />
              )
            }
            label="Weight change"
            value={w ? `${w.change > 0 ? "+" : ""}${w.change} kg` : "—"}
            tone={changeTone}
          />
          <Tile icon={<Star className="h-4 w-4 fill-[hsl(40,90%,55%)] text-[hsl(40,90%,45%)]" />} label="Star weeks" value={`${analytics.starWeeks}/${analytics.weeks}`} />
          <Tile icon={<Flame className="h-4 w-4 text-[hsl(24,85%,52%)]" />} label="Avg calories" value={analytics.averages.calories !== null ? `${analytics.averages.calories}` : "—"} />
          <Tile icon={<Beef className="h-4 w-4 text-[hsl(24,55%,42%)]" />} label="Avg protein" value={analytics.averages.protein !== null ? `${analytics.averages.protein}g` : "—"} />
          <Tile icon={<Droplets className="h-4 w-4 text-[hsl(200,60%,45%)]" />} label="Avg water" value={analytics.averages.water !== null ? `${analytics.averages.water}` : "—"} />
          <Tile icon={<Footprints className="h-4 w-4 text-[hsl(140,40%,40%)]" />} label="Avg steps" value={analytics.averages.steps !== null ? `${Math.round(analytics.averages.steps).toLocaleString()}` : "—"} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <GameButton color="leaf" size="sm" className="flex-1" onClick={() => handleExport("csv")}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </GameButton>
          <GameButton color="red" size="sm" className="flex-1" onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4" />
            Export PDF
          </GameButton>
        </div>
      </div>
    </GamePanel>
  );
};

export default DataAnalytics;
