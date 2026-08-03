import { describe, expect, it } from "vitest";
import {
  COOK_METHODS,
  MEALS,
  PROTEIN_GROUPS,
  computeMacros,
  lookupFood,
  scaleServingNote,
  servingNoteFor,
  staplesForMeal,
  totalMacros,
  type DiaryEntry,
} from "@/lib/foodGame/foods";
import {
  NONE_SIDE,
  NONE_STAPLE,
  currentStep,
  draftEntries,
  emptyDraft,
  hasAnyAnswer,
  plateItems,
  rewind,
  type MealDraft,
} from "@/lib/foodGame/flow";

describe("nutrition maths", () => {
  it("scales a regular serving straight off the per-100g values", () => {
    const breast = lookupFood("chicken-breast")!;
    // 120 g of 165 kcal / 31 g protein per 100 g, grilled (no multiplier).
    expect(computeMacros(breast, "regular", "grilled")).toEqual({ grams: 120, kcal: 198, protein: 37.2 });
  });

  it("applies the portion multiplier to the weight", () => {
    const breast = lookupFood("chicken-breast")!;
    expect(computeMacros(breast, "small", "grilled").grams).toBe(72);
    expect(computeMacros(breast, "huge", "grilled").grams).toBe(240);
  });

  it("charges deep-frying for its oil and dilutes the protein", () => {
    const breast = lookupFood("chicken-breast")!;
    const grilled = computeMacros(breast, "regular", "grilled");
    const fried = computeMacros(breast, "regular", "deepfried");
    expect(fried.kcal).toBeGreaterThan(grilled.kcal);
    expect(fried.protein).toBeLessThan(grilled.protein);
  });

  it("treats a missing cooking method as no adjustment", () => {
    const rice = lookupFood("rice-white")!;
    expect(computeMacros(rice, "regular")).toEqual(computeMacros(rice, "regular", "grilled"));
  });

  it("sums entries without accumulating float noise", () => {
    const entries = [
      { protein: 0.1, kcal: 10 },
      { protein: 0.2, kcal: 20 },
    ] as DiaryEntry[];
    expect(totalMacros(entries)).toEqual({ kcal: 30, protein: 0.3 });
  });

  it("gives every catalogue entry a sane, complete row", () => {
    const foods = [
      ...MEALS.flatMap((m) => staplesForMeal(m.id)),
      ...PROTEIN_GROUPS.flatMap((g) => g.cuts),
    ];
    for (const food of foods) {
      expect(food.kcal100, food.id).toBeGreaterThanOrEqual(0);
      expect(food.protein100, food.id).toBeGreaterThanOrEqual(0);
      expect(food.servingNote, food.id).toBeTruthy();
      // Nothing in the catalogue should out-calorie pure fat (884 kcal/100 g).
      expect(food.kcal100, food.id).toBeLessThan(900);
    }
  });

  it("keeps every cut reachable through lookupFood", () => {
    for (const group of PROTEIN_GROUPS) {
      for (const cut of group.cuts) expect(lookupFood(cut.id), cut.id).toBeDefined();
    }
  });
});

describe("meal step machine", () => {
  /** Walk a main meal to its plate screen. */
  const buildLunch = (): MealDraft => ({
    ...emptyDraft("lunch"),
    stapleId: "rice-white",
    proteinGroupIds: ["chicken", "beef"],
    cuts: { chicken: "chicken-breast", beef: "beef-ground" },
    methods: { chicken: "grilled", beef: "panfried" },
    sideIds: ["side-salad"],
  });

  it("asks carbs first, then proteins", () => {
    const draft = emptyDraft("lunch");
    expect(currentStep(draft).kind).toBe("staple");
    expect(currentStep({ ...draft, stapleId: "rice-white" }).kind).toBe("protein");
  });

  it("runs cut-then-method for each chosen protein, in pick order", () => {
    let draft: MealDraft = { ...emptyDraft("dinner"), stapleId: NONE_STAPLE, proteinGroupIds: ["beef", "fish"] };

    expect(currentStep(draft)).toMatchObject({ kind: "cut", groupId: "beef" });
    draft = { ...draft, cuts: { beef: "beef-ribeye" } };
    expect(currentStep(draft)).toMatchObject({ kind: "method", groupId: "beef" });
    draft = { ...draft, methods: { beef: "grilled" } };
    expect(currentStep(draft)).toMatchObject({ kind: "cut", groupId: "fish" });
    draft = { ...draft, cuts: { ...draft.cuts, fish: "fish-salmon" }, methods: { ...draft.methods, fish: "baked" } };
    expect(currentStep(draft).kind).toBe("sides");
  });

  it("ends on the plate screen once everything is answered", () => {
    expect(currentStep(buildLunch()).kind).toBe("plate");
  });

  it("skips the plate screen when the player ate nothing", () => {
    const draft: MealDraft = {
      ...emptyDraft("breakfast"),
      stapleId: NONE_STAPLE,
      proteinGroupIds: [],
      sideIds: [],
    };
    expect(currentStep(draft).kind).toBe("done");
  });

  it("sends snacks and drinks straight to a picker", () => {
    expect(currentStep(emptyDraft("snacks")).kind).toBe("picker");
    expect(currentStep({ ...emptyDraft("drinks"), itemIds: ["drink-soda"] }).kind).toBe("plate");
    expect(currentStep({ ...emptyDraft("drinks"), itemIds: [] }).kind).toBe("done");
  });

  it("rewinds one answer at a time, back down to nothing", () => {
    let draft = buildLunch();
    const seen: string[] = [];
    for (let i = 0; i < 8 && hasAnyAnswer(draft); i++) {
      draft = rewind(draft);
      seen.push(currentStep(draft).kind);
    }
    expect(seen).toEqual(["sides", "method", "cut", "method", "cut", "protein", "staple"]);
    expect(hasAnyAnswer(draft)).toBe(false);
  });

  it("drops the skipped courses from the plate", () => {
    const draft: MealDraft = {
      ...emptyDraft("lunch"),
      stapleId: NONE_STAPLE,
      proteinGroupIds: ["chicken"],
      cuts: { chicken: "chicken-thigh" },
      methods: { chicken: "boiled" },
      sideIds: [NONE_SIDE],
    };
    expect(plateItems(draft).map((i) => i.food.id)).toEqual(["chicken-thigh"]);
  });

  it("plates carbs, then proteins, then sides", () => {
    expect(plateItems(buildLunch()).map((i) => i.food.id)).toEqual([
      "rice-white",
      "chicken-breast",
      "beef-ground",
      "side-salad",
    ]);
  });

  it("carries the cooking method into the diary entry", () => {
    const entries = draftEntries(buildLunch());
    const beef = entries.find((e) => e.foodId === "beef-ground")!;
    expect(beef.methodId).toBe("panfried");
    expect(beef.methodLabel).toBe(COOK_METHODS.find((m) => m.id === "panfried")!.label);
    // The rice has no method, so it must not inherit the beef's oil.
    expect(entries.find((e) => e.foodId === "rice-white")!.methodId).toBeUndefined();
  });

  it("defaults unsized items to a regular portion", () => {
    const entries = draftEntries(buildLunch());
    expect(entries.every((e) => e.portionId === "regular")).toBe(true);
    expect(entries.find((e) => e.foodId === "rice-white")!.grams).toBe(lookupFood("rice-white")!.serving);
  });

  it("gives entries keys that stay unique across meals", () => {
    const lunch = draftEntries(buildLunch());
    const snacks = draftEntries({ ...emptyDraft("snacks"), itemIds: ["snack-nuts"] });
    const keys = [...lunch, ...snacks].map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only offers breakfast carbs at breakfast", () => {
    expect(staplesForMeal("breakfast").map((s) => s.id)).toContain("oats");
    expect(staplesForMeal("dinner").map((s) => s.id)).not.toContain("oats");
  });
});

describe("serving notes", () => {
  it("scales the count and re-conjugates the unit", () => {
    expect(scaleServingNote("1 cup cooked", 1.5)).toBe("1½ cups cooked");
    expect(scaleServingNote("1 cup cooked", 2)).toBe("2 cups cooked");
    expect(scaleServingNote("1 thigh", 2)).toBe("2 thighs");
    expect(scaleServingNote("1 glass", 2)).toBe("2 glasses");
  });

  it("singularises when the portion drops below one", () => {
    expect(scaleServingNote("2 slices", 0.6)).toBe("1⅕ slices");
    expect(scaleServingNote("2 slices", 0.5)).toBe("1 slice");
    expect(scaleServingNote("3 strips", 0.6)).toBe("1⅘ strips");
    expect(scaleServingNote("1 steak", 0.6)).toBe("⅗ steak");
  });

  it("keeps the size adjective and conjugates the noun after it", () => {
    expect(scaleServingNote("2 large eggs", 1.5)).toBe("3 large eggs");
    expect(scaleServingNote("1 large wrap", 2)).toBe("2 large wraps");
    expect(scaleServingNote("1 bowl (dry)", 2)).toBe("2 bowls (dry)");
  });

  it("leaves notes it can't count alone", () => {
    expect(scaleServingNote("skipped", 2)).toBe("skipped");
    expect(scaleServingNote("1 cup", 1)).toBe("1 cup");
  });

  it("moves in step with the grams for every portion", () => {
    const rice = lookupFood("rice-white")!;
    const seen = (["small", "regular", "large", "huge"] as const).map((id) => ({
      grams: computeMacros(rice, id).grams,
      note: servingNoteFor(rice, id),
    }));
    expect(seen).toEqual([
      { grams: 95, note: "⅗ cup cooked" },
      { grams: 158, note: "1 cup cooked" },
      { grams: 237, note: "1½ cups cooked" },
      { grams: 316, note: "2 cups cooked" },
    ]);
  });

  it("hands the weight back to the player once they've weighed it", () => {
    expect(servingNoteFor(lookupFood("rice-white")!, "custom")).toBe("you weighed it");
  });
});

describe("weighed portions", () => {
  const ribeye = lookupFood("beef-ribeye")!;

  it("uses the typed weight instead of a multiplier", () => {
    const { grams, kcal } = computeMacros(ribeye, "custom", undefined, 250);
    expect(grams).toBe(250);
    expect(kcal).toBe(Math.round((ribeye.kcal100 * 250) / 100));
  });

  it("still applies the cooking method's added fat", () => {
    const plain = computeMacros(ribeye, "custom", undefined, 200);
    const fried = computeMacros(ribeye, "custom", "panfried", 200);
    expect(fried.grams).toBe(plain.grams);
    expect(fried.kcal).toBeGreaterThan(plain.kcal);
  });

  it("falls back to the regular serving when no weight was given", () => {
    expect(computeMacros(ribeye, "custom").grams).toBe(ribeye.serving);
    expect(computeMacros(ribeye, "custom", undefined, 0).grams).toBe(ribeye.serving);
  });

  it("carries the weighed grams into the diary entry", () => {
    const draft: MealDraft = {
      ...emptyDraft("dinner"),
      stapleId: NONE_STAPLE,
      proteinGroupIds: ["beef"],
      cuts: { beef: "beef-ribeye" },
      methods: { beef: "grilled" },
      sideIds: [NONE_SIDE],
      portions: { "beef-ribeye": "custom" },
      customGrams: { "beef-ribeye": 312 },
    };
    const entry = draftEntries(draft).find((e) => e.foodId === "beef-ribeye")!;
    expect(entry.portionId).toBe("custom");
    expect(entry.grams).toBe(312);
  });
});
