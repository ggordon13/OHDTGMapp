import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { DailyLog } from "@/lib/mockData";
import { getWeeklyWeightAverages, getWeightMilestones } from "@/lib/gamification";
import { CalendarDays, CalendarRange, Flag, TrendingDown, Maximize2, X } from "lucide-react";
import GamePanel from "@/components/game/GamePanel";
import GameProgress from "@/components/game/GameProgress";
import { cn, parseDateInputValue } from "@/lib/utils";

interface WeightChartProps {
  logs: DailyLog[];
  targetWeight: number;
  startWeight?: number | null;
}

const LINE = "hsl(268, 45%, 52%)";

/** "Jul 8 – Jul 14", or a single date when the week holds one weigh-in. */
const rangeLabel = (first: string, last: string) => {
  const fmt = (iso: string) =>
    parseDateInputValue(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
};

const MiniStat = ({ label, value, highlight, delta }: { label: string; value: string; highlight?: boolean; delta?: string }) => (
  <div className={`game-tag px-2.5 py-1.5 ${highlight ? "ring-2 ring-inset ring-[hsl(268,45%,55%)]/40" : ""}`}>
    <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-display text-sm font-bold text-card-foreground">
      {value}
      {delta && <span className="ml-1 text-[10px] font-bold text-[hsl(84,45%,32%)]">{delta}</span>}
    </p>
  </div>
);

type TrendMode = "daily" | "weekly";

const WeightChart = ({ logs, targetWeight, startWeight }: WeightChartProps) => {
  const [zoomed, setZoomed] = useState(false);
  const [mode, setMode] = useState<TrendMode>("daily");

  const weighed = logs.filter((l) => l.weight !== null) as (DailyLog & { weight: number })[];
  const data = weighed.map((l) => ({ day: `Day ${l.day}`, date: l.date, weight: l.weight, days: 1 }));
  const latestWeight = weighed.length > 0 ? weighed[weighed.length - 1].weight : null;

  // Weekly view: one point per week, averaging that week's weigh-ins.
  const weeklyData = getWeeklyWeightAverages(logs).map((w) => ({
    day: `Wk ${w.week}`,
    date: `${rangeLabel(w.firstDate, w.lastDate)} · ${w.days} ${w.days === 1 ? "log" : "logs"}`,
    weight: w.weight,
    days: w.days,
  }));

  const weekly = mode === "weekly";
  const series = weekly ? weeklyData : data;
  const countLabel = weekly
    ? `${weeklyData.length} ${weeklyData.length === 1 ? "week" : "weeks"}`
    : `Last ${data.length} days`;

  // Weight-loss (or gain) journey progress from the starting weight to the goal.
  const hasJourney = startWeight != null && startWeight !== targetWeight;
  const milestones = hasJourney ? getWeightMilestones(startWeight!, targetWeight) : [];
  const losing = hasJourney && startWeight! > targetWeight;

  let journeyPct = 0;
  let toGo = 0;
  let milestonesReached = 0;
  if (hasJourney && latestWeight != null) {
    const total = Math.abs(startWeight! - targetWeight);
    const done = losing ? startWeight! - latestWeight : latestWeight - startWeight!;
    journeyPct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    toGo = Math.max(0, Math.round((losing ? latestWeight - targetWeight : targetWeight - latestWeight) * 10) / 10);
    milestonesReached = milestones.filter((m) => (losing ? latestWeight <= m : latestWeight >= m)).length;
  }

  // Change from start to now, formatted with a leading sign.
  const changeVal =
    startWeight != null && latestWeight != null ? Math.round((latestWeight - startWeight) * 10) / 10 : null;
  const changeText = changeVal != null && changeVal !== 0 ? `${changeVal > 0 ? "+" : ""}${changeVal} kg` : undefined;

  const hasData = series.length > 0;

  /** The chart itself — reused at panel size and (bigger) inside the zoom modal. */
  const chart = (gradId: string, big: boolean) => (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE} stopOpacity={0.38} />
            <stop offset="100%" stopColor={LINE} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="hsl(33, 28%, 66%)" strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: big ? 12 : 11, fontWeight: 700, fill: "hsl(27, 24%, 42%)" }}
          tickLine={false}
          axisLine={false}
          interval={weekly ? 0 : big ? Math.floor(data.length / 15) : Math.floor(data.length / 7)}
        />
        <YAxis
          tick={{ fontSize: big ? 12 : 11, fontWeight: 700, fill: "hsl(27, 24%, 42%)" }}
          tickLine={false}
          axisLine={false}
          width={big ? 46 : 40}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip
          cursor={{ stroke: LINE, strokeWidth: 1, strokeDasharray: "4 4" }}
          contentStyle={{
            backgroundColor: "hsl(40, 48%, 92%)",
            border: "2px solid hsl(33, 30%, 55%)",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            color: "hsl(24, 42%, 16%)",
            boxShadow: "0 6px 14px rgba(40,20,6,0.3)",
          }}
          labelStyle={{ color: "hsl(27, 24%, 40%)", fontWeight: 700 }}
          formatter={(v: number) => [`${v} kg`, weekly ? "Weekly average" : "Weight"]}
          labelFormatter={(label: string, payload) => {
            const detail = payload?.[0]?.payload?.date as string | undefined;
            return detail ? `${label} · ${detail}` : label;
          }}
        />
        {startWeight != null && (
          <ReferenceLine
            y={startWeight}
            stroke="hsl(27, 24%, 48%)"
            strokeDasharray="2 4"
            strokeOpacity={0.6}
            label={{ value: "Start", position: "insideLeft", fontSize: 10, fontWeight: 700, fill: "hsl(27, 24%, 42%)" }}
          />
        )}
        <ReferenceLine
          y={targetWeight}
          stroke="hsl(84, 45%, 40%)"
          strokeWidth={2}
          strokeDasharray="6 4"
          label={{ value: `Goal ${targetWeight}kg`, position: "right", fontSize: 11, fontWeight: 700, fill: "hsl(84, 45%, 32%)" }}
        />
        <Area
          type="monotone"
          dataKey="weight"
          stroke={LINE}
          strokeWidth={3}
          fill={`url(#${gradId})`}
          // Weekly has few points, so mark each one; daily would be a solid smear.
          dot={weekly ? { r: big ? 4 : 3.5, fill: LINE, strokeWidth: 0 } : false}
          activeDot={{ r: big ? 6 : 5, fill: LINE, stroke: "hsl(40, 48%, 94%)", strokeWidth: 2.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  /** Stats + milestone bar + chart. `big`/heights differ between panel and modal. */
  const body = (opts: { gradId: string; big: boolean; chartHeight: string; onChartClick?: () => void }) => (
    <div className="space-y-4">
      {/* Start / Now / Goal mini-stats */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Start" value={startWeight != null ? `${startWeight} kg` : "—"} />
        <MiniStat label="Now" value={latestWeight != null ? `${latestWeight} kg` : "—"} delta={changeText} highlight />
        <MiniStat label="Goal" value={`${targetWeight} kg`} />
      </div>

      {hasJourney && latestWeight != null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-display font-bold text-[hsl(268,42%,42%)]">
              <Flag className="h-3.5 w-3.5" />
              {milestonesReached}/{milestones.length} milestones
            </span>
            <span className="font-bold tabular-nums text-muted-foreground">
              {toGo > 0 ? `${toGo} kg to goal` : "Goal reached! 🎉"}
            </span>
          </div>
          <GameProgress value={journeyPct} color="purple" size="h-2.5" />
        </div>
      )}

      {/* Daily / weekly-average switch */}
      <div role="tablist" aria-label="Weight trend view" className="grid grid-cols-2 gap-1 rounded-xl border-2 border-[hsl(33,28%,58%)] bg-[hsl(37,40%,82%)] p-1">
        {([
          ["daily", "Daily", CalendarDays],
          ["weekly", "Weekly avg", CalendarRange],
        ] as const).map(([key, label, Icon]) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide transition",
                active
                  ? "border-2 border-[hsl(268,45%,28%)] bg-gradient-to-b from-[hsl(268,45%,62%)] to-[hsl(268,44%,46%)] text-white shadow-[0_2px_0_hsl(268,45%,28%)]"
                  : "border-2 border-transparent text-muted-foreground hover:bg-[hsl(40,48%,92%)]",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          opts.chartHeight,
          opts.onChartClick && hasData && "cursor-zoom-in rounded-lg transition hover:ring-2 hover:ring-inset hover:ring-[hsl(268,45%,55%)]/30",
        )}
        onClick={opts.onChartClick}
        title={opts.onChartClick ? "Click to zoom in" : undefined}
      >
        {chart(opts.gradId, opts.big)}
      </div>

      {weekly && (
        <p className="text-center text-[11px] font-semibold text-muted-foreground">
          {weeklyData.length < 2
            ? "Log a second week to see the weekly trend line."
            : "Each point is that week's average weigh-in — steadier than day-to-day noise."}
        </p>
      )}
    </div>
  );

  return (
    <>
      <GamePanel
        title="Weight Trend"
        icon={<TrendingDown className="h-4 w-4" />}
        color="purple"
        right={
          <div className="flex items-center gap-2">
            <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{countLabel}</span>
            {hasData && (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                aria-label="Zoom weight chart"
                className="rounded-lg border-2 border-[hsl(33,28%,55%)] bg-[hsl(40,50%,96%)] p-1 text-card-foreground transition hover:bg-[hsl(40,50%,92%)]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        }
      >
        {body({ gradId: "weightFill", big: false, chartHeight: "h-64", onChartClick: hasData ? () => setZoomed(true) : undefined })}
      </GamePanel>

      <Dialog.Root open={zoomed} onOpenChange={setZoomed}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-[60] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-[hsl(33,28%,62%)] px-6 pb-3 pt-5">
              <div>
                <Dialog.Title className="flex items-center gap-2 font-display text-2xl font-bold text-card-foreground">
                  <TrendingDown className="h-5 w-5 text-[hsl(268,45%,52%)]" /> Weight Trend
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm font-semibold text-muted-foreground">
                  {countLabel} · hover any point for its {weekly ? "week and average" : "date and weight"}.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {body({ gradId: "weightFillZoom", big: true, chartHeight: "h-[58vh]" })}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

export default WeightChart;
