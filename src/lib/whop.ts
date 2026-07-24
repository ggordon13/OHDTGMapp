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

export interface WhopPlan {
  id: string;
  label: string;
  url: string;
}

/**
 * The configured Whop checkout plans (public URLs, safe to expose). Supports a
 * Monthly + Yearly pair, and falls back to a single VITE_WHOP_CHECKOUT_URL.
 */
export function getWhopPlans(): WhopPlan[] {
  const monthly = import.meta.env.VITE_WHOP_CHECKOUT_URL_MONTHLY as string | undefined;
  const yearly = import.meta.env.VITE_WHOP_CHECKOUT_URL_YEARLY as string | undefined;
  const single = import.meta.env.VITE_WHOP_CHECKOUT_URL as string | undefined;

  const plans: WhopPlan[] = [];
  if (monthly) plans.push({ id: "monthly", label: "Monthly", url: monthly });
  if (yearly) plans.push({ id: "yearly", label: "Yearly", url: yearly });
  if (plans.length === 0 && single) plans.push({ id: "premium", label: "Premium", url: single });
  return plans;
}

export function isWhopCheckoutConfigured(): boolean {
  return getWhopPlans().length > 0;
}

/**
 * Send the user to a Whop hosted checkout, tagging it with their app email + id
 * so the webhook can link the resulting payment back to this account.
 *
 * NOTE: confirm the exact query params your Whop checkout link accepts for
 * email prefill and metadata — the names below are a starting point.
 */
export function startWhopCheckout(checkoutUrl: string, opts: { email?: string | null; userId?: string | null }): void {
  const url = new URL(checkoutUrl);
  if (opts.email) url.searchParams.set("email", opts.email);
  if (opts.userId) url.searchParams.set("metadata[app_user_id]", opts.userId);
  window.location.href = url.toString();
}
