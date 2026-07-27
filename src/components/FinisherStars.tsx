import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { pop, sparkle } from "@/lib/fx";
import { cn } from "@/lib/utils";

interface FinisherStarsProps {
  /** How many 100-day runs the user has finished. Nothing renders at 0. */
  count: number;
  onClick: () => void;
  className?: string;
}

/** Beyond this, stars collapse into a single star with a ×N counter. */
const MAX_VISIBLE = 3;

/**
 * The permanent golden stars that sit beside the user's name — one per finished
 * 100-day run. Clicking opens the finisher archive.
 */
const FinisherStars = ({ count, onClick, className }: FinisherStarsProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const prevCount = useRef(count);

  // A freshly earned star arrives with a pop and a burst of sparkles.
  useEffect(() => {
    if (count > prevCount.current) {
      pop(ref.current, 1.8);
      sparkle(ref.current, 14);
    }
    prevCount.current = count;
  }, [count]);

  if (count < 1) return null;

  const visible = Math.min(count, MAX_VISIBLE);
  const label = `${count} finished 100-day challenge${count === 1 ? "" : "s"} — view your finisher archive`;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "group inline-flex shrink-0 items-center gap-0.5 rounded-full border-2 border-[hsl(33,78%,26%)]",
        "bg-gradient-to-b from-[hsl(44,95%,66%)] to-[hsl(36,88%,48%)] px-2 py-1 align-middle",
        "shadow-[0_3px_0_hsl(33,75%,26%),0_0_14px_hsl(42,95%,60%,0.5)]",
        "transition-[transform,filter] duration-100 hover:brightness-110",
        "active:translate-y-[2px] active:shadow-[0_1px_0_hsl(33,75%,26%)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42,95%,62%)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {Array.from({ length: visible }).map((_, i) => (
        <Star
          key={i}
          className="h-4 w-4 fill-[hsl(48,100%,85%)] text-[hsl(28,60%,20%)] drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
        />
      ))}
      {count > MAX_VISIBLE && (
        <span className="ml-0.5 font-display text-xs font-bold leading-none text-[hsl(28,60%,16%)]">×{count}</span>
      )}
    </button>
  );
};

export default FinisherStars;
