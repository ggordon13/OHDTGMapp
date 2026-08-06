import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import GameButton from "@/components/game/GameButton";
import { ACTION_BUTTON } from "./ui";
import { prepareCardAssets } from "@/lib/canvasDraw";
import {
  CARD_WIDTH,
  foodCardHeight,
  paintFoodCard,
  type FoodShareData,
} from "@/lib/foodGame/shareCard";
import { canvasToPngBlob, shareOrDownload } from "@/lib/shareImage";
import { track } from "@/lib/telemetry";

interface FoodShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FoodShareData;
}

/**
 * Preview and share of the day's food diary as an image.
 *
 * Sits above the game (z-[70] against its z-50) rather than replacing it, so
 * dismissing the share sheet drops the player back on the summary they were
 * looking at instead of ending their run.
 */
const FoodShareModal = ({ open, onOpenChange, data }: FoodShareModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const height = foodCardHeight(data);

  useEffect(() => {
    if (!open) return;
    let active = true;
    // The canvas only exists while the dialog is mounted, and the assets are
    // awaited — so re-check on the way back that this preview is still the one
    // on screen before painting into it.
    void prepareCardAssets().then((assets) => {
      if (active && canvasRef.current) paintFoodCard(canvasRef.current, data, assets);
    });
    return () => {
      active = false;
    };
    // `data` is rebuilt on every render of the parent, so key the repaint on
    // the values that actually change what gets drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.kcal, data.protein, data.itemCount, data.meals.length, data.date]);

  const share = async () => {
    if (!canvasRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      if (!blob) throw new Error("render failed");
      const res = await shareOrDownload(blob, {
        filename: `gglvlup-food-${data.date}.png`,
        title: "My food diary",
        text: `${data.kcal.toLocaleString()} kcal · ${data.protein}g protein — tracked with GGLvlup 🍽️`,
      });
      if (res === "failed") {
        toast.error("Couldn't create the image — try again.");
      } else {
        if (res === "downloaded") toast.success("Image saved — share it anywhere! 🎉");
        track("food_game_shared", { method: res, kcal: data.kcal, meals: data.meals.length });
      }
    } catch {
      toast.error("Couldn't create the image — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-[70] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col p-0 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="shrink-0 border-b-2 border-[hsl(33,28%,62%)] px-6 pb-3 pt-5">
            <Dialog.Title className="flex items-center gap-2 font-display text-xl font-bold text-card-foreground">
              <Share2 className="h-5 w-5 text-[hsl(178,52%,38%)]" /> Share your day
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-sm font-semibold text-muted-foreground">
              Post the card — calories, protein and every meal.
            </Dialog.Description>
            <Dialog.Close className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="overflow-x-auto">
              <canvas
                ref={canvasRef}
                width={CARD_WIDTH * 2}
                height={height * 2}
                style={{ width: CARD_WIDTH, height }}
                className="block shrink-0"
                role="img"
                aria-label={`Food diary: ${data.kcal} calories and ${data.protein} grams of protein across ${data.meals.length} meals`}
              />
            </div>
            <div className="flex justify-center">
              <GameButton color="teal" size="lg" className={ACTION_BUTTON} disabled={busy} onClick={() => void share()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                {busy ? "Preparing…" : "Share / Save image"}
              </GameButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default FoodShareModal;
