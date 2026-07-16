import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Beef, Droplets, Footprints, LogOut } from "lucide-react";
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
} from "@/lib/gamification";
import { formatDateInputValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading your data...</div>
      </div>
    );
  }

  const today = logs.length > 0 ? logs[logs.length - 1] : null;
  const todayEntry = dayRange.length > 0 ? dayRange[dayRange.length - 1] : null;
  const streakResult = getStreakWithShields(dayRange, shields);
  const currentDay = todayEntry?.day ?? 0;
  const nextDay = todayEntry?.day ?? 1;
  const hasLoggedToday = logs.some((log) => log.date === todayDate);

  // Today's own row is expected to be empty until it's logged, so only check prior days.
  const pastDays = dayRange.slice(0, -1);

  const currentWeek = getCurrentWeek(dayRange);
  const weeklyPeriod = getCurrentWeekPeriod(dayRange);
  const dailyQuests = getDailyQuests(todayEntry, questGoals);
  const weeklyQuests = getWeeklyQuests(currentWeek, weeklyGoals);

  const handleAddEntry = async (entry: DailyLog) => {
    await addLog(entry);
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "there";
  const hasEmptyDailyLogEntries = pastDays.some((log) => ["weight", "calories", "protein", "water", "exercise", "steps"].some((key) => {
    const value = log[key as keyof DailyLog];
    return value == null || value === "";
  }));

  const formatRange = (min: number | null, max: number | null, fallback: number, unit: string) => {
    if (min != null && max != null) return `${min}–${max} ${unit}`;
    return `${fallback} ${unit}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Confetti trigger={confettiTrigger} />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <DashboardHeader
              currentDay={currentDay}
              streak={streakResult.streak}
              streakProtected={streakResult.protected}
              userName={displayName}
              levelProgress={levelProgress}
              shields={shields}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/setup", { state: { intentional: true } })}>
              Update Profile
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

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
            value={today?.steps?.toLocaleString() ?? "—"}
            icon={Footprints}
            target={`${goals.dailySteps.toLocaleString()}`}
          />
        </motion.div>

        <div className="grid lg:grid-cols-6 gap-6">
          <aside className="lg:col-span-1 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <p className="text-sm font-semibold">Starting data</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This is the baseline used to calculate your challenge targets.
            </p>
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Day 1 date</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="date"
                    value={dayOneDate}
                    onChange={(e) => setDayOneDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateDayOneDate}
                    disabled={updatingDayOneDate}
                  >
                    {updatingDayOneDate ? "Saving..." : "Update"}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Age</p>
                <p className="font-medium">{profile?.age ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Height</p>
                <p className="font-medium">{profile?.height_cm != null ? `${profile.height_cm} cm` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-medium">{profile?.current_weight != null ? `${profile.current_weight} kg` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Activity</p>
                <p className="font-medium">{profile?.activity_level ? profile.activity_level.replace(/_/g, " ") : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gender</p>
                <p className="font-medium">{profile?.gender ?? "—"}</p>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-5 space-y-6">
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
