import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import FoodSprite from "./FoodSprite";
import { ACTION_BUTTON, ACTION_BUTTON_SM, ICON_BUTTON, PORTION_BUTTON } from "./ui";
import {
  CUSTOM_PORTION,
  PORTIONS,
  computeMacros,
  lookupMethod,
  servingNoteFor,
  type PortionId,
} from "@/lib/foodGame/foods";
import {
  draftEntries,
  isPickerMeal,
  plateItems,
  stepPrompt,
  type Course,
  type MealDraft,
  type PlateItem,
} from "@/lib/foodGame/flow";
import { pulse } from "@/lib/fx";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface MealScreenProps {
  draft: MealDraft;
  onSetPortion: (foodId: string, portionId: PortionId, customGrams?: number) => void;
  /** Re-open a whole course (carbs, proteins, sides, or the snack/drink picker). */
  onEditCourse: (course: Course) => void;
  /** Re-ask which cut of a protein family was eaten. */
  onEditCut: (groupId: string) => void;
  /** Re-ask how a protein was cooked. */
  onEditMethod: (groupId: string) => void;
  onRemove: (item: PlateItem) => void;
  onConfirm: () => void;
  /** "Next: Lunch" or "Finish — see my day", depending on what follows. */
  confirmLabel: string;
}

/** Shared look for the portion buttons, so the scale sits flush with the rest. */
const portionButtonClass = (active: boolean) =>
  cn(
    PORTION_BUTTON,
    "flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 transition-[transform,box-shadow,filter] duration-150",
    "hover:-translate-y-0.5 hover:brightness-105 active:translate-y-[1px]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(40,90%,58%)]",
    active
      ? "border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(40,90%,60%)] to-[hsl(36,85%,46%)] text-[hsl(26,50%,18%)] shadow-[0_3px_0_hsl(33,75%,28%)]"
      : "border-[hsl(28,30%,55%)] bg-[hsl(40,40%,90%)] text-[hsl(26,35%,38%)] shadow-[0_3px_0_hsl(28,30%,55%)]",
  );

/** The courses this meal can add to, in plate order. */
const coursesFor = (draft: MealDraft): { course: Course; label: string }[] =>
  isPickerMeal(draft.mealId)
    ? [{ course: "item", label: draft.mealId === "drinks" ? "Drinks" : "Snacks" }]
    : [
        { course: "staple", label: "Carbs" },
        { course: "protein", label: "Protein" },
        { course: "side", label: "Sides" },
      ];

/**
 * The meal's editor — the screen every meal settles on once its questions are
 * answered, and the hub the tab strip navigates between.
 *
 * It was previously a one-shot "size it up" step at the end of a corridor: the
 * player set portions, hit Lock it in, and the meal was sealed short of walking
 * the whole question sequence backwards. Here the built meal stays open. Every
 * row can be resized, re-cooked, swapped for a different cut or thrown out, and
 * the course buttons at the bottom re-open the questions to add what was
 * missed — which is what "I forgot the rice" actually needs.
 */
const MealScreen = ({
  draft,
  onSetPortion,
  onEditCourse,
  onEditCut,
  onEditMethod,
  onRemove,
  onConfirm,
  confirmLabel,
}: MealScreenProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const items = plateItems(draft);
  const { title, hint } = stepPrompt({ kind: "plate", mealId: draft.mealId });
  const courses = coursesFor(draft);

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
        clearProps: "all",
      });
    }, rootRef);
    return () => ctx.revert();
    // Re-runs per meal, not per edit — re-animating on every portion tap would
    // slide the row out from under the finger that tapped it.
  }, [draft.mealId]);

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

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-[3px] border-dashed border-[hsl(28,30%,55%)] bg-[hsl(40,40%,90%)] px-4 py-8 text-center">
          <UtensilsCrossed className="h-8 w-8 text-[hsl(26,30%,50%)]" />
          <p className="font-display text-sm font-bold text-[hsl(26,50%,20%)]">Nothing logged for this meal yet</p>
          <p className="text-xs font-bold text-[hsl(26,30%,45%)]">
            Add a course below, or leave it empty and move on.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const { food, methodId, groupId } = item;
            const portionId = draft.portions[food.id] ?? "regular";
            const weighed = draft.customGrams?.[food.id];
            const { grams, kcal, protein } = computeMacros(food, portionId, methodId, weighed);
            const method = lookupMethod(methodId);
            const isCustom = portionId === "custom";

            return (
              <div
                key={`${item.course}:${food.id}`}
                data-plate-row
                className="space-y-2.5 rounded-2xl border-[3px] border-[hsl(28,35%,45%)] bg-gradient-to-b from-[hsl(42,62%,94%)] to-[hsl(38,48%,86%)] p-3 shadow-[0_4px_0_hsl(24,40%,26%)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <FoodSprite sprite={food.sprite} size="text-3xl" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span className="truncate font-display text-sm font-bold text-[hsl(26,50%,20%)]">
                        {food.label}
                      </span>
                      {/* The cooking method is the single biggest lever on the
                          numbers, so it is a control rather than a caption. */}
                      {method && groupId && (
                        <button
                          type="button"
                          onClick={() => onEditMethod(groupId)}
                          title={`Change how the ${food.label.toLowerCase()} was cooked`}
                          className="rounded-lg border-2 border-[hsl(28,30%,55%)] bg-[hsl(40,50%,96%)] px-1.5 py-0.5 font-display text-[10px] font-bold text-[hsl(26,35%,38%)] transition-colors hover:border-[hsl(36,70%,50%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(40,90%,58%)]"
                        >
                          {method.sprite} {method.label}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-[hsl(26,30%,45%)]">
                      {grams} g — {servingNoteFor(food, portionId)}
                    </div>
                  </div>

                  <GameButton
                    color="wood"
                    size="sm"
                    className={ICON_BUTTON}
                    title={groupId ? `Swap the ${food.label.toLowerCase()}` : `Change ${food.label}`}
                    aria-label={`Change ${food.label}`}
                    onClick={() => (groupId ? onEditCut(groupId) : onEditCourse(item.course))}
                  >
                    <Pencil className="h-4 w-4" />
                  </GameButton>
                  <GameButton
                    color="red"
                    size="sm"
                    className={ICON_BUTTON}
                    title={`Remove ${food.label}`}
                    aria-label={`Remove ${food.label}`}
                    onClick={() => {
                      sfx.claim();
                      onRemove(item);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </GameButton>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
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
                      <span className="font-display text-[9px] font-bold uppercase leading-none">
                        {p.label.split(" ")[0]}
                      </span>
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
                    <label className="flex h-14 items-center gap-1 rounded-xl border-2 border-[hsl(33,75%,28%)] bg-[hsl(40,50%,96%)] px-2">
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
                        className="w-14 bg-transparent font-display text-sm font-bold text-[hsl(26,50%,20%)] focus:outline-none"
                      />
                      <span className="font-display text-xs font-bold text-[hsl(26,35%,40%)]">g</span>
                    </label>
                  )}

                  <span className="ml-auto flex items-center gap-2">
                    <span className="rounded-lg border-2 border-[hsl(6,55%,30%)] bg-[hsl(6,70%,62%)] px-2 py-0.5 font-display text-xs font-bold text-white">
                      {kcal}
                    </span>
                    <span className="rounded-lg border-2 border-[hsl(178,50%,18%)] bg-[hsl(178,48%,44%)] px-2 py-0.5 font-display text-xs font-bold text-white">
                      {protein}g
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / change a whole course. Same buttons whether the meal is empty or
          full, so "I forgot the rice" is one tap from anywhere in the run. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {courses.map(({ course, label }) => (
          <GameButton
            key={course}
            color="wood"
            size="md"
            className={ACTION_BUTTON_SM}
            onClick={() => {
              sfx.claim();
              onEditCourse(course);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            {label}
          </GameButton>
        ))}
      </div>

      <div
        ref={totalRef}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border-2 border-[hsl(28,35%,45%)] bg-[hsl(40,40%,90%)] px-4 py-2"
      >
        <span className="font-display text-sm font-bold text-[hsl(26,50%,20%)]">Meal total</span>
        <span className="font-display text-lg font-bold text-[hsl(6,62%,45%)]">{totals.kcal} kcal</span>
        <span className="font-display text-lg font-bold text-[hsl(178,54%,30%)]">{totals.protein}g protein</span>
      </div>

      <div className="flex justify-center">
        <GameButton
          color="gold"
          size="lg"
          className={ACTION_BUTTON}
          onClick={() => {
            sfx.milestone();
            onConfirm();
          }}
        >
          {confirmLabel}
          <ArrowRight className="h-5 w-5" />
        </GameButton>
      </div>
    </div>
  );
};

export default MealScreen;
