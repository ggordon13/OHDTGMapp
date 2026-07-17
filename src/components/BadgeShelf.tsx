import { useEffect, useRef } from "react";
import { Award } from "lucide-react";
import { Badge, BadgeTier } from "@/lib/gamification";
import GamePanel from "@/components/game/GamePanel";
import { pop, sparkle } from "@/lib/fx";

interface BadgeShelfProps {
  badges: (Badge & { unlocked: boolean })[];
}

const tierStyle: Record<BadgeTier, string> = {
  bronze: "bg-gradient-to-b from-[hsl(24,60%,55%)] to-[hsl(22,55%,38%)]",
  silver: "bg-gradient-to-b from-[hsl(210,15%,78%)] to-[hsl(210,12%,55%)]",
  gold: "bg-gradient-to-b from-[hsl(44,95%,62%)] to-[hsl(36,85%,45%)]",
  special: "bg-gradient-to-b from-[hsl(268,45%,62%)] to-[hsl(268,44%,44%)]",
};

const BadgeHex = ({ badge }: { badge: Badge & { unlocked: boolean } }) => {
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
    <div className="flex flex-col items-center gap-1.5 text-center" title={badge.description}>
      {/* outer hex = rim, inner hex = face */}
      <div className={`hex-clip p-[3px] ${badge.unlocked ? "bg-[hsl(24,50%,16%)]" : "bg-[hsl(33,25%,52%)]"}`}>
        <div
          ref={hexRef}
          className={`hex-clip flex h-14 w-14 items-center justify-center text-2xl ${
            badge.unlocked ? tierStyle[badge.tier] : "game-slot grayscale opacity-50"
          }`}
        >
          <span className={badge.unlocked ? "drop-shadow-[0_2px_1px_rgba(0,0,0,0.4)]" : ""}>{badge.icon}</span>
        </div>
      </div>
      <span
        className={`font-display text-[11px] font-semibold leading-tight ${
          badge.unlocked ? "text-card-foreground" : "text-muted-foreground"
        }`}
      >
        {badge.label}
      </span>
    </div>
  );
};

const BadgeShelf = ({ badges }: BadgeShelfProps) => {
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <GamePanel
      title="Trophy Case"
      icon={<Award className="h-4 w-4" />}
      color="gold"
      right={<span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{unlockedCount} unlocked</span>}
    >
      {badges.length === 0 ? (
        <p className="text-sm font-semibold text-muted-foreground">
          No badges yet — log your days and hit your targets to start unlocking trophies.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-2 xl:grid-cols-3">
          {badges.map((b) => (
            <BadgeHex key={b.key} badge={b} />
          ))}
        </div>
      )}
    </GamePanel>
  );
};

export default BadgeShelf;
