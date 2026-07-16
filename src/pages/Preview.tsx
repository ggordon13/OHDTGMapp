import { useState } from "react";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog, TrendingDown } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import QuestBoard from "@/components/QuestBoard";
import BadgeShelf from "@/components/BadgeShelf";
import WeeklyAchievements from "@/components/WeeklyAchievements";
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

const TODAY = "2026-07-17";
const dayRange: DailyLog[] = [
  ...Array.from({ length: 16 }, (_, i) => mkLog(i + 1)),
  // Day 17 is "today": an empty row the user fills in and saves.
  { date: TODAY, day: 17, weight: null, calories: null, protein: null, water: null, exercise: "", steps: null },
];
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
            <Popover>
              <PopoverTrigger asChild>
                <GameButton color="wood" size="sm">
                  <UserCog className="h-4 w-4" />
                  <span className="hidden sm:inline">Update Profile</span>
                </GameButton>
              </PopoverTrigger>
              <PopoverContent align="end" className="game-panel w-72 border-0 p-4 text-card-foreground">
                <p className="font-display text-sm font-semibold uppercase tracking-wider">Starting Point</p>
                <div className="mt-3 space-y-2">
                  <div className="game-tag px-3 py-2">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Day 1 Date</p>
                    <p className="font-bold text-card-foreground">May 18, 2026</p>
                  </div>
                  <div className="game-tag px-3 py-2">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Starting Weight</p>
                    <p className="font-bold text-card-foreground">88 kg</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[hsl(84,45%,30%)]">
                  <TrendingDown className="h-4 w-4 shrink-0" />
                  -2.4 kg since Day 1
                </div>
                <GameButton type="button" color="wood" size="sm" className="mt-4 w-full">
                  Edit Full Profile
                </GameButton>
              </PopoverContent>
            </Popover>
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
        <DailyTracker logs={dayRange} onUpdate={() => {}} highlightDate={TODAY} />

        <div className="space-y-6">
          <QuestBoard
            dailyQuests={dailyQuests}
            weeklyQuests={weeklyQuests}
            dailyPeriod="today"
            weeklyPeriod="week"
            isClaimed={(p, k) => claims.has(`${p}::${k}`)}
            onClaim={(q, p) => setClaims((prev) => new Set(prev).add(`${p}::${q.key}`))}
            claimingKey={claiming}
          />
          <WeightChart logs={dayRange} targetWeight={75} startWeight={88} />
          <WeeklyAchievements logs={dayRange} goals={weeklyGoals} />
          <BadgeShelf badges={badges} />
        </div>
      </div>
    </div>
  );
};

export default Preview;
