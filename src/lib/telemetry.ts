// Product analytics via PostHog.
//
// Entirely optional and privacy-respecting: nothing loads or fires unless
// VITE_POSTHOG_KEY is set. posthog-js is dynamically imported only when
// configured, so it stays out of the default bundle. All helpers no-op when
// disabled, so call sites never need to guard.

import type { PostHog } from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

let ph: PostHog | null = null;

/** Boot PostHog once, if configured. Safe to call unconditionally at startup. */
export async function initAnalytics(): Promise<void> {
  if (ph || !KEY || typeof window === "undefined") return;
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
