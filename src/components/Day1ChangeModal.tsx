import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarClock } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import { parseDateInputValue } from "@/lib/utils";

interface Day1ChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user's current Day 1 (YYYY-MM-DD), or null if never set. */
  currentDay1: string | null;
  /** The Day 1 an admin has proposed (YYYY-MM-DD). */
  proposedDay1: string;
  /** Apply the proposed date. May be async. */
  onAccept: () => void | Promise<void>;
  /** Keep the current date and clear the proposal. May be async. */
  onReject: () => void | Promise<void>;
}

const pretty = (iso: string | null): string =>
  iso ? parseDateInputValue(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

/**
 * Shown on next login when an admin has proposed a new Day 1 date. The user
 * decides whether to accept it (their day numbering re-bases) or keep the
 * current date. Not dismissible without choosing.
 */
const Day1ChangeModal = ({ open, onOpenChange, currentDay1, proposedDay1, onAccept, onReject }: Day1ChangeModalProps) => {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    await action();
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="game-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] shadow-[0_4px_0_hsl(33,75%,28%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]">
                <CalendarClock className="h-7 w-7 text-[hsl(30,55%,25%)]" />
              </div>
              <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                Day 1 change requested
              </Dialog.Title>
              <Dialog.Description className="text-sm font-bold text-muted-foreground">
                An admin has proposed a new start date for your challenge. Accepting re-bases your day
                numbering — your logged entries are kept.
              </Dialog.Description>
            </div>

            <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)] px-4 py-3">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current</p>
                <p className="font-display text-sm font-bold text-card-foreground">{pretty(currentDay1)}</p>
              </div>
              <span className="text-lg text-muted-foreground" aria-hidden>→</span>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(70,45%,32%)]">Proposed</p>
                <p className="font-display text-sm font-bold text-[hsl(70,45%,28%)]">{pretty(proposedDay1)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <GameButton color="leaf" size="lg" className="w-full" disabled={busy} onClick={() => void run(onAccept)}>
                {busy ? "Saving..." : "Accept new Day 1"}
              </GameButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(onReject)}
                className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground disabled:opacity-50"
              >
                Keep my current date
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Day1ChangeModal;
