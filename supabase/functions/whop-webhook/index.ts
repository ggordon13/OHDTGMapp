// Supabase Edge Function (Deno): Whop payment webhooks.
//
// On a successful payment it grants premium — via the app's premium_allowlist
// (which resolveEffectiveAccessLevel reads) and, when the buyer maps to an app
// account, directly on that profile — and records the payment. Refund/cancel
// events revoke, if you subscribe to them (the dashboard is currently set to
// payment_succeeded only, which is all the grant path needs).
//
// Deploy (webhooks are unauthenticated):
//   npx supabase functions deploy whop-webhook --project-ref <ref> --no-verify-jwt
// Secret (the whsec_ value Whop shows for the webhook):
//   npx supabase secrets set WHOP_WEBHOOK_SECRET=whsec_xxx --project-ref <ref>
//   npx supabase secrets set WHOP_API_KEY=...   # optional, used to look up a
//                                               # buyer email when the payload
//                                               # only carries a Whop user id.
//
// Verified against real Whop traffic: Standard Webhooks headers
// (webhook-id / webhook-timestamp / webhook-signature) and a `type` +
// `data.{...}` payload.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchWhopUserEmail, verifyStandardWebhook } from "../_shared/whop.ts";

const WEBHOOK_SECRET = Deno.env.get("WHOP_WEBHOOK_SECRET") ?? "";
const WHOP_API_KEY = Deno.env.get("WHOP_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

// Whop names events differently across API versions and in the dashboard
// ("payment_succeeded" vs "payment.succeeded"), so compare on a normalized form.
const normalizeType = (value: string) => value.toLowerCase().replace(/[._\s]+/g, ".");

// A payment that actually went through / access that became valid.
const SUCCESS_TYPES = ["payment.succeeded", "membership.went.valid"];
const SUCCESS_STATUS = ["succeeded", "paid", "completed"];
// A reversal that should revoke access.
const REVERSAL_TYPES = ["payment.refunded", "membership.went.invalid", "dispute.created"];

/** First non-empty email anywhere Whop is known to put one. */
function extractEmail(data: Json): string {
  const candidates = [
    data.user_email,
    data.user?.email,
    data.email,
    data.customer?.email,
    data.customer_email,
    data.membership?.user?.email,
    data.membership?.email,
    data.checkout_session?.email,
    data.metadata?.email,
    data.checkout_session?.metadata?.email,
  ];
  for (const candidate of candidates) {
    const email = (candidate ?? "").toString().trim().toLowerCase();
    if (email.includes("@")) return email;
  }
  return "";
}

/** The app user id we tag onto the checkout URL, if it survived the round trip. */
function extractAppUserId(data: Json): string | null {
  const candidates = [
    data.metadata?.app_user_id,
    data.checkout_session?.metadata?.app_user_id,
    data.membership?.metadata?.app_user_id,
    data.plan?.metadata?.app_user_id,
  ];
  for (const candidate of candidates) {
    const id = (candidate ?? "").toString().trim();
    if (id) return id;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const valid = await verifyStandardWebhook({
    id: req.headers.get("webhook-id") ?? "",
    timestamp: req.headers.get("webhook-timestamp") ?? "",
    signatureHeader: req.headers.get("webhook-signature") ?? "",
    body: raw,
    secret: WEBHOOK_SECRET,
  });
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let event: Json;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const type = normalizeType((event.type ?? event.action ?? "").toString());
  const data: Json = event.data ?? {};
  const status: string = (data.status ?? "").toString().toLowerCase();
  const whopPaymentId: string | null = data.id ?? null;
  const appUserId = extractAppUserId(data);

  const succeeded = SUCCESS_TYPES.includes(type) || SUCCESS_STATUS.includes(status);
  const reversed = REVERSAL_TYPES.includes(type) || status === "refunded" || Boolean(data.refunded_at);

  let email = extractEmail(data);
  // Some payment payloads carry only a Whop user id; the API can resolve it.
  if (!email && succeeded && WHOP_API_KEY && data.user_id) {
    email = (await fetchWhopUserEmail(WHOP_API_KEY, String(data.user_id))) ?? "";
  }

  console.log(
    `whop event type=${type} status=${status} email=${email || "-"} appUserId=${appUserId ?? "-"} → ` +
      `${succeeded ? "grant" : reversed ? "revoke" : "ignore"}`,
  );

  if (!succeeded && !reversed) return new Response("ok", { status: 200 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Match the payment to an app account: by the id we tagged onto checkout if it
  // came back, otherwise by the buyer's email.
  let profile: { user_id: string; email: string | null } | null = null;
  if (appUserId) {
    const { data: byId } = await supabase.from("profiles").select("user_id, email").eq("user_id", appUserId).maybeSingle();
    profile = byId ?? null;
  }
  if (!profile && email) {
    const { data: byEmail } = await supabase.from("profiles").select("user_id, email").ilike("email", email).maybeSingle();
    profile = byEmail ?? null;
  }
  // A tagged account's own email is what the allowlist should key on.
  if (!email && profile?.email) email = profile.email.trim().toLowerCase();

  if (succeeded) {
    if (email) {
      // The allowlist is what resolveEffectiveAccessLevel checks on every load.
      const { error } = await supabase
        .from("premium_allowlist")
        .upsert({ email, access_level: "premium", is_active: true }, { onConflict: "email" });
      if (error) console.error("premium_allowlist upsert failed", error);
    }
    if (profile) {
      // Immediate effect for this account, so the app doesn't wait on the sync.
      const { error } = await supabase.from("profiles").update({ access_level: "premium" }).eq("user_id", profile.user_id);
      if (error) console.error("profile premium update failed", error);
    }
    if (!email && !profile) {
      console.error("whop payment succeeded with no email or app user — grant needs a manual admin allowlist entry", whopPaymentId);
    }

    const { error } = await supabase.from("payments").upsert(
      {
        user_id: profile?.user_id ?? null,
        email: email || null,
        whop_payment_id: whopPaymentId,
        product_id: data.product?.id ?? data.product_id ?? data.plan?.id ?? data.plan_id ?? null,
        amount: data.final_amount ?? data.total ?? data.usd_total ?? data.subtotal ?? data.amount ?? null,
        currency: data.currency ?? null,
        status: "succeeded",
        raw: event,
      },
      { onConflict: "whop_payment_id" },
    );
    if (error) console.error("payments upsert failed", error);
  } else if (reversed) {
    if (email) {
      await supabase.from("premium_allowlist").update({ is_active: false }).eq("email", email);
    }
    if (profile) {
      await supabase.from("profiles").update({ access_level: "free" }).eq("user_id", profile.user_id);
    }
    if (whopPaymentId) {
      await supabase.from("payments").update({ status: "refunded", raw: event }).eq("whop_payment_id", whopPaymentId);
    }
  }

  return new Response("ok", { status: 200 });
});
