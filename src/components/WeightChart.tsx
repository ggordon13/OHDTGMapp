import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { DailyLog } from "@/lib/mockData";
import { getWeightMilestones } from "@/lib/gamification";
import { Flag, TrendingDown } from "lucide-react";
import GamePanel from "@/components/game/GamePanel";
import GameProgress from "@/components/game/GameProgress";

interface WeightChartProps {
  logs: DailyLog[];
  targetWeight: number;
  startWeight?: number | null;
}

const LINE = "hsl(268, 45%, 52%)";

const MiniStat = ({ label, value, highlight, delta }: { label: string; value: string; highlight?: boolean; delta?: string }) => (
  <div className={`game-tag px-2.5 py-1.5 ${highlight ? "ring-2 ring-inset ring-[hsl(268,45%,55%)]/40" : ""}`}>
    <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-display text-sm font-bold text-card-foreground">
      {value}
      {delta && <span className="ml-1 text-[10px] font-bold text-[hsl(84,45%,32%)]">{delta}</span>}
    </p>
  </div>
);

const WeightChart = ({ logs, targetWeight, startWeight }: WeightChartProps) => {
  const weighed = logs.filter((l) => l.weight !== null) as (DailyLog & { weight: number })[];
  const data = weighed.map((l) => ({ day: `Day ${l.day}`, weight: l.weight }));
  const latestWeight = weighed.length > 0 ? weighed[weighed.length - 1].weight : null;

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

  return (
    <GamePanel
      title="Weight Trend"
      icon={<TrendingDown className="h-4 w-4" />}
      color="purple"
      right={<span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Last {data.length} days</span>}
    >
      <div className="space-y-4">
        {/* Start / Now / Goal mini-stats */}
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Start" value={startWeight != null ? `${startWeight} kg` : "—"} />
          <MiniStat
            label="Now"
            value={latestWeight != null ? `${latestWeight} kg` : "—"}
            delta={changeText}
            highlight
          />
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

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LINE} stopOpacity={0.38} />
                  <stop offset="100%" stopColor={LINE} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="hsl(33, 28%, 66%)" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(27, 24%, 42%)" }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(data.length / 7)}
              />
              <YAxis
                tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(27, 24%, 42%)" }}
                tickLine={false}
                axisLine={false}
                width={40}
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
                formatter={(v: number) => [`${v} kg`, "Weight"]}
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
                fill="url(#weightFill)"
                dot={false}
                activeDot={{ r: 5, fill: LINE, stroke: "hsl(40, 48%, 94%)", strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </GamePanel>
  );
};

export default WeightChart;
