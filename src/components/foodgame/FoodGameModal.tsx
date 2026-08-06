import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import WelcomeScreen from "./WelcomeScreen";
import MealPickerScreen from "./MealPickerScreen";
import MealTabs from "./MealTabs";
import QuestionScreen from "./QuestionScreen";
import MealScreen from "./MealScreen";
import SummaryScreen from "./SummaryScreen";
import FoodShareModal from "./FoodShareModal";
import { ACTION_BUTTON, ICON_BUTTON } from "./ui";
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
  editCutStep,
  editMethodStep,
  editStep,
  emptyDraft,
  hasAnyAnswer,
  isMealBuilt,
  removePlateItem,
  rewind,
  type Course,
  type MealDraft,
  type PlateItem,
  type Step,
} from "@/lib/foodGame/flow";
import { clearRun, loadRun, saveRun, type SavedRun } from "@/lib/foodGame/persist";
import type { FoodShareData } from "@/lib/foodGame/shareCard";
import { cn, formatDateInputValue } from "@/lib/utils";

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
 * The Food Track mini-game. A full-screen takeover that walks the player from a
 * title screen, through a question-per-screen build of each meal they ate, to a
 * level-complete summary with the day's calories and protein.
 *
 * State lives here: a {@link MealDraft} per meal in play, the in-progress
 * selection for multi-answer steps, and which course (if any) is being re-opened
 * for editing. The step machine in `lib/foodGame/flow` decides what to ask next
 * from the draft alone, so Back is just "undo the last answer" and an edit is
 * just "ask this question again".
 *
 * Two things make it a diary rather than a quiz. The run is mirrored to
 * localStorage under today's date, so closing the modal to go and eat lunch
 * leaves a Continue waiting rather than an empty plate — and it clears itself
 * when the date stops matching. And every meal is reachable from every screen
 * via the tab strip, in any order, added or dropped at will, because nobody
 * knows at breakfast what they'll have eaten by nine.
 */
const FoodGameModal = ({ open, onOpenChange, goals, onSave }: FoodGameModalProps) => {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [drafts, setDrafts] = useState<Record<string, MealDraft>>({});
  const [activeMeal, setActiveMeal] = useState<MealId | null>(null);
  /** A course re-opened from the meal editor; overrides what the machine asks. */
  const [editing, setEditing] = useState<Step | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  /** True once the run is worth saving — gates the mirror to localStorage. */
  const [live, setLive] = useState(false);
  const [saved, setSaved] = useState<SavedRun | null>(null);
  const [showShare, setShowShare] = useState(false);

  /** Everything except the saved run — used both by Reset and by each opening. */
  const blank = useCallback(() => {
    setPhase("welcome");
    setDrafts({});
    setActiveMeal(null);
    setEditing(null);
    setPending([]);
    setShowShare(false);
    setLive(false);
  }, []);

  // Each opening starts on the title screen, but *not* from zero: a run saved
  // earlier today is loaded and offered back as Continue rather than binned.
  useEffect(() => {
    if (!open) return;
    setSaved(loadRun());
    blank();
  }, [open, blank]);

  const mealsInPlay = useMemo(() => MEALS.filter((m) => drafts[m.id]).map((m) => m.id), [drafts]);
  const draft = activeMeal ? drafts[activeMeal] : undefined;
  const step = editing ?? (draft ? currentStep(draft) : null);

  const entriesByMeal = useMemo(
    () =>
      Object.fromEntries(
        mealsInPlay.map((id) => [id, drafts[id] ? draftEntries(drafts[id]) : []]),
      ) as Record<MealId, DiaryEntry[]>,
    [mealsInPlay, drafts],
  );
  const allEntries: DiaryEntry[] = useMemo(
    () => mealsInPlay.flatMap((id) => entriesByMeal[id] ?? []),
    [mealsInPlay, entriesByMeal],
  );
  const runningTotals = useMemo(() => totalMacros(allEntries), [allEntries]);
  const mealTotals = useMemo(
    () =>
      Object.fromEntries(
        mealsInPlay.map((id) => [id, totalMacros(entriesByMeal[id] ?? [])]),
      ) as Partial<Record<MealId, Macros>>,
    [mealsInPlay, entriesByMeal],
  );

  // Mirror the run on every change. Cheap (a handful of small objects) and
  // unconditional, so there is no "did I remember to save that" path.
  useEffect(() => {
    if (!live) return;
    saveRun({ drafts, activeMeal, finished: phase === "summary" });
  }, [live, drafts, activeMeal, phase]);

  // ---- navigation ----------------------------------------------------------

  /** Open a meal, adding it to the run if it wasn't already in it. */
  const openMeal = useCallback((mealId: MealId) => {
    setDrafts((d) => (d[mealId] ? d : { ...d, [mealId]: emptyDraft(mealId) }));
    setActiveMeal(mealId);
    setEditing(null);
    setPending([]);
    setPhase("play");
    setLive(true);
  }, []);

  /** Toggle a meal in or out of the run from the level-select screen. */
  const toggleMeal = (mealId: MealId) => {
    setLive(true);
    setDrafts((d) => {
      if (!d[mealId]) return { ...d, [mealId]: emptyDraft(mealId) };
      const next = { ...d };
      delete next[mealId];
      return next;
    });
  };

  /** Drop a meal and everything logged against it. */
  const removeMeal = (mealId: MealId) => {
    const remaining = mealsInPlay.filter((id) => id !== mealId);
    setDrafts((d) => {
      const next = { ...d };
      delete next[mealId];
      return next;
    });
    setEditing(null);
    setPending([]);
    // An empty run has nowhere to be, so fall back to the level select.
    if (remaining.length === 0) {
      setActiveMeal(null);
      setPhase("meals");
      return;
    }
    if (activeMeal === mealId) setActiveMeal(remaining[0]);
  };

  const goSummary = () => {
    setEditing(null);
    setPending([]);
    setPhase("summary");
    setLive(true);
  };

  const startMeals = () => {
    const first = mealsInPlay[0];
    if (first) openMeal(first);
  };

  const continueRun = () => {
    if (!saved) return;
    const restored = saved.drafts;
    const first = MEALS.find((m) => restored[m.id])?.id ?? null;
    const landing = saved.activeMeal && restored[saved.activeMeal] ? saved.activeMeal : first;
    setDrafts(restored);
    setActiveMeal(landing);
    setEditing(null);
    setPending([]);
    setPhase(saved.finished ? "summary" : landing ? "play" : "meals");
    setLive(true);
  };

  /** Throw the day away and start over — the manual half of the reset rule. */
  const resetRun = useCallback(() => {
    clearRun();
    setSaved(null);
    blank();
  }, [blank]);

  const goBack = () => {
    // An abandoned edit must leave the meal exactly as it was, and it does:
    // nothing was written when the question was re-opened.
    if (editing) {
      setEditing(null);
      setPending([]);
      return;
    }
    if (phase === "meals") {
      setPhase("welcome");
      return;
    }
    if (phase === "summary") {
      const landing = activeMeal && drafts[activeMeal] ? activeMeal : mealsInPlay[0];
      if (landing) openMeal(landing);
      else setPhase("meals");
      return;
    }
    if (phase !== "play" || !draft || !activeMeal) return;

    // Back stays what it always was — undo the last answer, walking the exact
    // path taken. The editor's Change buttons are the way to reach *one*
    // decision without unpicking the ones after it; Back is the way to retrace.
    if (hasAnyAnswer(draft)) {
      const next = rewind(draft);
      setPending(pendingFor(draft, currentStep(next)));
      setDrafts((d) => ({ ...d, [activeMeal]: next }));
      return;
    }

    // At a meal's first question, Back leaves the meal entirely.
    const index = mealsInPlay.indexOf(activeMeal);
    if (index > 0) openMeal(mealsInPlay[index - 1]);
    else setPhase("meals");
  };

  // ---- answering -----------------------------------------------------------

  /** Store an updated draft and leave any edit mode behind. */
  const commit = useCallback((next: MealDraft) => {
    setDrafts((d) => ({ ...d, [next.mealId]: next }));
    setPending([]);
    setEditing(null);
  }, []);

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

  // ---- editing a built meal ------------------------------------------------

  const editCourse = (course: Course) => {
    if (!draft) return;
    const { step: next, pending: seed } = editStep(draft, course);
    setPending(seed);
    setEditing(next);
  };

  const editCut = (groupId: string) => {
    if (!draft) return;
    setPending([]);
    setEditing(editCutStep(draft, groupId));
  };

  const editMethod = (groupId: string) => {
    if (!draft) return;
    const next = editMethodStep(draft, groupId);
    if (!next) return;
    setPending([]);
    setEditing(next);
  };

  const removeItem = (item: PlateItem) => {
    if (!draft) return;
    commit(removePlateItem(draft, item));
  };

  /**
   * Portion and weighed-grams move together: picking "I weighed it" seeds the
   * input with whatever was on screen, and typing keeps the portion on custom.
   * Both live in one update so neither clobbers the other.
   */
  const setPortion = (foodId: string, portionId: PortionId, customGrams?: number) => {
    if (!draft) return;
    setDrafts((d) => {
      const current = d[draft.mealId] ?? draft;
      return {
        ...d,
        [draft.mealId]: {
          ...current,
          portions: { ...current.portions, [foodId]: portionId },
          customGrams:
            customGrams == null
              ? current.customGrams
              : { ...current.customGrams, [foodId]: customGrams },
        },
      };
    });
  };

  // ---- chrome --------------------------------------------------------------

  const meal = MEALS.find((m) => m.id === activeMeal);
  const mealIndex = activeMeal ? mealsInPlay.indexOf(activeMeal) : -1;
  const nextMealId = mealIndex >= 0 ? mealsInPlay[mealIndex + 1] : undefined;
  const nextMeal = MEALS.find((m) => m.id === nextMealId);
  const showChrome = phase === "play" || phase === "summary";

  // Progress is "meals finished", not "questions answered": the run is no
  // longer a fixed-length corridor, so the only honest denominator is how many
  // meals are in play right now.
  const builtCount = mealsInPlay.filter((id) => isMealBuilt(drafts[id])).length;
  const progressPct = mealsInPlay.length ? (builtCount / mealsInPlay.length) * 100 : 0;

  const shareData: FoodShareData = useMemo(
    () => ({
      date: formatDateInputValue(),
      kcal: runningTotals.kcal,
      protein: runningTotals.protein,
      itemCount: allEntries.length,
      meals: MEALS.filter((m) => (entriesByMeal[m.id] ?? []).length > 0).map((m) => {
        const totals = totalMacros(entriesByMeal[m.id] ?? []);
        return { sprite: m.sprite, label: m.label, kcal: totals.kcal, protein: totals.protein };
      }),
      goals,
    }),
    [runningTotals, allEntries.length, entriesByMeal, goals],
  );

  return (
    <>
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
              <header className="shrink-0 space-y-2 border-b-2 border-[hsl(22,45%,12%)] bg-[hsl(24,40%,20%)] px-3 py-2">
                <div className="flex items-center gap-3">
                  <GameButton
                    color="wood"
                    size="sm"
                    className={ICON_BUTTON}
                    onClick={goBack}
                    title="Back"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </GameButton>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-display text-sm font-bold text-[hsl(42,95%,72%)]">
                        {phase === "summary" ? "🏆 Your day" : `${meal?.sprite} ${meal?.label}`}
                      </span>
                      {phase === "play" && mealIndex >= 0 && (
                        <span className="shrink-0 text-[11px] font-bold text-[hsl(38,25%,65%)]">
                          Meal {mealIndex + 1} of {mealsInPlay.length}
                        </span>
                      )}
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
                    <GameButton
                      color="red"
                      size="sm"
                      className={ICON_BUTTON}
                      title="Close — your progress is saved"
                      aria-label="Close game"
                    >
                      <X className="h-4 w-4" />
                    </GameButton>
                  </Dialog.Close>
                </div>

                <MealTabs
                  inPlay={mealsInPlay}
                  active={phase === "summary" ? "summary" : activeMeal}
                  totals={mealTotals}
                  onOpen={openMeal}
                  onRemove={removeMeal}
                  onSummary={goSummary}
                />
              </header>
            )}

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto",
                phase === "welcome" ? "" : "bg-[hsl(40,45%,92%)]",
              )}
            >
              {phase === "welcome" && (
                <WelcomeScreen
                  resume={
                    saved
                      ? {
                          meals: Object.keys(saved.drafts).length,
                          kcal: totalMacros(
                            Object.values(saved.drafts).flatMap((d) => draftEntries(d)),
                          ).kcal,
                          finished: saved.finished,
                        }
                      : null
                  }
                  onStart={() => setPhase("meals")}
                  onContinue={continueRun}
                  onReset={resetRun}
                  onExit={() => onOpenChange(false)}
                />
              )}

              {phase === "meals" && (
                <MealPickerScreen
                  selected={mealsInPlay}
                  started={live && mealsInPlay.length > 0 && builtCount > 0}
                  onToggle={toggleMeal}
                  onConfirm={startMeals}
                />
              )}

              {phase === "play" && draft && step && (step.kind === "plate" || step.kind === "done") && (
                <MealScreen
                  key={draft.mealId}
                  draft={draft}
                  onSetPortion={setPortion}
                  onEditCourse={editCourse}
                  onEditCut={editCut}
                  onEditMethod={editMethod}
                  onRemove={removeItem}
                  onConfirm={() => (nextMealId ? openMeal(nextMealId) : goSummary())}
                  confirmLabel={nextMeal ? `Next: ${nextMeal.label}` : "Finish — see my day"}
                />
              )}

              {phase === "play" && draft && step && step.kind !== "plate" && step.kind !== "done" && (
                <QuestionScreen
                  key={`${draft.mealId}-${step.kind}-${"groupId" in step ? step.groupId : ""}`}
                  step={step}
                  pending={pending}
                  editing={editing != null}
                  onPick={pick}
                  onToggle={toggle}
                  onConfirm={confirmMulti}
                  onCancel={() => {
                    setEditing(null);
                    setPending([]);
                  }}
                />
              )}

              {phase === "summary" && (
                <SummaryScreen
                  entries={allEntries}
                  goals={goals}
                  onSave={onSave}
                  onShare={() => setShowShare(true)}
                  onEdit={goBack}
                  onReset={resetRun}
                  onClose={() => onOpenChange(false)}
                />
              )}
            </div>

            {phase === "meals" && (
              <footer className="flex shrink-0 justify-center border-t-2 border-[hsl(22,45%,12%)] bg-[hsl(24,40%,20%)] px-3 py-2">
                <GameButton color="wood" size="md" className={ACTION_BUTTON} onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to title
                </GameButton>
              </footer>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* A sibling of the game, not a child: dismissing the share sheet has to
          drop the player back on their summary, not end the run. */}
      <FoodShareModal open={showShare} onOpenChange={setShowShare} data={shareData} />
    </>
  );
};

export default FoodGameModal;
