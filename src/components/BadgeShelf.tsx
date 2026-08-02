import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Award, ChevronDown, Lock, X } from "lucide-react";
import { Badge } from "@/lib/gamification";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import TrophyHex from "@/components/game/TrophyHex";
import { pop, sparkle } from "@/lib/fx";
import { cn } from "@/lib/utils";

type BadgeWithState = Badge & { unlocked: boolean };

interface BadgeShelfProps {
  badges: BadgeWithState[];
  /** Which 100-day run this shelf belongs to; shown once the user has restarted. */
  runNumber?: number;
  /**
   * Collapsed state. Only meaningful alongside `onToggleCollapsed` — pass
   * neither for the always-open desktop shelf.
   */
  collapsed?: boolean;
  /** Supplying this makes the panel collapsible (the phone layout does). */
  onToggleCollapsed?: () => void;
}

/** Hexagonal badge. `size` scales the face for the modal's list rows. */
const BadgeHex = ({ badge, size = "h-14 w-14 text-2xl" }: { badge: BadgeWithState; size?: string }) => {
  const hexRef = useRef<HTMLDivElement>(null);
  const wasUnlocked = useRef(badge.unlocked);

  // Freshly earned badge: pop + star ring. Already-earned ones mount quietly.
  useEffect(() => {
    if (badge.unlocked && !wasUnlocked.current) {
      pop(hexRef.current, 1.8);
      sparkle(hexRef.current, 10);
    }
    wasUnlocked.current = badge.unlocked;
  }, [badge.unlocked]);

  return (
    <TrophyHex
      ref={hexRef}
      tier={badge.tier}
      icon={badge.icon}
      iconColor={badge.iconColor}
      locked={!badge.unlocked}
      size={size}
    />
  );
};

const BadgeShelf = ({ badges, runNumber, collapsed = false, onToggleCollapsed }: BadgeShelfProps) => {
  const [showLocked, setShowLocked] = useState(false);
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);
  const isCollapsed = onToggleCollapsed != null && collapsed;

  return (
    <GamePanel
      title="Trophy Case"
      icon={<Award className="h-4 w-4" />}
      color="gold"
      className={isCollapsed ? "h-full" : undefined}
      onTitleClick={onToggleCollapsed}
      collapsed={isCollapsed}
      // The collapsed tile is its own full-width control, so the corner chips
      // would only collide with it.
      right={
        isCollapsed ? undefined : (
          <div className="flex items-center gap-1.5">
            {runNumber != null && runNumber > 1 && (
              <span
                className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                title="Your trophy case resets each 100-day run — earlier runs live in your finisher archive."
              >
                Run {runNumber}
              </span>
            )}
            <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {unlocked.length}/{badges.length} unlocked
            </span>
          </div>
        )
      }
    >
      {isCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(40,90%,58%)] to-[hsl(36,85%,46%)] px-3 py-3 font-display text-sm font-bold uppercase tracking-wide text-[hsl(26,50%,18%)] shadow-[0_3px_0_hsl(33,75%,28%)] transition hover:brightness-110 active:translate-y-[2px] active:shadow-[0_1px_0_hsl(33,75%,28%)]"
        >
          <span className="flex items-center gap-1.5">
            <Award className="h-4 w-4" />
            Trophies
            <ChevronDown className="h-4 w-4 -rotate-90" strokeWidth={3} />
          </span>
          <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[hsl(33,75%,28%)]">
            {unlocked.length}/{badges.length}
          </span>
        </button>
      )}

      <div className={cn("space-y-4", isCollapsed && "hidden")}>
        {unlocked.length === 0 ? (
          <p className="text-sm font-semibold text-muted-foreground">
            No trophies yet — log your days and hit your targets to start unlocking them.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6">
            {unlocked.map((b) => (
              <div key={b.key} className="flex flex-col items-center gap-1.5 text-center" title={b.description}>
                <BadgeHex badge={b} />
                <span className="font-display text-[11px] font-semibold leading-tight text-card-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        )}

        {locked.length > 0 && (
          <div className="flex justify-end">
            <GameButton color="wood" size="sm" onClick={() => setShowLocked(true)}>
              <Lock className="h-3.5 w-3.5" />
              {locked.length} to unlock
            </GameButton>
          </div>
        )}
      </div>

      <Dialog.Root open={showLocked} onOpenChange={setShowLocked}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <Dialog.Title className="font-display text-xl font-bold text-card-foreground">Trophies to Unlock</Dialog.Title>
            </div>
            <Dialog.Description className="sr-only">Badges you can still earn and how to earn them.</Dialog.Description>

            {locked.length === 0 ? (
              <p className="text-sm font-semibold text-muted-foreground">You've unlocked every trophy — legendary! 🏆</p>
            ) : (
              <div className="space-y-2.5">
                {locked.map((b) => (
                  <div key={b.key} className="game-tag flex items-center gap-3 px-3 py-2.5">
                    <BadgeHex badge={b} size="h-11 w-11 text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-card-foreground">{b.label}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{b.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full border-2 border-[hsl(40,65%,32%)] bg-gradient-to-b from-[hsl(44,92%,62%)] to-[hsl(38,85%,48%)] px-2 py-0.5 font-display text-[11px] font-bold text-[hsl(26,50%,18%)] shadow-[0_2px_0_hsl(38,65%,32%)]">
                      +{b.xp}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Dialog.Close className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </GamePanel>
  );
};

export default BadgeShelf;
