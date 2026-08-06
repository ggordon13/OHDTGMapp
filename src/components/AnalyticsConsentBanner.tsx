import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import { analyticsAvailable, analyticsConsent, setAnalyticsConsent } from "@/lib/telemetry";

/**
 * Cookie/analytics consent.
 *
 * Analytics cookies are non-essential, so under the ePrivacy Directive (and UK
 * PECR) they need consent *before* being set — which is why nothing in
 * telemetry.ts boots until this resolves. Accept and decline carry equal weight
 * and equal prominence; a decline is remembered so this never nags.
 *
 * Renders nothing when analytics isn't configured (no PostHog key), so local
 * and self-hosted builds don't ask a question that has no effect.
 */
const AnalyticsConsentBanner = () => {
  const [choice, setChoice] = useState(analyticsConsent);
  // Avoid a flash of the banner during hydration/first paint.
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (!ready || !analyticsAvailable() || choice !== "unset") return null;

  const decide = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setChoice(granted ? "granted" : "denied");
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="game-panel mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <BarChart3 className="hidden h-5 w-5 shrink-0 text-[hsl(268,44%,48%)] sm:block" />
        <p className="flex-1 text-xs font-semibold text-muted-foreground">
          Can we use cookies for product analytics? It helps us see which features actually help
          people. We never use them for advertising, and the app works exactly the same if you say
          no.{" "}
          <Link to="/privacy" className="font-bold underline">
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          {/* Equal prominence: a decline that is harder to click than accept is
              not a free choice, and regulators treat it as invalid consent. */}
          <GameButton color="wood" size="sm" className="flex-1 sm:flex-none" onClick={() => decide(false)}>
            No thanks
          </GameButton>
          <GameButton color="leaf" size="sm" className="flex-1 sm:flex-none" onClick={() => decide(true)}>
            Allow
          </GameButton>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsConsentBanner;
