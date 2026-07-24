import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PartyPopper } from "lucide-react";
import GameButton from "@/components/game/GameButton";

interface ChallengeCompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persist that the user finished Day 30 (so this fires once). May be async. */
  onDismiss: () => void | Promise<void>;
}

/**
 * Celebratory takeover when the user finishes their Day-30 data. Results are
 * revealed the next day, so this just marks the finish and cheers them on.
 */
const ChallengeCompleteModal = ({ open, onOpenChange, onDismiss }: ChallengeCompleteModalProps) => {
  const [busy, setBusy] = useState(false);

  const done = async () => {
    if (busy) return;
    setBusy(true);
    await onDismiss();
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="game-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(268,45%,30%)] bg-gradient-to-b from-[hsl(268,50%,64%)] to-[hsl(268,46%,48%)] shadow-[0_4px_0_hsl(268,45%,30%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.4)]">
              <PartyPopper className="h-7 w-7 text-white" />
            </div>
            <div className="space-y-1">
              <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                Challenge complete! 🎉
              </Dialog.Title>
              <Dialog.Description className="text-sm font-bold text-muted-foreground">
                You logged all 30 days of the challenge. Winners are revealed next time you open the app —
                once everyone's finished their final day.
              </Dialog.Description>
            </div>
            <GameButton color="purple" size="lg" className="w-full" disabled={busy} onClick={() => void done()}>
              {busy ? "Saving…" : "Awesome!"}
            </GameButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ChallengeCompleteModal;
