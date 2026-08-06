import { describe, expect, it } from "vitest";
import {
  CARD_WIDTH,
  foodCardHeight,
  paintFoodCard,
  type FoodShareData,
} from "@/lib/foodGame/shareCard";
import { makeRecorder, recordingCanvas } from "./canvasRecorder";

/**
 * The food card's height is computed from its data — meals and goal bars each
 * add rows — so unlike the fixed progress card it can genuinely paint past its
 * own bottom edge if the geometry and the height function ever disagree. These
 * check the two against each other across the shapes a real day takes.
 */

function paint(data: FoodShareData) {
  const rec = makeRecorder();
  paintFoodCard(recordingCanvas(rec.ctx), data, { logo: null });
  return rec;
}

const meal = (label: string, kcal: number, protein: number) => ({
  sprite: "🌅",
  label,
  kcal,
  protein,
});

const base: FoodShareData = {
  date: "2026-08-06",
  kcal: 1840,
  protein: 128.5,
  itemCount: 11,
  meals: [meal("Breakfast", 420, 32), meal("Lunch", 610, 44.5), meal("Dinner", 810, 52)],
  goals: { calories: 2000, protein: 150 },
};

const inBounds = (data: FoodShareData) => {
  const height = foodCardHeight(data);
  for (const p of paint(data).points) {
    expect(p.x).toBeGreaterThanOrEqual(-2);
    expect(p.x).toBeLessThanOrEqual(CARD_WIDTH + 2);
    expect(p.y).toBeGreaterThanOrEqual(-2);
    expect(p.y).toBeLessThanOrEqual(height + 2);
  }
};

describe("food share card", () => {
  it("keeps everything it paints inside the card", () => {
    expect(paint(base).points.length).toBeGreaterThan(0);
    inBounds(base);
  });

  it("grows exactly one row per meal", () => {
    const one = foodCardHeight({ ...base, meals: base.meals.slice(0, 1) });
    const two = foodCardHeight({ ...base, meals: base.meals.slice(0, 2) });
    const three = foodCardHeight(base);
    expect(two - one).toBe(three - two);
    expect(three).toBeGreaterThan(one);
  });

  it("stays in bounds across the shapes a day can take", () => {
    const shapes: FoodShareData[] = [
      // Nothing logged at all.
      { ...base, kcal: 0, protein: 0, itemCount: 0, meals: [], goals: undefined },
      // No targets set, so no goal bars.
      { ...base, goals: undefined },
      // Only one of the two targets.
      { ...base, goals: { calories: 2000, protein: null } },
      { ...base, goals: { calories: null, protein: 150 } },
      // A full day, every meal, and numbers wide enough to test the fitting.
      {
        ...base,
        kcal: 12345,
        protein: 999.9,
        itemCount: 40,
        meals: [
          meal("Breakfast", 9999, 999.9),
          meal("Lunch", 9999, 999.9),
          meal("Dinner", 9999, 999.9),
          meal("Snacks", 9999, 999.9),
          meal("Drinks", 9999, 999.9),
        ],
      },
      // Over the goal — the bar must clamp rather than run off the track.
      { ...base, kcal: 9000, protein: 400, goals: { calories: 1200, protein: 90 } },
    ];
    for (const shape of shapes) inBounds(shape);
  });

  it("trims a long meal name rather than letting it run into the numbers", () => {
    const long = "Second Breakfast, Elevenses and Afternoon Tea Combined";
    const { texts } = paint({ ...base, meals: [meal(long, 500, 30)] });
    const drawn = texts.find((t) => t.text.startsWith("Second"));
    expect(drawn).toBeDefined();
    expect(drawn!.text.length).toBeLessThan(long.length);
  });

  it("falls back to the raw date string if it can't be formatted", () => {
    const { texts } = paint({ ...base, date: "not-a-date" });
    expect(texts.some((t) => t.text.includes("not-a-date"))).toBe(true);
  });
});
