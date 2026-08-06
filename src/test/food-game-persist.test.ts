import { beforeEach, describe, expect, it } from "vitest";
import { clearRun, loadRun, saveRun } from "@/lib/foodGame/persist";
import { emptyDraft, type MealDraft } from "@/lib/foodGame/flow";

/**
 * The saved run is the only thing standing between "closed the tab after
 * breakfast" and "logged breakfast twice", and it is read back from storage the
 * user can edit. So the loader is tested on the two things that matter: that a
 * real run survives a round trip, and that anything else at all is dropped
 * rather than handed to a step machine that assumes it is well-formed.
 */

const KEY = "gglvlup:foodgame:run";
const TODAY = "2026-08-06";

const breakfast: MealDraft = {
  ...emptyDraft("breakfast"),
  stapleId: "bread",
  proteinGroupIds: ["egg"],
  cuts: { egg: "egg-whole" },
  methods: { egg: "panfried" },
  sideIds: [],
  portions: { "egg-whole": "large" },
};

beforeEach(() => window.localStorage.clear());

describe("food game run persistence", () => {
  it("round-trips a run saved today", () => {
    saveRun({ drafts: { breakfast }, activeMeal: "breakfast", finished: false }, TODAY);
    const run = loadRun(TODAY);
    expect(run?.drafts.breakfast).toEqual(breakfast);
    expect(run?.activeMeal).toBe("breakfast");
    expect(run?.finished).toBe(false);
  });

  it("drops a run stamped with any other day", () => {
    saveRun({ drafts: { breakfast }, activeMeal: "breakfast", finished: false }, "2026-08-05");
    expect(loadRun(TODAY)).toBeNull();
    // The stored value is still there — it is the read that refuses it, so a
    // clock that jumps backwards can't destroy a run it will want again.
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
  });

  it("clears the slot rather than storing an empty run", () => {
    saveRun({ drafts: { breakfast }, activeMeal: "breakfast", finished: false }, TODAY);
    saveRun({ drafts: {}, activeMeal: null, finished: false }, TODAY);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("forgets everything on clearRun", () => {
    saveRun({ drafts: { breakfast }, activeMeal: "breakfast", finished: true }, TODAY);
    clearRun();
    expect(loadRun(TODAY)).toBeNull();
  });

  it("survives a finished run and lands it back on the summary", () => {
    saveRun({ drafts: { breakfast }, activeMeal: "breakfast", finished: true }, TODAY);
    expect(loadRun(TODAY)?.finished).toBe(true);
  });

  describe("rejects anything malformed", () => {
    const store = (value: unknown) => window.localStorage.setItem(KEY, JSON.stringify(value));
    const valid = { version: 1, date: TODAY, drafts: { breakfast }, activeMeal: "breakfast", finished: false };

    it("ignores a value that isn't JSON at all", () => {
      window.localStorage.setItem(KEY, "{not json");
      expect(loadRun(TODAY)).toBeNull();
    });

    it("ignores a run from an older schema version", () => {
      store({ ...valid, version: 0 });
      expect(loadRun(TODAY)).toBeNull();
    });

    it("ignores a run with no usable drafts", () => {
      store({ ...valid, drafts: {} });
      expect(loadRun(TODAY)).toBeNull();
      store({ ...valid, drafts: { breakfast: { mealId: "breakfast" } } });
      expect(loadRun(TODAY)).toBeNull();
    });

    it("drops meals it doesn't recognise but keeps the ones it does", () => {
      store({ ...valid, drafts: { breakfast, brunch: breakfast } });
      const run = loadRun(TODAY);
      expect(Object.keys(run!.drafts)).toEqual(["breakfast"]);
    });

    it("drops a draft filed under the wrong meal", () => {
      // A breakfast draft stored as "lunch" would build the wrong staples.
      store({ ...valid, drafts: { lunch: breakfast } });
      expect(loadRun(TODAY)).toBeNull();
    });

    it("drops a draft whose answer lists aren't lists of strings", () => {
      store({ ...valid, drafts: { breakfast: { ...breakfast, proteinGroupIds: [1, 2] } } });
      expect(loadRun(TODAY)).toBeNull();
      store({ ...valid, drafts: { breakfast: { ...breakfast, cuts: "egg" } } });
      expect(loadRun(TODAY)).toBeNull();
    });

    it("forgets an active meal that isn't in the run", () => {
      store({ ...valid, activeMeal: "dinner" });
      expect(loadRun(TODAY)?.activeMeal).toBeNull();
    });
  });
});
