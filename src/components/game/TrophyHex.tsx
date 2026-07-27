import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Tier faces, shared by the live trophy case and the finisher archive. */
const trophyTierStyle: Record<string, string> = {
  bronze: "bg-gradient-to-b from-[hsl(24,60%,55%)] to-[hsl(22,55%,38%)]",
  silver: "bg-gradient-to-b from-[hsl(210,15%,78%)] to-[hsl(210,12%,55%)]",
  gold: "bg-gradient-to-b from-[hsl(44,95%,62%)] to-[hsl(36,85%,45%)]",
  special: "bg-gradient-to-b from-[hsl(268,45%,62%)] to-[hsl(268,44%,44%)]",
};

interface TrophyHexProps {
  tier: string;
  icon: string;
  /** CSS colour for text glyphs (e.g. the "★" stars); emoji ignore it. */
  iconColor?: string;
  /** Locked badges render greyed out behind a dull rim. */
  locked?: boolean;
  /** Face size + glyph size, e.g. "h-11 w-11 text-xl". */
  size?: string;
  className?: string;
}

/** Hexagonal trophy face with a dark rim. Purely presentational. */
const TrophyHex = forwardRef<HTMLDivElement, TrophyHexProps>(
  ({ tier, icon, iconColor, locked = false, size = "h-14 w-14 text-2xl", className }, ref) => (
    <div className={cn("hex-clip p-[3px]", locked ? "bg-[hsl(33,25%,52%)]" : "bg-[hsl(24,50%,16%)]", className)}>
      <div
        ref={ref}
        className={cn(
          "hex-clip flex items-center justify-center",
          size,
          locked ? "game-slot grayscale opacity-50" : trophyTierStyle[tier] ?? trophyTierStyle.special,
        )}
      >
        <span
          className={locked ? undefined : "drop-shadow-[0_2px_1px_rgba(0,0,0,0.4)]"}
          style={iconColor ? { color: iconColor } : undefined}
        >
          {icon}
        </span>
      </div>
    </div>
  ),
);
TrophyHex.displayName = "TrophyHex";

export default TrophyHex;
