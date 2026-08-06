import { useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import FoodSprite, { isCritter } from "./FoodSprite";
import { CHOICE_TILE } from "./ui";

interface ChoiceCardProps {
  label: string;
  sprite: string;
  /** Small line under the label — serving size, cooking blurb, macros. */
  detail?: string;
  /** Speech bubble the critter panics with on hover. */
  taunt?: string;
  selected?: boolean;
  /** Shows a tick badge and gold ring; multi-select steps set this. */
  multi?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  className?: string;
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A chunky pick-me tile. Hovering makes the artwork react: emoji food hops and
 * tilts, while the drawn critters realise what's about to happen — eyes blow
 * up, a bead of sweat rolls off, the whole body shivers and they blurt out
 * their taunt. Built on GSAP timelines that are parked at 0 and played /
 * reversed on pointer enter and leave, so rapid hovering never leaves a card
 * stuck mid-panic.
 */
const ChoiceCard = ({
  label,
  sprite,
  detail,
  taunt,
  selected = false,
  multi = false,
  disabled = false,
  onSelect,
  className,
}: ChoiceCardProps) => {
  const cardRef = useRef<HTMLButtonElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const panicRef = useRef<gsap.core.Timeline | null>(null);
  const shiverRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const art = artRef.current;
    if (!art || reducedMotion()) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });

      if (isCritter(sprite)) {
        // The panic reaction, layered so it reads in ~0.25s.
        tl.to(art.querySelectorAll("[data-part='eye']"), { scale: 1.5, duration: 0.22, transformOrigin: "50% 50%" }, 0)
          .to(art.querySelectorAll("[data-part='pupil']"), { scale: 0.55, duration: 0.22, transformOrigin: "50% 50%" }, 0)
          .to(art.querySelectorAll("[data-part='mouth']"), { scaleY: -1.4, duration: 0.22, transformOrigin: "50% 50%" }, 0)
          .fromTo(
            art.querySelectorAll("[data-part='sweat']"),
            { opacity: 0, y: -4 },
            { opacity: 1, y: 8, duration: 0.35, ease: "power1.in" },
            0.05,
          )
          .to(art, { scale: 1.08, duration: 0.25 }, 0);

        if (bubbleRef.current) {
          tl.fromTo(
            bubbleRef.current,
            { opacity: 0, y: 6, scale: 0.8 },
            { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "back.out(3)" },
            0.08,
          );
        }
      } else {
        // Plain food just gets cheeky: a hop with a wobble on the way down.
        tl.to(art, { y: -10, scale: 1.16, rotate: -8, duration: 0.22 }, 0).to(
          art,
          { rotate: 8, duration: 0.35, ease: "elastic.out(1, 0.4)" },
          0.22,
        );
      }

      panicRef.current = tl;
    }, art);

    return () => {
      ctx.revert();
      panicRef.current = null;
    };
  }, [sprite]);

  const enter = useCallback(() => {
    if (disabled || reducedMotion()) return;
    panicRef.current?.play();
    gsap.to(cardRef.current, { y: -6, duration: 0.18, ease: "power2.out", overwrite: "auto" });
    // Continuous shiver only for the critters — the food hop is a one-shot.
    if (isCritter(sprite) && artRef.current && !shiverRef.current) {
      shiverRef.current = gsap.to(artRef.current, {
        x: 2.5,
        duration: 0.06,
        repeat: -1,
        yoyo: true,
        ease: "none",
      });
    }
  }, [disabled, sprite]);

  const leave = useCallback(() => {
    if (reducedMotion()) return;
    panicRef.current?.reverse();
    gsap.to(cardRef.current, { y: 0, duration: 0.22, ease: "power2.out", overwrite: "auto" });
    shiverRef.current?.kill();
    shiverRef.current = null;
    gsap.to(artRef.current, { x: 0, duration: 0.15 });
  }, []);

  useEffect(
    () => () => {
      shiverRef.current?.kill();
    },
    [],
  );

  const click = () => {
    if (disabled) return;
    if (!reducedMotion()) {
      gsap.fromTo(cardRef.current, { scale: 0.93 }, { scale: 1, duration: 0.4, ease: "back.out(3)", overwrite: "auto" });
    }
    onSelect();
  };

  return (
    <button
      ref={cardRef}
      type="button"
      disabled={disabled}
      onClick={click}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      aria-pressed={multi ? selected : undefined}
      className={cn(
        // Fixed height, contents pinned to the bottom: "Fries" and "Cooked
        // Veggies · 130 g · 59 kcal · 3.6g P" are the same tile, and the grid
        // rows line up instead of stepping with whichever label is longest.
        CHOICE_TILE,
        "group relative flex w-full flex-col items-center justify-end gap-2 rounded-2xl border-[3px] p-3 pt-4 text-center",
        "bg-gradient-to-b from-[hsl(42,62%,94%)] to-[hsl(38,48%,84%)]",
        "transition-[box-shadow,border-color,filter] duration-150 will-change-transform",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(40,90%,58%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(24,40%,22%)]",
        "disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50",
        selected
          ? "border-[hsl(36,85%,46%)] shadow-[0_5px_0_hsl(33,75%,28%),0_0_0_3px_hsl(40,90%,58%,0.45),0_10px_18px_rgba(0,0,0,0.35)]"
          : "border-[hsl(28,35%,45%)] shadow-[0_5px_0_hsl(24,40%,26%),0_8px_16px_rgba(0,0,0,0.3)] hover:border-[hsl(36,70%,50%)]",
        className,
      )}
    >
      {selected && (
        <span className="absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(40,90%,60%)] to-[hsl(36,85%,46%)] shadow-[0_2px_0_hsl(33,75%,28%)]">
          <Check className="h-4 w-4 text-[hsl(26,50%,18%)]" strokeWidth={4} />
        </span>
      )}

      {taunt && (
        <div
          ref={bubbleRef}
          // Decorative gag — keep it out of the button's accessible name.
          aria-hidden="true"
          className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border-2 border-[hsl(22,45%,18%)] bg-white px-2 py-0.5 font-display text-[10px] font-bold text-[hsl(22,45%,18%)] opacity-0 shadow-[0_2px_0_hsl(22,45%,18%)]"
        >
          {taunt}
          <span className="absolute -bottom-[7px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[hsl(22,45%,18%)] bg-white" />
        </div>
      )}

      <div
        ref={artRef}
        className={cn("flex items-center justify-center", isCritter(sprite) ? "h-16 w-16 sm:h-20 sm:w-20" : "h-14 sm:h-16")}
      >
        <FoodSprite sprite={sprite} size="text-4xl sm:text-5xl" />
      </div>

      <div className="min-h-[2.25rem] space-y-0.5">
        <div className="font-display text-xs font-bold leading-tight text-[hsl(26,50%,20%)] sm:text-sm">{label}</div>
        {detail && <div className="text-[10px] font-bold leading-tight text-[hsl(26,30%,42%)]">{detail}</div>}
      </div>
    </button>
  );
};

export default ChoiceCard;
