import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDailyLogs } from "@/hooks/useDailyLogs";
import { useGamification } from "@/hooks/useGamification";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import WeightChart from "@/components/WeightChart";
import WeeklyAchievements from "@/components/WeeklyAchievements";
import DailyTracker from "@/components/DailyTracker";
import QuestBoard from "@/components/QuestBoard";
import BadgeShelf from "@/components/BadgeShelf";
import Confetti from "@/components/Confetti";
import { buildDayRange } from "@/lib/mockData";
import {
  getStreakWithShields,
  getCurrentWeek,
  getCurrentWeekPeriod,
  getDailyQuests,
  getWeeklyQuests,
  getNewlyCrossedMilestone,
} from "@/lib/gamification";
import { formatDateInputValue, parseDateInputValue, cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import GameButton from "@/components/game/GameButton";

const Index = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const { logs, loading, updateLogs } = useDailyLogs();
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const celebratingRef = useRef(false);

  const todayDate = formatDateInputValue();

  const goals = useMemo(() => ({
    targetWeight: profile?.target_weight ?? 75,
    targetWeightMin: profile?.target_weight_min ?? null,
    targetWeightMax: profile?.target_weight_max ?? null,
    dailyCalories: profile?.daily_calorie_target ?? 2000,
    dailyCaloriesMin: profile?.daily_calorie_target_min ?? null,
    dailyCaloriesMax: profile?.daily_calorie_target_max ?? null,
    dailyProtein: profile?.daily_protein_target ?? 150,
    dailyProteinMin: profile?.daily_protein_target_min ?? null,
    dailyProteinMax: profile?.daily_protein_target_max ?? null,
    dailyWater: profile?.daily_water_target ?? 7,
    dailySteps: profile?.daily_steps_target ?? 10000,
  }), [profile]);

  // Scoring targets shared by weekly achievements, weekly quests, and badges.
  const weeklyGoals = useMemo(() => ({
    dailyCalories: goals.dailyCaloriesMax ?? goals.dailyCalories,
    dailyProtein: goals.dailyProteinMin ?? goals.dailyProtein,
    dailyWater: goals.dailyWater,
    dailySteps: goals.dailySteps,
  }), [goals]);

  const questGoals = useMemo(() => ({
    caloriesMax: goals.dailyCaloriesMax ?? goals.dailyCalories,
    protein: goals.dailyProteinMin ?? goals.dailyProtein,
    water: goals.dailyWater,
    steps: goals.dailySteps,
  }), [goals]);

  const dayRange = useMemo(
    () => buildDayRange(profile?.challenge_start_date ?? todayDate, todayDate, logs),
    [profile?.challenge_start_date, todayDate, logs],
  );

  const {
    levelProgress,
    shields,
    isClaimed,
    claimQuest,
    claimingKey,
    badges,
    celebrateMilestone,
  } = useGamification({
    userId: user?.id,
    profile,
    refetchProfile,
    dayRange,
    weeklyGoals,
  });

  // Celebrate the first time the weight trend crosses a new 1kg milestone.
  const startWeight = profile?.current_weight ?? null;
  const targetWeight = goals.targetWeight;
  const latestWeight = useMemo(() => {
    const weighed = logs.filter((l) => l.weight != null);
    return weighed.length ? (weighed[weighed.length - 1].weight as number) : null;
  }, [logs]);

  useEffect(() => {
    if (startWeight == null || latestWeight == null || celebratingRef.current) return;
    const crossed = getNewlyCrossedMilestone(
      latestWeight,
      startWeight,
      targetWeight,
      profile?.last_celebrated_weight ?? null,
    );
    if (crossed != null) {
      celebratingRef.current = true;
      setConfettiTrigger(Date.now());
      toast.success(`Milestone! You crossed ${crossed} kg 🎉 +30 XP`);
      celebrateMilestone(crossed).finally(() => {
        celebratingRef.current = false;
      });
    }
  }, [startWeight, latestWeight, targetWeight, profile?.last_celebrated_weight, celebrateMilestone]);

  // Quick weight-progress summary shown in the Update Profile popover: compares
  // the baseline weight set at signup against the latest logged weight, judging
  // "good" vs "bad" by whether the challenge goal is to lose or gain.
  const weightStatus = useMemo(() => {
    if (startWeight == null || latestWeight == null) {
      return { text: "Log your weight to see progress", tone: "neutral" as const };
    }
    const diff = Math.round((latestWeight - startWeight) * 10) / 10;
    if (diff === 0) return { text: "Same as Day 1", tone: "neutral" as const };
    const goalIsLoss = targetWeight < startWeight;
    const madeProgress = goalIsLoss ? diff < 0 : diff > 0;
    const sign = diff > 0 ? "+" : "-";
    return {
      text: `${sign}${Math.abs(diff)} kg since Day 1`,
      tone: madeProgress ? ("good" as const) : ("bad" as const),
    };
  }, [startWeight, latestWeight, targetWeight]);

  if (loading || profileLoading) {
    return (
      <div className="wood-bg flex min-h-screen items-center justify-center">
        <div className="animate-pulse font-display text-[hsl(35,30%,65%)]">Loading your data...</div>
      </div>
    );
  }

  const today = logs.length > 0 ? logs[logs.length - 1] : null;
  const todayEntry = dayRange.length > 0 ? dayRange[dayRange.length - 1] : null;
  const streakResult = getStreakWithShields(dayRange, shields);
  const currentDay = todayEntry?.day ?? 0;

  const currentWeek = getCurrentWeek(dayRange);
  const weeklyPeriod = getCurrentWeekPeriod(dayRange);
  const dailyQuests = getDailyQuests(todayEntry, questGoals);
  const weeklyQuests = getWeeklyQuests(currentWeek, weeklyGoals);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "there";
  const formattedDayOneDate = parseDateInputValue(profile?.challenge_start_date ?? todayDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formatRange = (min: number | null, max: number | null, fallback: number, unit: string) => {
    if (min != null && max != null) return `${min}–${max} ${unit}`;
    return `${fallback} ${unit}`;
  };

  return (
    <div className="wood-bg min-h-screen">
      <Confetti trigger={confettiTrigger} />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Top toolbar: app title + account actions, styled to match the game theme */}
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
                    <p className="font-bold text-card-foreground">{formattedDayOneDate}</p>
                  </div>
                  <div className="game-tag px-3 py-2">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Starting Weight</p>
                    <p className="font-bold text-card-foreground">{startWeight != null ? `${startWeight} kg` : "—"}</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 flex items-center gap-1.5 text-sm font-bold",
                    weightStatus.tone === "good" && "text-[hsl(84,45%,30%)]",
                    weightStatus.tone === "bad" && "text-[hsl(6,62%,42%)]",
                    weightStatus.tone === "neutral" && "text-muted-foreground",
                  )}
                >
                  {weightStatus.tone === "good" && <TrendingDown className="h-4 w-4 shrink-0" />}
                  {weightStatus.tone === "bad" && <TrendingUp className="h-4 w-4 shrink-0" />}
                  {weightStatus.tone === "neutral" && <Minus className="h-4 w-4 shrink-0" />}
                  {weightStatus.text}
                </div>
                <GameButton
                  type="button"
                  color="wood"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => navigate("/setup", { state: { intentional: true } })}
                >
                  Edit Full Profile
                </GameButton>
              </PopoverContent>
            </Popover>
            <GameButton color="wood" size="sm" onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </GameButton>
          </div>
        </div>

        <DashboardHeader
          currentDay={currentDay}
          streak={streakResult.streak}
          streakProtected={streakResult.protected}
          userName={displayName}
          levelProgress={levelProgress}
          shields={shields}
        />

        <motion.div
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, staggerChildren: 0.05 }}
        >
          <StatCard
            label="Weight"
            value={today?.weight ?? "—"}
            unit="kg"
            icon={Scale}
            target={formatRange(goals.targetWeightMin, goals.targetWeightMax, goals.targetWeight, "kg")}
          />
          <StatCard
            label="Calories"
            value={today?.calories ?? "—"}
            unit="kcal"
            icon={Utensils}
            target={formatRange(goals.dailyCaloriesMin, goals.dailyCaloriesMax, goals.dailyCalories, "kcal")}
          />
          <StatCard
            label="Protein"
            value={today?.protein ?? "—"}
            unit="g"
            icon={Beef}
            target={formatRange(goals.dailyProteinMin, goals.dailyProteinMax, goals.dailyProtein, "g")}
          />
          <StatCard
            label="Water"
            value={today?.water ?? "—"}
            unit="glasses"
            icon={Droplets}
            target={`${goals.dailyWater} glasses`}
          />
          <StatCard
            label="Steps"
            value={today?.steps ?? "—"}
            icon={Footprints}
            target={`${goals.dailySteps.toLocaleString()}`}
          />
        </motion.div>

        {/* Primary logging surface: edit rows here (today's is highlighted) and save. */}
        <DailyTracker logs={dayRange} onUpdate={updateLogs} highlightDate={todayDate} />

        <div className="space-y-6">
          <QuestBoard
            dailyQuests={dailyQuests}
            weeklyQuests={weeklyQuests}
            dailyPeriod={todayDate}
            weeklyPeriod={weeklyPeriod}
            isClaimed={isClaimed}
            onClaim={claimQuest}
            claimingKey={claimingKey}
          />
          <WeightChart logs={logs} targetWeight={goals.targetWeight} startWeight={startWeight} />
          <WeeklyAchievements logs={dayRange} goals={weeklyGoals} />
          <BadgeShelf badges={badges} />
        </div>
      </div>
    </div>
  );
};

export default Index;
