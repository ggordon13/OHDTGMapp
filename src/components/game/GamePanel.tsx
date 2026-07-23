import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerColor = "red" | "teal" | "leaf" | "gold" | "purple" | "wood";

// Literal class names so Tailwind's content scanner keeps every variant.
const bannerColorClass: Record<BannerColor, string> = {
  red: "game-banner-red",
  teal: "game-banner-teal",
  leaf: "game-banner-leaf",
  gold: "game-banner-gold",
  purple: "game-banner-purple",
  wood: "game-banner-wood",
};

interface GamePanelProps {
  title?: ReactNode;
  icon?: ReactNode;
  color?: BannerColor;
  /** Slot pinned to the top-right of the panel (counters, small actions). */
  right?: ReactNode;
  variant?: "parchment" | "wood";
  className?: string;
  children: ReactNode;
  /** When set, the title plate becomes a button that toggles collapse. */
  onTitleClick?: () => void;
  /** Collapsed state — rotates the chevron and slims the body padding. */
  collapsed?: boolean;
  /** Pulsing "on fire" glow on the title plate (e.g. something to claim). */
  titleGlow?: boolean;
}

/**
 * Parchment sheet (or wooden board) with a tilted title plate riding its top
 * edge, mimicking a hand-drawn game UI kit panel. The plate can act as a
 * collapse toggle when `onTitleClick` is provided.
 */
const GamePanel = ({
  title,
  icon,
  color = "wood",
  right,
  variant = "parchment",
  className,
  children,
  onTitleClick,
  collapsed = false,
  titleGlow = false,
}: GamePanelProps) => (
  <section className={cn(variant === "wood" ? "game-panel-wood" : "game-panel", title ? "mt-4" : "", className)}>
    {title && (
      <div className="absolute -top-4 left-4 z-10">
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            aria-expanded={!collapsed}
            className={cn(
              `game-banner ${bannerColorClass[color]} cursor-pointer text-sm transition-[filter,transform] hover:brightness-110 active:translate-y-[1px]`,
              titleGlow && "animate-banner-glow",
            )}
          >
            {icon}
            {title}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "-rotate-90")}
              strokeWidth={3}
            />
          </button>
        ) : (
          <span className={`game-banner ${bannerColorClass[color]} text-sm`}>
            {icon}
            {title}
          </span>
        )}
      </div>
    )}
    {right && <div className="absolute right-4 top-2.5 z-10">{right}</div>}
    {/* Extra top padding when a right slot is present so content clears it. */}
    <div className={cn("p-5", right ? "pt-11" : title ? "pt-7" : "", collapsed && "!pb-3")}>{children}</div>
  </section>
);

export default GamePanel;
