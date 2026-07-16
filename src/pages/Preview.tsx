import { useState } from "react";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import GameButton from "@/components/game/GameButton";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import QuestBoard from "@/components/QuestBoard";
import BadgeShelf from "@/components/BadgeShelf";
import WeeklyAchievements from "@/components/WeeklyAchievements";
import TodayEntry from "@/components/TodayEntry";
import DailyTracker from "@/components/DailyTracker";
import WeightChart from "@/components/WeightChart";
import { DailyLog } from "@/lib/mockData";
import {
  getDailyQuests,
  getWeeklyQuests,
  getEarnedBadges,
  getLevelProgress,
} from "@/lib/gamification";

// ---------------------------------------------------------------------------
// Dev-only style preview: renders the gamified dashboard with mock data and a
// local (non-persisted) claim state, so the theme and GSAP animations can be
// exercised without signing in. Not routed in production builds.
// ---------------------------------------------------------------------------

const goals = { caloriesMax: 2000, protein: 150, water: 7, steps: 10000 };
const weeklyGoals = { dailyCalories: 2000, dailyProtein: 150, dailyWater: 7, dailySteps: 10000 };

const mkLog = (day: number, overrides: Partial<DailyLog> = {}): DailyLog => ({
  date: `2026-07-${String(day).padStart(2, "0")}`,
  day,
  weight: 88 - day * 0.15,
  calories: 1800 + (day % 3) * 100,
  protein: 155,
  water: 8,
  exercise: day % 2 ? "Gym" : "None",
  steps: 11000,
  ...overrides,
});

const dayRange: DailyLog[] = Array.from({ length: 16 }, (_, i) => mkLog(i + 1));
const today = dayRange[dayRange.length - 1];

const Preview = () => {
  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [claiming] = useState<string | null>(null);

  const dailyQuests = getDailyQuests(today, goals);
  const weeklyQuests = getWeeklyQuests(dayRange.slice(-7), weeklyGoals);
  const badges = getEarnedBadges(dayRange, weeklyGoals).map((b, i) => ({ ...b, unlocked: i % 2 === 0 }));

  return (
    <div className="wood-bg min-h-screen">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold uppercase tracking-widest text-[hsl(42,80%,70%)] [text-shadow:0_2px_0_rgba(0,0,0,0.4)]">
            My 100 Days
          </span>
          <div className="flex items-center gap-2">
            <GameButton color="wood" size="sm">
              <UserCog className="h-4 w-4" />
              <span className="hidden sm:inline">Update Profile</span>
            </GameButton>
            <GameButton color="wood" size="sm" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </GameButton>
          </div>
        </div>

        <DashboardHeader
          currentDay={16}
          streak={12}
          userName="Preview"
          levelProgress={getLevelProgress(430)}
          shields={2}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Weight" value={85.6} unit="kg" icon={Scale} target="75 kg" />
          <StatCard label="Calories" value={1850} unit="kcal" icon={Utensils} target="2000 kcal" />
          <StatCard label="Protein" value={155} unit="g" icon={Beef} target="150 g" />
          <StatCard label="Water" value={8} unit="glasses" icon={Droplets} target="7 glasses" />
          <StatCard label="Steps" value={11240} icon={Footprints} target="10,000" />
        </div>
        <QuestBoard
          dailyQuests={dailyQuests}
          weeklyQuests={weeklyQuests}
          dailyPeriod="today"
          weeklyPeriod="week"
          isClaimed={(p, k) => claims.has(`${p}::${k}`)}
          onClaim={(q, p) => setClaims((prev) => new Set(prev).add(`${p}::${q.key}`))}
          claimingKey={claiming}
        />
        <div className="grid gap-6 lg:grid-cols-6">
          <aside className="game-panel p-6 lg:col-span-2">
            <p className="font-display text-sm font-semibold uppercase tracking-wider">Starting data</p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              This is the baseline used to calculate your challenge targets.
            </p>
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">Day 1 date</p>
                <div className="mt-1.5 space-y-2">
                  <Input type="date" value="2026-05-18" onChange={() => {}} className="h-9 text-sm" />
                  <GameButton type="button" color="gold" size="sm" className="w-full">
                    Update Day 1
                  </GameButton>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Age", value: "30", cap: false },
                  { label: "Height", value: "170 cm", cap: false },
                  { label: "Weight", value: "76 kg", cap: false },
                  { label: "Activity", value: "sedentary", cap: true },
                  { label: "Gender", value: "male", cap: true },
                ].map(({ label, value, cap }) => (
                  <div key={label} className="game-tag px-2.5 py-1.5">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className={`font-bold text-card-foreground ${cap ? "capitalize" : ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <div className="space-y-6 lg:col-span-4">
            <TodayEntry nextDay={17} onAdd={() => {}} />
            <WeightChart logs={dayRange} targetWeight={75} startWeight={88} />
          </div>
        </div>
        <WeeklyAchievements logs={dayRange} goals={weeklyGoals} />
        <BadgeShelf badges={badges} />
        <DailyTracker logs={dayRange} onUpdate={() => {}} />
      </div>
    </div>
  );
};

export default Preview;
