import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog, BookOpen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
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
import TodayData from "@/components/TodayData";
import QuestBoard from "@/components/QuestBoard";
import BadgeShelf from "@/components/BadgeShelf";
import Confetti from "@/components/Confetti";
import CelebrationModal from "@/components/CelebrationModal";
import Logo from "@/components/Logo";
import QuickGuide from "@/components/QuickGuide";
import DailyCheckIn from "@/components/DailyCheckIn";
import FireflyCanvas from "@/components/FireflyCanvas";
import { revealPanels } from "@/lib/fx";
import { buildDayRange, type DailyLog } from "@/lib/mockData";
import {
  getStreakWithShields,
  getCurrentWeek,
  getCurrentWeekPeriod,
  getDailyQuests,
  getWeeklyQuests,
  getNewlyCrossedMilestone,
} from "@/lib/gamification";
import { formatDateInputValue, parseDateInputValue } from "@/lib/utils";
import GameButton from "@/components/game/GameButton";

const Index = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const { logs, loading, updateLogs } = useDailyLogs();
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideIsOnboarding, setGuideIsOnboarding] = useState(false);
  const celebratingRef = useRef(false);
  const checkInDoneRef = useRef(false);
  const guideDoneRef = useRef(false);
  const location = useLocation();

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
    dailyWater: 7, // fixed daily hydration goal (glasses)
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
    celebrations,
    dismissCelebration,
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

  // First open of the day for returning users (those with prior logs): greet
  // them and ask for today's weight — once per calendar day, and only when
  // today's weight isn't already recorded.
  useEffect(() => {
    if (checkInDoneRef.current) return;
    if (loading || profileLoading || !user || !profile) return;
    checkInDoneRef.current = true;

    const key = `dailyCheckIn:${user.id}`;
    const alreadyGreetedToday = localStorage.getItem(key) === todayDate;
    const loggedWeightToday = logs.some((l) => l.date === todayDate && l.weight != null);
    const isReturningUser = logs.length > 0;

    if (isReturningUser && !alreadyGreetedToday && !loggedWeightToday) {
      setShowCheckIn(true);
      localStorage.setItem(key, todayDate);
    }
  }, [loading, profileLoading, user, profile, logs, todayDate]);

  // Show the quick guide once, right after the first profile setup, before the
  // user starts tracking. Persisted per-user so it never nags twice.
  useEffect(() => {
    if (guideDoneRef.current || !user) return;
    guideDoneRef.current = true;

    const key = `quickGuideSeen:${user.id}`;
    const seen = localStorage.getItem(key) === "1";
    const justOnboarded = (location.state as { justOnboarded?: boolean } | null)?.justOnboarded === true;

    if (justOnboarded && !seen) {
      setGuideIsOnboarding(true);
      setShowGuide(true);
      localStorage.setItem(key, "1");
      // Drop the flag so a refresh doesn't replay the onboarding guide.
      navigate(".", { replace: true, state: {} });
    }
  }, [user, location.state, navigate]);

  // Scroll-triggered entrances for the main panels once the data has loaded.
  useEffect(() => {
    if (loading || profileLoading) return;
    let cleanup: (() => void) | undefined;
    const raf = requestAnimationFrame(() => {
      cleanup = revealPanels();
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [loading, profileLoading]);

  // Persist the check-in weight onto today's row without disturbing other fields.
  const handleCheckInWeight = async (weight: number) => {
    const todayRow = dayRange[dayRange.length - 1];
    if (!todayRow) return;
    await updateLogs([{ ...todayRow, weight }]);
    setConfettiTrigger(Date.now());
    toast.success(`Logged ${weight} kg for today 💪`);
  };

  // Save the "Today's Data" panel straight onto today's row in the Daily Log.
  const handleSaveToday = async (updated: DailyLog) => {
    await updateLogs([updated]);
    toast.success("Today's data saved 💪");
  };

  if (loading || profileLoading) {
    return (
      <div className="wood-bg flex min-h-screen items-center justify-center">
        <div className="animate-pulse font-display text-[hsl(35,30%,65%)]">Loading your data...</div>
      </div>
    );
  }

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

  // Goal shown on each stat card: a "min–max" range when both bounds exist,
  // otherwise the single target value. Returns a number when it's a lone value
  // so the card can animate it, or a formatted string for ranges.
  const formatGoal = (min: number | null, max: number | null, fallback: number): string | number =>
    min != null && max != null ? `${min.toLocaleString()}–${max.toLocaleString()}` : fallback;

  return (
    <div className="wood-bg min-h-screen">
      <FireflyCanvas />
      <Confetti trigger={confettiTrigger} />
      <CelebrationModal event={celebrations[0] ?? null} onDismiss={dismissCelebration} />
      <DailyCheckIn
        open={showCheckIn}
        onOpenChange={setShowCheckIn}
        userName={displayName}
        currentDay={currentDay}
        streak={streakResult.streak}
        streakProtected={streakResult.protected}
        onSaveWeight={handleCheckInWeight}
        onLater={() => { /* dismissed; already marked as greeted for today */ }}
      />
      <QuickGuide
        open={showGuide}
        onOpenChange={(v) => {
          setShowGuide(v);
          if (!v) setGuideIsOnboarding(false);
        }}
        mustAcknowledge={guideIsOnboarding}
      />
      <div className="relative z-10 mx-auto max-w-[1720px] space-y-8 px-4 py-8 lg:px-8">
        {/* Top toolbar: app title + account actions, styled to match the game theme */}
        <div className="flex items-center justify-between gap-3">
          <Logo className="h-11 w-11" withWordmark wordmarkClassName="hidden text-lg sm:inline" />
          <div className="flex items-center gap-2">
            <GameButton
              color="wood"
              size="sm"
              onClick={() => navigate("/setup", { state: { intentional: true } })}
            >
              <UserCog className="h-4 w-4" />
              <span className="hidden sm:inline">Update Profile</span>
            </GameButton>
            <GameButton color="gold" size="sm" onClick={() => setShowGuide(true)} title="Open the quick guide">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Guide</span>
            </GameButton>
            <GameButton color="wood" size="sm" onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </GameButton>
          </div>
        </div>

        {/* Header row: greeting + progress bars on the left half, today's entry on the right */}
        <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <DashboardHeader
            currentDay={currentDay}
            streak={streakResult.streak}
            streakProtected={streakResult.protected}
            userName={displayName}
            levelProgress={levelProgress}
            shields={shields}
            startPoint={{ date: formattedDayOneDate, weight: startWeight, status: weightStatus }}
          />
          <div data-reveal>
            <TodayData entry={todayEntry} onSave={handleSaveToday} />
          </div>
        </div>

        {/* Wide two-lane layout: trophies + quests on the left, tracking lane on the right */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="order-2 min-w-0 space-y-6 lg:order-1 lg:col-span-4 xl:col-span-3">
            <div data-reveal>
              <BadgeShelf badges={badges} />
            </div>
            <div data-reveal>
              <QuestBoard
                dailyQuests={dailyQuests}
                weeklyQuests={weeklyQuests}
                dailyPeriod={todayDate}
                weeklyPeriod={weeklyPeriod}
                isClaimed={isClaimed}
                onClaim={claimQuest}
                claimingKey={claimingKey}
              />
            </div>
          </div>

          <div className="order-1 min-w-0 space-y-6 lg:order-2 lg:col-span-8 xl:col-span-9">
            <motion.div
              className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, staggerChildren: 0.05 }}
            >
              <StatCard
                label="Weight"
                value={formatGoal(goals.targetWeightMin, goals.targetWeightMax, goals.targetWeight)}
                unit="kg"
                icon={Scale}
                caption="Goal weight"
              />
              <StatCard
                label="Calories"
                value={formatGoal(goals.dailyCaloriesMin, goals.dailyCaloriesMax, goals.dailyCalories)}
                unit="kcal"
                icon={Utensils}
                caption="Daily goal"
              />
              <StatCard
                label="Protein"
                value={formatGoal(goals.dailyProteinMin, goals.dailyProteinMax, goals.dailyProtein)}
                unit="g"
                icon={Beef}
                caption="Daily goal"
              />
              <StatCard
                label="Water"
                value={goals.dailyWater}
                unit="glasses"
                icon={Droplets}
                caption="Daily goal"
              />
              <StatCard
                label="Steps"
                value={goals.dailySteps}
                unit="steps"
                icon={Footprints}
                caption="Daily goal"
              />
            </motion.div>

            {/* Primary logging surface: edit rows here (today's is highlighted) and save. */}
            <div data-reveal>
              <DailyTracker logs={dayRange} onUpdate={updateLogs} highlightDate={todayDate} />
            </div>

            <div className="grid gap-6 2xl:grid-cols-5">
              <div data-reveal className="min-w-0 2xl:col-span-3">
                <WeeklyAchievements logs={dayRange} goals={weeklyGoals} />
              </div>
              <div data-reveal className="min-w-0 2xl:col-span-2">
                <WeightChart logs={logs} targetWeight={goals.targetWeight} startWeight={startWeight} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
