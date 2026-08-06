// ---------------------------------------------------------------------------
// Food Track game — the question machine.
//
// A meal is answered by filling in a MealDraft. `currentStep` reads the draft
// and decides what to ask next, so the sequence stays correct no matter how
// many proteins the player picked (or how far back they rewind). Pure
// functions only — the modal owns the React state.
// ---------------------------------------------------------------------------

import {
  COOK_METHODS,
  DRINKS,
  MealId,
  PROTEIN_GROUPS,
  PortionId,
  SIDES,
  SNACKS,
  computeMacros,
  lookupFood,
  lookupMethod,
  staplesForMeal,
  type DiaryEntry,
  type FoodItem,
} from "./foods";

/** Sentinel ids that mean "I skipped this course". */
export const NONE_STAPLE = "none-staple";
export const NONE_SIDE = "none-side";

export type Step =
  | { kind: "staple"; mealId: MealId }
  | { kind: "protein"; mealId: MealId }
  | { kind: "cut"; mealId: MealId; groupId: string }
  | { kind: "method"; mealId: MealId; groupId: string; foodId: string }
  | { kind: "sides"; mealId: MealId }
  | { kind: "picker"; mealId: MealId }
  | { kind: "plate"; mealId: MealId }
  | { kind: "done"; mealId: MealId };

/**
 * A meal in progress. `undefined` means "not answered yet" and is what drives
 * the machine forward; an empty array is a real answer meaning "none of these".
 */
export interface MealDraft {
  mealId: MealId;
  stapleId?: string;
  /** Protein families chosen, in pick order. */
  proteinGroupIds?: string[];
  /** groupId → chosen cut's food id. */
  cuts: Record<string, string>;
  /** groupId → cooking method id. */
  methods: Record<string, string>;
  sideIds?: string[];
  /** Snack/drink selections (those meals skip straight to a picker). */
  itemIds?: string[];
  /** foodId → portion size. Defaults to "regular" until the player changes it. */
  portions: Record<string, PortionId>;
  /** foodId → weight the player typed in; only read when the portion is "custom". */
  customGrams: Record<string, number>;
}

export function emptyDraft(mealId: MealId): MealDraft {
  return { mealId, cuts: {}, methods: {}, portions: {}, customGrams: {} };
}

/** Snacks and drinks are a flat multi-pick, not a build-a-plate. */
export const isPickerMeal = (mealId: MealId) => mealId === "snacks" || mealId === "drinks";

/** The catalogue a picker meal chooses from. */
export function pickerOptions(mealId: MealId): FoodItem[] {
  return mealId === "drinks" ? DRINKS : SNACKS;
}

/** What to ask next for this draft. */
export function currentStep(draft: MealDraft): Step {
  const { mealId } = draft;

  if (isPickerMeal(mealId)) {
    if (draft.itemIds === undefined) return { kind: "picker", mealId };
    if (draft.itemIds.length === 0) return { kind: "done", mealId };
    return { kind: "plate", mealId };
  }

  if (draft.stapleId === undefined) return { kind: "staple", mealId };
  if (draft.proteinGroupIds === undefined) return { kind: "protein", mealId };

  // Each protein family is a two-beat mini-quest: which cut, then how cooked.
  for (const groupId of draft.proteinGroupIds) {
    const foodId = draft.cuts[groupId];
    if (!foodId) return { kind: "cut", mealId, groupId };
    if (!draft.methods[groupId]) return { kind: "method", mealId, groupId, foodId };
  }

  if (draft.sideIds === undefined) return { kind: "sides", mealId };
  if (plateItems(draft).length === 0) return { kind: "done", mealId };
  return { kind: "plate", mealId };
}

/** Whether anything has been answered — i.e. whether Back stays in this meal. */
export function hasAnyAnswer(draft: MealDraft): boolean {
  return isPickerMeal(draft.mealId) ? draft.itemIds !== undefined : draft.stapleId !== undefined;
}

/** Undo the most recent answer, so Back walks the exact path taken. */
export function rewind(draft: MealDraft): MealDraft {
  const next: MealDraft = { ...draft, cuts: { ...draft.cuts }, methods: { ...draft.methods } };
  const step = currentStep(draft);

  // On the plate screen the previous answer is the last question asked, so
  // clearing the plate alone isn't enough — fall through to the same ladder.
  if (step.kind === "plate" || step.kind === "done") {
    if (isPickerMeal(next.mealId)) {
      next.itemIds = undefined;
      return next;
    }
    if (next.sideIds !== undefined) {
      next.sideIds = undefined;
      return next;
    }
  }

  if (isPickerMeal(next.mealId)) {
    next.itemIds = undefined;
    return next;
  }

  const groups = next.proteinGroupIds ?? [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupId = groups[i];
    if (next.methods[groupId]) {
      delete next.methods[groupId];
      return next;
    }
    if (next.cuts[groupId]) {
      delete next.cuts[groupId];
      return next;
    }
  }

  if (next.proteinGroupIds !== undefined) {
    next.proteinGroupIds = undefined;
    return next;
  }
  next.stapleId = undefined;
  return next;
}

/**
 * Which course a plated food came from. The meal editor groups its rows by
 * this, and it is what tells a "remove" tap which answer to unpick — the food
 * id alone isn't enough, since the same id can be a staple in one meal and a
 * snack in another.
 */
export type Course = "staple" | "protein" | "side" | "item";

export interface PlateItem {
  food: FoodItem;
  course: Course;
  /** The protein family this cut belongs to. Only set for `course: "protein"`. */
  groupId?: string;
  methodId?: string;
}

/**
 * Every food in this meal that needs a portion, in plate order: carbs, then
 * proteins, then sides (or just the picks, for snacks/drinks).
 */
export function plateItems(draft: MealDraft): PlateItem[] {
  if (isPickerMeal(draft.mealId)) {
    return (draft.itemIds ?? [])
      .map((id) => lookupFood(id))
      .filter((f): f is FoodItem => !!f)
      .map((food) => ({ food, course: "item" as const }));
  }

  const items: PlateItem[] = [];

  if (draft.stapleId && draft.stapleId !== NONE_STAPLE) {
    const food = lookupFood(draft.stapleId);
    if (food) items.push({ food, course: "staple" });
  }

  for (const groupId of draft.proteinGroupIds ?? []) {
    const food = lookupFood(draft.cuts[groupId] ?? "");
    if (food) items.push({ food, course: "protein", groupId, methodId: draft.methods[groupId] });
  }

  for (const sideId of draft.sideIds ?? []) {
    if (sideId === NONE_SIDE) continue;
    const food = lookupFood(sideId);
    if (food) items.push({ food, course: "side" });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Editing an answered meal
//
// Once a meal has been walked through, the player lands on its editor rather
// than being pushed onward, and everything below is what that screen acts
// through. Each helper unpicks one answer while leaving the rest of the draft —
// and crucially the step machine's invariants — intact, so `currentStep` keeps
// working on the result exactly as it does on a freshly-built draft.
//
// Portions are deliberately *not* cleared on removal: they are keyed by food id
// and only ever read for foods that are currently plated, so keeping them means
// re-adding something you removed by mistake brings its size back with it.
// ---------------------------------------------------------------------------

/** Drop one plated food, unpicking whichever answer put it there. */
export function removePlateItem(draft: MealDraft, item: PlateItem): MealDraft {
  const next: MealDraft = { ...draft, cuts: { ...draft.cuts }, methods: { ...draft.methods } };

  switch (item.course) {
    case "item":
      next.itemIds = (next.itemIds ?? []).filter((id) => id !== item.food.id);
      break;
    case "staple":
      // "No carbs" rather than undefined — undefined would re-ask the question.
      next.stapleId = NONE_STAPLE;
      break;
    case "protein":
      if (item.groupId) {
        next.proteinGroupIds = (next.proteinGroupIds ?? []).filter((id) => id !== item.groupId);
        delete next.cuts[item.groupId];
        delete next.methods[item.groupId];
      }
      break;
    case "side":
      next.sideIds = (next.sideIds ?? []).filter((id) => id !== item.food.id);
      break;
  }

  return next;
}

/**
 * Re-open one course for editing. Returns the step to ask, and the answers to
 * seed the multi-select with so the screen opens on what is already chosen.
 *
 * The draft itself is untouched: an edit that is abandoned must leave the meal
 * exactly as it was, which it can only do if nothing was cleared to ask.
 */
export function editStep(draft: MealDraft, course: Course): { step: Step; pending: string[] } {
  const { mealId } = draft;
  switch (course) {
    case "item":
      return { step: { kind: "picker", mealId }, pending: draft.itemIds ?? [] };
    case "staple":
      return { step: { kind: "staple", mealId }, pending: [] };
    case "protein":
      return { step: { kind: "protein", mealId }, pending: draft.proteinGroupIds ?? [] };
    case "side":
      return { step: { kind: "sides", mealId }, pending: draft.sideIds ?? [] };
  }
}

/** Re-ask how one already-chosen protein was cooked. */
export function editMethodStep(draft: MealDraft, groupId: string): Step | null {
  const foodId = draft.cuts[groupId];
  return foodId ? { kind: "method", mealId: draft.mealId, groupId, foodId } : null;
}

/** Re-ask which cut of an already-chosen protein family was eaten. */
export function editCutStep(draft: MealDraft, groupId: string): Step {
  return { kind: "cut", mealId: draft.mealId, groupId };
}

/**
 * Whether the meal has been walked through far enough to show its editor: every
 * question answered, so the only thing left is sizing and second thoughts.
 */
export function isMealBuilt(draft: MealDraft): boolean {
  const kind = currentStep(draft).kind;
  return kind === "plate" || kind === "done";
}

/** Turn a finished draft into diary lines with calories and protein filled in. */
export function draftEntries(draft: MealDraft): DiaryEntry[] {
  return plateItems(draft).map(({ food, methodId }) => {
    const portionId = draft.portions[food.id] ?? "regular";
    const { grams, kcal, protein } = computeMacros(food, portionId, methodId, draft.customGrams?.[food.id]);
    return {
      key: `${draft.mealId}:${food.id}`,
      mealId: draft.mealId,
      foodId: food.id,
      label: food.label,
      sprite: food.sprite,
      methodId,
      methodLabel: lookupMethod(methodId)?.label,
      portionId,
      grams,
      kcal,
      protein,
    };
  });
}

// ---------------------------------------------------------------------------
// Copy for each step — the "host" of the game show.
// ---------------------------------------------------------------------------

export function stepPrompt(step: Step): { title: string; hint: string } {
  switch (step.kind) {
    case "staple":
      return { title: "Pick your carbs", hint: "What did the rest of the plate sit on?" };
    case "protein":
      return { title: "Choose your victims", hint: "Tap everything you ate — they won't like it." };
    case "cut": {
      const group = PROTEIN_GROUPS.find((g) => g.id === step.groupId);
      return { title: `Which part of the ${group?.label.toLowerCase() ?? "protein"}?`, hint: "Different cuts, very different calories." };
    }
    case "method": {
      const food = lookupFood(step.foodId);
      return { title: `How was the ${food?.label.toLowerCase() ?? "protein"} cooked?`, hint: "This is where the hidden calories live." };
    }
    case "sides":
      return { title: "Any sides?", hint: "Pick as many as you had." };
    case "picker":
      return step.mealId === "drinks"
        ? { title: "What did you drink?", hint: "Everything counts — even the sneaky ones." }
        : { title: "What did you snack on?", hint: "Be honest. The bar knows." };
    case "plate":
      // Doubles as the meal editor's heading, so the hint names both jobs.
      return { title: "Size it up", hint: "How much of each did you have? Change or remove anything below." };
    case "done":
      return { title: "Meal cleared!", hint: "" };
  }
}

/** Options for a single-select step. */
export function optionsForStep(step: Step): FoodItem[] {
  switch (step.kind) {
    case "staple":
      return staplesForMeal(step.mealId);
    case "cut":
      return PROTEIN_GROUPS.find((g) => g.id === step.groupId)?.cuts ?? [];
    case "sides":
      return SIDES;
    case "picker":
      return pickerOptions(step.mealId);
    default:
      return [];
  }
}

export { COOK_METHODS };
