import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Star } from "lucide-react";
import type { Celebration } from "@/hooks/useGamification";
import type { BadgeTier } from "@/lib/gamification";
import GameButton from "@/components/game/GameButton";
import { confettiBurst, sparkle, shine } from "@/lib/fx";

interface CelebrationModalProps {
  /** The celebration currently on screen (front of the queue), or null. */
  event: Celebration | null;
  /** Advance past the current celebration. */
  onDismiss: () => void;
}

const tierFace: Record<BadgeTier, string> = {
  bronze: "bg-gradient-to-b from-[hsl(24,60%,55%)] to-[hsl(22,55%,38%)]",
  silver: "bg-gradient-to-b from-[hsl(210,15%,78%)] to-[hsl(210,12%,55%)]",
  gold: "bg-gradient-to-b from-[hsl(44,95%,62%)] to-[hsl(36,85%,45%)]",
  special: "bg-gradient-to-b from-[hsl(268,45%,62%)] to-[hsl(268,44%,44%)]",
};

/**
 * Full-screen "you did it!" takeover for trophy unlocks and level-ups:
 * rotating sunburst, bouncing icon, sparkle ring, confetti, staggered copy.
 */
const CelebrationModal = ({ event, onDismiss }: CelebrationModalProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);

  // Re-run the entrance choreography for each queued event.
  useEffect(() => {
    if (!event) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const spin = !reduced && raysRef.current
      ? gsap.to(raysRef.current, { rotation: 360, duration: 24, repeat: -1, ease: "none" })
      : null;

    let tl: gsap.core.Timeline | null = null;
    const timers: number[] = [];
    if (!reduced && cardRef.current) {
      const bits = cardRef.current.querySelectorAll("[data-cheer]");
      tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(cardRef.current, { scale: 0.6, opacity: 0, duration: 0.45, ease: "back.out(1.8)" })
        .from(iconRef.current, { scale: 0, rotate: -40, duration: 0.65, ease: "back.out(2.4)" }, "-=0.15")
        .from(bits, { y: 22, opacity: 0, duration: 0.5, stagger: 0.09 }, "-=0.3");

      timers.push(window.setTimeout(() => sparkle(iconRef.current, 12), 500));
      timers.push(window.setTimeout(() => confettiBurst(iconRef.current, 34), 420));
      timers.push(window.setTimeout(() => shine(cardRef.current), 950));
    }

    return () => {
      spin?.kill();
      tl?.kill();
      timers.forEach(window.clearTimeout);
    };
  }, [event]);

  // Allow Escape to dismiss.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onDismiss]);

  if (!event) return null;

  const isBadge = event.type === "badge";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isBadge ? "Trophy unlocked" : "Level up"}
      onClick={onDismiss}
    >
      <div
        key={event.id}
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="game-panel relative w-full max-w-sm overflow-hidden p-8 text-center"
      >
        {/* Rotating sunburst behind the icon */}
        <div
          ref={raysRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, hsl(42 90% 60% / 0.5) 0deg 12deg, transparent 12deg 24deg)",
            WebkitMaskImage: "radial-gradient(circle, black 25%, transparent 68%)",
            maskImage: "radial-gradient(circle, black 25%, transparent 68%)",
          }}
        />

        <div className="relative space-y-4">
          {isBadge ? (
            <div className="hex-clip mx-auto w-fit bg-[hsl(24,50%,16%)] p-1">
              <div
                ref={iconRef}
                className={`hex-clip flex h-28 w-28 items-center justify-center text-6xl ${tierFace[event.badge.tier]}`}
              >
                <span className="drop-shadow-[0_3px_2px_rgba(0,0,0,0.4)]" style={{ color: event.badge.iconColor }}>
                  {event.badge.icon}
                </span>
              </div>
            </div>
          ) : (
            <div
              ref={iconRef}
              className="mx-auto flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] shadow-[0_6px_0_hsl(33,75%,28%),0_10px_18px_rgba(0,0,0,0.45),inset_0_3px_0_rgba(255,255,255,0.5)]"
            >
              <Star className="h-7 w-7 fill-[hsl(26,50%,18%)] text-[hsl(26,50%,18%)]" />
              <span className="font-display text-4xl font-bold leading-none text-[hsl(26,50%,18%)]">
                {event.level}
              </span>
            </div>
          )}

          <div data-cheer>
            <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-[hsl(36,80%,40%)]">
              {isBadge ? "Trophy Unlocked!" : "Level Up!"}
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-card-foreground">
              {isBadge ? event.badge.label : `Level ${event.level}`}
            </h2>
          </div>

          <p data-cheer className="text-sm font-semibold text-muted-foreground">
            {isBadge
              ? event.badge.description
              : "Your dedication is paying off — keep the momentum going!"}
          </p>

          {isBadge && (
            <span
              data-cheer
              className="inline-block rounded-full border-2 border-[hsl(40,65%,32%)] bg-gradient-to-b from-[hsl(44,92%,62%)] to-[hsl(38,85%,48%)] px-3 py-1 font-display text-sm font-bold text-[hsl(26,50%,18%)] shadow-[0_2px_0_hsl(38,65%,32%)]"
            >
              +{event.badge.xp} XP
            </span>
          )}

          <div data-cheer className="pt-1">
            <GameButton color="gold" size="lg" className="w-full" onClick={onDismiss}>
              Awesome!
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CelebrationModal;
