import { useEffect, useMemo, useRef, useState } from "react";
import { DailyLog, exerciseOptions } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ChevronLeft, ChevronRight, ClipboardList, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import { pop } from "@/lib/fx";

interface DailyTrackerProps {
  logs: DailyLog[];
  onUpdate: (logs: DailyLog[]) => void;
  /** Date (YYYY-MM-DD) of the current day, highlighted as today's logging row. */
  highlightDate?: string;
  /** Rendered below the table (e.g. a premium upsell once the free cap is hit). */
  footer?: React.ReactNode;
  /** Small chip shown in the panel header (e.g. a free-plan day counter). */
  statusBadge?: React.ReactNode;
  /** Inclusive date range (YYYY-MM-DD) of an active 30-day challenge; rows in it get a chip. */
  challengeStart?: string;
  challengeEnd?: string;
  /** Days 1–100 have been locked in: the log is a read-only record. */
  locked?: boolean;
}

const PAGE_SIZE = 7;

/** Columns the user can type into — exactly what the merge below has to protect. */
const EDITABLE_KEYS = ["weight", "calories", "protein", "water", "exercise", "steps"] as const;

const PagerButton = ({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[hsl(22,45%,14%)] bg-gradient-to-b from-[hsl(26,36%,38%)] to-[hsl(24,40%,26%)] text-[hsl(42,80%,72%)] shadow-[0_2px_0_hsl(22,45%,12%)] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:saturate-50"
  >
    {children}
  </button>
);

const DailyTracker = ({
  logs,
  onUpdate,
  highlightDate,
  footer,
  statusBadge,
  challengeStart,
  challengeEnd,
  locked = false,
}: DailyTrackerProps) => {
  const [editedLogs, setEditedLogs] = useState<DailyLog[]>(logs);
  const [page, setPage] = useState(Math.max(0, Math.floor((logs.length - 1) / PAGE_SIZE)));
  const todayRowRef = useRef<HTMLTableRowElement>(null);
  /** The saved rows we last merged from — how we tell an unsaved edit apart
   *  from a value that simply hasn't changed. */
  const mergedFrom = useRef<DailyLog[]>(logs);

  // Fingerprint of what's actually saved. The parent hands us a fresh array on
  // most renders (the free-plan window is a `.slice()`), so keying the merge on
  // the array's identity would re-run it forever.
  const savedSignature = useMemo(
    () =>
      logs
        .map((l) => [l.date, l.weight, l.calories, l.protein, l.water, l.exercise, l.steps].join(","))
        .join("|"),
    [logs],
  );

  // Adopt saves made elsewhere — Today's Data, the daily check-in — without
  // discarding edits typed here but not yet saved.
  //
  // This used to key on `logs.length`, which only changes when a new day
  // arrives. Saving calories from Today's Data leaves the row count identical,
  // so the table never picked the value up: it kept rendering the stale row
  // and, worse, "Save Progress" wrote that stale row straight back, wiping the
  // fields that had just been saved.
  useEffect(() => {
    const previous = new Map(mergedFrom.current.map((l) => [l.date, l]));
    setEditedLogs((current) => {
      const own = new Map(current.map((l) => [l.date, l]));
      return logs.map((incoming) => {
        const mine = own.get(incoming.date);
        const before = previous.get(incoming.date);
        if (!mine || !before) return incoming; // a day we haven't rendered before
        const merged = { ...incoming };
        for (const key of EDITABLE_KEYS) {
          // Differs from what was saved last time we looked → unsaved edit, keep it.
          if (mine[key] !== before[key]) (merged as Record<string, unknown>)[key] = mine[key];
        }
        return merged;
      });
    });
    mergedFrom.current = logs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignature]);

  // Jump to the newest page only when the range actually grows (a new day).
  useEffect(() => {
    setPage(Math.max(0, Math.floor((logs.length - 1) / PAGE_SIZE)));
  }, [logs.length]);

  // Draw the eye to today's row whenever it comes into view.
  useEffect(() => {
    if (todayRowRef.current) pop(todayRowRef.current, 1.04);
  }, [page, highlightDate]);

  const startIdx = page * PAGE_SIZE;
  const visibleLogs = editedLogs.slice(startIdx, startIdx + PAGE_SIZE);
  const totalPages = Math.ceil(editedLogs.length / PAGE_SIZE);

  const handleChange = (index: number, field: keyof DailyLog, value: string) => {
    if (locked) return;
    const globalIdx = startIdx + index;
    const numFields: (keyof DailyLog)[] = ["weight", "calories", "protein", "water", "steps"];
    const parsed = numFields.includes(field) ? (value === "" ? null : Number(value)) : value;

    // Replace the row rather than mutating it. These row objects arrive from
    // the parent's memoised day range, so editing one in place also edited the
    // copy that quests, streaks and trophies are scored from — uncommitted
    // keystrokes were silently feeding the gamification maths.
    setEditedLogs((current) =>
      current.map((row, i) => (i === globalIdx ? { ...row, [field]: parsed } : row)),
    );
  };

  const handleSave = () => {
    if (locked) return;
    onUpdate(editedLogs);
    toast.success("Progress saved! Keep going 💪");
  };

  const columns: { key: keyof DailyLog; label: string; unit: string; type: string }[] = [
    { key: "weight", label: "Weight", unit: "kg", type: "number" },
    { key: "calories", label: "Calories", unit: "kcal", type: "number" },
    { key: "protein", label: "Protein", unit: "g", type: "number" },
    { key: "water", label: "Water", unit: "glasses", type: "number" },
    { key: "exercise", label: "Exercise", unit: "", type: "select" },
    { key: "steps", label: "Steps", unit: "", type: "number" },
  ];

  return (
    <GamePanel
      title="Daily Log"
      icon={<ClipboardList className="h-4 w-4" />}
      color="leaf"
      right={
        <div className="flex items-center gap-2">
          {statusBadge}
          <div className="flex items-center gap-1.5">
            <PagerButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </PagerButton>
            <span className="game-tag px-2 py-0.5 text-xs font-bold text-muted-foreground">
              Week {page + 1} of {totalPages}
            </span>
            <PagerButton onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </PagerButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[hsl(33,28%,60%)]">
                <th className="px-3 py-2.5 text-left font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Day</th>
                <th className="px-3 py-2.5 text-left font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Date</th>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2.5 text-left font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                    {col.unit && <span className="ml-1 opacity-60">({col.unit})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log, idx) => {
                const isToday = highlightDate != null && log.date === highlightDate;
                return (
                  <tr
                    key={log.day}
                    ref={isToday ? todayRowRef : undefined}
                    className={cn(
                      "border-b border-[hsl(33,28%,72%)] transition-colors last:border-0",
                      isToday
                        ? "bg-[hsl(84,48%,52%)]/20 ring-2 ring-inset ring-[hsl(84,45%,40%)]/50"
                        : "hover:bg-[hsl(36,38%,80%)]/40",
                    )}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                          isToday
                            ? "bg-gradient-to-b from-[hsl(84,46%,50%)] to-[hsl(70,50%,38%)] text-white shadow-[0_2px_0_hsl(70,50%,22%)]"
                            : "bg-[hsl(6,60%,55%)]/15 text-[hsl(6,55%,42%)]",
                        )}
                      >
                        {log.day}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        {log.date}
                        {isToday && (
                          <span className="rounded-full border border-[hsl(84,45%,28%)] bg-gradient-to-b from-[hsl(84,46%,50%)] to-[hsl(70,50%,38%)] px-1.5 py-px font-display text-[9px] font-bold uppercase tracking-wide text-white shadow-[0_1px_0_hsl(84,45%,24%)]">
                            Today
                          </span>
                        )}
                        {challengeStart != null && challengeEnd != null && log.date >= challengeStart && log.date <= challengeEnd && (
                          <span
                            title="Part of your 30-day challenge"
                            className="rounded-full border border-[hsl(268,45%,32%)] bg-gradient-to-b from-[hsl(268,50%,62%)] to-[hsl(268,46%,48%)] px-1.5 py-px font-display text-[9px] font-bold uppercase tracking-wide text-white shadow-[0_1px_0_hsl(268,45%,30%)]"
                          >
                            ⚔ 30d
                          </span>
                        )}
                      </div>
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-2 py-1.5">
                        {col.type === "select" ? (
                          <Select
                            value={(log[col.key] as string) || "None"}
                            disabled={locked}
                            onValueChange={(value) => handleChange(idx, col.key, value)}
                          >
                            <SelectTrigger className="h-8 border-transparent bg-transparent text-sm transition-colors hover:border-input focus:border-input data-[state=open]:border-input">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {exerciseOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={col.type}
                            placeholder={isToday ? "0" : ""}
                            value={log[col.key] ?? ""}
                            readOnly={locked}
                            disabled={locked}
                            onChange={(e) => handleChange(idx, col.key, e.target.value)}
                            className="h-8 border-transparent bg-transparent text-sm shadow-none transition-colors hover:border-input focus:border-input focus:bg-[hsl(40,48%,94%)] disabled:cursor-default disabled:opacity-100"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {footer}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {locked ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-[hsl(6,62%,42%)]">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              This challenge is locked in — its log is a permanent record and can no longer be edited.
            </p>
          ) : highlightDate != null && visibleLogs.some((l) => l.date === highlightDate) ? (
            <p className="text-xs font-bold text-[hsl(70,45%,32%)]">
              Fill in the highlighted <span className="uppercase">Today</span> row, then save.
            </p>
          ) : (
            <span className="hidden sm:block" />
          )}
          {!locked && (
            <GameButton onClick={handleSave} color="leaf" className="w-full shrink-0 whitespace-nowrap sm:w-auto">
              <Save className="h-4 w-4" />
              Save Progress
            </GameButton>
          )}
        </div>
      </div>
    </GamePanel>
  );
};

export default DailyTracker;
