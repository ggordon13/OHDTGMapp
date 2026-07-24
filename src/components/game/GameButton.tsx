import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { BannerColor } from "./GamePanel";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: BannerColor;
  size?: "sm" | "md" | "lg";
}

const colorClasses: Record<BannerColor, string> = {
  red: "from-[hsl(6,70%,62%)] to-[hsl(6,62%,50%)] border-[hsl(6,55%,30%)] shadow-[0_4px_0_hsl(6,55%,30%)] text-white",
  teal: "from-[hsl(178,48%,44%)] to-[hsl(178,54%,32%)] border-[hsl(178,50%,18%)] shadow-[0_4px_0_hsl(178,50%,18%)] text-white",
  leaf: "from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] border-[hsl(70,50%,22%)] shadow-[0_4px_0_hsl(70,50%,22%)] text-white",
  gold: "from-[hsl(40,90%,58%)] to-[hsl(36,85%,46%)] border-[hsl(33,75%,28%)] shadow-[0_4px_0_hsl(33,75%,28%)] text-[hsl(26,50%,18%)]",
  purple: "from-[hsl(268,42%,60%)] to-[hsl(268,44%,46%)] border-[hsl(268,45%,28%)] shadow-[0_4px_0_hsl(268,45%,28%)] text-white",
  wood: "from-[hsl(26,36%,38%)] to-[hsl(24,40%,26%)] border-[hsl(22,45%,12%)] shadow-[0_4px_0_hsl(22,45%,12%)] text-[hsl(38,45%,90%)]",
  navy: "from-[hsl(222,55%,46%)] to-[hsl(224,60%,32%)] border-[hsl(226,60%,18%)] shadow-[0_4px_0_hsl(226,60%,18%)] text-white",
  forest: "from-[hsl(140,45%,40%)] to-[hsl(146,52%,26%)] border-[hsl(148,55%,14%)] shadow-[0_4px_0_hsl(148,55%,14%)] text-white",
};

const sizeClasses = {
  sm: "px-3 py-1 text-xs rounded-lg",
  md: "px-4 py-1.5 text-sm rounded-xl",
  lg: "px-6 py-2.5 text-base rounded-xl",
};

/** Chunky 3D cartoon button: gradient face, dark rim, hard bottom shadow, press-down on click. */
const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ color = "red", size = "md", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border-2 bg-gradient-to-b font-display font-semibold uppercase tracking-wide",
        "[text-shadow:0_1.5px_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow,filter] duration-100",
        "hover:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.6)]",
        "disabled:pointer-events-none disabled:opacity-60 disabled:saturate-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        colorClasses[color],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
GameButton.displayName = "GameButton";

export default GameButton;
