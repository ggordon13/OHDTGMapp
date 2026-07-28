import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog, BookOpen, ShieldCheck, Palette, Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDailyLogs } from "@/hooks/useDailyLogs";
import { useGamification } from "@/hooks/useGamification";
import { useChallenge } from "@/hooks/useChallenge";
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
import ThemePicker from "@/components/ThemePicker";
import ShareCardModal from "@/components/ShareCardModal";
import InstallButton from "@/components/InstallButton";
import NotificationsButton from "@/components/NotificationsButton";
import { useTheme } from "@/hooks/useTheme";
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
  getLastSettledWeek,
  getNewlyCrossedMilestone,
  isDayComplete,
} from "@/lib/gamification";
import { formatDateInputValue, parseDateInputValue } from "@/lib/utils";
import GameButton from "@/components/game/GameButton";
import PremiumAccessManager from "@/components/PremiumAccessManager";
import PremiumRequests from "@/components/PremiumRequests";
import AdminChallenges from "@/components/AdminChallenges";
import DataAnalytics from "@/components/DataAnalytics";
import GetPremiumButton from "@/components/GetPremiumButton";
import StartTrialButton from "@/components/StartTrialButton";
import ChallengePanel from "@/components/ChallengePanel";
import ChallengeCompleteModal from "@/components/ChallengeCompleteModal";
import ChallengeResultsModal from "@/components/ChallengeResultsModal";
import { type LeaderboardRow } from "@/hooks/useChallenge";
import Day1ChangeModal from "@/components/Day1ChangeModal";
import FreeLimitModal from "@/components/FreeLimitModal";
import HundredDayFinishModal from "@/components/HundredDayFinishModal";
import FinisherArchiveModal from "@/components/FinisherArchiveModal";
import { useHundredDay, type RestartPlan } from "@/hooks/useHundredDay";
import { buildRunSummary, canFinishRun, runSealDate, toArchivedBadge } from "@/lib/hundredDay";
import type { GoalType } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/telemetry";
import {
  getAccessBadgeLabel,
  freeLogDayLimit,
  canManageAccess,
  normalizeAccessLevel,
  getTrialState,
  FREE_LOG_DAY_LIMIT,
  CHALLENGE_DAYS,
} from "@/lib/access";

const Index = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const { logs, loading, updateLogs, refetch: refetchLogs } = useDailyLogs();
  const challenge = useChallenge();
  // Applies the user's cosmetic theme (premium themes auto-revert when free).
  const { appliedKey: themeKey, isPremium: themePremium, setTheme, startTrial } = useTheme({
    profile,
    userId: user?.id,
    refetchProfile,
  });
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showAdmin, setShowAdmin] = useState(true); // admin panels visible by default
  const [showDay1Modal, setShowDay1Modal] = useState(false);
  const [showFreeLimit, setShowFreeLimit] = useState(false);
  const [showChallengeComplete, setShowChallengeComplete] = useState(false);
  const [showChallengeResults, setShowChallengeResults] = useState(false);
  const [challengeResultRows, setChallengeResultRows] = useState<LeaderboardRow[]>([]);
  const challengeCompleteShownRef = useRef(false);
  const [showRunFinish, setShowRunFinish] = useState(false);
  const [showFinisherArchive, setShowFinisherArchive] = useState(false);
  const runFinishShownRef = useRef(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideIsOnboarding, setGuideIsOnboarding] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // A shared challenge link sent a not-yet-signed-in visitor through auth; now
  // that they've landed on the dashboard, bounce them to finish joining.
  useEffect(() => {
    const pending = localStorage.getItem("pendingJoinChallenge");
    if (pending) {
      localStorage.removeItem("pendingJoinChallenge");
      navigate(`/join/${pending}`, { replace: true });
    }
  }, [navigate]);
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

  // Which day of the current 100-day run we're on (0 before Day 1 arrives — a
  // restart may schedule Day 1 in the future).
  const runDay = dayRange.length > 0 ? dayRange[dayRange.length - 1].day : 0;
  const runStartIso = profile?.challenge_start_date ?? todayDate;
  const challengeNotStarted = runStartIso > todayDate;

  // The current run's window. Day 100 is 99 days after Day 1.
  const runEndIso = useMemo(() => {
    const end = parseDateInputValue(runStartIso);
    end.setDate(end.getDate() + CHALLENGE_DAYS - 1);
    return formatDateInputValue(end);
  }, [runStartIso]);

  // Locking in Day 100 declares the run over: its log goes read-only and every
  // week — Week 15 included — is scored as of the day after Day 100 rather than
  // waiting for the calendar.
  const runLocked = profile?.run_locked_at != null;
  const sealDate = useMemo(() => runSealDate(runEndIso), [runEndIso]);
  const scoringDate = runLocked ? sealDate : undefined;

  const {
    levelProgress,
    shields,
    isClaimed,
    claimQuest,
    claimAll,
    claimingKey,
    badges,
    sealBadges,
    celebrateMilestone,
    celebrations,
    dismissCelebration,
  } = useGamification({
    userId: user?.id,
    profile,
    refetchProfile,
    dayRange,
    weeklyGoals,
    scoringDate,
  });

  const hundredDay = useHundredDay(user?.id);

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

    // Logging today is always allowed (even for free users past their history
    // window), so the only reasons to skip the check-in are a pending Day 1
    // proposal or a challenge-results reveal.

    // A pending challenge-results reveal takes priority over the daily check-in.
    const cur = challenge.current;
    let challengeResultsPending = false;
    if (cur && !cur.resultsSeenAt) {
      const e = parseDateInputValue(cur.challenge.start_date);
      e.setDate(e.getDate() + cur.challenge.duration_days - 1);
      challengeResultsPending = cur.challenge.status === "completed" || todayDate > formatDateInputValue(e);
    }

    if (
      isReturningUser &&
      !alreadyGreetedToday &&
      !loggedWeightToday &&
      !profile.pending_challenge_start_date &&
      !challengeResultsPending &&
      !challengeNotStarted &&
      !profile.run_locked_at
    ) {
      setShowCheckIn(true);
      localStorage.setItem(key, todayDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profileLoading, user, profile, logs, todayDate, dayRange, challenge.current]);

  // Surface an admin-proposed Day 1 change for the user to accept or reject.
  useEffect(() => {
    if (profile?.pending_challenge_start_date) setShowDay1Modal(true);
  }, [profile?.pending_challenge_start_date]);

  // Celebrate & pitch premium once, the first time a free user fills their free
  // {cap}-day history window (logging today stays free after this).
  useEffect(() => {
    if (loading || profileLoading || !user || !profile) return;
    const cap = freeLogDayLimit(profile.access_level, profile.role);
    if (cap == null) return; // premium/staff — no cap
    const todayDay = dayRange[dayRange.length - 1]?.day ?? 0;
    if (todayDay < cap) return;

    const key = `freeLimitNotified:${user.id}`;
    if (localStorage.getItem(key) !== "1") {
      setShowFreeLimit(true);
      track("paywall_viewed", { source: "history_cap" });
      localStorage.setItem(key, "1");
    }
  }, [loading, profileLoading, user, profile, dayRange]);

  // The current challenge's last day (Day 30) — used to detect completion/results.
  const challengeEndIso = (() => {
    const cur = challenge.current;
    if (!cur) return null;
    const e = parseDateInputValue(cur.challenge.start_date);
    e.setDate(e.getDate() + cur.challenge.duration_days - 1);
    return formatDateInputValue(e);
  })();

  // Celebrate the moment the user finishes their Day-30 data (once).
  useEffect(() => {
    if (loading || profileLoading) return;
    const cur = challenge.current;
    if (!cur || cur.completedAt || !challengeEndIso) return;
    if (formatDateInputValue() > challengeEndIso) return; // past Day 30 → results takes over
    const day30 = dayRange.find((d) => d.date === challengeEndIso);
    if (day30 && isDayComplete(day30) && !challengeCompleteShownRef.current) {
      challengeCompleteShownRef.current = true;
      setShowChallengeComplete(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.current, challengeEndIso, dayRange, loading, profileLoading]);

  // The day after Day 30, reveal results on first open (once, until acknowledged).
  useEffect(() => {
    if (loading || profileLoading) return;
    const cur = challenge.current;
    if (!cur || cur.resultsSeenAt || !challengeEndIso) return;
    const isResults = cur.challenge.status === "completed" || formatDateInputValue() > challengeEndIso;
    if (!isResults) return;
    let active = true;
    void challenge.getLeaderboard(cur.challenge.id).then((rows) => {
      if (!active) return;
      setChallengeResultRows(rows);
      setShowChallengeResults(true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.current, challenge.getLeaderboard, challengeEndIso, loading, profileLoading]);

  // ---------------------------------------------------------------------------
  // 100-day finish line
  // ---------------------------------------------------------------------------

  const unlockedBadges = useMemo(() => badges.filter((b) => b.unlocked), [badges]);

  // The report card that gets archived with the run — also what the finish
  // modal shows, so the celebration and the archive can never disagree.
  const runSummary = useMemo(
    () =>
      buildRunSummary({
        dayRange,
        goals: weeklyGoals,
        startWeight: profile?.current_weight ?? null,
        targetWeight: profile?.target_weight ?? null,
        badges: unlockedBadges,
        xp: levelProgress.xp,
        level: levelProgress.level,
        // Sealing the run judges every week in it, Week 15 included.
        asOf: sealDate,
      }),
    [dayRange, weeklyGoals, profile?.current_weight, profile?.target_weight, unlockedBadges, levelProgress, sealDate],
  );

  const archivedBadges = useMemo(() => unlockedBadges.map(toArchivedBadge), [unlockedBadges]);
  const runFinishable = canFinishRun(runDay);

  // Clearing Day 100 opens the finish celebration on the first visit of each
  // day until it's claimed. The header keeps a permanent button either way, so
  // dismissing it never strands the star.
  useEffect(() => {
    if (loading || profileLoading || !user || !profile) return;
    if (!runFinishable || runFinishShownRef.current) return;
    runFinishShownRef.current = true;

    const key = `runFinishPrompt:${user.id}:${profile.current_run ?? 1}`;
    if (localStorage.getItem(key) === todayDate) return;
    localStorage.setItem(key, todayDate);
    setShowRunFinish(true);
  }, [loading, profileLoading, user, profile, runFinishable, todayDate]);

  // Locking in seals Days 1–100. Trophies are settled first — Week 15 counts
  // from this moment, so anything it unlocks must be paid out before the trophy
  // case is archived and reset.
  const handleLockInRun = async (): Promise<boolean> => {
    const ok = await hundredDay.lockRun();
    if (!ok) return false;
    await sealBadges(sealDate);
    await refetchProfile();
    toast.success(`Day ${CHALLENGE_DAYS} locked in — your challenge is final 🔒`);
    return true;
  };

  const handleFinishRun = async (plan: RestartPlan): Promise<boolean> => {
    const ok = await hundredDay.finishRun({
      startDate: runStartIso,
      endDate: runEndIso,
      summary: runSummary,
      badges: archivedBadges,
      restart: plan,
    });
    if (!ok) return false;

    // Re-arm the prompt for the run that just started, then pull in the
    // re-based profile and the seeded Day 1 row.
    runFinishShownRef.current = false;
    setConfettiTrigger(Date.now());
    toast.success("Golden star earned ⭐ Your next 100 days are set up!");
    await Promise.all([refetchProfile(), refetchLogs()]);
    return true;
  };

  const dismissChallengeComplete = async () => {
    const cur = challenge.current;
    if (cur) await challenge.markCompleted(cur.challenge.id);
  };

  const acknowledgeChallengeResults = async () => {
    const cur = challenge.current;
    if (cur) await challenge.markResultsSeen(cur.challenge.id);
    setShowChallengeResults(false);
  };

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
    // has_weight marks a "real" logged day (matches isDayLogged / the streak
    // rule) — Weekly Logging Users counts these, not partial saves.
    track("day_saved", { day: updated.day, has_weight: updated.weight != null });
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
  const currentDay = runDay;

  const currentWeek = getCurrentWeek(dayRange);
  const weeklyPeriod = getCurrentWeekPeriod(dayRange);
  const dailyQuests = getDailyQuests(todayEntry, questGoals);
  // The ⭐ quest is scored on the last week that actually finished, so it can
  // never be banked off a strong half-week.
  const weeklyQuests = getWeeklyQuests(currentWeek, weeklyGoals, getLastSettledWeek(dayRange));

  const displayName = profile?.username || profile?.display_name || user?.user_metadata?.full_name || "there";
  const accessBadgeLabel = getAccessBadgeLabel(profile?.role ?? undefined, profile?.access_level ?? undefined);

  // Access gates. Staff (admin/dev) and premium users get the full experience;
  // free users are capped to a trailing history window and can't export.
  const isStaff = canManageAccess(profile?.role ?? undefined);
  const isPremium = normalizeAccessLevel(profile?.access_level) === "premium" || isStaff;
  const freeDayCap = freeLogDayLimit(profile?.access_level, profile?.role);
  // Free users can always log *today*, but only see a trailing window of their
  // most recent `freeDayCap` days — older history (and export) is premium. All
  // data is preserved; premium just unlocks the full view. Premium/staff = no cap.
  const historyCapped = freeDayCap != null && dayRange.length > freeDayCap;
  const visibleDayRange = historyCapped ? dayRange.slice(-freeDayCap!) : dayRange;
  const visibleDates = new Set(visibleDayRange.map((d) => d.date));
  const visibleLogs = historyCapped ? logs.filter((l) => visibleDates.has(l.date)) : logs;
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

  // Active-challenge window, used to flag Daily Log rows that count toward it.
  const activeChallenge = challenge.current?.challenge.status === "active" ? challenge.current.challenge : null;
  const challengeStart = activeChallenge?.start_date;
  let challengeEnd: string | undefined;
  if (activeChallenge) {
    const end = parseDateInputValue(activeChallenge.start_date);
    end.setDate(end.getDate() + activeChallenge.duration_days - 1);
    challengeEnd = formatDateInputValue(end);
  }

  // A stored min/max band means the user opted into the recommended range (a
  // projection); a lone target means they set their own goal.
  const usingRecommendedRange = goals.targetWeightMin != null && goals.targetWeightMax != null;
  const weightCaption = usingRecommendedRange ? "Projected Weight on Day 100" : "Target Weight on Day 100";

  // Free-plan footer notice, shared by the Daily Log and Today's Data panels:
  // a light premium nudge (with the day counter) before the window fills, then a
  // "history trimmed" nudge after. Premium/staff (freeDayCap == null) see nothing.
  const freeFooter =
    freeDayCap == null ? undefined : historyCapped ? (
      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border-2 border-[hsl(268,42%,60%)]/40 bg-[hsl(268,42%,60%)]/10 px-4 py-3 sm:flex-row">
        <p className="text-sm font-bold text-[hsl(268,40%,38%)]">
          🔒 Free plan shows your latest {FREE_LOG_DAY_LIMIT} days — keep logging today for free. Go premium for your
          full history & export, all the way to Day {CHALLENGE_DAYS}.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StartTrialButton size="sm" />
          <GetPremiumButton size="sm" />
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-[hsl(268,42%,60%)]/30 bg-[hsl(268,42%,60%)]/8 px-3 py-2">
        <span className="game-tag whitespace-nowrap px-2 py-0.5 text-[10px] font-bold text-[hsl(268,40%,42%)]">
          Free · Day {Math.min(currentDay, freeDayCap)} of {FREE_LOG_DAY_LIMIT}
        </span>
        <p className="text-xs font-bold text-[hsl(268,40%,42%)]">
          🔒 Go premium to keep logging all the way to Day {CHALLENGE_DAYS}.
        </p>
      </div>
    );

  // Radix dialogs set `pointer-events: none` on the body while open, which would
  // make the (non-Radix) celebration's buttons unclickable if both showed at
  // once. Hold celebrations in the queue until every blocking modal is closed.
  const blockingModalOpen =
    showGuide ||
    showCheckIn ||
    showDay1Modal ||
    showFreeLimit ||
    showChallengeComplete ||
    showChallengeResults ||
    showRunFinish ||
    showFinisherArchive ||
    showThemes ||
    showShare;

  return (
    <div className="wood-bg min-h-screen">
      <FireflyCanvas />
      <Confetti trigger={confettiTrigger} />
      <CelebrationModal event={blockingModalOpen ? null : (celebrations[0] ?? null)} onDismiss={dismissCelebration} />
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
        onStartTrial={startTrial}
        trialUsed={getTrialState(profile?.premium_trial_started_at).used}
      />
      <ChallengeCompleteModal
        open={showChallengeComplete}
        onOpenChange={setShowChallengeComplete}
        onDismiss={dismissChallengeComplete}
      />
      {challenge.current && (
        <ChallengeResultsModal
          open={showChallengeResults}
          mode={challenge.current.challenge.mode}
          rows={challengeResultRows}
          rewards={challenge.current.rewards}
          onAcknowledge={acknowledgeChallengeResults}
        />
      )}
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
      <ThemePicker
        open={showThemes}
        onOpenChange={setShowThemes}
        selectedKey={profile?.theme ?? "oak"}
        appliedKey={themeKey}
        isPremium={themePremium}
        trial={getTrialState(profile?.premium_trial_started_at)}
        onSelect={setTheme}
        onStartTrial={startTrial}
      />
      <ShareCardModal
        open={showShare}
        onOpenChange={setShowShare}
        data={{
          name: displayName,
          level: levelProgress.level,
          streak: streakResult.streak,
          day: Math.min(currentDay, CHALLENGE_DAYS),
          totalDays: CHALLENGE_DAYS,
          pct: Math.max(0, Math.min(100, Math.round((currentDay / CHALLENGE_DAYS) * 100))),
        }}
      />
      <HundredDayFinishModal
        open={showRunFinish}
        onOpenChange={setShowRunFinish}
        userName={displayName}
        summary={runSummary}
        badges={archivedBadges}
        starCount={profile?.finisher_count ?? 0}
        stats={{
          age: profile?.age ?? null,
          heightCm: profile?.height_cm ?? null,
          gender: profile?.gender ?? null,
          activityLevel: profile?.activity_level ?? null,
        }}
        suggestedStartWeight={latestWeight}
        currentGoalType={(profile?.goal_type === "maintain" ? "maintain" : "lose") as GoalType}
        busy={hundredDay.finishing || hundredDay.locking}
        locked={runLocked}
        readiness={{
          daysLogged: runSummary.daysLogged,
          totalDays: CHALLENGE_DAYS,
          finalDayLogged: dayRange.some((d) => d.day === CHALLENGE_DAYS && d.weight != null),
        }}
        onLockIn={handleLockInRun}
        onConfirm={handleFinishRun}
      />
      <FinisherArchiveModal
        open={showFinisherArchive}
        onOpenChange={setShowFinisherArchive}
        runs={hundredDay.runs}
        userName={displayName}
      />
      <div className="relative z-10 mx-auto max-w-[1720px] space-y-8 px-4 py-8 lg:px-8">
        {/* Top toolbar: app title + account actions, styled to match the game theme */}
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <Logo className="h-24 w-auto sm:h-16" />
          {/* Right cluster: on mobile the access badge drops to its own line
              below the right-aligned buttons; on desktop it sits inline first. */}
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="order-2 rounded-full border border-[hsl(42,95%,62%)]/50 bg-[hsl(45,82%,88%)] px-3 py-1 text-sm font-bold text-[hsl(30,55%,32%)] sm:order-1">
              {accessBadgeLabel}
            </div>
            <div className="order-1 flex flex-wrap items-center justify-end gap-2 sm:order-2">
            <InstallButton size="sm" />
            <NotificationsButton size="sm" />
            {!isPremium && <StartTrialButton size="sm" />}
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
            <GameButton color="purple" size="sm" onClick={() => setShowThemes(true)} title="Change your theme">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Themes</span>
            </GameButton>
            <GameButton color="teal" size="sm" onClick={() => setShowShare(true)} title="Share your progress">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
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
        </div>

        {isStaff && showAdmin && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
              <PremiumAccessManager />
              <PremiumRequests />
            </div>
            <AdminChallenges />
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
            finisherCount={profile?.finisher_count ?? 0}
            onOpenArchive={() => setShowFinisherArchive(true)}
            canFinishRun={runFinishable}
            onFinishRun={() => setShowRunFinish(true)}
            runLocked={runLocked}
            upcomingStartDate={challengeNotStarted ? formattedDayOneDate : null}
          />
          <div data-reveal>
            <TodayData
              entry={todayEntry}
              onSave={handleSaveToday}
              footer={freeFooter}
              locked={runLocked}
            />
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
              <BadgeShelf badges={badges} runNumber={profile?.current_run ?? 1} />
            </div>
            <div data-reveal className="order-3 min-w-0">
              <QuestBoard
                dailyQuests={dailyQuests}
                weeklyQuests={weeklyQuests}
                dailyPeriod={todayDate}
                weeklyPeriod={weeklyPeriod}
                isClaimed={isClaimed}
                onClaim={claimQuest}
                onClaimAll={claimAll}
                claimingKey={claimingKey}
              />
            </div>
            <div data-reveal className="order-7 min-w-0">
              <DataAnalytics
                logs={dayRange}
                goals={weeklyGoals}
                scoringDate={scoringDate}
                userName={displayName}
                canExport={isPremium}
                lockedSlot={
                  <div className="flex flex-wrap items-center gap-2">
                    <StartTrialButton size="sm" />
                    <GetPremiumButton size="sm" />
                  </div>
                }
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
                caption={weightCaption}
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
                <WeeklyAchievements logs={visibleDayRange} goals={weeklyGoals} scoringDate={scoringDate} />
              </div>
              {/* Challenge takes the Weight Trend column; Weight Trend sits below it. */}
              <div className="min-w-0 space-y-6 2xl:col-span-2">
                <div data-reveal>
                  <ChallengePanel challenge={challenge} />
                </div>
                <div data-reveal>
                  <WeightChart logs={visibleLogs} targetWeight={goals.targetWeight} startWeight={startWeight} />
                </div>
              </div>
            </div>

            {/* Primary logging surface: edit rows here (today's is highlighted) and save.
                Free users see a trailing {FREE_LOG_DAY_LIMIT}-day window; the footer nudges premium. */}
            <div data-reveal className="order-5 min-w-0">
              <DailyTracker
                logs={visibleDayRange}
                onUpdate={updateLogs}
                highlightDate={todayDate}
                footer={freeFooter}
                challengeStart={challengeStart}
                challengeEnd={challengeEnd}
                locked={runLocked}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
