import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "GGLvlup";

interface LogoProps {
  /** Size utilities for the badge itself, e.g. "h-10 w-10". */
  className?: string;
  /** Show the wordmark beside the badge (useful at small sizes). */
  withWordmark?: boolean;
  /** Wordmark type scale. */
  wordmarkClassName?: string;
}

/**
 * Brand badge. Renders /logo.png, falling back to a styled monogram so the
 * header never shows a broken image if the asset is missing.
 */
const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ className, withWordmark = false, wordmarkClassName }, ref) => {
    const [failed, setFailed] = useState(false);

    return (
      <div ref={ref} className="flex items-center gap-2.5">
        {failed ? (
          <span
            aria-hidden
            className={cn(
              "flex items-center justify-center rounded-xl border-2 border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] font-display font-bold text-[hsl(26,50%,18%)] shadow-[0_3px_0_hsl(33,75%,28%)]",
              className,
            )}
          >
            GG
          </span>
        ) : (
          <img
            src="/logo.png"
            alt={BRAND_NAME}
            onError={() => setFailed(true)}
            className={cn("object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)]", className)}
          />
        )}

        {withWordmark && (
          <span
            className={cn(
              "font-display font-semibold uppercase tracking-widest text-[hsl(42,80%,70%)] [text-shadow:0_2px_0_rgba(0,0,0,0.4)]",
              wordmarkClassName,
            )}
          >
            {BRAND_NAME}
          </span>
        )}
      </div>
    );
  },
);
Logo.displayName = "Logo";

export default Logo;
