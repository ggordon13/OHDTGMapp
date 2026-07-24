// Supabase Edge Function (Deno): Whop payment webhooks.
//
// On a successful payment it grants premium via the app's existing
// premium_allowlist (which resolveEffectiveAccessLevel already reads), and
// records the payment. On a refund/cancel it revokes access.
//
// Deploy (webhooks are unauthenticated, so disable JWT verification):
//   supabase functions deploy whop-webhook --no-verify-jwt
// Set the secret:
//   supabase secrets set WHOP_WEBHOOK_SECRET=whsec_xxx
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Then point your Whop webhook at:
//   https://<project-ref>.functions.supabase.co/whop-webhook
//
// NOTE: the event-type strings, data field names, and signature header below
// must be confirmed against Whop's webhook reference (marked TODO).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyWhopSignature } from "../_shared/whop.ts";

const WEBHOOK_SECRET = Deno.env.get("WHOP_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();

  // TEMP DEBUG — remove once wired. Logs Whop's headers + body so we can read the
  // real signature header name and payload field names from the function logs.
  console.log("WHOP HEADERS:", JSON.stringify(Object.fromEntries(req.headers.entries())));
  console.log("WHOP BODY:", raw);

  // TODO: confirm the signature header Whop sends (e.g. "x-whop-signature").
  const signature = req.headers.get("x-whop-signature") ?? "";
  if (!(await verifyWhopSignature(raw, signature, WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: Json;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // TODO: confirm the event-type + data field names in Whop's webhook docs.
  const type: string = event.action ?? event.type ?? "";
  const data: Json = event.data ?? event;
  const email: string = (data.user?.email ?? data.email ?? "").toString().toLowerCase();
  const whopPaymentId: string | null = data.id ?? null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const succeeded = ["payment.succeeded", "payment_success", "membership.went_valid"].includes(type);
  const reversed = ["payment.refunded", "refund.created", "membership.went_invalid"].includes(type);

  if (succeeded) {
    if (email) {
      // Grant premium the same way the admin tools do.
      await supabase
        .from("premium_allowlist")
        .upsert({ email, access_level: "premium", is_active: true }, { onConflict: "email" });
    }
    await supabase.from("payments").upsert(
      {
        email: email || null,
        whop_payment_id: whopPaymentId,
        product_id: data.product_id ?? null,
        amount: data.final_amount ?? data.amount ?? null,
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

  // Always 200 for handled events so Whop doesn't retry endlessly.
  return new Response("ok", { status: 200 });
});
