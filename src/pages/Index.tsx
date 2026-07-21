import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog, BookOpen, ShieldCheck } from "lucide-react";
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
import PremiumAccessManager from "@/components/PremiumAccessManager";
import PremiumRequests from "@/components/PremiumRequests";
import DataAnalytics from "@/components/DataAnalytics";
import GetPremiumButton from "@/components/GetPremiumButton";
import Day1ChangeModal from "@/components/Day1ChangeModal";
import FreeLimitModal from "@/components/FreeLimitModal";
import { supabase } from "@/integrations/supabase/client";
import {
  getAccessBadgeLabel,
  freeLogDayLimit,
  canManageAccess,
  normalizeAccessLevel,
  FREE_LOG_DAY_LIMIT,
  CHALLENGE_DAYS,
} from "@/lib/access";

const Index = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const { logs, loading, updateLogs } = useDailyLogs();
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showAdmin, setShowAdmin] = useState(true); // admin panels visible by default
  const [showDay1Modal, setShowDay1Modal] = useState(false);
  const [showFreeLimit, setShowFreeLimit] = useState(false);
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

    // Don't prompt a check-in for a day the user can't log: a free user past
    // the Day-{cap} wall, or when a pending Day 1 proposal is awaiting them.
    const cap = freeLogDayLimit(profile.access_level, profile.role);
    const todayDay = dayRange[dayRange.length - 1]?.day ?? 0;
    // At/after the cap the free-limit modal takes over, so skip the check-in.
    const freeWallHit = cap != null && todayDay >= cap;

    if (isReturningUser && !alreadyGreetedToday && !loggedWeightToday && !profile.pending_challenge_start_date && !freeWallHit) {
      setShowCheckIn(true);
      localStorage.setItem(key, todayDate);
    }
  }, [loading, profileLoading, user, profile, logs, todayDate, dayRange]);

  // Surface an admin-proposed Day 1 change for the user to accept or reject.
  useEffect(() => {
    if (profile?.pending_challenge_start_date) setShowDay1Modal(true);
  }, [profile?.pending_challenge_start_date]);

  // Notify a free user once, the first time they reach the Day-{cap} logging wall.
  useEffect(() => {
    if (loading || profileLoading || !user || !profile) return;
    const cap = freeLogDayLimit(profile.access_level, profile.role);
    if (cap == null) return; // premium/staff — no wall
    const todayDay = dayRange[dayRange.length - 1]?.day ?? 0;
    if (todayDay < cap) return;

    const key = `freeLimitNotified:${user.id}`;
    if (localStorage.getItem(key) !== "1") {
      setShowFreeLimit(true);
      localStorage.setItem(key, "1");
    }
  }, [loading, profileLoading, user, profile, dayRange]);

  const acceptDay1Change = async () => {
    const pending = profile?.pending_challenge_start_date;
    if (!user || !pending) return;
    const { error } = await supabase
      .from("profiles")
      .update({ challenge_start_date: pending, pending_challenge_start_date: null })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't apply the new Day 1. Please try again.");
      return;
    }
    toast.success("Your Day 1 has been updated.");
    await refetchProfile();
  };

  const rejectDay1Change = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ pending_challenge_start_date: null })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't dismiss the request. Please try again.");
      return;
    }
    await refetchProfile();
  };

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
  // Per-field saves show their own quiet confirmation (in TodayData), so this
  // just persists without an extra toast.
  const handleSaveToday = async (updated: DailyLog) => {
    await updateLogs([updated]);
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

  const displayName = profile?.username || profile?.display_name || user?.user_metadata?.full_name || "there";
  const accessBadgeLabel = getAccessBadgeLabel(profile?.role ?? undefined, profile?.access_level ?? undefined);

  // Access gates. Staff (admin/dev) and premium users get the full experience;
  // free users are capped to a trailing history window and can't export.
  const isStaff = canManageAccess(profile?.role ?? undefined);
  const isPremium = normalizeAccessLevel(profile?.access_level) === "premium" || isStaff;
  const freeDayCap = freeLogDayLimit(profile?.access_level, profile?.role);
  // Free users may only log Day 1..cap; days past the cap are locked (but any
  // data already saved there is kept). Premium/staff have no cap.
  const logCapped = freeDayCap != null && dayRange.length > freeDayCap;
  const visibleDayRange = freeDayCap != null ? dayRange.slice(0, freeDayCap) : dayRange;
  const visibleDates = new Set(visibleDayRange.map((d) => d.date));
  const visibleLogs = logCapped ? logs.filter((l) => visibleDates.has(l.date)) : logs;
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
      {profile?.pending_challenge_start_date && (
        <Day1ChangeModal
          open={showDay1Modal}
          onOpenChange={setShowDay1Modal}
          currentDay1={profile.challenge_start_date}
          proposedDay1={profile.pending_challenge_start_date}
          onAccept={acceptDay1Change}
          onReject={rejectDay1Change}
        />
      )}
      <FreeLimitModal
        open={showFreeLimit}
        onOpenChange={setShowFreeLimit}
        dayLimit={FREE_LOG_DAY_LIMIT}
        challengeDays={CHALLENGE_DAYS}
        getPremiumSlot={<GetPremiumButton size="md" />}
      />
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-[hsl(42,95%,62%)]/50 bg-[hsl(45,82%,88%)] px-3 py-1 text-sm font-bold text-[hsl(30,55%,32%)]">
              {accessBadgeLabel}
            </div>
            {!isPremium && <GetPremiumButton size="sm" />}
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
            {isStaff && (
              <GameButton
                color="red"
                size="sm"
                onClick={() => setShowAdmin((v) => !v)}
                title={showAdmin ? "Hide the admin panels" : "Show the admin panels"}
                aria-pressed={showAdmin}
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{showAdmin ? "Hide Access" : "Manage Access"}</span>
              </GameButton>
            )}
            <GameButton color="wood" size="sm" onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </GameButton>
          </div>
        </div>

        {isStaff && showAdmin && (
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <PremiumAccessManager />
            <PremiumRequests />
          </div>
        )}

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

        {/* Two-column magazine layout on desktop. On mobile the lane wrappers
            collapse (display:contents) so every panel becomes a direct grid
            item and can be ordered independently via `order-*`. Desktop order
            follows DOM order inside each `lg:block` lane. */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left column (desktop): Trophy Case → Quests → Analytics & Export */}
          <div className="contents lg:block lg:col-span-4 lg:space-y-6 xl:col-span-3">
            <div data-reveal className="order-2 min-w-0">
              <BadgeShelf badges={badges} />
            </div>
            <div data-reveal className="order-3 min-w-0">
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
            <div data-reveal className="order-6 min-w-0">
              <DataAnalytics
                logs={dayRange}
                goals={weeklyGoals}
                userName={displayName}
                canExport={isPremium}
                lockedSlot={<GetPremiumButton size="sm" />}
              />
            </div>
          </div>

          {/* Right column (desktop): stat cards → Weekly Achievements + Weight Trend → Daily Log */}
          <div className="contents lg:block lg:col-span-8 lg:space-y-6 xl:col-span-9">
            <motion.div
              className="order-1 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
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

            <div className="order-4 grid min-w-0 gap-6 2xl:grid-cols-5">
              <div data-reveal className="min-w-0 2xl:col-span-3">
                <WeeklyAchievements logs={visibleDayRange} goals={weeklyGoals} />
              </div>
              <div data-reveal className="min-w-0 2xl:col-span-2">
                <WeightChart logs={visibleLogs} targetWeight={goals.targetWeight} startWeight={startWeight} />
              </div>
            </div>

            {/* Primary logging surface: edit rows here (today's is highlighted) and save.
                Free users hit a Day-{FREE_LOG_DAY_LIMIT} wall shown below the table. */}
            <div data-reveal className="order-5 min-w-0">
              <DailyTracker
                logs={visibleDayRange}
                onUpdate={updateLogs}
                highlightDate={todayDate}
                statusBadge={
                  freeDayCap != null && !logCapped ? (
                    <span className="game-tag whitespace-nowrap px-2 py-0.5 text-[10px] font-bold text-[hsl(268,40%,42%)]">
                      Free · Day {Math.min(currentDay, freeDayCap)} of {FREE_LOG_DAY_LIMIT}
                    </span>
                  ) : undefined
                }
                footer={
                  logCapped ? (
                    <div className="flex flex-col items-center justify-between gap-3 rounded-xl border-2 border-[hsl(268,42%,60%)]/40 bg-[hsl(268,42%,60%)]/10 px-4 py-3 sm:flex-row">
                      <p className="text-sm font-bold text-[hsl(268,40%,38%)]">
                        🔒 Free plan stops at Day {FREE_LOG_DAY_LIMIT}. Your logs are saved — go premium to keep
                        logging all the way to Day {CHALLENGE_DAYS}.
                      </p>
                      <GetPremiumButton size="sm" className="shrink-0" />
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
