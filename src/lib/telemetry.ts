// Product analytics via PostHog.
//
// Entirely optional and privacy-respecting: nothing loads or fires unless
// VITE_POSTHOG_KEY is set. posthog-js is dynamically imported only when
// configured, so it stays out of the default bundle. All helpers no-op when
// disabled, so call sites never need to guard.

import type { PostHog } from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

const CONSENT_KEY = "gglvlup:analytics-consent";

export type AnalyticsConsent = "granted" | "denied" | "unset";

let ph: PostHog | null = null;

export function analyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unset";
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : "unset";
  } catch {
    return "unset";
  }
}

/** True when analytics is configured at all — no key, nothing to ask about. */
export function analyticsAvailable(): boolean {
  return !!KEY;
}

/**
 * Record the user's choice and act on it immediately.
 *
 * Denying after having granted stops collection and clears PostHog's own
 * identifiers, so the opt-out is real rather than cosmetic.
 */
export function setAnalyticsConsent(granted: boolean): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {
    /* storage blocked — the choice just won't persist */
  }
  if (granted) {
    void initAnalytics();
  } else if (ph) {
    ph.opt_out_capturing();
    ph.reset();
    ph = null;
  }
}

/**
 * Boot PostHog — but only once the user has actively agreed.
 *
 * Analytics cookies are non-essential, and the ePrivacy Directive / UK PECR
 * require consent *before* they are set, independently of GDPR. This used to
 * run unconditionally at startup, which set a tracking cookie on first paint.
 */
export async function initAnalytics(): Promise<void> {
  if (ph || !KEY || typeof window === "undefined") return;
  if (analyticsConsent() !== "granted") return;
  const mod = await import("posthog-js");
  ph = mod.default;
  ph.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    autocapture: false, // we send explicit, named events instead
    persistence: "localStorage+cookie",
  });
}

/** Tie subsequent events to a signed-in user. */
export function identifyUser(id: string, props?: Record<string, unknown>): void {
  ph?.identify(id, props);
}

/** Forget the current user (call on sign-out). */
export function resetAnalytics(): void {
  ph?.reset();
}

/** Record a named event. No-ops unless analytics is enabled. */
export function track(event: string, props?: Record<string, unknown>): void {
  ph?.capture(event, props);
}
