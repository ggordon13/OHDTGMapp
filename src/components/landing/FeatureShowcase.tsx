import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Award, Crown, Flame, Play, Swords, Target, Users, Zap, type LucideIcon } from "lucide-react";
import type { BannerColor } from "@/components/game/GamePanel";
import {
  HundredDayDemo,
  LeaderboardDemo,
  LogLevelDemo,
  QuestDemo,
  RankDemo,
  StreakDemo,
  TrophyDemo,
  type DemoProps,
} from "@/components/landing/FeatureDemos";
import { cn } from "@/lib/utils";

interface Feature {
  key: string;
  eyebrow: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  accent: BannerColor;
  demo: (props: DemoProps) => JSX.Element;
  /** Spans both columns — used for the closing card. */
  wide?: boolean;
  /**
   * Optional screen recording (e.g. "/demos/quests.mp4" or a .gif). When set it
   * replaces the live demo and plays on hover; leave it off and the animated
   * mini-panel in FeatureDemos.tsx plays instead.
   */
  video?: string;
  poster?: string;
}

const FEATURES: Feature[] = [
  {
    key: "log",
    eyebrow: "Log to level up",
    title: "One minute a day. Real XP.",
    blurb:
      "Weight, calories, protein, water, steps — punch them in and the XP bar moves. No more logging into a void: every entry pays you back immediately.",
    icon: Zap,
    accent: "gold",
    demo: LogLevelDemo,
  },
  {
    key: "quests",
    eyebrow: "Daily & weekly quests",
    title: "Quests that pay you to show up",
    blurb:
      "Fresh objectives every morning and a bigger set each week. Hit them, smack Claim, and watch the XP rain. Missed one? Tomorrow's board is already waiting.",
    icon: Swords,
    accent: "red",
    demo: QuestDemo,
  },
  {
    key: "challenge",
    eyebrow: "Challenge your people",
    title: "Drag your friends into it",
    blurb:
      "Invite a friend or the whole office to a 30-day head-to-head. Live leaderboards, side awards like the Golden Shoe, and a winner nobody can argue with.",
    icon: Users,
    accent: "navy",
    demo: LeaderboardDemo,
  },
  {
    key: "trophies",
    eyebrow: "Trophy case",
    title: "Twelve trophies. Zero excuses.",
    blurb:
      "Perfect weeks, iron streaks, hydration runs. Locked trophies sit in your case in plain sight — and that empty slot is exactly why you'll log tonight.",
    icon: Award,
    accent: "gold",
    demo: TrophyDemo,
  },
  {
    key: "ranks",
    eyebrow: "Ranks",
    title: "Newcomer today. Mythic later.",
    blurb:
      "Eleven ranks stand between a dull stone plate and a glowing prismatic one. Levels never reset — every rank you take is yours for good.",
    icon: Crown,
    accent: "purple",
    demo: RankDemo,
  },
  {
    key: "streak",
    eyebrow: "Streaks & freezes",
    title: "One bad day won't kill the run",
    blurb:
      "Your streak is the hardest thing to rebuild, so we guard it. Earn Streak Freezes and a missed Wednesday costs you nothing but the day.",
    icon: Flame,
    accent: "teal",
    demo: StreakDemo,
  },
  {
    key: "hundred",
    eyebrow: "The 100-day run",
    title: "100 days, sealed and scored",
    blurb:
      "Everything above rolls up into one 100-day run. Cross the line and it's locked in, scored, and stamped with a golden star — then you start the next one from a higher level.",
    icon: Target,
    accent: "forest",
    demo: HundredDayDemo,
    wide: true,
  },
];

const bannerColorClass: Record<BannerColor, string> = {
  red: "game-banner-red",
  teal: "game-banner-teal",
  leaf: "game-banner-leaf",
  gold: "game-banner-gold",
  purple: "game-banner-purple",
  wood: "game-banner-wood",
  navy: "game-banner-navy",
  forest: "game-banner-forest",
};

/**
 * One feature card. The demo inside is inert until the card is hovered,
 * focused or tapped; on touch screens (no hover) it plays itself once it
 * scrolls into view, so mobile visitors still see the thing move.
 */
const FeatureCard = ({ feature }: { feature: Feature }) => {
  const [active, setActive] = useState(false);
  const [run, setRun] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const still = useReducedMotion() ?? false;

  // Bumping `run` remounts the demo, so every replay starts from frame 0.
  const activate = useCallback(() => {
    setActive(true);
    setRun((n) => n + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Pointer devices drive the demo from hover; only touch needs a scroll cue.
    if (window.matchMedia("(hover: hover)").matches) return;
    const el = cardRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? activate() : setActive(false)),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [activate]);

  // Keep an optional screen recording in sync with the same active state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      void video.play().catch(() => {
        /* autoplay blocked — the poster frame still reads fine */
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  // Reduced motion: no hover choreography, just show the finished state.
  const playing = still || active;
  const Demo = feature.demo;

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onMouseEnter={activate}
      onMouseLeave={() => setActive(false)}
      onClick={activate}
      className={cn(
        "game-panel-wood group relative p-3 text-left transition-transform duration-200 hover:-translate-y-1",
        feature.wide && "md:col-span-2",
      )}
    >
      {/* Inset "screen" the demo plays inside. Decorative: the sample weights,
          names and XP totals would only confuse a screen reader, so the whole
          stage is hidden from the accessibility tree — the copy below carries
          the meaning. */}
      <div
        aria-hidden
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-[hsl(22,45%,10%)] bg-[hsl(24,30%,15%)]",
          "shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)]",
          feature.wide ? "h-[11.5rem]" : "h-[15.5rem]",
        )}
      >
        {feature.video ? (
          <video
            ref={videoRef}
            src={feature.video}
            poster={feature.poster}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 p-3">
            <Demo key={`${run}-${active}`} playing={playing} />
          </div>
        )}

        {/* Nudge that disappears the moment the demo takes over. */}
        <span
          className={cn(
            "pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full",
            "border border-[hsl(42,88%,62%)]/40 bg-[hsl(24,40%,12%)]/85 px-2 py-0.5",
            "font-display text-[9px] font-bold uppercase tracking-wider text-[hsl(42,88%,72%)]",
            "transition-opacity duration-200",
            active || still ? "opacity-0" : "opacity-100",
          )}
        >
          <Play className="h-2.5 w-2.5 fill-current" />
          Hover to play
        </span>
      </div>

      <div className="mt-3 space-y-1.5 px-1 pb-1">
        <span className={cn("game-banner !rotate-0 text-[10px]", bannerColorClass[feature.accent])}>
          <feature.icon className="h-3 w-3" />
          {feature.eyebrow}
        </span>
        <h3 className="font-display text-lg font-bold leading-tight text-[hsl(38,60%,90%)] [text-shadow:0_2px_0_rgba(0,0,0,0.45)]">
          {feature.title}
        </h3>
        <p className="text-sm font-semibold leading-snug text-[hsl(35,30%,66%)]">{feature.blurb}</p>
      </div>
    </motion.article>
  );
};

/**
 * The "here's what you're actually signing up for" tour: one card per hook,
 * each playing a miniature of the real dashboard panel on hover.
 */
const FeatureShowcase = () => (
  <MotionConfig reducedMotion="user">
    <section className="mt-16">
      <div className="mx-auto max-w-2xl space-y-2 text-center">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(42,88%,62%)]">
          A gamified way to a better you
        </p>
        <h2 className="font-display text-3xl font-bold leading-tight tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_4px_0_rgba(0,0,0,0.45)] sm:text-4xl">
          Log to level up.
          <br className="sm:hidden" />{" "}
          <span className="text-[hsl(42,88%,62%)]">Then go take the crown.</span>
        </h2>
        <p className="font-semibold text-[hsl(35,30%,66%)]">
          Finish quests, top the leaderboard and earn trophies to climb the ranks — with your friends dragged along for
          the ride. Hover any card to watch it happen.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.key} feature={feature} />
        ))}
      </div>
    </section>
  </MotionConfig>
);

export default FeatureShowcase;
