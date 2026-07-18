import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Award, Lock, X } from "lucide-react";
import { Badge, BadgeTier } from "@/lib/gamification";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import { pop, sparkle } from "@/lib/fx";

type BadgeWithState = Badge & { unlocked: boolean };

interface BadgeShelfProps {
  badges: BadgeWithState[];
}

const tierStyle: Record<BadgeTier, string> = {
  bronze: "bg-gradient-to-b from-[hsl(24,60%,55%)] to-[hsl(22,55%,38%)]",
  silver: "bg-gradient-to-b from-[hsl(210,15%,78%)] to-[hsl(210,12%,55%)]",
  gold: "bg-gradient-to-b from-[hsl(44,95%,62%)] to-[hsl(36,85%,45%)]",
  special: "bg-gradient-to-b from-[hsl(268,45%,62%)] to-[hsl(268,44%,44%)]",
};

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
    <div className={`hex-clip p-[3px] ${badge.unlocked ? "bg-[hsl(24,50%,16%)]" : "bg-[hsl(33,25%,52%)]"}`}>
      <div
        ref={hexRef}
        className={`hex-clip flex items-center justify-center ${size} ${
          badge.unlocked ? tierStyle[badge.tier] : "game-slot grayscale opacity-50"
        }`}
      >
        <span
          className={badge.unlocked ? "drop-shadow-[0_2px_1px_rgba(0,0,0,0.4)]" : ""}
          style={badge.iconColor ? { color: badge.iconColor } : undefined}
        >
          {badge.icon}
        </span>
      </div>
    </div>
  );
};

const BadgeShelf = ({ badges }: BadgeShelfProps) => {
  const [showLocked, setShowLocked] = useState(false);
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);

  return (
    <GamePanel
      title="Trophy Case"
      icon={<Award className="h-4 w-4" />}
      color="gold"
      right={
        <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {unlocked.length}/{badges.length} unlocked
        </span>
      }
    >
      <div className="space-y-4">
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
