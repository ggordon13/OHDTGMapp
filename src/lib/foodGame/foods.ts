// ---------------------------------------------------------------------------
// Food Track game — nutrition catalogue.
//
// Every number here is per 100 g (per 100 ml for drinks), taken from the USDA
// FoodData Central public-domain SR Legacy / Foundation datasets — a free,
// no-key source. Values are for the food *as eaten* (cooked, drained) so the
// cooking-method multipliers below only have to account for added fat.
//
// Why a local table instead of a live API: the game never takes free text —
// every answer is one of a fixed set of buttons — so a curated catalogue is
// both faster and offline-safe. FatSecret's Platform API needs OAuth2 client
// credentials + an IP allowlist and rejects browser-origin calls, so wiring it
// in would mean a server proxy. `lookupFood` is the only read path into this
// table; swapping it for an edge-function call later touches nothing else.
// ---------------------------------------------------------------------------

export type MealId = "breakfast" | "lunch" | "dinner" | "snacks" | "drinks";

/** A single food the player can pick. Macros are per 100 g / 100 ml. */
export interface FoodItem {
  id: string;
  label: string;
  /** Emoji or critter key used by <FoodSprite />. */
  sprite: string;
  kcal100: number;
  protein100: number;
  /** The "regular" serving in grams (ml for drinks). */
  serving: number;
  /** Plain-language size of that regular serving, shown on the portion screen. */
  servingNote: string;
}

/** A meat/protein family — the animal that panics when you hover it. */
export interface ProteinGroup {
  id: string;
  label: string;
  /** Hand-drawn critter sprite key (see FoodSprite). */
  critter: "chicken" | "cow" | "pig" | "fish" | "egg" | "plant";
  /** Line the critter blurts out when you hover it. */
  taunt: string;
  cuts: FoodItem[];
}

// ---------------------------------------------------------------------------
// Staples
// ---------------------------------------------------------------------------

export const MAIN_STAPLES: FoodItem[] = [
  { id: "rice-white", label: "White Rice", sprite: "🍚", kcal100: 130, protein100: 2.7, serving: 158, servingNote: "1 cup cooked" },
  { id: "rice-brown", label: "Brown Rice", sprite: "🍘", kcal100: 123, protein100: 2.7, serving: 195, servingNote: "1 cup cooked" },
  { id: "bread", label: "Bread", sprite: "🍞", kcal100: 265, protein100: 9, serving: 60, servingNote: "2 slices" },
  { id: "pasta", label: "Pasta", sprite: "🍝", kcal100: 158, protein100: 5.8, serving: 140, servingNote: "1 cup cooked" },
  { id: "potato", label: "Potato", sprite: "🥔", kcal100: 87, protein100: 2, serving: 170, servingNote: "1 medium" },
  { id: "noodles", label: "Noodles", sprite: "🍜", kcal100: 138, protein100: 3.6, serving: 190, servingNote: "1 bowl" },
  { id: "tortilla", label: "Wrap / Tortilla", sprite: "🌯", kcal100: 310, protein100: 8, serving: 72, servingNote: "1 large wrap" },
  { id: "none-staple", label: "No Carbs", sprite: "🚫", kcal100: 0, protein100: 0, serving: 0, servingNote: "skipped" },
];

export const BREAKFAST_STAPLES: FoodItem[] = [
  { id: "oats", label: "Oatmeal", sprite: "🥣", kcal100: 71, protein100: 2.5, serving: 234, servingNote: "1 cup cooked" },
  { id: "cereal", label: "Cereal", sprite: "🥛", kcal100: 379, protein100: 7, serving: 40, servingNote: "1 bowl (dry)" },
  { id: "bread", label: "Toast", sprite: "🍞", kcal100: 265, protein100: 9, serving: 60, servingNote: "2 slices" },
  { id: "pancake", label: "Pancakes", sprite: "🥞", kcal100: 227, protein100: 6.4, serving: 116, servingNote: "2 pancakes" },
  { id: "rice-white", label: "Rice", sprite: "🍚", kcal100: 130, protein100: 2.7, serving: 158, servingNote: "1 cup cooked" },
  { id: "none-staple", label: "No Carbs", sprite: "🚫", kcal100: 0, protein100: 0, serving: 0, servingNote: "skipped" },
];

// ---------------------------------------------------------------------------
// Proteins — the boss fights
// ---------------------------------------------------------------------------

export const PROTEIN_GROUPS: ProteinGroup[] = [
  {
    id: "chicken",
    label: "Chicken",
    critter: "chicken",
    taunt: "Not the nuggets!",
    cuts: [
      { id: "chicken-breast", label: "Breast", sprite: "🍗", kcal100: 165, protein100: 31, serving: 120, servingNote: "1 fillet" },
      { id: "chicken-thigh", label: "Thigh", sprite: "🍗", kcal100: 209, protein100: 26, serving: 110, servingNote: "1 thigh" },
      { id: "chicken-drum", label: "Drumstick", sprite: "🍗", kcal100: 172, protein100: 28, serving: 95, servingNote: "1 drumstick" },
      { id: "chicken-wing", label: "Wings", sprite: "🍗", kcal100: 290, protein100: 27, serving: 100, servingNote: "4 wings" },
    ],
  },
  {
    id: "beef",
    label: "Beef",
    critter: "cow",
    taunt: "Moo-ve along, please…",
    cuts: [
      { id: "beef-sirloin", label: "Steak (lean)", sprite: "🥩", kcal100: 206, protein100: 30, serving: 150, servingNote: "1 steak" },
      { id: "beef-ribeye", label: "Ribeye", sprite: "🥩", kcal100: 291, protein100: 24, serving: 170, servingNote: "1 steak" },
      { id: "beef-ground", label: "Ground Beef", sprite: "🍖", kcal100: 254, protein100: 26, serving: 113, servingNote: "1 patty" },
      { id: "beef-brisket", label: "Brisket", sprite: "🍖", kcal100: 250, protein100: 28, serving: 140, servingNote: "1 portion" },
    ],
  },
  {
    id: "pork",
    label: "Pork",
    critter: "pig",
    taunt: "That'll do, pig. That'll do.",
    cuts: [
      { id: "pork-loin", label: "Loin Chop", sprite: "🥩", kcal100: 231, protein100: 27, serving: 130, servingNote: "1 chop" },
      { id: "pork-belly", label: "Belly", sprite: "🥓", kcal100: 518, protein100: 9.3, serving: 85, servingNote: "1 portion" },
      { id: "pork-bacon", label: "Bacon", sprite: "🥓", kcal100: 541, protein100: 37, serving: 34, servingNote: "3 strips" },
      { id: "pork-ham", label: "Ham", sprite: "🍖", kcal100: 145, protein100: 21, serving: 85, servingNote: "3 slices" },
    ],
  },
  {
    id: "fish",
    label: "Fish",
    critter: "fish",
    taunt: "Blub. Blub. Help.",
    cuts: [
      { id: "fish-salmon", label: "Salmon", sprite: "🐟", kcal100: 208, protein100: 20, serving: 130, servingNote: "1 fillet" },
      { id: "fish-tuna", label: "Tuna", sprite: "🐟", kcal100: 144, protein100: 29, serving: 120, servingNote: "1 can / steak" },
      { id: "fish-white", label: "White Fish", sprite: "🐠", kcal100: 128, protein100: 26, serving: 130, servingNote: "1 fillet" },
      { id: "fish-shrimp", label: "Shrimp", sprite: "🦐", kcal100: 99, protein100: 24, serving: 100, servingNote: "8 shrimp" },
    ],
  },
  {
    id: "egg",
    label: "Eggs",
    critter: "egg",
    taunt: "I was going to be somebody!",
    cuts: [
      { id: "egg-whole", label: "Whole Eggs", sprite: "🥚", kcal100: 143, protein100: 12.6, serving: 100, servingNote: "2 large eggs" },
      { id: "egg-white", label: "Egg Whites", sprite: "🥚", kcal100: 52, protein100: 11, serving: 132, servingNote: "4 whites" },
      { id: "egg-omelette", label: "Omelette", sprite: "🍳", kcal100: 154, protein100: 11, serving: 150, servingNote: "3-egg omelette" },
    ],
  },
  {
    id: "plant",
    label: "Plant Protein",
    critter: "plant",
    taunt: "I photosynthesized for this?",
    cuts: [
      { id: "plant-tofu", label: "Tofu", sprite: "🧊", kcal100: 76, protein100: 8, serving: 120, servingNote: "1 block" },
      { id: "plant-beans", label: "Beans", sprite: "🫘", kcal100: 127, protein100: 9, serving: 170, servingNote: "1 cup" },
      { id: "plant-lentils", label: "Lentils", sprite: "🥣", kcal100: 116, protein100: 9, serving: 198, servingNote: "1 cup" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------

export const SIDES: FoodItem[] = [
  { id: "side-salad", label: "Salad", sprite: "🥗", kcal100: 35, protein100: 2, serving: 120, servingNote: "1 bowl" },
  { id: "side-veg", label: "Cooked Veggies", sprite: "🥦", kcal100: 45, protein100: 2.8, serving: 130, servingNote: "1 cup" },
  { id: "side-fries", label: "Fries", sprite: "🍟", kcal100: 312, protein100: 3.4, serving: 117, servingNote: "medium fries" },
  { id: "side-cheese", label: "Cheese", sprite: "🧀", kcal100: 402, protein100: 25, serving: 28, servingNote: "1 slice" },
  { id: "side-soup", label: "Soup", sprite: "🍲", kcal100: 56, protein100: 3, serving: 245, servingNote: "1 bowl" },
  { id: "none-side", label: "No Sides", sprite: "🚫", kcal100: 0, protein100: 0, serving: 0, servingNote: "skipped" },
];

// ---------------------------------------------------------------------------
// Snacks & drinks
// ---------------------------------------------------------------------------

export const SNACKS: FoodItem[] = [
  { id: "snack-fruit", label: "Fruit", sprite: "🍎", kcal100: 57, protein100: 0.4, serving: 150, servingNote: "1 piece" },
  { id: "snack-banana", label: "Banana", sprite: "🍌", kcal100: 89, protein100: 1.1, serving: 118, servingNote: "1 medium" },
  { id: "snack-yogurt", label: "Greek Yogurt", sprite: "🥛", kcal100: 59, protein100: 10, serving: 170, servingNote: "1 cup" },
  { id: "snack-nuts", label: "Nuts", sprite: "🥜", kcal100: 607, protein100: 21, serving: 30, servingNote: "small handful" },
  { id: "snack-bar", label: "Protein Bar", sprite: "🍫", kcal100: 350, protein100: 30, serving: 60, servingNote: "1 bar" },
  { id: "snack-chips", label: "Chips", sprite: "🍟", kcal100: 536, protein100: 7, serving: 50, servingNote: "small bag" },
  { id: "snack-choc", label: "Chocolate", sprite: "🍫", kcal100: 535, protein100: 8, serving: 40, servingNote: "small bar" },
  { id: "snack-cookies", label: "Cookies", sprite: "🍪", kcal100: 480, protein100: 6, serving: 45, servingNote: "3 cookies" },
  { id: "snack-icecream", label: "Ice Cream", sprite: "🍦", kcal100: 207, protein100: 3.5, serving: 132, servingNote: "1 scoop cup" },
  { id: "snack-popcorn", label: "Popcorn", sprite: "🍿", kcal100: 387, protein100: 12, serving: 30, servingNote: "1 bowl" },
];

export const DRINKS: FoodItem[] = [
  { id: "drink-water", label: "Water", sprite: "💧", kcal100: 0, protein100: 0, serving: 250, servingNote: "1 glass" },
  { id: "drink-coffee", label: "Black Coffee", sprite: "☕", kcal100: 2, protein100: 0.1, serving: 240, servingNote: "1 mug" },
  { id: "drink-latte", label: "Latte / Milk Coffee", sprite: "🥤", kcal100: 55, protein100: 3, serving: 350, servingNote: "1 tall cup" },
  { id: "drink-milk", label: "Milk", sprite: "🥛", kcal100: 61, protein100: 3.2, serving: 250, servingNote: "1 glass" },
  { id: "drink-shake", label: "Protein Shake", sprite: "🧋", kcal100: 40, protein100: 8, serving: 300, servingNote: "1 scoop + water" },
  { id: "drink-juice", label: "Fruit Juice", sprite: "🧃", kcal100: 45, protein100: 0.5, serving: 250, servingNote: "1 glass" },
  { id: "drink-soda", label: "Soda", sprite: "🥤", kcal100: 41, protein100: 0, serving: 330, servingNote: "1 can" },
  { id: "drink-boba", label: "Milk Tea / Boba", sprite: "🧋", kcal100: 90, protein100: 1, serving: 400, servingNote: "1 large cup" },
  { id: "drink-tea", label: "Tea", sprite: "🍵", kcal100: 1, protein100: 0, serving: 240, servingNote: "1 mug" },
  { id: "drink-beer", label: "Beer", sprite: "🍺", kcal100: 43, protein100: 0.5, serving: 355, servingNote: "1 bottle" },
  { id: "drink-energy", label: "Energy Drink", sprite: "⚡", kcal100: 45, protein100: 0, serving: 250, servingNote: "1 can" },
];

// ---------------------------------------------------------------------------
// Cooking methods — how much fat the pan smuggled in
// ---------------------------------------------------------------------------

export interface CookMethod {
  id: string;
  label: string;
  sprite: string;
  /** Multiplier on the cooked-food calories. */
  kcalMult: number;
  /** Deep-frying adds batter, which dilutes protein per gram. */
  proteinMult: number;
  blurb: string;
}

export const COOK_METHODS: CookMethod[] = [
  { id: "grilled", label: "Grilled", sprite: "🔥", kcalMult: 1, proteinMult: 1, blurb: "No extra oil. Clean numbers." },
  { id: "baked", label: "Baked / Roast", sprite: "🍞", kcalMult: 1.05, proteinMult: 1, blurb: "A light brush of oil." },
  { id: "boiled", label: "Soup / Stew", sprite: "🍲", kcalMult: 0.95, proteinMult: 1, blurb: "Some fat renders into the broth." },
  { id: "panfried", label: "Pan-Fried", sprite: "🍳", kcalMult: 1.25, proteinMult: 1, blurb: "The pan gave it a little gift." },
  { id: "deepfried", label: "Deep-Fried", sprite: "🍤", kcalMult: 1.6, proteinMult: 0.95, blurb: "Batter + oil. Worth it though." },
  { id: "raw", label: "Raw / Fresh", sprite: "🥗", kcalMult: 1, proteinMult: 1, blurb: "Straight from the source." },
];

// ---------------------------------------------------------------------------
// Portions
// ---------------------------------------------------------------------------

export type PortionId = "small" | "regular" | "large" | "huge";

export interface Portion {
  id: PortionId;
  label: string;
  sprite: string;
  mult: number;
}

export const PORTIONS: Portion[] = [
  { id: "small", label: "Just a taste", sprite: "🤏", mult: 0.6 },
  { id: "regular", label: "Normal", sprite: "🍽️", mult: 1 },
  { id: "large", label: "Hungry", sprite: "😋", mult: 1.5 },
  { id: "huge", label: "Beast mode", sprite: "💪", mult: 2 },
];

// ---------------------------------------------------------------------------
// Lookup + maths
// ---------------------------------------------------------------------------

const ALL_FOODS: FoodItem[] = [
  ...MAIN_STAPLES,
  ...BREAKFAST_STAPLES,
  ...PROTEIN_GROUPS.flatMap((g) => g.cuts),
  ...SIDES,
  ...SNACKS,
  ...DRINKS,
];

const FOOD_BY_ID = new Map<string, FoodItem>(ALL_FOODS.map((f) => [f.id, f]));

/**
 * The single read path into the catalogue. Everything downstream goes through
 * here, so this is the seam to swap for a remote lookup (FatSecret via an edge
 * function) without touching the game flow.
 */
export function lookupFood(id: string): FoodItem | undefined {
  return FOOD_BY_ID.get(id);
}

export function lookupMethod(id?: string): CookMethod | undefined {
  return id ? COOK_METHODS.find((m) => m.id === id) : undefined;
}

export function lookupPortion(id: PortionId): Portion {
  return PORTIONS.find((p) => p.id === id) ?? PORTIONS[1];
}

/** One line of the finished diary. */
export interface DiaryEntry {
  /** Unique within a run — `${mealId}:${foodId}`. */
  key: string;
  mealId: MealId;
  foodId: string;
  label: string;
  sprite: string;
  methodId?: string;
  methodLabel?: string;
  portionId: PortionId;
  grams: number;
  kcal: number;
  protein: number;
}

export interface Macros {
  kcal: number;
  protein: number;
}

/**
 * Calories and protein for one plated item: scale the per-100 g values by the
 * portioned weight, then apply the cooking method's added-fat multiplier.
 */
export function computeMacros(food: FoodItem, portionId: PortionId, methodId?: string): Macros & { grams: number } {
  const portion = lookupPortion(portionId);
  const method = lookupMethod(methodId);
  const grams = Math.round(food.serving * portion.mult);
  const kcal = Math.round((food.kcal100 * grams) / 100 * (method?.kcalMult ?? 1));
  const protein = Math.round(((food.protein100 * grams) / 100) * (method?.proteinMult ?? 1) * 10) / 10;
  return { grams, kcal, protein };
}

/** Roll a set of diary lines up into a single total. */
export function totalMacros(entries: DiaryEntry[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, protein: Math.round((acc.protein + e.protein) * 10) / 10 }),
    { kcal: 0, protein: 0 },
  );
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export interface MealDef {
  id: MealId;
  label: string;
  sprite: string;
  /** Panel/banner colour, matching the game UI kit. */
  color: "gold" | "teal" | "navy" | "purple" | "leaf";
  tagline: string;
}

export const MEALS: MealDef[] = [
  { id: "breakfast", label: "Breakfast", sprite: "🌅", color: "gold", tagline: "First fuel of the day" },
  { id: "lunch", label: "Lunch", sprite: "☀️", color: "leaf", tagline: "Midday refuel" },
  { id: "dinner", label: "Dinner", sprite: "🌙", color: "navy", tagline: "The main event" },
  { id: "snacks", label: "Snacks", sprite: "🍿", color: "purple", tagline: "The sneaky calories" },
  { id: "drinks", label: "Drinks", sprite: "🥤", color: "teal", tagline: "Liquid calories count too" },
];

/** Staple options depend on the meal — nobody wants pasta at 7am. */
export function staplesForMeal(mealId: MealId): FoodItem[] {
  return mealId === "breakfast" ? BREAKFAST_STAPLES : MAIN_STAPLES;
}
