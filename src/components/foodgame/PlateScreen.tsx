import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import FoodSprite from "./FoodSprite";
import {
  CUSTOM_PORTION,
  PORTIONS,
  computeMacros,
  lookupMethod,
  servingNoteFor,
  type PortionId,
} from "@/lib/foodGame/foods";
import { draftEntries, plateItems, stepPrompt, type MealDraft } from "@/lib/foodGame/flow";
import { pulse } from "@/lib/fx";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface PlateScreenProps {
  draft: MealDraft;
  onSetPortion: (foodId: string, portionId: PortionId, customGrams?: number) => void;
  onConfirm: () => void;
}

/** Shared look for the portion buttons, so the scale sits flush with the rest. */
const portionButtonClass = (active: boolean) =>
  cn(
    "flex w-[3.25rem] flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-1.5 transition-[transform,box-shadow,filter] duration-150",
    "hover:-translate-y-0.5 hover:brightness-105 active:translate-y-[1px]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(40,90%,58%)]",
    active
      ? "border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(40,90%,60%)] to-[hsl(36,85%,46%)] text-[hsl(26,50%,18%)] shadow-[0_3px_0_hsl(33,75%,28%)]"
      : "border-[hsl(28,30%,55%)] bg-[hsl(40,40%,90%)] text-[hsl(26,35%,38%)] shadow-[0_3px_0_hsl(28,30%,55%)]",
  );

/**
 * "Size it up" — one row per food on the plate with four chunky portion
 * buttons. Deliberately a single screen rather than a question each: portions
 * are the least interesting decision in the run, and drip-feeding them one
 * modal at a time is what would make the game drag.
 */
const PlateScreen = ({ draft, onSetPortion, onConfirm }: PlateScreenProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const items = plateItems(draft);
  const { title, hint } = stepPrompt({ kind: "plate", mealId: draft.mealId });

  const totals = draftEntries(draft).reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, protein: Math.round((acc.protein + e.protein) * 10) / 10 }),
    { kcal: 0, protein: 0 },
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-plate-row]", {
        x: -28,
        opacity: 0,
        duration: 0.4,
        stagger: 0.07,
        ease: "power2.out",
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const totalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pulse(totalRef.current);
  }, [totals.kcal, totals.protein]);

  const pick = (foodId: string, portionId: PortionId, customGrams?: number) => {
    sfx.claim();
    onSetPortion(foodId, portionId, customGrams);
  };

  return (
    <div ref={rootRef} className="space-y-5 p-5 sm:p-7">
      <div className="text-center">
        <h3 className="font-display text-xl font-bold text-[hsl(26,50%,20%)] sm:text-2xl">{title}</h3>
        <p className="mt-1 text-sm font-bold text-[hsl(26,30%,42%)]">{hint}</p>
      </div>

      <div className="space-y-3">
        {items.map(({ food, methodId }) => {
          const portionId = draft.portions[food.id] ?? "regular";
          const weighed = draft.customGrams?.[food.id];
          const { grams, kcal, protein } = computeMacros(food, portionId, methodId, weighed);
          const method = lookupMethod(methodId);
          const isCustom = portionId === "custom";

          return (
            <div
              key={food.id}
              data-plate-row
              className="flex flex-col gap-3 rounded-2xl border-[3px] border-[hsl(28,35%,45%)] bg-gradient-to-b from-[hsl(42,62%,94%)] to-[hsl(38,48%,86%)] p-3 shadow-[0_4px_0_hsl(24,40%,26%)] sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                  <FoodSprite sprite={food.sprite} size="text-3xl" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold text-[hsl(26,50%,20%)]">
                    {food.label}
                    {method && <span className="ml-1.5 font-body text-xs font-bold text-[hsl(26,30%,45%)]">· {method.label}</span>}
                  </div>
                  <div className="text-[11px] font-bold text-[hsl(26,30%,45%)]">
                    {grams} g — {servingNoteFor(food, portionId)}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5">
                {PORTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(food.id, p.id)}
                    aria-pressed={portionId === p.id}
                    title={p.label}
                    className={portionButtonClass(portionId === p.id)}
                  >
                    <span className="text-base leading-none">{p.sprite}</span>
                    <span className="font-display text-[9px] font-bold uppercase leading-none">{p.label.split(" ")[0]}</span>
                  </button>
                ))}

                {/* Scale option: seeds the input with whatever weight is already
                    on screen, so switching to it never zeroes the row out. */}
                <button
                  type="button"
                  onClick={() => pick(food.id, "custom", weighed ?? grams)}
                  aria-pressed={isCustom}
                  title={CUSTOM_PORTION.label}
                  className={portionButtonClass(isCustom)}
                >
                  <span className="text-base leading-none">{CUSTOM_PORTION.sprite}</span>
                  <span className="font-display text-[9px] font-bold uppercase leading-none">Weighed</span>
                </button>

                {isCustom && (
                  <label className="flex items-center gap-1 rounded-xl border-2 border-[hsl(33,75%,28%)] bg-[hsl(40,50%,96%)] px-2 py-1">
                    <span className="sr-only">Weight in grams for {food.label}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={5000}
                      autoFocus
                      defaultValue={weighed ?? grams}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        // Ignore empty/invalid while typing; the last good value stands.
                        if (Number.isFinite(next) && next > 0) {
                          onSetPortion(food.id, "custom", Math.min(5000, Math.round(next)));
                        }
                      }}
                      className="w-16 bg-transparent font-display text-sm font-bold text-[hsl(26,50%,20%)] focus:outline-none"
                    />
                    <span className="font-display text-xs font-bold text-[hsl(26,35%,40%)]">g</span>
                  </label>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 sm:w-32">
                <span className="rounded-lg border-2 border-[hsl(6,55%,30%)] bg-[hsl(6,70%,62%)] px-2 py-0.5 font-display text-xs font-bold text-white">
                  {kcal}
                </span>
                <span className="rounded-lg border-2 border-[hsl(178,50%,18%)] bg-[hsl(178,48%,44%)] px-2 py-0.5 font-display text-xs font-bold text-white">
                  {protein}g
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={totalRef}
        className="flex items-center justify-center gap-4 rounded-xl border-2 border-[hsl(28,35%,45%)] bg-[hsl(40,40%,90%)] px-4 py-2"
      >
        <span className="font-display text-sm font-bold text-[hsl(26,50%,20%)]">Meal total</span>
        <span className="font-display text-lg font-bold text-[hsl(6,62%,45%)]">{totals.kcal} kcal</span>
        <span className="font-display text-lg font-bold text-[hsl(178,54%,30%)]">{totals.protein}g protein</span>
      </div>

      <div className="flex justify-center">
        <GameButton
          color="gold"
          size="lg"
          className="px-8"
          onClick={() => {
            sfx.milestone();
            onConfirm();
          }}
        >
          Lock it in
          <ArrowRight className="h-5 w-5" />
        </GameButton>
      </div>
    </div>
  );
};

export default PlateScreen;
