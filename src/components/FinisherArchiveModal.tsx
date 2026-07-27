import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Star, X } from "lucide-react";
import RunReport from "@/components/RunReport";
import type { FinishedRun } from "@/hooks/useHundredDay";
import { parseDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FinisherArchiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runs: FinishedRun[];
  userName: string;
}

const pretty = (iso: string): string =>
  parseDateInputValue(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Everything behind the golden stars: one tab per finished 100-day run, each
 * showing that run's report card and the trophies it earned. This is where the
 * trophy case goes when it resets for the next run.
 */
const FinisherArchiveModal = ({ open, onOpenChange, runs, userName }: FinisherArchiveModalProps) => {
  // Newest run first — that's the one the user just finished.
  const ordered = [...runs].sort((a, b) => b.runNumber - a.runNumber);
  const [selected, setSelected] = useState<number | null>(ordered[0]?.runNumber ?? null);

  // Keep the selection valid as runs load in or a new one is finished.
  useEffect(() => {
    if (!ordered.some((r) => r.runNumber === selected)) {
      setSelected(ordered[0]?.runNumber ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  const run = ordered.find((r) => r.runNumber === selected) ?? ordered[0] ?? null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] shadow-[0_3px_0_hsl(33,75%,28%),inset_0_2px_0_rgba(255,255,255,0.5)]">
              <Star className="h-5 w-5 fill-[hsl(48,100%,85%)] text-[hsl(26,50%,18%)]" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="font-display text-xl font-bold text-card-foreground">
                Finisher Archive
              </Dialog.Title>
              <Dialog.Description className="text-sm font-bold text-muted-foreground">
                {runs.length === 0
                  ? "Finish a 100-day challenge to earn your first golden star."
                  : `${userName} has finished ${runs.length} 100-day challenge${runs.length === 1 ? "" : "s"}. Every run keeps its own trophies.`}
              </Dialog.Description>
            </div>
          </div>

          {ordered.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ordered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.runNumber)}
                  aria-pressed={r.runNumber === run?.runNumber}
                  className={cn(
                    "rounded-lg border-2 px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition",
                    r.runNumber === run?.runNumber
                      ? "border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] text-[hsl(26,50%,18%)] shadow-[0_2px_0_hsl(33,75%,28%)]"
                      : "border-[hsl(33,28%,58%)] bg-[hsl(37,40%,82%)] text-muted-foreground hover:bg-[hsl(40,48%,88%)]",
                  )}
                >
                  Run {r.runNumber}
                </button>
              ))}
            </div>
          )}

          {run ? (
            <div className="space-y-3">
              <div className="game-tag flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-display text-sm font-bold text-card-foreground">
                  Run {run.runNumber} · 100 days
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {pretty(run.startDate)} → {pretty(run.endDate)}
                </span>
              </div>
              <RunReport summary={run.summary} badges={run.badges} />
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">
              Nothing archived yet. Log your way to Day 100 and your first star lands here.
            </p>
          )}

          <Dialog.Close className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default FinisherArchiveModal;
