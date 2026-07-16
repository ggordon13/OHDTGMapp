import { useEffect, useRef } from "react";
import { Flame, Target, Shield, Star, Flag, Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { LevelProgress } from "@/lib/gamification";
import GameProgress from "@/components/game/GameProgress";
import { pop, pulse } from "@/lib/fx";
import { cn } from "@/lib/utils";

export interface StartPoint {
  /** Human-readable Day 1 date, e.g. "May 18, 2026". */
  date: string;
  /** Baseline weight set at signup, in kg. */
  weight: number | null;
  /** Progress vs. the latest weigh-in. */
  status: { text: string; tone: "good" | "bad" | "neutral" };
}

interface DashboardHeaderProps {
  currentDay: number;
  streak: number;
  userName?: string;
  levelProgress?: LevelProgress;
  shields?: number;
  streakProtected?: boolean;
  startPoint?: StartPoint;
}

const DashboardHeader = ({
  currentDay,
  streak,
  userName = "there",
  levelProgress,
  shields = 0,
  streakProtected = false,
  startPoint,
}: DashboardHeaderProps) => {
  const progress = (currentDay / 100) * 100;
  const streakRef = useRef<HTMLDivElement>(null);
  const medalRef = useRef<HTMLDivElement>(null);
  const prevLevel = useRef(levelProgress?.level);

  useEffect(() => {
    pop(streakRef.current);
    pop(medalRef.current);
  }, []);

  // Level-up: make the medal celebrate.
  useEffect(() => {
    const level = levelProgress?.level;
    if (level != null && prevLevel.current != null && level > prevLevel.current) {
      pop(medalRef.current, 1.6);
    }
    prevLevel.current = level;
  }, [levelProgress?.level]);

  useEffect(() => {
    if (streak > 0) pulse(streakRef.current);
  }, [streak]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_3px_0_rgba(0,0,0,0.4)]">
            Hey {userName} 👋
          </h1>
          <p className="mt-1 font-semibold text-[hsl(35,30%,65%)]">Day {currentDay} of your 100-day challenge</p>

          {startPoint && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="game-tag inline-flex items-center gap-1.5 px-2.5 py-1">
                <Flag className="h-3.5 w-3.5 text-[hsl(6,60%,52%)]" />
                <span className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Day 1</span>
                <span className="text-xs font-bold text-card-foreground">{startPoint.date}</span>
              </span>
              <span className="game-tag inline-flex items-center gap-1.5 px-2.5 py-1">
                <Scale className="h-3.5 w-3.5 text-[hsl(178,45%,38%)]" />
                <span className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Start</span>
                <span className="text-xs font-bold text-card-foreground">
                  {startPoint.weight != null ? `${startPoint.weight} kg` : "—"}
                </span>
              </span>
              <span
                className={cn(
                  "game-tag inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold",
                  startPoint.status.tone === "good" && "text-[hsl(84,45%,30%)]",
                  startPoint.status.tone === "bad" && "text-[hsl(6,62%,42%)]",
                  startPoint.status.tone === "neutral" && "text-muted-foreground",
                )}
              >
                {startPoint.status.tone === "good" && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
                {startPoint.status.tone === "bad" && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
                {startPoint.status.tone === "neutral" && <Minus className="h-3.5 w-3.5 shrink-0" />}
                {startPoint.status.text}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shields > 0 && (
            <div
              className="game-banner game-banner-teal !rotate-0 text-sm"
              title={`${shields} streak freeze${shields > 1 ? "s" : ""} protecting your streak`}
            >
              <Shield className="h-4 w-4" />
              {shields}
            </div>
          )}
          <div ref={streakRef} className="game-banner game-banner-red !rotate-0 text-sm">
            <Flame className={`h-4 w-4 ${streakProtected ? "text-sky-300" : "text-yellow-300"}`} />
            {streak} day streak
          </div>
        </div>
      </div>

      {/* Level / XP bar */}
      {levelProgress && (
        <div className="flex items-center gap-3">
          <div
            ref={medalRef}
            data-fx="xp-target"
            title={`Level ${levelProgress.level} · ${levelProgress.xp} XP total`}
            className="relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] shadow-[0_4px_0_hsl(33,75%,28%),0_6px_12px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.5)]"
          >
            <Star className="h-4 w-4 fill-[hsl(26,50%,18%)] text-[hsl(26,50%,18%)]" />
            <span className="font-display text-base font-bold leading-none text-[hsl(26,50%,18%)]">
              {levelProgress.level}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-display font-semibold uppercase tracking-wider text-[hsl(42,80%,70%)] [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
                Level {levelProgress.level}
              </span>
              <span className="text-xs font-bold tabular-nums text-[hsl(35,30%,65%)]">
                {levelProgress.xpIntoLevel}/{levelProgress.xpForNextLevel} XP to level {levelProgress.level + 1}
              </span>
            </div>
            <GameProgress value={levelProgress.pct} color="gold" size="h-4" />
          </div>
        </div>
      )}

      {/* 100-day progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 font-semibold text-[hsl(35,30%,65%)]">
            <Target className="h-4 w-4" />
            <span>100-Day Challenge</span>
          </div>
          <span className="font-display font-bold text-[hsl(178,45%,60%)] [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
            {currentDay}%
          </span>
        </div>
        <GameProgress value={progress} color="teal" size="h-4" />
      </div>
    </div>
  );
};

export default DashboardHeader;
