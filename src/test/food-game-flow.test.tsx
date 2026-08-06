import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import gsap from "gsap";
import FoodGameModal from "@/components/foodgame/FoodGameModal";
import { MEALS, computeMacros, lookupFood } from "@/lib/foodGame/foods";
import { loadRun } from "@/lib/foodGame/persist";

/**
 * Drives the real modal the way a player would — clicking through the title
 * screen, a full breakfast build and the meal editor — to prove the step
 * machine and the UI agree, that the run ends on a summary whose totals match
 * the catalogue maths, and that a half-built day survives being closed.
 */

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));

/** Play a breakfast of toast + pan-fried whole eggs, no sides. */
const playBreakfast = () => {
  click(/Start Game/i);
  click(/Breakfast/i);
  click(/Start — 1 meal/i);

  click(/^Toast/i); // carbs
  click(/^Eggs/i); // protein family (multi-select)
  click(/Continue \(1\)/i);
  click(/^Whole Eggs/i); // cut
  click(/^Pan-Fried/i); // method
  click(/^No Sides/i); // exclusive skip
};

// Every test starts on a clean day. Without this a run saved by the previous
// test is offered back as Continue, and the title screen has no Start Game.
beforeEach(() => window.localStorage.clear());

describe("Food Track playthrough", () => {
  it("opens on the title screen", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("FOOD TRACK")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Game/i })).toBeInTheDocument();
  });

  it("Exit closes without starting a run", () => {
    const onOpenChange = vi.fn();
    render(<FoodGameModal open onOpenChange={onOpenChange} />);
    click(/Exit/i);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("meal tiles settle cleanly after the entrance animation", () => {
    /** Run every in-flight GSAP tween to its end, applying clearProps. */
    const finishAnimations = () => gsap.globalTimeline.progress(1, true);

    const tiles = () =>
      MEALS.map((m) => screen.getAllByRole("button", { name: new RegExp(m.label, "i") })[0]);

    it("leaves no inline styles that outrank the tiles' own classes", () => {
      render(<FoodGameModal open onOpenChange={vi.fn()} />);
      click(/Start Game/i);
      finishAnimations();

      // A leftover inline opacity:1 would defeat the `opacity-80` dimming and
      // erase the selected/unselected distinction for the rest of the screen.
      for (const tile of tiles()) {
        expect(tile.style.opacity, tile.textContent ?? "").toBe("");
        expect(tile.style.transform, tile.textContent ?? "").toBe("");
      }
    });

    it("keeps unselected tiles dimmed and lights up the chosen one", () => {
      render(<FoodGameModal open onOpenChange={vi.fn()} />);
      click(/Start Game/i);
      finishAnimations();

      click(/Lunch/i);
      const [breakfast, lunch] = tiles();
      expect(lunch.className).not.toMatch(/(^|\s)opacity-80(\s|$)/);
      expect(breakfast.className).toMatch(/(^|\s)opacity-80(\s|$)/);
      expect(lunch.style.opacity).toBe("");
    });
  });

  it("blocks the meal picker until at least one meal is chosen", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    click(/Start Game/i);
    expect(screen.getByRole("button", { name: /Pick at least one/i })).toBeDisabled();
    click(/Lunch/i);
    expect(screen.getByRole("button", { name: /Start — 1 meal/i })).toBeEnabled();
  });

  it("walks a meal question by question and lands on the meal editor", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    click(/Start Game/i);
    click(/Breakfast/i);
    click(/Start — 1 meal/i);

    expect(screen.getByText(/Pick your carbs/i)).toBeInTheDocument();
    click(/^Toast/i);

    expect(screen.getByText(/Choose your victims/i)).toBeInTheDocument();
    click(/^Eggs/i);
    click(/Continue \(1\)/i);

    expect(screen.getByText(/Which part of the eggs\?/i)).toBeInTheDocument();
    click(/^Whole Eggs/i);

    expect(screen.getByText(/How was the whole eggs cooked\?/i)).toBeInTheDocument();
    click(/^Pan-Fried/i);

    expect(screen.getByText(/Any sides\?/i)).toBeInTheDocument();
    click(/^No Sides/i);

    expect(screen.getByText(/Size it up/i)).toBeInTheDocument();
  });

  it("reaches the summary with totals matching the catalogue maths", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    click(/Finish — see my day/i);

    expect(screen.getByText(/Level Complete/i)).toBeInTheDocument();

    const toast = computeMacros(lookupFood("bread")!, "regular");
    const eggs = computeMacros(lookupFood("egg-whole")!, "regular", "panfried");
    const expectedKcal = toast.kcal + eggs.kcal;

    // The headline counts up from 0, so assert on the itemised diary instead.
    // The day's total also rides in the header chip, hence getAllByText.
    expect(screen.getAllByText(new RegExp(`${expectedKcal} kcal`)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Toast —/)).toBeInTheDocument();
    expect(screen.getByText(/Whole Eggs \(Pan-Fried\) —/)).toBeInTheDocument();
  });

  it("re-sizing a portion updates that item's macros live", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();

    const rows = screen.getAllByText(/Whole Eggs/);
    const row = rows[0].closest("[data-plate-row]") as HTMLElement;
    const regular = computeMacros(lookupFood("egg-whole")!, "regular", "panfried");
    const huge = computeMacros(lookupFood("egg-whole")!, "huge", "panfried");

    expect(within(row).getByText(String(regular.kcal))).toBeInTheDocument();
    fireEvent.click(within(row).getByTitle("Beast mode"));
    expect(within(row).getByText(String(huge.kcal))).toBeInTheDocument();
  });

  it("Back undoes one answer at a time", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    expect(screen.getByText(/Size it up/i)).toBeInTheDocument();

    click("Back");
    expect(screen.getByText(/Any sides\?/i)).toBeInTheDocument();
    click("Back");
    expect(screen.getByText(/How was the whole eggs cooked\?/i)).toBeInTheDocument();
    click("Back");
    expect(screen.getByText(/Which part of the eggs\?/i)).toBeInTheDocument();
    click("Back");
    // The protein family the player had chosen is restored, not lost.
    expect(screen.getByText(/Choose your victims/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue \(1\)/i })).toBeInTheDocument();
  });

  it("skipping every course leaves an empty meal that can still be filled in", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    click(/Start Game/i);
    click(/Dinner/i);
    click(/Start — 1 meal/i);

    click(/^No Carbs/i);
    click(/No protein — skip/i);
    click(/^No Sides/i);

    // The old flow ejected the player to the summary here, which is exactly
    // where they can't add the course they skipped by mistake.
    expect(screen.getByText(/Nothing logged for this meal yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Carbs/i })).toBeInTheDocument();

    click(/Finish — see my day/i);
    expect(screen.getByText(/0 items logged/i)).toBeInTheDocument();
  });

  it("sends snacks and drinks straight to their picker, then plays both in order", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    click(/Start Game/i);
    click(/Snacks/i);
    click(/Drinks/i);
    click(/Start — 2 meals/i);

    expect(screen.getByText(/Meal 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/What did you snack on\?/i)).toBeInTheDocument();
    click(/^Nuts/i);
    click(/Continue \(1\)/i);
    click(/Next: Drinks/i);

    expect(screen.getByText(/Meal 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/What did you drink\?/i)).toBeInTheDocument();
    click(/^Protein Shake/i);
    click(/Continue \(1\)/i);
    click(/Finish — see my day/i);

    expect(screen.getByText(/Level Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 items logged across 2 meals/i)).toBeInTheDocument();
  });

  it("hands the run's totals to onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<FoodGameModal open onOpenChange={vi.fn()} onSave={onSave} />);
    playBreakfast();
    click(/Finish — see my day/i);
    click(/Save to Today's Data/i);

    const toast = computeMacros(lookupFood("bread")!, "regular");
    const eggs = computeMacros(lookupFood("egg-whole")!, "regular", "panfried");
    expect(onSave).toHaveBeenCalledWith({
      kcal: toast.kcal + eggs.kcal,
      protein: Math.round((toast.protein + eggs.protein) * 10) / 10,
    });
  });

  it("omits the save button when there is nowhere to save", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    click(/Finish — see my day/i);
    expect(screen.queryByRole("button", { name: /Save to Today's Data/i })).not.toBeInTheDocument();
  });
});

describe("Food Track editing", () => {
  it("adds a meal that wasn't in the run from the tab strip", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    expect(screen.getByText(/Meal 1 of 1/i)).toBeInTheDocument();

    // The Lunch tab is an "Add" affordance until the meal is in the run.
    fireEvent.click(screen.getByRole("tab", { name: /Lunch.*Add/i }));

    expect(screen.getByText(/Meal 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick your carbs/i)).toBeInTheDocument();
  });

  it("removes a plated item without disturbing the rest of the meal", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();

    click(/Remove Toast/i);

    expect(screen.queryByText(/^Toast$/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Whole Eggs/).length).toBeGreaterThan(0);

    // The meal total is now the eggs alone — and so is the day's, so both the
    // footer bar and the header chip read it back.
    const eggs = computeMacros(lookupFood("egg-whole")!, "regular", "panfried");
    expect(screen.getAllByText(`${eggs.kcal} kcal`).length).toBeGreaterThan(0);
  });

  it("re-opens a course from the editor and cancels back out unchanged", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();

    click(/^Carbs/i);
    expect(screen.getByText(/Pick your carbs/i)).toBeInTheDocument();

    click(/Cancel/i);
    expect(screen.getByText(/Size it up/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Toast/).length).toBeGreaterThan(0);
  });

  it("swaps a cooking method from the editor and re-prices the row", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();

    // The method chip on the row is the control — its label is the method.
    fireEvent.click(screen.getByTitle(/Change how the whole eggs was cooked/i));
    click(/^Grilled/i);

    const grilled = computeMacros(lookupFood("egg-whole")!, "regular", "grilled");
    const row = screen.getAllByText(/Whole Eggs/)[0].closest("[data-plate-row]") as HTMLElement;
    expect(within(row).getByText(String(grilled.kcal))).toBeInTheDocument();
  });

  it("offers a share button on the summary", () => {
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    click(/Finish — see my day/i);
    expect(screen.getByRole("button", { name: /Share my day/i })).toBeInTheDocument();
  });
});

describe("Food Track persistence", () => {
  it("saves the run as it is built and offers it back as Continue", () => {
    const { unmount } = render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();

    const saved = loadRun();
    expect(saved?.drafts.breakfast).toBeTruthy();
    expect(saved?.activeMeal).toBe("breakfast");
    unmount();

    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Start Game/i })).not.toBeInTheDocument();
    click(/Continue/i);

    // Back on the meal, with the plate intact.
    expect(screen.getByText(/Size it up/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Whole Eggs/).length).toBeGreaterThan(0);
  });

  it("ignores a run saved on an earlier day", () => {
    const { unmount } = render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    unmount();

    // Age the stored run by a day — the calendar stamp is the whole reset rule.
    const key = "gglvlup:foodgame:run";
    const stored = JSON.parse(window.localStorage.getItem(key)!);
    window.localStorage.setItem(key, JSON.stringify({ ...stored, date: "2000-01-01" }));

    expect(loadRun()).toBeNull();
    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Start Game/i })).toBeInTheDocument();
  });

  it("Start Over wipes the day after a confirming second tap", () => {
    const { unmount } = render(<FoodGameModal open onOpenChange={vi.fn()} />);
    playBreakfast();
    unmount();

    render(<FoodGameModal open onOpenChange={vi.fn()} />);
    click(/Start Over/i);
    expect(loadRun()).not.toBeNull(); // one tap only arms it

    click(/Tap again to wipe/i);
    expect(loadRun()).toBeNull();
    expect(screen.getByRole("button", { name: /Start Game/i })).toBeInTheDocument();
  });
});
