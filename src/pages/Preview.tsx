import { useEffect, useState } from "react";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import QuestBoard from "@/components/QuestBoard";
import BadgeShelf from "@/components/BadgeShelf";
import WeeklyAchievements from "@/components/WeeklyAchievements";
import DailyTracker from "@/components/DailyTracker";
import WeightChart from "@/components/WeightChart";
import FireflyCanvas from "@/components/FireflyCanvas";
import { revealPanels } from "@/lib/fx";
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

  useEffect(() => {
    const raf = requestAnimationFrame(() => revealPanels());
    return () => cancelAnimationFrame(raf);
  }, []);

  const dailyQuests = getDailyQuests(today, goals);
  const weeklyQuests = getWeeklyQuests(dayRange.slice(-7), weeklyGoals);
  const badges = getEarnedBadges(dayRange, weeklyGoals).map((b, i) => ({ ...b, unlocked: i % 2 === 0 }));

  return (
    <div className="wood-bg min-h-screen">
      <FireflyCanvas />
      <div className="relative z-10 mx-auto max-w-[1720px] space-y-8 px-4 py-8 lg:px-8">
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

        <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <DashboardHeader
            currentDay={16}
            streak={12}
            userName="Preview"
            levelProgress={getLevelProgress(430)}
            shields={2}
            startPoint={{ date: "May 18, 2026", weight: 88, status: { text: "-2.4 kg since Day 1", tone: "good" } }}
          />
          <div data-reveal>
            <BadgeShelf badges={badges} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="order-2 min-w-0 space-y-6 lg:order-1 lg:col-span-4 xl:col-span-3">
            <div data-reveal>
              <QuestBoard
                dailyQuests={dailyQuests}
                weeklyQuests={weeklyQuests}
                dailyPeriod="today"
                weeklyPeriod="week"
                isClaimed={(p, k) => claims.has(`${p}::${k}`)}
                onClaim={(q, p) => setClaims((prev) => new Set(prev).add(`${p}::${q.key}`))}
                claimingKey={claiming}
              />
            </div>
          </div>

          <div className="order-1 min-w-0 space-y-6 lg:order-2 lg:col-span-8 xl:col-span-9">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Weight" value="66.1–69.2" unit="kg" icon={Scale} caption="Goal weight" />
              <StatCard label="Calories" value="1,420–1,654" unit="kcal" icon={Utensils} caption="Daily goal" />
              <StatCard label="Protein" value="99–137" unit="g" icon={Beef} caption="Daily goal" />
              <StatCard label="Water" value={7} unit="glasses" icon={Droplets} caption="Daily goal" />
              <StatCard label="Steps" value={4000} unit="steps" icon={Footprints} caption="Daily goal" />
            </div>

            <div data-reveal>
              <DailyTracker logs={dayRange} onUpdate={() => {}} highlightDate={TODAY} />
            </div>

            <div className="grid gap-6 2xl:grid-cols-5">
              <div data-reveal className="min-w-0 2xl:col-span-3">
                <WeeklyAchievements logs={dayRange} goals={weeklyGoals} />
              </div>
              <div data-reveal className="min-w-0 2xl:col-span-2">
                <WeightChart logs={dayRange} targetWeight={75} startWeight={88} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preview;
