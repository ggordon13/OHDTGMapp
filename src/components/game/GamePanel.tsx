import { ReactNode } from "react";
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
}

/**
 * Parchment sheet (or wooden board) with a tilted title plate riding its top
 * edge, mimicking a hand-drawn game UI kit panel.
 */
const GamePanel = ({ title, icon, color = "wood", right, variant = "parchment", className, children }: GamePanelProps) => (
  <section className={cn(variant === "wood" ? "game-panel-wood" : "game-panel", title ? "mt-4" : "", className)}>
    {title && (
      <div className="absolute -top-4 left-4 z-10">
        <span className={`game-banner ${bannerColorClass[color]} text-sm`}>
          {icon}
          {title}
        </span>
      </div>
    )}
    {right && <div className="absolute right-3 top-2 z-10">{right}</div>}
    <div className={cn("p-5", title ? "pt-7" : "")}>{children}</div>
  </section>
);

export default GamePanel;
