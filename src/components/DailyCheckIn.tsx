import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Flame, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import GameButton from "@/components/game/GameButton";
import { pop } from "@/lib/fx";

interface DailyCheckInProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  currentDay: number;
  streak: number;
  streakProtected?: boolean;
  /** Persist today's weight (kg). May be async. */
  onSaveWeight: (weight: number) => void | Promise<void>;
  /** Dismiss without logging. */
  onLater: () => void;
}

const DailyCheckIn = ({
  open,
  onOpenChange,
  userName,
  currentDay,
  streak,
  streakProtected = false,
  onSaveWeight,
  onLater,
}: DailyCheckInProps) => {
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const medalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setWeight("");
      // Let the entrance animation settle, then bounce the medal.
      const t = setTimeout(() => pop(medalRef.current, 1.5), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  const parsed = Number(weight);
  const valid = weight !== "" && !Number.isNaN(parsed) && parsed > 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    await onSaveWeight(parsed);
    setSaving(false);
    onOpenChange(false);
  };

  const handleLater = () => {
    onLater();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="game-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="space-y-5">
            {/* Greeting */}
            <div className="space-y-2 text-center">
              <div
                ref={medalRef}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] text-3xl shadow-[0_4px_0_hsl(33,75%,28%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]"
              >
                👋
              </div>
              <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                Welcome back, {userName}!
              </Dialog.Title>
              <Dialog.Description asChild>
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
                  <span>Day {currentDay}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-[hsl(24,80%,45%)]">
                    <Flame className={`h-4 w-4 ${streakProtected ? "text-sky-500" : "text-[hsl(24,85%,52%)]"}`} />
                    {streak} day streak
                  </span>
                </div>
              </Dialog.Description>
            </div>

            {/* Weight prompt */}
            <div className="space-y-2">
              <label
                htmlFor="checkin-weight"
                className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <Scale className="h-3.5 w-3.5" />
                What's your weight today? (kg)
              </label>
              <Input
                id="checkin-weight"
                type="number"
                step="0.1"
                inputMode="decimal"
                autoFocus
                placeholder="e.g. 75.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                className="h-11 text-center text-lg"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <GameButton color="leaf" size="lg" className="w-full" disabled={!valid || saving} onClick={handleSave}>
                {saving ? "Saving..." : "Save Today's Weight"}
              </GameButton>
              <button
                type="button"
                onClick={handleLater}
                className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground"
              >
                Log it later
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default DailyCheckIn;
