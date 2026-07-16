import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { DailyLog } from "@/lib/mockData";
import { getWeightMilestones } from "@/lib/gamification";
import { Progress } from "@/components/ui/progress";
import { Flag } from "lucide-react";

interface WeightChartProps {
  logs: DailyLog[];
  targetWeight: number;
  startWeight?: number | null;
}

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

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Weight Trend</h3>
        <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-secondary">
          Last {data.length} days
        </span>
      </div>

      {hasJourney && latestWeight != null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium text-primary">
              <Flag className="h-3.5 w-3.5" />
              {milestonesReached}/{milestones.length} milestones
            </span>
            <span className="text-muted-foreground tabular-nums">
              {toGo > 0 ? `${toGo} kg to goal` : "Goal reached! 🎉"}
            </span>
          </div>
          <Progress value={journeyPct} className="h-2" />
        </div>
      )}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 7)}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              domain={["dataMin - 1", "dataMax + 1"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: 13,
              }}
            />
            {startWeight != null && (
              <ReferenceLine
                y={startWeight}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="2 4"
                strokeOpacity={0.5}
                label={{ value: "Start", position: "left", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
            )}
            <ReferenceLine
              y={targetWeight}
              stroke="hsl(var(--accent))"
              strokeDasharray="6 4"
              label={{ value: `Goal: ${targetWeight}kg`, position: "right", fontSize: 11, fill: "hsl(var(--accent))" }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeightChart;
