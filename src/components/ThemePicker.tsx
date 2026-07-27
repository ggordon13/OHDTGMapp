import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Palette, Lock, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { THEMES, themeSwatch, type Theme } from "@/lib/themes";
import type { TrialState } from "@/lib/access";
import GameButton from "@/components/game/GameButton";
import GetPremiumButton from "@/components/GetPremiumButton";
import { cn } from "@/lib/utils";

interface ThemePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The theme the user has chosen (may be a premium one that's reverted). */
  selectedKey: string;
  /** The theme actually applied right now (default if a premium one reverted). */
  appliedKey: string;
  isPremium: boolean;
  trial: TrialState;
  onSelect: (key: string) => Promise<void>;
  onStartTrial: () => Promise<void>;
}

const ThemeCell = ({
  theme,
  applied,
  locked,
  busy,
  onClick,
}: {
  theme: Theme;
  applied: boolean;
  locked: boolean;
  busy: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    aria-pressed={applied}
    className={cn(
      "group relative overflow-hidden rounded-xl border-2 text-left transition disabled:opacity-60",
      applied ? "border-[hsl(42,90%,50%)] ring-2 ring-[hsl(42,90%,55%)]/50" : "border-[hsl(33,28%,55%)] hover:border-[hsl(33,28%,42%)]",
    )}
  >
    <div className="h-16 w-full" style={{ background: themeSwatch(theme) }} />
    <div className="flex items-center justify-between gap-1 bg-[hsl(40,48%,94%)] px-2.5 py-1.5">
      <span className="truncate font-display text-xs font-bold text-card-foreground">{theme.name}</span>
      {theme.tier === "premium" && (
        <span className="shrink-0 rounded-full bg-[hsl(42,90%,60%)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[hsl(36,70%,34%)]">
          Premium
        </span>
      )}
    </div>
    {applied && (
      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[hsl(42,90%,35%)] bg-[hsl(42,90%,55%)] text-[hsl(26,50%,18%)] shadow">
        <Check className="h-3 w-3" strokeWidth={4} />
      </span>
    )}
    {locked && (
      <span className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
        <Lock className="h-5 w-5 text-white/90" strokeWidth={2.5} />
      </span>
    )}
  </button>
);

/** Cosmetic theme gallery: free themes for everyone, the rest a premium perk. */
const ThemePicker = ({
  open,
  onOpenChange,
  appliedKey,
  isPremium,
  trial,
  onSelect,
  onStartTrial,
}: ThemePickerProps) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);

  const handleSelect = async (theme: Theme) => {
    if (theme.key === appliedKey || busyKey) return;
    if (theme.tier === "premium" && !isPremium) {
      toast.info("That's a premium theme — start a free trial or go Premium to use it.");
      return;
    }
    setBusyKey(theme.key);
    try {
      await onSelect(theme.key);
      toast.success(`Theme set: ${theme.name}`);
    } catch {
      toast.error("Couldn't switch theme — try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      await onStartTrial();
      toast.success("7-day premium trial started — all themes unlocked! ✨");
    } catch {
      toast.error("Couldn't start the trial — try again.");
    } finally {
      setStartingTrial(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-[60] flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="shrink-0 border-b-2 border-[hsl(33,28%,62%)] px-6 pb-3 pt-5">
            <Dialog.Title className="flex items-center gap-2 font-display text-2xl font-bold text-card-foreground">
              <Palette className="h-5 w-5 text-[hsl(268,45%,52%)]" /> Themes
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-sm font-semibold text-muted-foreground">
              Re-skin your table. Premium unlocks the full palette.
            </Dialog.Description>
            <Dialog.Close className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {isPremium && trial.active && (
              <div className="flex items-center gap-2 rounded-xl border-2 border-[hsl(42,90%,50%)]/50 bg-[hsl(45,82%,90%)] px-3 py-2">
                <Sparkles className="h-4 w-4 shrink-0 text-[hsl(36,80%,42%)]" />
                <span className="text-xs font-bold text-[hsl(30,55%,30%)]">
                  Premium trial active — {trial.daysLeft} day{trial.daysLeft === 1 ? "" : "s"} left. Enjoy every theme!
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {THEMES.map((theme) => (
                <ThemeCell
                  key={theme.key}
                  theme={theme}
                  applied={theme.key === appliedKey}
                  locked={theme.tier === "premium" && !isPremium}
                  busy={busyKey === theme.key}
                  onClick={() => void handleSelect(theme)}
                />
              ))}
            </div>

            {/* Upsell — only when the user can't use premium themes yet. */}
            {!isPremium && (
              <div className="space-y-2.5 rounded-xl border-2 border-[hsl(33,28%,58%)] bg-[hsl(37,40%,84%)] p-3">
                {trial.used ? (
                  <p className="text-xs font-bold text-[hsl(30,55%,30%)]">
                    Your free trial has ended. Go Premium to unlock every theme (and everything else).
                  </p>
                ) : (
                  <p className="text-xs font-bold text-[hsl(30,55%,30%)]">
                    Unlock all themes — try Premium free for 7 days. No charge; it reverts to free automatically.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {!trial.used && (
                    <GameButton color="leaf" size="sm" disabled={startingTrial} onClick={() => void handleStartTrial()}>
                      <Sparkles className="h-4 w-4" />
                      {startingTrial ? "Starting…" : "Start free 7-day trial"}
                    </GameButton>
                  )}
                  <GetPremiumButton size="sm" />
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ThemePicker;
