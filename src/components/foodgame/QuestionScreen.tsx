import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, Undo2 } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import ChoiceCard from "./ChoiceCard";
import { ACTION_BUTTON } from "./ui";
import { COOK_METHODS, PROTEIN_GROUPS, lookupFood } from "@/lib/foodGame/foods";
import { NONE_SIDE, optionsForStep, stepPrompt, type Step } from "@/lib/foodGame/flow";
import { sfx } from "@/lib/sfx";

interface QuestionScreenProps {
  step: Step;
  /**
   * Multi-select answers in progress. They live in the parent rather than the
   * draft because writing them into the draft would satisfy the step machine
   * and skip the question out from under the player mid-tap.
   */
  pending: string[];
  /**
   * The question was re-opened from a built meal rather than reached in
   * sequence. Only changes the way out: an edit can be abandoned, so it offers
   * a cancel that a first pass has no use for.
   */
  editing?: boolean;
  /** Single-select steps commit and advance immediately. */
  onPick: (id: string) => void;
  /** Multi-select steps toggle, then commit via the Continue button. */
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Multi-select steps let the player tap several answers before continuing. */
const MULTI_STEPS = new Set<Step["kind"]>(["protein", "sides", "picker"]);

/** Per-serving preview, so the player learns the cost of each choice as they go. */
const servingDetail = (kcal100: number, serving: number, protein100: number, note: string) => {
  if (serving === 0) return note;
  const kcal = Math.round((kcal100 * serving) / 100);
  const protein = Math.round((protein100 * serving) / 10) / 10;
  return `${note} · ${kcal} kcal · ${protein}g P`;
};

/**
 * One question of a meal. Renders whichever catalogue the current step calls
 * for — carbs, the protein critters, cuts, cooking methods, sides or the
 * snack/drink picker — and animates the whole block in whenever the step
 * changes so the game reads as a sequence of screens rather than a form.
 */
const QuestionScreen = ({
  step,
  pending,
  editing = false,
  onPick,
  onToggle,
  onConfirm,
  onCancel,
}: QuestionScreenProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { title, hint } = stepPrompt(step);
  const isMulti = MULTI_STEPS.has(step.kind);

  // A key that changes on every distinct question, driving the entrance tween.
  const stepKey = `${step.kind}:${"groupId" in step ? step.groupId : step.mealId}`;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .from("[data-q-head]", { y: -18, opacity: 0, duration: 0.35, ease: "power2.out" })
        .from(
          "[data-q-card]",
          { y: 34, opacity: 0, scale: 0.88, duration: 0.42, stagger: 0.055, ease: "back.out(2)" },
          0.08,
        )
        .from("[data-q-foot]", { y: 16, opacity: 0, duration: 0.3, ease: "power2.out" }, 0.25);
    }, rootRef);
    return () => ctx.revert();
  }, [stepKey]);

  const single = (id: string) => {
    sfx.claim();
    onPick(id);
  };

  const multi = (id: string) => {
    sfx.claim();
    onToggle(id);
  };

  // ---- which cards to draw -------------------------------------------------

  let cards: JSX.Element[];

  if (step.kind === "protein") {
    cards = PROTEIN_GROUPS.map((group) => (
      <div key={group.id} data-q-card>
        <ChoiceCard
          label={group.label}
          sprite={group.critter}
          taunt={group.taunt}
          detail={`${group.cuts.length} cuts`}
          multi
          selected={pending.includes(group.id)}
          onSelect={() => multi(group.id)}
        />
      </div>
    ));
  } else if (step.kind === "method") {
    const food = lookupFood(step.foodId);
    cards = COOK_METHODS.map((method) => (
      <div key={method.id} data-q-card>
        <ChoiceCard
          label={method.label}
          sprite={method.sprite}
          detail={
            food
              ? `${method.blurb} (~${Math.round((food.kcal100 * food.serving * method.kcalMult) / 100)} kcal)`
              : method.blurb
          }
          onSelect={() => single(method.id)}
        />
      </div>
    ));
  } else {
    const options = optionsForStep(step);

    cards = options.map((food) => (
      <div key={food.id} data-q-card>
        <ChoiceCard
          label={food.label}
          sprite={food.sprite}
          detail={servingDetail(food.kcal100, food.serving, food.protein100, food.servingNote)}
          multi={isMulti}
          selected={isMulti && pending.includes(food.id)}
          onSelect={() => {
            // "No sides" is exclusive — picking it clears everything else.
            if (isMulti && food.id === NONE_SIDE) {
              sfx.claim();
              onPick(NONE_SIDE);
              return;
            }
            if (isMulti) multi(food.id);
            else single(food.id);
          }}
        />
      </div>
    ));
  }

  // ---- Continue label ------------------------------------------------------

  const chosenCount = pending.length;

  const skipLabel =
    step.kind === "protein" ? "No protein — skip" : step.kind === "picker" ? "Nothing — skip" : "None — skip";

  return (
    <div ref={rootRef} className="space-y-6 p-5 sm:p-7">
      <div data-q-head className="text-center">
        <h3 className="font-display text-xl font-bold text-[hsl(26,50%,20%)] sm:text-2xl">{title}</h3>
        {hint && <p className="mt-1 text-sm font-bold text-[hsl(26,30%,42%)]">{hint}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{cards}</div>

      {(isMulti || editing) && (
        <div data-q-foot className="flex flex-col items-center justify-center gap-2 pt-1 sm:flex-row">
          {isMulti && (
            <GameButton
              color={chosenCount > 0 ? "gold" : "wood"}
              size="lg"
              className={ACTION_BUTTON}
              onClick={() => {
                if (chosenCount > 0) sfx.claimAll();
                else sfx.claim();
                onConfirm();
              }}
            >
              {chosenCount > 0 ? `Continue (${chosenCount})` : skipLabel}
              <ArrowRight className="h-5 w-5" />
            </GameButton>
          )}
          {editing && (
            <GameButton color="wood" size="lg" className={ACTION_BUTTON} onClick={onCancel}>
              <Undo2 className="h-5 w-5" />
              Cancel
            </GameButton>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionScreen;
