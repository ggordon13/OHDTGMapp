import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Lock } from "lucide-react";

interface FreeLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The last day the free plan allows logging (e.g. 21). */
  dayLimit: number;
  /** The full challenge length premium unlocks (e.g. 100). */
  challengeDays: number;
  /** The "Get Premium" request button, rendered as the primary action. */
  getPremiumSlot?: ReactNode;
}

/**
 * Shown once when a free user reaches the Day {dayLimit} logging cap. Their
 * data is safe; this just explains the wall and offers the upgrade.
 */
const FreeLimitModal = ({ open, onOpenChange, dayLimit, challengeDays, getPremiumSlot }: FreeLimitModalProps) => (
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
              <Lock className="h-7 w-7 text-white" />
            </div>
            <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
              You've reached Day {dayLimit}
            </Dialog.Title>
            <Dialog.Description className="text-sm font-bold text-muted-foreground">
              That's the end of the free plan. Everything you've logged so far is saved — but logging
              Day {dayLimit + 1} onward needs premium. Go premium to keep going all the way to Day {challengeDays}.
            </Dialog.Description>
          </div>

          <div className="space-y-2">
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

export default FreeLimitModal;
