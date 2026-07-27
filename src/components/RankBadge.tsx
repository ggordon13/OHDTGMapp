import { getNextRank, getRank } from "@/lib/ranks";
import { cn } from "@/lib/utils";

interface RankBadgeProps {
  level: number;
  /** Hide the "RANK:" label (e.g. inside a list where the context is obvious). */
  hideLabel?: boolean;
  className?: string;
}

/**
 * The title carried at the current level, shown as a chunky plate. Tiers climb
 * from a dull stone plate at Newcomer to a glowing prismatic one at Mythic, so
 * a promotion reads at a glance.
 */
const RankBadge = ({ level, hideLabel = false, className }: RankBadgeProps) => {
  const rank = getRank(level);
  const next = getNextRank(level);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!hideLabel && (
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[hsl(35,30%,62%)] [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
          Rank:
        </span>
      )}
      <span
        title={
          next
            ? `${rank.name} · next rank ${next.name} at level ${next.minLevel}`
            : `${rank.name} — the highest rank there is`
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5",
          "font-display text-[11px] font-bold uppercase tracking-wider",
          "[text-shadow:0_1px_0_rgba(255,255,255,0.25)]",
          rank.className,
          rank.glowClassName,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", rank.pipClassName)} aria-hidden />
        {rank.name}
      </span>
    </div>
  );
};

export default RankBadge;
