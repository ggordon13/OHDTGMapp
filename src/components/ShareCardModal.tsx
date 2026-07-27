import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ShareCard, { type ShareCardData } from "@/components/ShareCard";
import GameButton from "@/components/game/GameButton";
import { nodeToPngBlob, shareOrDownload } from "@/lib/shareImage";

interface ShareCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ShareCardData;
}

/** Preview + share/download of a branded progress card. */
const ShareCardModal = ({ open, onOpenChange, data }: ShareCardModalProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await nodeToPngBlob(cardRef.current, 2);
      if (!blob) throw new Error("render failed");
      const res = await shareOrDownload(blob, {
        filename: "gglvlup-progress.png",
        title: "My GGLvlup progress",
        text: "Leveling up my life with GGLvlup 💪",
      });
      if (res === "downloaded") toast.success("Image saved — share it anywhere! 🎉");
      else if (res === "failed") toast.error("Couldn't create the image — try again.");
    } catch {
      toast.error("Couldn't create the image — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-[60] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="shrink-0 border-b-2 border-[hsl(33,28%,62%)] px-6 pb-3 pt-5">
            <Dialog.Title className="flex items-center gap-2 font-display text-2xl font-bold text-card-foreground">
              <Share2 className="h-5 w-5 text-[hsl(178,52%,38%)]" /> Share your progress
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-sm font-semibold text-muted-foreground">
              Post your card to bring a friend along.
            </Dialog.Description>
            <Dialog.Close className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {/* Preview. The modal's inner width matches the 400px card, so it
                sits flush on desktop and scrolls horizontally on tiny screens. */}
            <div className="overflow-x-auto">
              <ShareCard ref={cardRef} {...data} />
            </div>
            <GameButton color="teal" size="lg" className="w-full" disabled={busy} onClick={handleShare}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              {busy ? "Preparing…" : "Share / Save image"}
            </GameButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ShareCardModal;
