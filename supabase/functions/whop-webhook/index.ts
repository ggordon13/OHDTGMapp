// Supabase Edge Function (Deno): Whop payment webhooks.
//
// On a successful payment it grants premium via the app's existing
// premium_allowlist (which resolveEffectiveAccessLevel reads) and records the
// payment; on a refund/cancel it revokes.
//
// Deploy (webhooks are unauthenticated):
//   npx supabase functions deploy whop-webhook --project-ref <ref> --no-verify-jwt
// Secret (the whsec_ value Whop shows for the webhook):
//   npx supabase secrets set WHOP_WEBHOOK_SECRET=whsec_xxx --project-ref <ref>
//
// Verified against real Whop traffic: Standard Webhooks headers
// (webhook-id / webhook-timestamp / webhook-signature) and a `type` +
// `data.{...}` payload.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyStandardWebhook } from "../_shared/whop.ts";

const WEBHOOK_SECRET = Deno.env.get("WHOP_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

// A payment that actually went through / access that became valid.
const SUCCESS_TYPES = ["payment.succeeded", "membership.went_valid", "membership_went_valid"];
const SUCCESS_STATUS = ["succeeded", "paid", "completed"];
// A reversal that should revoke access.
const REVERSAL_TYPES = ["payment.refunded", "membership.went_invalid", "membership_went_invalid", "dispute.created"];

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

  const type: string = event.type ?? event.action ?? "";
  const data: Json = event.data ?? {};
  const status: string = (data.status ?? "").toString().toLowerCase();
  const email: string = (data.user?.email ?? data.email ?? "").toString().toLowerCase();
  const whopPaymentId: string | null = data.id ?? null;

  const succeeded = SUCCESS_TYPES.includes(type) || SUCCESS_STATUS.includes(status);
  const reversed = REVERSAL_TYPES.includes(type) || status === "refunded" || Boolean(data.refunded_at);

  console.log(`whop event type=${type} status=${status} email=${email} → ${succeeded ? "grant" : reversed ? "revoke" : "ignore"}`);

  if (!succeeded && !reversed) return new Response("ok", { status: 200 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (succeeded) {
    if (email) {
      await supabase
        .from("premium_allowlist")
        .upsert({ email, access_level: "premium", is_active: true }, { onConflict: "email" });
    }
    await supabase.from("payments").upsert(
      {
        email: email || null,
        whop_payment_id: whopPaymentId,
        product_id: data.product?.id ?? data.plan?.id ?? null,
        amount: data.total ?? data.usd_total ?? data.subtotal ?? null,
        currency: data.currency ?? null,
        status: "succeeded",
        raw: event,
      },
      { onConflict: "whop_payment_id" },
    );
  } else if (reversed) {
    if (email) {
      await supabase.from("premium_allowlist").update({ is_active: false }).eq("email", email);
    }
    if (whopPaymentId) {
      await supabase.from("payments").update({ status: "refunded", raw: event }).eq("whop_payment_id", whopPaymentId);
    }
  }

  return new Response("ok", { status: 200 });
});
