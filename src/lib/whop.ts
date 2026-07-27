import { track } from "@/lib/telemetry";

// Client-side Whop checkout. ONLY the public hosted-checkout URL lives here —
// never WHOP_API_KEY. Anything with the secret key (SDK calls, webhooks, payment
// storage) runs in the Supabase Edge Function, because VITE_* vars are compiled
// into the browser bundle and are publicly visible.

/** A payment as this app stores it (see the `payments` table). */
export interface Payment {
  id: string;
  user_id: string | null;
  email: string | null;
  whop_payment_id: string | null;
  product_id: string | null;
  amount: number | null;
  currency: string | null;
  status: "pending" | "succeeded" | "refunded" | "failed";
  created_at: string;
}

/** The single Whop product page "Get Premium" opens. Public, safe to expose. */
const DEFAULT_CHECKOUT_URL = "https://whop.com/gglvlup/gglvlup-premium/";

/** The configured checkout URL, or the default product page. */
export function getWhopCheckoutUrl(): string {
  const configured = (import.meta.env.VITE_WHOP_CHECKOUT_URL as string | undefined)?.trim();
  return configured || DEFAULT_CHECKOUT_URL;
}

/**
 * Send the user to Whop's hosted checkout, tagging it with their app email + id
 * so the webhook can link the resulting payment back to this account.
 *
 * The email tag is the reliable link: Whop's webhook carries the buyer's email,
 * and the webhook grants premium to that address. Buying with a different email
 * than the app account still needs an admin grant.
 */
export function startWhopCheckout(opts: { email?: string | null; userId?: string | null } = {}): void {
  const url = new URL(getWhopCheckoutUrl());
  if (opts.email) url.searchParams.set("email", opts.email);
  if (opts.userId) url.searchParams.set("metadata[app_user_id]", opts.userId);
  track("premium_checkout_started");
  markWhopCheckoutStarted();
  window.location.href = url.toString();
}

// ---------------------------------------------------------------------------
// "Came back from checkout" flag
//
// Payment is granted server-side by the webhook, which lands a moment after the
// user returns. This flag tells the app to poll for the new access level rather
// than make them reload.
// ---------------------------------------------------------------------------

const PENDING_KEY = "whop:checkout_started_at";
/** How long a started checkout stays interesting. Beyond this, they didn't buy. */
const PENDING_TTL_MS = 6 * 60 * 60 * 1000;

export function markWhopCheckoutStarted(): void {
  try {
    localStorage.setItem(PENDING_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode); the flag is only an optimisation.
  }
}

export function hasPendingWhopCheckout(): boolean {
  try {
    const startedAt = Number(localStorage.getItem(PENDING_KEY));
    if (!Number.isFinite(startedAt) || startedAt <= 0) return false;
    if (Date.now() - startedAt > PENDING_TTL_MS) {
      clearPendingWhopCheckout();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the flag. Returns whether this call is the one that cleared it — several
 * useProfile instances race to announce the upgrade, and only one should.
 */
export function clearPendingWhopCheckout(): boolean {
  try {
    const existed = localStorage.getItem(PENDING_KEY) !== null;
    localStorage.removeItem(PENDING_KEY);
    return existed;
  } catch {
    // See markWhopCheckoutStarted.
    return false;
  }
}
