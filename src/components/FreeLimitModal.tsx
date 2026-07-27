import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PartyPopper, Sparkles } from "lucide-react";
import { toast } from "sonner";
import GameButton from "@/components/game/GameButton";

interface FreeLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The size of the free history window (e.g. 30 days). */
  dayLimit: number;
  /** The full run length premium unlocks (e.g. 100). */
  challengeDays: number;
  /** The "Get Premium" button, rendered as a secondary action. */
  getPremiumSlot?: ReactNode;
  /** Starts the one-time 7-day trial. Omitted/hidden once the trial is used. */
  onStartTrial?: () => Promise<void>;
  /** Whether the one-time trial has already been used. */
  trialUsed?: boolean;
}

/**
 * Shown once when a free user has logged {dayLimit} days. Logging today stays
 * free forever — this celebrates the milestone and pitches what premium adds
 * (full history, export, and more), with the free trial as the primary nudge.
 */
const FreeLimitModal = ({
  open,
  onOpenChange,
  dayLimit,
  challengeDays,
  getPremiumSlot,
  onStartTrial,
  trialUsed = false,
}: FreeLimitModalProps) => {
  const [starting, setStarting] = useState(false);
  const canTrial = !!onStartTrial && !trialUsed;

  const handleTrial = async () => {
    if (!onStartTrial) return;
    setStarting(true);
    try {
      await onStartTrial();
      toast.success("7-day premium trial started — full history unlocked! ✨");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't start the trial — try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="game-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(268,45%,32%)] bg-gradient-to-b from-[hsl(268,50%,66%)] to-[hsl(268,46%,50%)] shadow-[0_4px_0_hsl(268,45%,32%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.4)]">
                <PartyPopper className="h-7 w-7 text-white" />
              </div>
              <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                {dayLimit} days logged — nice! 🎉
              </Dialog.Title>
              <Dialog.Description className="text-sm font-bold text-muted-foreground">
                Keep logging every day for free. Premium unlocks your <strong>full history</strong> beyond the last{" "}
                {dayLimit} days, data export, and every cosmetic theme — all the way to Day {challengeDays}.
              </Dialog.Description>
            </div>

            <div className="space-y-2">
              {canTrial && (
                <GameButton color="leaf" size="lg" className="w-full" disabled={starting} onClick={() => void handleTrial()}>
                  <Sparkles className="h-4 w-4" />
                  {starting ? "Starting…" : "Try Premium free for 7 days"}
                </GameButton>
              )}
              {getPremiumSlot && <div className="flex justify-center [&>*]:w-full">{getPremiumSlot}</div>}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground"
              >
                Maybe later
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default FreeLimitModal;
