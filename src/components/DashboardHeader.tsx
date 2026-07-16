import { Flame, Target, Shield, Star } from "lucide-react";
import { motion } from "framer-motion";
import { LevelProgress } from "@/lib/gamification";

interface DashboardHeaderProps {
  currentDay: number;
  streak: number;
  userName?: string;
  levelProgress?: LevelProgress;
  shields?: number;
  streakProtected?: boolean;
}

const DashboardHeader = ({
  currentDay,
  streak,
  userName = "there",
  levelProgress,
  shields = 0,
  streakProtected = false,
}: DashboardHeaderProps) => {
  const progress = (currentDay / 100) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Hey {userName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Day {currentDay} of your 100-day challenge</p>
        </div>
        <div className="flex items-center gap-2">
          {shields > 0 && (
            <motion.div
              className="flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              title={`${shields} streak freeze${shields > 1 ? "s" : ""} protecting your streak`}
            >
              <Shield className="h-4 w-4 text-sky-500" />
              <span className="font-display font-semibold text-sky-600">{shields}</span>
            </motion.div>
          )}
          <motion.div
            className="flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Flame className={`h-5 w-5 ${streakProtected ? "text-sky-500" : "text-streak"}`} />
            <span className="font-display font-semibold text-streak">{streak} day streak</span>
          </motion.div>
        </div>
      </div>

      {/* Level / XP bar */}
      {levelProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs">
                <Star className="h-3.5 w-3.5" />
              </span>
              <span className="font-display">Level {levelProgress.level}</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {levelProgress.xpIntoLevel}/{levelProgress.xpForNextLevel} XP to level {levelProgress.level + 1}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress.pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* 100-day progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>100-Day Challenge</span>
          </div>
          <span className="font-display font-semibold text-primary">{currentDay}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
