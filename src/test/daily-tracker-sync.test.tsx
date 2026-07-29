import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import DailyTracker from "@/components/DailyTracker";
import type { DailyLog } from "@/lib/mockData";

const row = (over: Partial<DailyLog> & { date: string; day: number }): DailyLog => ({
  weight: null,
  calories: null,
  protein: null,
  water: null,
  exercise: "None",
  steps: null,
  ...over,
});

/** Value currently in the input for a given column of a given row. */
const cell = (dayIndex: number, column: number) => {
  const rows = screen.getAllByRole("row").slice(1); // drop the header
  const inputs = rows[dayIndex].querySelectorAll("input");
  return (inputs[column] as HTMLInputElement | undefined)?.value;
};

describe("Daily Log stays in sync with saves made elsewhere", () => {
  // Reproduces the reported sequence: the user fills Today's Data, saves, and
  // then opens the Daily Log. The saved row count never changes, so the old
  // length-keyed effect left the table showing stale values — and saving from
  // it wrote those stale values back over the fresh ones.
  it("picks up a save that changes values but not the row count", () => {
    const before = [row({ date: "2026-07-28", day: 1, weight: 80 }), row({ date: "2026-07-29", day: 2, weight: 79 })];
    // Same two dates — Today's Data filled in calories for day 2.
    const after = [before[0], row({ date: "2026-07-29", day: 2, weight: 79, calories: 1850 })];

    const { rerender } = render(<DailyTracker logs={before} onUpdate={vi.fn()} />);
    expect(cell(1, 1)).toBe(""); // calories empty

    rerender(<DailyTracker logs={after} onUpdate={vi.fn()} />);
    expect(cell(1, 1)).toBe("1850");
  });

  it("does not write stale values back when saving", () => {
    const onUpdate = vi.fn();
    const before = [row({ date: "2026-07-29", day: 1, weight: 79 })];
    const after = [row({ date: "2026-07-29", day: 1, weight: 79, calories: 1850, protein: 140 })];

    const { rerender } = render(<DailyTracker logs={before} onUpdate={onUpdate} />);
    rerender(<DailyTracker logs={after} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const saved = onUpdate.mock.calls[0][0] as DailyLog[];
    expect(saved[0].calories).toBe(1850);
    expect(saved[0].protein).toBe(140);
  });

  it("keeps edits typed here that have not been saved yet", () => {
    const before = [row({ date: "2026-07-29", day: 1, weight: 79 })];
    const after = [row({ date: "2026-07-29", day: 1, weight: 79, calories: 1850 })];

    const { rerender } = render(<DailyTracker logs={before} onUpdate={vi.fn()} />);

    // User starts typing a protein value in the table…
    const proteinInput = screen.getAllByRole("row")[1].querySelectorAll("input")[2];
    fireEvent.change(proteinInput, { target: { value: "155" } });

    // …and meanwhile a save from Today's Data lands.
    rerender(<DailyTracker logs={after} onUpdate={vi.fn()} />);

    expect(cell(0, 1)).toBe("1850"); // incoming calories adopted
    expect(cell(0, 2)).toBe("155"); // their in-flight protein survived
  });

  it("never mutates the rows it was handed", () => {
    // These objects live inside the parent's memoised day range, which quests,
    // streaks and trophies are all scored from.
    const logs = [row({ date: "2026-07-29", day: 1, weight: 79 })];
    const snapshot = { ...logs[0] };

    render(<DailyTracker logs={logs} onUpdate={vi.fn()} />);
    const caloriesInput = screen.getAllByRole("row")[1].querySelectorAll("input")[1];
    fireEvent.change(caloriesInput, { target: { value: "2400" } });

    expect(logs[0]).toEqual(snapshot);
  });
});
