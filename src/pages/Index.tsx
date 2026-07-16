import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDailyLogs } from "@/hooks/useDailyLogs";
import { useGamification } from "@/hooks/useGamification";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import WeightChart from "@/components/WeightChart";
import WeeklyAchievements from "@/components/WeeklyAchievements";
import DailyTracker from "@/components/DailyTracker";
import TodayEntry from "@/components/TodayEntry";
import QuestBoard from "@/components/QuestBoard";
import BadgeShelf from "@/components/BadgeShelf";
import Confetti from "@/components/Confetti";
import { buildDayRange, DailyLog } from "@/lib/mockData";
import {
  getStreakWithShields,
  getCurrentWeek,
  getCurrentWeekPeriod,
  getDailyQuests,
  getWeeklyQuests,
  getNewlyCrossedMilestone,
  isDayLogged,
  isDayComplete,
} from "@/lib/gamification";
import { formatDateInputValue } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import GameButton from "@/components/game/GameButton";

const Index = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const { logs, loading, addLog, updateLogs } = useDailyLogs();
  const [dayOneDate, setDayOneDate] = useState("");
  const [updatingDayOneDate, setUpdatingDayOneDate] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const celebratingRef = useRef(false);

  const todayDate = formatDateInputValue();

  useEffect(() => {
    if (profile) {
      setDayOneDate(profile.challenge_start_date ?? todayDate);
    }
  }, [profile, todayDate]);

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

  const handleUpdateDayOneDate = async () => {
    if (!user) return;

    setUpdatingDayOneDate(true);
    const { error } = await supabase.from("profiles").update({
      challenge_start_date: dayOneDate || todayDate,
    }).eq("user_id", user.id);
    setUpdatingDayOneDate(false);

    if (error) {
      toast.error("Failed to update Day 1 date");
    } else {
      toast.success("Day 1 date updated");
      await refetchProfile();
    }
  };

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
  const nextDay = todayEntry?.day ?? 1;
  const hasLoggedToday = logs.some((log) => log.date === todayDate);

  // Today's own row is expected to be empty until it's logged with this form,
  // so exclude the current day and only require prior days to be complete.
  const pastDays = dayRange.filter((log) => log.date !== todayDate);

  const currentWeek = getCurrentWeek(dayRange);
  const weeklyPeriod = getCurrentWeekPeriod(dayRange);
  const dailyQuests = getDailyQuests(todayEntry, questGoals);
  const weeklyQuests = getWeeklyQuests(currentWeek, weeklyGoals);

  const handleAddEntry = async (entry: DailyLog) => {
    await addLog(entry);
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "there";
  // Only nag about days that were started but left half-filled. Days that were
  // skipped entirely (never logged) are not "incomplete" — they just weren't
  // logged, and shouldn't block adding today's brand-new entry.
  const hasEmptyDailyLogEntries = pastDays.some((log) => isDayLogged(log) && !isDayComplete(log));

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
            <GameButton color="wood" size="sm" onClick={() => navigate("/setup", { state: { intentional: true } })}>
              <UserCog className="h-4 w-4" />
              <span className="hidden sm:inline">Update Profile</span>
            </GameButton>
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
                  <Input
                    type="date"
                    value={dayOneDate}
                    onChange={(e) => setDayOneDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <GameButton
                    type="button"
                    color="gold"
                    size="sm"
                    className="w-full"
                    onClick={handleUpdateDayOneDate}
                    disabled={updatingDayOneDate}
                  >
                    {updatingDayOneDate ? "Saving..." : "Update Day 1"}
                  </GameButton>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Age", value: profile?.age ?? "—", cap: false },
                  { label: "Height", value: profile?.height_cm != null ? `${profile.height_cm} cm` : "—", cap: false },
                  { label: "Weight", value: profile?.current_weight != null ? `${profile.current_weight} kg` : "—", cap: false },
                  { label: "Activity", value: profile?.activity_level ? profile.activity_level.replace(/_/g, " ") : "—", cap: true },
                  { label: "Gender", value: profile?.gender ?? "—", cap: true },
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
            <TodayEntry
              nextDay={nextDay}
              onAdd={handleAddEntry}
              disabled={hasLoggedToday}
              disabledReason={hasLoggedToday ? "logged_today" : hasEmptyDailyLogEntries ? "incomplete_logs" : undefined}
            />
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
          <div className="lg:col-span-6">
            <DailyTracker logs={dayRange} onUpdate={updateLogs} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
