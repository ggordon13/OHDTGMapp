// ---------------------------------------------------------------------------
// Landing-page feature demos.
//
// Each demo is a miniature of a real dashboard panel, built from the same
// components and CSS kit the app uses (game-panel, GameProgress, TrophyHex,
// RankBadge…), so what a visitor hovers is what they actually get. They render
// a resting "frame 0" until `playing` flips true, then run a short scripted
// timeline once — the showcase remounts them on every hover so each pass
// starts clean.
//
// If you later record real screen captures, drop the file in `public/demos/`
// and set `video` on the matching entry in FeatureShowcase's FEATURES list;
// the video takes over and these stay as the no-asset fallback.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Beef, Check, Flame, Footprints, Scale, Shield, Sparkles, Star, Trophy, Utensils } from "lucide-react";
import GameProgress from "@/components/game/GameProgress";
import TrophyHex from "@/components/game/TrophyHex";
import RankBadge from "@/components/RankBadge";
import { RANKS, getRank } from "@/lib/ranks";
import { CHALLENGE_DAYS } from "@/lib/access";
import { cn } from "@/lib/utils";

export interface DemoProps {
  /** Run the scripted timeline. False renders the resting first frame. */
  playing: boolean;
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

/** Visitors who asked for less motion get the end state, not the journey. */
const useStill = () => useReducedMotion() ?? false;

/** Fires each `[msFromStart, action]` step while playing; clears on unmount. */
function useTimeline(playing: boolean, steps: Array<[number, () => void]>) {
  const still = useStill();
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (!playing) return;
    // Reduced motion: skip the choreography and land on the final frame.
    if (still) {
      stepsRef.current.forEach(([, fn]) => fn());
      return;
    }
    const ids = stepsRef.current.map(([at, fn]) => window.setTimeout(fn, at));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);
}

/** Eased number tweens for a whole row of counters at once. */
function useCounts(playing: boolean, from: number[], to: number[], duration = 1800, delay = 200) {
  const still = useStill();
  const [values, setValues] = useState(from);

  useEffect(() => {
    if (!playing) {
      setValues(from);
      return;
    }
    if (still) {
      setValues(to);
      return;
    }
    let raf = 0;
    let startedAt = 0;
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!startedAt) startedAt = now;
        const p = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValues(from.map((f, i) => f + (to[i] - f) * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);

  return values;
}

// ---------------------------------------------------------------------------
// Shared bits of chrome
// ---------------------------------------------------------------------------

/** Small uppercase caption used as a mini panel header. */
const DemoLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-[hsl(42,80%,70%)] [text-shadow:0_2px_0_rgba(0,0,0,0.4)]">
    {children}
  </p>
);

/** The golden level medal from the dashboard header, shrunk. */
const LevelMedal = ({ level, className }: { level: number; className?: string }) => (
  <div
    className={cn(
      "relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[hsl(33,75%,28%)]",
      "bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)]",
      "shadow-[0_4px_0_hsl(33,75%,28%),0_6px_12px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.5)]",
      className,
    )}
  >
    <Star className="h-3 w-3 fill-[hsl(26,50%,18%)] text-[hsl(26,50%,18%)]" />
    <span className="font-display text-sm font-bold leading-none text-[hsl(26,50%,18%)]">{level}</span>
  </div>
);

/** "+120 XP" sticker that drifts up and fades, the way a claim reads in-app. */
const XpPop = ({ amount, className }: { amount: number; className?: string }) => (
  <motion.span
    initial={{ opacity: 0, y: 8, scale: 0.8 }}
    animate={{ opacity: [0, 1, 1, 0], y: -26, scale: 1 }}
    transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
    className={cn("pointer-events-none text-sticker text-sm text-[hsl(44,95%,66%)]", className)}
  >
    +{amount} XP
  </motion.span>
);

// ---------------------------------------------------------------------------
// 1 · Log to level up
// ---------------------------------------------------------------------------

const LOG_FIELDS = [
  { icon: Scale, label: "Weight", value: "78.4 kg" },
  { icon: Utensils, label: "Calories", value: "1,840" },
  { icon: Beef, label: "Protein", value: "132 g" },
  { icon: Footprints, label: "Steps", value: "9,240" },
];

export const LogLevelDemo = ({ playing }: DemoProps) => {
  const [filled, setFilled] = useState(0);
  const [level, setLevel] = useState(12);
  const [xpPct, setXpPct] = useState(34);
  const [awarded, setAwarded] = useState(false);
  const [levelUp, setLevelUp] = useState(false);

  useTimeline(playing, [
    [250, () => setFilled(1)],
    [520, () => setFilled(2)],
    [790, () => setFilled(3)],
    [1060, () => setFilled(4)],
    [1400, () => {
      setAwarded(true);
      setXpPct(100);
    }],
    [2300, () => {
      setLevel(13);
      setXpPct(24);
      setLevelUp(true);
    }],
    [3600, () => setLevelUp(false)],
  ]);

  return (
    <div className="flex h-full flex-col justify-between gap-2.5">
      <div className="game-panel p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Today · Day 41
          </p>
          <span className="game-tag px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
            {filled}/4 filled
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {LOG_FIELDS.map((field, i) => {
            const done = i < filled;
            return (
              <div
                key={field.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-1.5 py-1.5 transition-colors duration-300",
                  done
                    ? "border-[hsl(84,45%,40%)] bg-[hsl(84,40%,90%)]"
                    : "border-[hsl(33,28%,72%)] bg-[hsl(40,48%,94%)]",
                )}
              >
                <field.icon className="h-3 w-3 shrink-0 text-[hsl(24,55%,42%)]" />
                <span className="font-display text-[9px] font-bold uppercase text-muted-foreground">{field.label}</span>
                <span
                  className={cn(
                    "ml-auto text-[11px] font-bold tabular-nums transition-opacity duration-200",
                    done ? "text-card-foreground opacity-100" : "text-muted-foreground opacity-60",
                  )}
                >
                  {done ? field.value : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative flex items-center gap-2.5">
        <motion.div animate={levelUp ? { scale: [1, 1.35, 1], rotate: [0, -8, 0] } : {}} transition={{ duration: 0.6 }}>
          <LevelMedal level={level} />
        </motion.div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-[hsl(42,80%,70%)]">
              Level {level}
            </span>
            <span className="text-[10px] font-bold tabular-nums text-[hsl(35,30%,65%)]">
              {Math.round((xpPct / 100) * 450)}/450 XP
            </span>
          </div>
          <GameProgress value={xpPct} color="gold" size="h-3" />
        </div>

        {awarded && !levelUp && <XpPop amount={120} className="absolute right-0 -top-3" />}

        {levelUp && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: -4 }}
            transition={{ type: "spring", stiffness: 460, damping: 14 }}
            className="pointer-events-none absolute inset-x-0 -top-4 text-center text-sticker text-lg text-[hsl(44,95%,66%)]"
          >
            LEVEL UP!
          </motion.span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2 · Quests
// ---------------------------------------------------------------------------

const DEMO_QUESTS = [
  { title: "Get your steps in", description: "Walk 10,000 steps", xp: 40, from: 58 },
  { title: "Hit your protein", description: "Eat at least 130g protein", xp: 30, from: 74 },
];

export const QuestDemo = ({ playing }: DemoProps) => {
  const [pcts, setPcts] = useState(DEMO_QUESTS.map((q) => q.from));
  const [ready, setReady] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const totalXp = DEMO_QUESTS.reduce((sum, q) => sum + q.xp, 0);

  useTimeline(playing, [
    [300, () => setPcts([100, DEMO_QUESTS[1].from])],
    [800, () => setPcts([100, 100])],
    [1250, () => setReady(true)],
    [2100, () => setClaimed(true)],
  ]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <DemoLabel>Daily quests</DemoLabel>
        <span className="game-tag px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
          {claimed ? "2/2" : "0/2"} claimed
        </span>
      </div>

      {DEMO_QUESTS.map((quest, i) => (
        <div
          key={quest.title}
          className={cn("game-panel p-2.5 transition-[filter] duration-300", claimed && "brightness-[0.97] saturate-[0.85]")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-[11px] font-semibold leading-tight text-card-foreground">{quest.title}</p>
              <p className="text-[10px] font-semibold leading-tight text-muted-foreground">{quest.description}</p>
            </div>
            {claimed ? (
              <motion.span
                initial={{ scale: 0.4, rotate: -14 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 15, delay: i * 0.12 }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-[hsl(84,45%,24%)] bg-gradient-to-b from-[hsl(84,45%,48%)] to-[hsl(84,42%,36%)] px-2 py-0.5 font-display text-[10px] font-bold text-white shadow-[0_2px_0_hsl(84,45%,24%)]"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={4} /> +{quest.xp}
              </motion.span>
            ) : (
              <span className="game-tag inline-block shrink-0 px-1.5 py-0.5 font-display text-[10px] font-bold text-muted-foreground">
                +{quest.xp} XP
              </span>
            )}
          </div>
          {!claimed && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <GameProgress value={pcts[i]} color={pcts[i] >= 100 ? "leaf" : "teal"} size="h-2" className="flex-1" />
              <span className="shrink-0 text-[9px] font-bold tabular-nums text-muted-foreground">
                {pcts[i] >= 100 ? "done" : `${pcts[i]}%`}
              </span>
            </div>
          )}
        </div>
      ))}

      <div className="relative mt-auto">
        {claimed ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[hsl(84,45%,32%)]/50 bg-[hsl(84,40%,90%)]/70 px-3 py-1.5 font-display text-[11px] font-bold text-[hsl(84,45%,26%)]"
          >
            <Sparkles className="h-3.5 w-3.5" /> +{totalXp} XP banked
          </motion.div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border-2 px-2.5 py-1.5 transition-opacity duration-300",
              ready
                ? "border-[hsl(84,45%,32%)]/50 bg-[hsl(84,40%,90%)]/70 opacity-100"
                : "border-[hsl(33,28%,60%)]/30 bg-[hsl(40,48%,94%)]/20 opacity-45",
            )}
          >
            <span className="font-display text-[10px] font-bold text-[hsl(84,45%,26%)]">
              {ready ? "2 quests ready" : "Keep going…"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border-2 border-[hsl(70,50%,22%)] bg-gradient-to-b from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] px-2 py-0.5",
                "font-display text-[10px] font-bold uppercase tracking-wide text-white shadow-[0_3px_0_hsl(70,50%,22%)]",
                ready && "animate-banner-glow",
              )}
            >
              <Sparkles className="h-3 w-3" /> Claim all · +{totalXp}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3 · Challenge leaderboard
// ---------------------------------------------------------------------------

const RACERS = [
  { id: "mika", name: "Mika" },
  { id: "dre", name: "Dre" },
  { id: "you", name: "You", me: true },
  { id: "sam", name: "Sam" },
];
const RACER_FROM = [820, 760, 540, 505];
const RACER_TO = [905, 838, 980, 566];

const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;

export const LeaderboardDemo = ({ playing }: DemoProps) => {
  const xp = useCounts(playing, RACER_FROM, RACER_TO, 2200, 250);
  const ranked = RACERS.map((r, i) => ({ ...r, xp: xp[i] })).sort((a, b) => b.xp - a.xp);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <DemoLabel>XP Leaderboard</DemoLabel>
        <span className="game-tag px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">Day 12 of 30</span>
      </div>

      <div className="game-panel flex-1 space-y-1.5 p-2.5">
        {ranked.map((racer, i) => (
          <motion.div
            key={racer.id}
            layout
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2 py-1.5",
              racer.me
                ? "border-[hsl(42,90%,45%)] bg-[hsl(44,80%,88%)] shadow-[0_0_10px_hsl(42,95%,60%,0.35)]"
                : "border-[hsl(33,28%,72%)] bg-[hsl(40,48%,94%)]",
            )}
          >
            <span className="w-5 shrink-0 text-center font-display text-xs font-bold text-[hsl(222,42%,50%)]">
              {medal(i)}
            </span>
            <span className="flex-1 truncate font-display text-xs font-bold text-card-foreground">{racer.name}</span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-[hsl(222,40%,42%)]">
              {Math.round(racer.xp).toLocaleString()} XP
            </span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {[
          { icon: "👟", label: "Golden Shoe" },
          { icon: "🔥", label: "The Energetic" },
          { icon: "📉", label: "Biggest Loser" },
        ].map((award) => (
          <span key={award.label} className="game-tag px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
            {award.icon} {award.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4 · Trophy case
// ---------------------------------------------------------------------------

const DEMO_TROPHIES = [
  { icon: "🌱", tier: "special", label: "First Steps" },
  { icon: "★", tier: "bronze", label: "Bronze Star", iconColor: "#8a4a16" },
  { icon: "💧", tier: "special", label: "Hydration Hero" },
  { icon: "👟", tier: "special", label: "Step Master" },
  { icon: "🔥", tier: "gold", label: "Iron Streak" },
  { icon: "💯", tier: "gold", label: "Perfectionist" },
];

export const TrophyDemo = ({ playing }: DemoProps) => {
  const [unlocked, setUnlocked] = useState(2);

  useTimeline(playing, [
    [500, () => setUnlocked(3)],
    [1050, () => setUnlocked(4)],
    [1600, () => setUnlocked(5)],
    [2150, () => setUnlocked(6)],
  ]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <DemoLabel>Trophy case</DemoLabel>
        <span className="game-tag px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-muted-foreground">
          {unlocked + 4}/12 unlocked
        </span>
      </div>

      <div className="game-panel flex-1 p-2.5">
        <div className="grid grid-cols-3 gap-2">
          {DEMO_TROPHIES.map((trophy, i) => {
            const isOpen = i < unlocked;
            return (
              <div key={trophy.label} className="flex flex-col items-center gap-1 text-center">
                <div className="relative">
                  <motion.div
                    key={isOpen ? "open" : "locked"}
                    initial={isOpen ? { scale: 0.35, rotate: -25 } : false}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 15 }}
                  >
                    <TrophyHex
                      tier={trophy.tier}
                      icon={trophy.icon}
                      iconColor={trophy.iconColor}
                      locked={!isOpen}
                      size="h-9 w-9 text-base"
                    />
                  </motion.div>
                  {isOpen && (
                    <motion.span
                      key={`ring-${isOpen}`}
                      initial={{ opacity: 0.9, scale: 0.6 }}
                      animate={{ opacity: 0, scale: 1.9 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 rounded-full border-2 border-[hsl(44,95%,66%)]"
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "font-display text-[8px] font-bold leading-tight transition-colors duration-300",
                    isOpen ? "text-card-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {trophy.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5 · Ranks
// ---------------------------------------------------------------------------

const RANK_TOUR = [2, 6, 12, 18, 24, 30];

export const RankDemo = ({ playing }: DemoProps) => {
  const [step, setStep] = useState(0);
  const level = RANK_TOUR[step];
  const rank = getRank(level);
  const rankIndex = RANKS.findIndex((r) => r.key === rank.key);

  useTimeline(
    playing,
    RANK_TOUR.slice(1).map((_, i) => [500 + i * 620, () => setStep(i + 1)] as [number, () => void]),
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <DemoLabel>Rank</DemoLabel>

      <div className="flex items-center gap-3">
        <LevelMedal level={level} />
        <motion.div
          key={rank.key}
          initial={{ scale: 0.6, y: -8, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 16 }}
        >
          <RankBadge level={level} hideLabel className="scale-[1.35]" />
        </motion.div>
      </div>

      {/* The whole ladder, with everything earned so far lit up. */}
      <div className="flex items-center gap-1">
        {RANKS.map((r, i) => (
          <span
            key={r.key}
            title={`${r.name} · level ${r.minLevel}+`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i < rankIndex && "w-2.5 bg-[hsl(42,88%,62%)]",
              i === rankIndex && "w-5 bg-[hsl(44,95%,72%)] shadow-[0_0_8px_hsl(42,95%,60%,0.8)]",
              i > rankIndex && "w-2 bg-[hsl(30,15%,42%)]",
            )}
          />
        ))}
      </div>

      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[hsl(35,30%,60%)]">
        Newcomer → Mythic · 11 ranks
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6 · Streaks & freezes
// ---------------------------------------------------------------------------

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const MISSED_INDEX = 2;

export const StreakDemo = ({ playing }: DemoProps) => {
  const [lit, setLit] = useState(0);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(11);

  useTimeline(playing, [
    [250, () => { setLit(1); setStreak(12); }],
    [520, () => { setLit(2); setStreak(13); }],
    [900, () => { setLit(3); setSaved(true); setStreak(14); }],
    [1400, () => { setLit(4); setStreak(15); }],
    [1670, () => { setLit(5); setStreak(16); }],
    [1940, () => { setLit(6); setStreak(17); }],
    [2210, () => { setLit(7); setStreak(18); }],
  ]);

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-center justify-center gap-2">
        <div className="game-banner game-banner-teal !rotate-0 text-xs">
          <Shield className="h-3.5 w-3.5" />
          {saved ? 1 : 2}
        </div>
        <motion.div
          key={streak}
          initial={{ scale: 1.14 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="game-banner game-banner-red !rotate-0 text-xs"
        >
          <Flame className="h-3.5 w-3.5 text-yellow-300" />
          {streak} day streak
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {WEEK.map((day, i) => {
          const isMiss = i === MISSED_INDEX;
          const done = i < lit;
          return (
            <div key={`${day}-${i}`} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-colors duration-300",
                  !done && "border-[hsl(24,25%,30%)] bg-[hsl(24,28%,22%)] text-[hsl(30,15%,45%)]",
                  done && isMiss && "border-[hsl(178,50%,18%)] bg-gradient-to-b from-[hsl(178,48%,44%)] to-[hsl(178,54%,32%)] text-white",
                  done && !isMiss && "border-[hsl(70,50%,22%)] bg-gradient-to-b from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] text-white",
                )}
              >
                {done ? (
                  isMiss ? (
                    <Shield className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" strokeWidth={3.5} />
                  )
                ) : (
                  <span className="font-display text-[10px] font-bold">{day}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <motion.p
        animate={{ opacity: saved ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="text-center text-[10px] font-bold uppercase tracking-wide text-[hsl(178,45%,62%)]"
      >
        Missed Wednesday · a Streak Freeze covered it
      </motion.p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7 · The 100-day run (wide card)
// ---------------------------------------------------------------------------

const RUN_FROM = [1, 84.6];
const RUN_TO = [CHALLENGE_DAYS, 76.2];

export const HundredDayDemo = ({ playing }: DemoProps) => {
  const [day, weight] = useCounts(playing, RUN_FROM, RUN_TO, 2400, 200);
  const [sealed, setSealed] = useState(false);

  useTimeline(playing, [[2750, () => setSealed(true)]]);

  return (
    <div className="grid h-full gap-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
      <div className="game-panel flex flex-col justify-center gap-1.5 p-3 text-center">
        <p className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Day</p>
        <p className="text-sticker text-3xl leading-none text-[hsl(44,95%,66%)]">{Math.round(day)}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">of {CHALLENGE_DAYS}</p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="game-tag px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-card-foreground">
            {weight.toFixed(1)} kg
          </span>
          <span className="game-tag px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[hsl(84,45%,30%)]">
            −{(RUN_FROM[1] - weight).toFixed(1)} kg
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-2.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
            <span className="text-[hsl(35,30%,65%)]">{CHALLENGE_DAYS}-Day Challenge</span>
            <span className="font-display text-[hsl(178,45%,60%)]">{Math.round((day / CHALLENGE_DAYS) * 100)}%</span>
          </div>
          <GameProgress value={(day / CHALLENGE_DAYS) * 100} color="teal" size="h-3.5" />
        </div>

        <motion.div
          animate={{ opacity: sealed ? 1 : 0.25, y: sealed ? 0 : 6 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between gap-2 rounded-xl border-2 border-[hsl(42,95%,62%)]/60 bg-[hsl(42,95%,62%)]/12 px-3 py-2 shadow-[0_0_18px_hsl(42,95%,60%,0.18)]"
        >
          <p className="font-display text-[11px] font-bold text-[hsl(42,85%,72%)]">
            <Trophy className="mr-1 inline h-3.5 w-3.5" />
            Run 1 sealed — golden star claimed
          </p>
          <motion.span
            animate={sealed ? { scale: [0.4, 1.25, 1], rotate: [0, 18, 0] } : { scale: 0.4 }}
            transition={{ duration: 0.7 }}
            className="text-lg drop-shadow-[0_0_8px_hsl(42,95%,60%,0.9)]"
          >
            ⭐
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
};
