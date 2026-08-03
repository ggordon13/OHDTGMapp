// Supabase Edge Function (Deno): Whop payment webhooks.
//
// On a successful payment it grants premium — via the app's premium_allowlist
// (which resolveEffectiveAccessLevel reads) and, when the buyer maps to an app
// account, directly on that profile — and records the payment. Refund/cancel
// events revoke, if you subscribe to them (the dashboard is currently set to
// payment_succeeded only, which is all the grant path needs).
//
// Setup and troubleshooting: docs/whop-setup.md
//
// Deliberately ONE self-contained file with no local imports, so it can be
// deployed either with the CLI or by pasting into the Supabase dashboard's
// function editor. Keep it that way.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Quotes get included when the value is pasted into the dashboard, so strip them.
const WEBHOOK_SECRET = (Deno.env.get("WHOP_WEBHOOK_SECRET") ?? "").trim().replace(/^["']|["']$/g, "");
// NOTE: there used to be a WHOP_WEBHOOK_ALLOW_UNVERIFIED escape hatch here that
// processed events with an unverifiable signature. It was a standing "anyone who
// finds this URL grants themselves premium" hole, and signatures are confirmed
// working (see the scheme note below), so it is gone for good. An unverified
// event is now always a 401 — no exceptions, no env var to get left switched on.
const WHOP_API_KEY = Deno.env.get("WHOP_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Printed on every cold start: proves which build is live and what env it sees.
console.log(
  `whop-webhook boot: build=2026-08-04-verified-only secret=${WEBHOOK_SECRET ? `set(len ${WEBHOOK_SECRET.length})` : "MISSING"}`,
);

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

// Whop names events differently across API versions and in the dashboard
// ("payment_succeeded" vs "payment.succeeded"), so compare on a normalized form.
const normalizeType = (value: string) => value.toLowerCase().replace(/[._\s]+/g, ".");

// A payment that actually went through / access that became valid.
const SUCCESS_TYPES = ["payment.succeeded", "membership.went.valid"];
const SUCCESS_STATUS = ["succeeded", "paid", "completed"];
// Money hasn't actually moved. Whop's dashboard test event is a `payment.succeeded`
// carrying status "draft", so the type alone is not enough to grant on.
const UNPAID_STATUS = ["draft", "open", "pending", "failed", "void", "canceled", "cancelled", "expired"];
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

/** Best-effort buyer email from a Whop user id, for payloads that omit the email. */
async function fetchWhopUserEmail(apiKey: string, userId: string): Promise<string> {
  for (const path of [`/v5/users/${userId}`, `/v2/users/${userId}`]) {
    try {
      const res = await fetch(`https://api.whop.com${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      });
      if (!res.ok) continue;
      const body = await res.json();
      const email = (body?.email ?? body?.data?.email ?? "").toString().trim().toLowerCase();
      if (email.includes("@")) return email;
    } catch (err) {
      console.error(`whop user lookup failed for ${path}`, err);
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Webhook signature verification
//
// CONFIRMED against real Whop traffic (2026-07-25): "raw | id.ts.body | base64"
//
//   key      = the WHOLE `ws_...` secret as raw UTF-8 bytes (prefix included)
//   content  = `${webhook-id}.${webhook-timestamp}.${rawBody}`
//   expected = base64( HMAC-SHA256(content, key) )
//
// Note the key is NOT base64-decoded — assuming the Svix `whsec_` convention
// here is what made every earlier attempt 401.
//
// The other candidates below are kept as fallbacks in case Whop changes
// convention; the confirmed one is tried first, so the common path is one HMAC.
// The matching scheme is always logged, so a silent change stays visible.
// ---------------------------------------------------------------------------

interface WebhookVerification {
  valid: boolean;
  /** Which candidate matched, e.g. "raw-unprefixed | id.ts.body | base64". */
  scheme?: string;
  /** Why it failed, safe to log. */
  reason?: string;
  /** Non-secret detail: what arrived vs what each scheme expected. */
  debug?: string;
}

const encoder = new TextEncoder();
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Base64-decode, or null when the input isn't base64 at all (e.g. a `ws_` secret). */
function tryBase64Decode(value: string): Uint8Array | null {
  // atob tolerates some junk, so reject anything outside the alphabet first.
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return null;
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Hex-decode, or null when the input isn't hex. Whop's `ws_` secrets are 64 hex chars. */
function tryHexDecode(value: string): Uint8Array | null {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** The signature values Whop sent, stripped of any `v1,` / `sha256=` labelling. */
function parseSignatureTokens(header: string): string[] {
  return header
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part && !/^(v\d+|sha256|sha1)$/i.test(part))
    .map((part) => part.replace(/^(v\d+|sha256|sha1)[,=]/i, ""));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Whop webhook. Returns a diagnostic rather than a bare boolean so a
 * 401 can say why. The 5-minute replay window is only enforced once a signature
 * actually matches, so clock skew doesn't look like a bad secret.
 */
async function verifyWhopWebhook(opts: {
  id: string;
  timestamp: string;
  body: string;
  signatureHeader: string;
  secret: string;
}): Promise<WebhookVerification> {
  const { id, timestamp, body, signatureHeader, secret } = opts;

  if (!secret) return { valid: false, reason: "WHOP_WEBHOOK_SECRET is not set on the function" };
  if (!signatureHeader) return { valid: false, reason: "request carried no webhook-signature header" };

  const provided = parseSignatureTokens(signatureHeader);
  if (provided.length === 0) return { valid: false, reason: `could not parse signature header: ${signatureHeader.slice(0, 24)}…` };

  // Every way the secret might become HMAC key bytes.
  const unprefixed = secret.replace(/^(whsec_|ws_|sk_)/, "");
  const keys: { name: string; bytes: Uint8Array }[] = [{ name: "raw", bytes: encoder.encode(secret) }];
  if (unprefixed !== secret) keys.push({ name: "raw-unprefixed", bytes: encoder.encode(unprefixed) });
  const base64Key = tryBase64Decode(unprefixed);
  if (base64Key) keys.push({ name: "base64", bytes: base64Key });
  const hexKey = tryHexDecode(unprefixed);
  if (hexKey) keys.push({ name: "hex", bytes: hexKey });

  // Every way the signed content might be assembled.
  const contents: { name: string; value: string }[] = [];
  if (id && timestamp) contents.push({ name: "id.ts.body", value: `${id}.${timestamp}.${body}` });
  if (timestamp) contents.push({ name: "ts.body", value: `${timestamp}.${body}` });
  contents.push({ name: "body", value: body });

  const attempted: string[] = [];

  for (const key of keys) {
    // The copy pins the buffer type — importKey rejects a plain Uint8Array under
    // TS 5.7's typed-array generics.
    const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(key.bytes), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    for (const content of contents) {
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(content.value)));
      for (const [encoding, expected] of Object.entries({ base64: toBase64(mac), hex: toHex(mac) })) {
        if (provided.some((sig) => timingSafeEqual(sig, expected))) {
          const scheme = `${key.name} | ${content.name} | ${encoding}`;
          const ts = Number(timestamp);
          const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
          if (timestamp && Number.isFinite(ts) && skew > 300) {
            return { valid: false, scheme, reason: `signature valid but timestamp is ${skew}s off — replay or clock skew` };
          }
          return { valid: true, scheme };
        }
        attempted.push(`${key.name}/${content.name}/${encoding}=${expected.slice(0, 8)}`);
      }
    }
  }

  return {
    valid: false,
    reason: "no signature scheme matched — the secret is probably wrong or from a different webhook",
    debug: `received=[${provided.map((s) => s.slice(0, 8)).join(", ")}] expected=[${attempted.join(", ")}] secretLen=${secret.length} secretPrefix=${secret.slice(0, 3)}`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const verification = await verifyWhopWebhook({
    // Standard Webhooks names, with the x-whop-* aliases Whop also uses.
    id: req.headers.get("webhook-id") ?? req.headers.get("x-whop-id") ?? "",
    timestamp: req.headers.get("webhook-timestamp") ?? req.headers.get("x-whop-timestamp") ?? "",
    signatureHeader: req.headers.get("webhook-signature") ?? req.headers.get("x-whop-signature") ?? "",
    body: raw,
    secret: WEBHOOK_SECRET,
  });

  if (!verification.valid) {
    // `reason` is safe to log; `debug` carries expected-signature prefixes, and
    // the raw headers carry the caller's signature — neither belongs in logs.
    console.error(`whop signature rejected: ${verification.reason}`);
    return new Response("Invalid signature", { status: 401 });
  }
  console.log(`whop signature ok (scheme: ${verification.scheme})`);

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

  // An unpaid status vetoes the type: a `payment.succeeded` carrying "draft" is
  // Whop's test fixture, not money. A missing status still grants on type alone.
  const unpaid = UNPAID_STATUS.includes(status);
  const succeeded = (SUCCESS_TYPES.includes(type) || SUCCESS_STATUS.includes(status)) && !unpaid;
  const reversed = REVERSAL_TYPES.includes(type) || status === "refunded" || Boolean(data.refunded_at);

  let email = extractEmail(data);
  // Some payment payloads carry only a Whop user id; the API can resolve it.
  if (!email && succeeded && WHOP_API_KEY && data.user_id) {
    email = await fetchWhopUserEmail(WHOP_API_KEY, String(data.user_id));
  }

  const action = succeeded ? "grant" : reversed ? "revoke" : unpaid ? "ignore (unpaid status)" : "ignore";
  console.log(
    `whop event type=${type} status=${status} email=${email || "-"} appUserId=${appUserId ?? "-"} → ${action}`,
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

  // Whether the buyer resolved to an app account is the thing you actually want
  // to know from the logs when someone says "I paid but I'm still free".
  console.log(
    profile
      ? `whop buyer matched app user ${profile.user_id}`
      : `whop buyer has no app account yet — allowlisting ${email || "(no email!)"} so signup grants it`,
  );

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
