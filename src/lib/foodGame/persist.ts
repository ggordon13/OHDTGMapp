// ---------------------------------------------------------------------------
// Food Track — run persistence.
//
// A run *is* today's food diary in progress, so closing the modal to go and eat
// lunch must not throw the morning away. The whole draft set is mirrored to
// localStorage on every change and offered back on the title screen as
// "Continue".
//
// The reset rule is a date stamp rather than a timer: a saved run carries the
// calendar day it belongs to, and a run whose date no longer matches today is
// stale by definition and never restored. That gives "resets when the day ends"
// for free, survives the tab being closed overnight, and needs no clock.
//
// Storage is best-effort throughout — private-mode Safari and locked-down
// browsers throw on access, and a diary that can't be cached is still a diary
// that works for the length of the session.
// ---------------------------------------------------------------------------

import { formatDateInputValue } from "@/lib/utils";
import { MEALS, type MealId } from "./foods";
import type { MealDraft } from "./flow";

const KEY = "gglvlup:foodgame:run";

/**
 * Bumped whenever the shape below changes incompatibly. A mismatch is treated
 * exactly like a stale date — dropped, not migrated, because a food diary is
 * one day's work and re-entering it is cheaper than a migration path.
 */
const VERSION = 1;

export interface SavedRun {
  version: number;
  /** The calendar day (YYYY-MM-DD) this run records. */
  date: string;
  /** Per-meal drafts. A meal is "in play" exactly when it has one. */
  drafts: Record<string, MealDraft>;
  /** Which meal the player was last looking at, so Continue lands there. */
  activeMeal: MealId | null;
  /** True once the run has reached the summary — Continue then goes straight there. */
  finished: boolean;
}

/** What callers hand in; the version and date are stamped here. */
export type RunSnapshot = Omit<SavedRun, "version" | "date">;

const MEAL_IDS = new Set<string>(MEALS.map((m) => m.id));

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Structural check on one stored draft. Anything that fails is dropped rather
 * than repaired: the draft feeds a step machine that assumes its own invariants,
 * and a half-valid draft would surface as a stuck question rather than an error.
 */
function isDraft(value: unknown, mealId: string): value is MealDraft {
  if (!isRecord(value)) return false;
  if (value.mealId !== mealId) return false;
  if (!isRecord(value.cuts) || !isRecord(value.methods)) return false;
  if (!isRecord(value.portions) || !isRecord(value.customGrams)) return false;
  if (value.stapleId !== undefined && typeof value.stapleId !== "string") return false;
  for (const key of ["proteinGroupIds", "sideIds", "itemIds"] as const) {
    const list = value[key];
    if (list !== undefined && !(Array.isArray(list) && list.every((x) => typeof x === "string"))) return false;
  }
  return true;
}

/** The saved run for `today`, or null if there is none, it's stale, or it's junk. */
export function loadRun(today: string = formatDateInputValue()): SavedRun | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== VERSION) return null;
    // Yesterday's diary is not today's. Drop it so tomorrow starts at zero.
    if (parsed.date !== today) return null;
    if (!isRecord(parsed.drafts)) return null;

    const drafts: Record<string, MealDraft> = {};
    for (const [mealId, draft] of Object.entries(parsed.drafts)) {
      if (!MEAL_IDS.has(mealId)) continue;
      if (isDraft(draft, mealId)) drafts[mealId] = draft;
    }
    if (Object.keys(drafts).length === 0) return null;

    const activeMeal =
      typeof parsed.activeMeal === "string" && drafts[parsed.activeMeal]
        ? (parsed.activeMeal as MealId)
        : null;

    return { version: VERSION, date: today, drafts, activeMeal, finished: parsed.finished === true };
  } catch {
    return null;
  }
}

/** Mirror the run to storage. A run with no meals clears the slot instead. */
export function saveRun(snapshot: RunSnapshot, today: string = formatDateInputValue()): void {
  if (typeof window === "undefined") return;
  if (Object.keys(snapshot.drafts).length === 0) {
    clearRun();
    return;
  }
  const run: SavedRun = { version: VERSION, date: today, ...snapshot };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    /* storage blocked or full — the run just won't survive a reload */
  }
}

/** Forget the saved run entirely (Reset, or a finished run being started over). */
export function clearRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do — there was nothing to clear */
  }
}
