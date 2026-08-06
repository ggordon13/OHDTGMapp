import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, Check } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import { ACTION_BUTTON, MEAL_TILE } from "./ui";
import { MEALS, type MealId } from "@/lib/foodGame/foods";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface MealPickerScreenProps {
  selected: MealId[];
  /** True once the run is under way — the screen is then "edit my meals". */
  started?: boolean;
  onToggle: (mealId: MealId) => void;
  onConfirm: () => void;
}

const bannerClass: Record<string, string> = {
  gold: "from-[hsl(40,90%,58%)] to-[hsl(36,85%,46%)]",
  leaf: "from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)]",
  navy: "from-[hsl(222,55%,46%)] to-[hsl(224,60%,32%)]",
  purple: "from-[hsl(268,42%,60%)] to-[hsl(268,44%,46%)]",
  teal: "from-[hsl(178,48%,44%)] to-[hsl(178,54%,32%)]",
};

/**
 * Level select — the opening pick of which meals to build, and afterwards the
 * bulk editor for that same set.
 *
 * It is no longer a gate: the tab strip can add any meal at any point, so this
 * screen exists to start the run pointed at something and to add or drop
 * several meals at once. Toggling here acts on the run immediately, which is
 * why unticking a meal you have already built takes its contents with it.
 */
const MealPickerScreen = ({ selected, started = false, onToggle, onConfirm }: MealPickerScreenProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      // Scale-and-fade only, deliberately no y. Transforms don't reserve
      // layout space, so a staggered tile travelling vertically renders
      // outside its own box and crosses the confirm button below it — with
      // five tiles landing 0.06s apart, any frame in that window looks like a
      // broken staircase. Scaling grows from the tile's centre, so it can
      // never leave the box no matter where the stagger is caught.
      //
      // clearProps must be "all", not just "transform": GSAP leaves the
      // animated opacity inline at 1 when it finishes, which outranks the
      // `opacity-80` class that dims unselected tiles and would flatten the
      // selected/unselected distinction for the rest of the screen's life.
      gsap.from("[data-meal]", {
        opacity: 0,
        scale: 0.9,
        duration: 0.45,
        stagger: 0.06,
        ease: "back.out(1.8)",
        clearProps: "all",
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const toggle = (mealId: MealId) => {
    sfx.claim();
    onToggle(mealId);
  };

  return (
    <div ref={rootRef} className="space-y-8 p-6 sm:p-8">
      <div className="text-center">
        <h3 className="font-display text-2xl font-bold text-[hsl(26,50%,20%)] sm:text-3xl">What did you eat today?</h3>
        <p className="mt-1 text-sm font-bold text-[hsl(26,30%,42%)]">
          Pick every meal you had — you can add or drop more at any time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MEALS.map((meal) => {
          const isOn = selected.includes(meal.id);
          return (
            <button
              key={meal.id}
              type="button"
              data-meal
              onClick={() => toggle(meal.id)}
              aria-pressed={isOn}
              className={cn(
                // A fixed height, not h-full: with a shared height the row is
                // identical whether or not a tagline wraps, and the grid can't
                // be stretched by whichever tile happens to hold the most text.
                MEAL_TILE,
                "group relative flex flex-col items-center justify-start gap-2 rounded-2xl border-[3px] bg-gradient-to-b p-4 text-center text-white",
                "transition-[transform,box-shadow,filter] duration-150 hover:-translate-y-1 hover:brightness-110 active:translate-y-[2px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(40,90%,58%)] focus-visible:ring-offset-2",
                bannerClass[meal.color],
                isOn
                  ? "border-[hsl(42,95%,68%)] shadow-[0_5px_0_hsl(22,45%,16%),0_0_0_3px_hsl(42,95%,68%,0.5),0_10px_20px_rgba(0,0,0,0.4)]"
                  : "border-[hsl(22,45%,16%)] opacity-80 shadow-[0_5px_0_hsl(22,45%,16%),0_8px_16px_rgba(0,0,0,0.3)]",
              )}
            >
              {isOn && (
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(33,75%,28%)] bg-[hsl(42,95%,68%)] shadow-[0_2px_0_hsl(33,75%,28%)]">
                  <Check className="h-4 w-4 text-[hsl(26,50%,18%)]" strokeWidth={4} />
                </span>
              )}
              <span className="text-4xl leading-none transition-transform duration-200 group-hover:scale-125 sm:text-5xl">
                {meal.sprite}
              </span>
              <span className="font-display text-sm font-bold uppercase tracking-wide [text-shadow:0_1.5px_0_rgba(0,0,0,0.3)]">
                {meal.label}
              </span>
              <span className="text-[10px] font-bold leading-tight opacity-90">{meal.tagline}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <GameButton
          color="gold"
          size="lg"
          className={ACTION_BUTTON}
          disabled={selected.length === 0}
          onClick={() => {
            sfx.claimAll();
            onConfirm();
          }}
        >
          {selected.length === 0
            ? "Pick at least one"
            : started
              ? "Back to my meals"
              : `Start — ${selected.length} meal${selected.length === 1 ? "" : "s"}`}
          <ArrowRight className="h-5 w-5" />
        </GameButton>
      </div>
    </div>
  );
};

export default MealPickerScreen;
