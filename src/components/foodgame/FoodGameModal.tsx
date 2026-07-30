import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import WelcomeScreen from "./WelcomeScreen";
import MealPickerScreen from "./MealPickerScreen";
import QuestionScreen from "./QuestionScreen";
import PlateScreen from "./PlateScreen";
import SummaryScreen from "./SummaryScreen";
import {
  MEALS,
  totalMacros,
  type DiaryEntry,
  type Macros,
  type MealId,
  type PortionId,
} from "@/lib/foodGame/foods";
import {
  NONE_SIDE,
  currentStep,
  draftEntries,
  emptyDraft,
  hasAnyAnswer,
  rewind,
  type MealDraft,
  type Step,
} from "@/lib/foodGame/flow";
import { cn } from "@/lib/utils";

type Phase = "welcome" | "meals" | "play" | "summary";

interface FoodGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Daily targets, used for the goal bars on the summary. */
  goals?: { calories?: number | null; protein?: number | null };
  /** Writes the run's totals onto today's log. Omitted = summary has no save. */
  onSave?: (totals: Macros) => Promise<void> | void;
}

/** Restore a multi-select step's answer when the player walks back into it. */
const pendingFor = (draft: MealDraft, step: Step): string[] => {
  switch (step.kind) {
    case "protein":
      return draft.proteinGroupIds ?? [];
    case "sides":
      return draft.sideIds ?? [];
    case "picker":
      return draft.itemIds ?? [];
    default:
      return [];
  }
};

/**
 * The Food Track mini-game. A full-screen takeover that walks the player from
 * a title screen, through a question-per-screen build of each meal they ate,
 * to a level-complete summary with the day's calories and protein.
 *
 * State lives here: which meals are in play, a {@link MealDraft} per meal, and
 * the in-progress selection for multi-answer steps. The step machine in
 * `lib/foodGame/flow` decides what to ask next from the draft alone, so Back
 * is just "undo the last answer".
 */
const FoodGameModal = ({ open, onOpenChange, goals, onSave }: FoodGameModalProps) => {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [selectedMeals, setSelectedMeals] = useState<MealId[]>([]);
  const [mealIndex, setMealIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, MealDraft>>({});
  const [pending, setPending] = useState<string[]>([]);

  const reset = useCallback(() => {
    setPhase("welcome");
    setSelectedMeals([]);
    setMealIndex(0);
    setDrafts({});
    setPending([]);
  }, []);

  // Each opening is a fresh run — nobody wants yesterday's half-built plate.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const mealId = selectedMeals[mealIndex];
  const draft = mealId ? drafts[mealId] : undefined;
  const step = draft ? currentStep(draft) : null;

  const allEntries: DiaryEntry[] = useMemo(
    () => selectedMeals.flatMap((id) => (drafts[id] ? draftEntries(drafts[id]) : [])),
    [selectedMeals, drafts],
  );
  const runningTotals = useMemo(() => totalMacros(allEntries), [allEntries]);

  // ---- navigation ----------------------------------------------------------

  const startMeals = () => {
    const seeded: Record<string, MealDraft> = {};
    selectedMeals.forEach((id) => (seeded[id] = emptyDraft(id)));
    setDrafts(seeded);
    setMealIndex(0);
    setPending([]);
    setPhase("play");
  };

  /** Move to the next meal, or finish the run. */
  const nextMeal = useCallback(() => {
    setPending([]);
    if (mealIndex + 1 >= selectedMeals.length) setPhase("summary");
    else setMealIndex(mealIndex + 1);
  }, [mealIndex, selectedMeals.length]);

  /**
   * Store an updated draft. If it leaves nothing left to ask (the player
   * skipped every course), roll straight on to the next meal.
   */
  const commit = useCallback(
    (next: MealDraft) => {
      setDrafts((d) => ({ ...d, [next.mealId]: next }));
      setPending([]);
      if (currentStep(next).kind === "done") nextMeal();
    },
    [nextMeal],
  );

  const goBack = () => {
    if (phase === "meals") {
      setPhase("welcome");
      return;
    }
    if (phase !== "play" || !draft) return;

    // At a meal's first question, Back leaves the meal entirely.
    if (!hasAnyAnswer(draft)) {
      if (mealIndex === 0) {
        setPhase("meals");
        setPending([]);
        return;
      }
      const prevId = selectedMeals[mealIndex - 1];
      // Rewind the previous meal past its "done" state so there's something to show.
      let prev = drafts[prevId];
      while (prev && currentStep(prev).kind === "done" && hasAnyAnswer(prev)) prev = rewind(prev);
      setDrafts((d) => ({ ...d, [prevId]: prev }));
      setPending(pendingFor(drafts[prevId], currentStep(prev)));
      setMealIndex(mealIndex - 1);
      return;
    }

    const next = rewind(draft);
    setPending(pendingFor(draft, currentStep(next)));
    setDrafts((d) => ({ ...d, [mealId]: next }));
  };

  // ---- answering -----------------------------------------------------------

  const pick = (id: string) => {
    if (!draft || !step) return;
    const next: MealDraft = { ...draft, cuts: { ...draft.cuts }, methods: { ...draft.methods } };

    switch (step.kind) {
      case "staple":
        next.stapleId = id;
        break;
      case "cut":
        next.cuts[step.groupId] = id;
        break;
      case "method":
        next.methods[step.groupId] = id;
        break;
      case "sides":
        // Only reachable via the exclusive "No sides" tile.
        if (id === NONE_SIDE) next.sideIds = [];
        break;
      default:
        return;
    }
    commit(next);
  };

  const toggle = (id: string) => {
    setPending((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const confirmMulti = () => {
    if (!draft || !step) return;
    const next: MealDraft = { ...draft, cuts: { ...draft.cuts }, methods: { ...draft.methods } };

    switch (step.kind) {
      case "protein": {
        next.proteinGroupIds = [...pending];
        // Dropping a family on the way back should drop its answers too.
        for (const groupId of Object.keys(next.cuts)) {
          if (!pending.includes(groupId)) {
            delete next.cuts[groupId];
            delete next.methods[groupId];
          }
        }
        break;
      }
      case "sides":
        next.sideIds = pending.filter((id) => id !== NONE_SIDE);
        break;
      case "picker":
        next.itemIds = [...pending];
        break;
      default:
        return;
    }
    commit(next);
  };

  const setPortion = (foodId: string, portionId: PortionId) => {
    if (!draft) return;
    setDrafts((d) => ({
      ...d,
      [draft.mealId]: { ...draft, portions: { ...draft.portions, [foodId]: portionId } },
    }));
  };

  // ---- chrome --------------------------------------------------------------

  const meal = MEALS.find((m) => m.id === mealId);
  const showChrome = phase === "play";
  const progressPct = selectedMeals.length ? ((mealIndex + (step?.kind === "plate" ? 0.85 : 0.35)) / selectedMeals.length) * 100 : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            "game-panel-wood fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden p-0",
            "focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <Dialog.Title className="sr-only">GGLVLUP Food Track</Dialog.Title>

          {showChrome && (
            <header className="flex shrink-0 items-center gap-3 border-b-2 border-[hsl(22,45%,12%)] bg-[hsl(24,40%,20%)] px-3 py-2">
              <GameButton color="wood" size="sm" onClick={goBack} title="Back" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </GameButton>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-display text-sm font-bold text-[hsl(42,95%,72%)]">
                    {meal?.sprite} {meal?.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-[hsl(38,25%,65%)]">
                    Meal {mealIndex + 1} of {selectedMeals.length}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full border border-[hsl(22,45%,12%)] bg-[hsl(22,40%,14%)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[hsl(40,90%,58%)] to-[hsl(68,46%,50%)] transition-[width] duration-500"
                    style={{ width: `${Math.min(100, progressPct)}%` }}
                  />
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <span className="rounded-lg border-2 border-[hsl(6,55%,30%)] bg-[hsl(6,70%,62%)] px-2 py-0.5 font-display text-xs font-bold text-white">
                  {runningTotals.kcal} kcal
                </span>
                <span className="rounded-lg border-2 border-[hsl(178,50%,18%)] bg-[hsl(178,48%,44%)] px-2 py-0.5 font-display text-xs font-bold text-white">
                  {runningTotals.protein}g P
                </span>
              </div>

              <Dialog.Close asChild>
                <GameButton color="red" size="sm" title="Quit game" aria-label="Quit game">
                  <X className="h-4 w-4" />
                </GameButton>
              </Dialog.Close>
            </header>
          )}

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              phase === "welcome" ? "" : "bg-[hsl(40,45%,92%)]",
            )}
          >
            {phase === "welcome" && (
              <WelcomeScreen onStart={() => setPhase("meals")} onExit={() => onOpenChange(false)} />
            )}

            {phase === "meals" && (
              <MealPickerScreen
                selected={selectedMeals}
                onToggle={(id) =>
                  setSelectedMeals((prev) =>
                    prev.includes(id)
                      ? prev.filter((m) => m !== id)
                      : // Keep the canonical meal order regardless of tap order.
                        MEALS.filter((m) => m.id === id || prev.includes(m.id)).map((m) => m.id),
                  )
                }
                onConfirm={startMeals}
              />
            )}

            {phase === "play" && draft && step && step.kind === "plate" && (
              <PlateScreen draft={draft} onSetPortion={setPortion} onConfirm={nextMeal} />
            )}

            {phase === "play" && draft && step && step.kind !== "plate" && step.kind !== "done" && (
              <QuestionScreen
                key={`${mealId}-${step.kind}-${"groupId" in step ? step.groupId : ""}`}
                step={step}
                pending={pending}
                onPick={pick}
                onToggle={toggle}
                onConfirm={confirmMulti}
              />
            )}

            {phase === "summary" && (
              <SummaryScreen
                entries={allEntries}
                goals={goals}
                onSave={onSave}
                onPlayAgain={reset}
                onClose={() => onOpenChange(false)}
              />
            )}
          </div>

          {phase === "meals" && (
            <footer className="shrink-0 border-t-2 border-[hsl(22,45%,12%)] bg-[hsl(24,40%,20%)] px-3 py-2">
              <GameButton color="wood" size="sm" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
                Back to title
              </GameButton>
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default FoodGameModal;
