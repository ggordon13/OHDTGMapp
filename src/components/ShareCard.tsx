import { forwardRef } from "react";
import { Star, Flame } from "lucide-react";
import { getRank } from "@/lib/ranks";
import { cn } from "@/lib/utils";

export interface ShareCardData {
  name: string;
  level: number;
  streak: number;
  day: number;
  totalDays: number;
  pct: number;
}

/**
 * A fixed-width, on-brand progress card designed to be rasterised to a PNG and
 * shared. Everything is self-contained (no CSS variables that a screenshot
 * couldn't resolve) so it renders identically off-screen.
 */
const ShareCard = forwardRef<HTMLDivElement, ShareCardData>(({ name, level, streak, day, totalDays, pct }, ref) => {
  const rank = getRank(level);

  return (
    <div
      ref={ref}
      className="w-[400px] shrink-0 overflow-hidden rounded-[20px] border-[3px] border-[hsl(22,45%,12%)] p-5"
      style={{ background: "linear-gradient(180deg, hsl(24 38% 26%), hsl(23 40% 15%))" }}
    >
      {/* Brand */}
      <div className="flex items-center justify-center gap-2 pb-4">
        <img src="/logo.png" alt="" crossOrigin="anonymous" className="h-11 w-auto" />
      </div>

      <div
        className="space-y-4 rounded-2xl border-2 border-[hsl(33,30%,55%)] p-5"
        style={{ background: "hsl(39 52% 88%)" }}
      >
        <p className="text-center font-display text-lg font-bold text-[hsl(24,42%,16%)]">
          {name}&rsquo;s progress
        </p>

        {/* Level medal + rank */}
        <div className="flex items-center justify-center gap-3">
          <div
            className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-[hsl(33,75%,28%)] shadow-[0_5px_0_hsl(33,75%,28%)]"
            style={{ background: "linear-gradient(180deg, hsl(42 95% 62%), hsl(36 85% 46%))" }}
          >
            <Star className="h-4 w-4 fill-[hsl(26,50%,18%)] text-[hsl(26,50%,18%)]" />
            <span className="font-display text-2xl font-bold leading-none text-[hsl(26,50%,18%)]">{level}</span>
          </div>
          <div className="space-y-1">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[hsl(27,24%,42%)]">
              Level {level}
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider",
                rank.className,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", rank.pipClassName)} />
              {rank.name}
            </span>
          </div>
        </div>

        {/* Streak */}
        <div
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-[hsl(6,55%,40%)] py-2"
          style={{ background: "linear-gradient(180deg, hsl(6 70% 62%), hsl(6 62% 50%))" }}
        >
          <Flame className="h-5 w-5 text-white" />
          <span className="font-display text-lg font-bold uppercase tracking-wide text-white [text-shadow:0_1.5px_0_rgba(0,0,0,0.3)]">
            {streak}-day streak
          </span>
        </div>

        {/* 100-day progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-display text-xs font-bold text-[hsl(27,24%,40%)]">
            <span>Day {day} of {totalDays}</span>
            <span className="text-[hsl(178,52%,32%)]">{pct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-[hsl(33,30%,55%)] bg-[hsl(37,30%,80%)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, pct)}%`, background: "linear-gradient(90deg, hsl(178 52% 44%), hsl(178 54% 32%))" }}
            />
          </div>
        </div>
      </div>

      <p className="pt-3 text-center font-display text-[11px] font-bold uppercase tracking-widest text-[hsl(42,80%,70%)]">
        GGLvlup · level up your life
      </p>
    </div>
  );
});
ShareCard.displayName = "ShareCard";

export default ShareCard;
