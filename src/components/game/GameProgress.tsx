import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { BannerColor } from "./GamePanel";

interface GameProgressProps {
  /** 0–100 */
  value: number;
  color?: BannerColor;
  className?: string;
  /** Height utility, e.g. "h-3" */
  size?: string;
}

const fillColors: Record<BannerColor, string> = {
  red: "from-[hsl(6,75%,66%)] to-[hsl(6,62%,52%)]",
  teal: "from-[hsl(178,50%,48%)] to-[hsl(178,54%,34%)]",
  leaf: "from-[hsl(68,52%,54%)] to-[hsl(70,50%,40%)]",
  gold: "from-[hsl(42,95%,62%)] to-[hsl(36,85%,48%)]",
  purple: "from-[hsl(268,46%,64%)] to-[hsl(268,44%,48%)]",
  wood: "from-[hsl(26,36%,44%)] to-[hsl(24,40%,30%)]",
};

/** Inset wooden trough with a glossy candy fill; width changes tween via GSAP. */
const GameProgress = ({ value, color = "gold", className, size = "h-3" }: GameProgressProps) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const pct = Math.max(0, Math.min(100, value));

  useEffect(() => {
    if (!fillRef.current) return;
    gsap.to(fillRef.current, { width: `${pct}%`, duration: 0.9, ease: "power2.out" });
  }, [pct]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full border-2 border-[hsl(22,45%,14%)]",
        "bg-[hsl(24,32%,22%)] shadow-[inset_0_3px_5px_rgba(0,0,0,0.55),0_1px_0_rgba(255,246,224,0.25)]",
        size,
        className,
      )}
    >
      <div
        ref={fillRef}
        style={{ width: 0 }}
        className={cn("relative h-full rounded-full bg-gradient-to-b", fillColors[color])}
      >
        {/* glossy top highlight */}
        <div className="absolute inset-x-1 top-[15%] h-[30%] rounded-full bg-white/35" />
      </div>
    </div>
  );
};

export default GameProgress;
