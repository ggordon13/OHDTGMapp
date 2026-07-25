// Server-only Whop helpers (Deno / Supabase Edge Functions). These need the
// secret WHOP_API_KEY — NEVER import this module into client/browser code.
//
// The user-provided facts are used as-is (base URL + Bearer auth). Exact REST
// paths, the webhook signature header, and event field names differ by Whop API
// version — the spots below marked TODO must be confirmed against your Whop
// dashboard / API reference before going live.

const WHOP_BASE = "https://api.whop.com";

/** Bearer-authenticated fetch against the Whop REST API. */
function whopFetch(path: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${WHOP_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** Minimal payment shape we rely on. Extend to match Whop's actual response. */
export interface WhopPayment {
  id: string;
  status?: string;
  final_amount?: number;
  amount?: number;
  currency?: string;
  product_id?: string;
  user?: { email?: string };
  email?: string;
}

/** List payments (Whop caps pages at 50). Pass companyId for company scope. */
export async function listPayments(
  apiKey: string,
  opts: { page?: number; companyId?: string } = {},
): Promise<{ data: WhopPayment[] }> {
  const params = new URLSearchParams({ per: "50" });
  if (opts.page) params.set("page", String(opts.page));
  if (opts.companyId) params.set("company_id", opts.companyId);
  // TODO: confirm the payments-list path (e.g. /v5/company/payments) in Whop docs.
  const res = await whopFetch(`/v5/payments?${params}`, apiKey);
  if (!res.ok) throw new Error(`Whop listPayments failed: ${res.status}`);
  return await res.json();
}

/** Retrieve a single payment by id. */
export async function getPayment(apiKey: string, paymentId: string): Promise<WhopPayment> {
  // TODO: confirm the single-payment path in Whop docs.
  const res = await whopFetch(`/v5/payments/${paymentId}`, apiKey);
  if (!res.ok) throw new Error(`Whop getPayment failed: ${res.status}`);
  return await res.json();
}

/**
 * Best-effort lookup of a buyer's email from a Whop user id, for payment
 * payloads that carry only the id. Returns null if no known endpoint answers —
 * the caller then falls back to whatever the payload had.
 */
export async function fetchWhopUserEmail(apiKey: string, userId: string): Promise<string | null> {
  for (const path of [`/v5/users/${userId}`, `/v2/users/${userId}`]) {
    try {
      const res = await whopFetch(path, apiKey);
      if (!res.ok) continue;
      const body = await res.json();
      const email = (body?.email ?? body?.data?.email ?? "").toString().trim().toLowerCase();
      if (email.includes("@")) return email;
    } catch (err) {
      console.error(`Whop user lookup failed for ${path}`, err);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
//
// Whop's headers are known from real traffic (webhook-id / webhook-timestamp /
// webhook-signature — the Standard Webhooks shape). What is NOT documented
// consistently is how the secret is keyed: Svix-style secrets are base64 after a
// `whsec_` prefix, while Whop hands out `ws_...` secrets that are used as raw
// bytes. Rather than betting on one, we try every plausible combination of
// (key derivation × signed content × digest encoding) and report which one hit,
// so the function log names the real scheme after the first successful event.
// ---------------------------------------------------------------------------

export interface WebhookVerification {
  valid: boolean;
  /** Which candidate scheme matched, e.g. "raw-unprefixed | id.ts.body | base64". */
  scheme?: string;
  /** Why it failed, safe to log. */
  reason?: string;
  /** Non-secret detail for the log: what arrived vs what each scheme expected. */
  debug?: string;
}

const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Base64-decode, or null when the input isn't base64 at all (e.g. a `ws_` secret). */
function tryBase64Decode(value: string): Uint8Array | null {
  // atob is lenient about some junk; reject anything outside the alphabet first.
  if (!/^[A-Za-z0-9+/=_-]+$/.test(value) || /[_-]/.test(value)) return null;
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
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
 * Verify a Whop webhook. Returns a diagnostic rather than a bare boolean so the
 * caller can log exactly why a 401 happened.
 *
 * A 5-minute timestamp tolerance guards replays; it is only enforced when Whop
 * actually sent a timestamp.
 */
export async function verifyWhopWebhook(opts: {
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
  const keys: { name: string; bytes: Uint8Array }[] = [
    { name: "raw", bytes: encoder.encode(secret) },
  ];
  if (unprefixed !== secret) keys.push({ name: "raw-unprefixed", bytes: encoder.encode(unprefixed) });
  const decoded = tryBase64Decode(unprefixed);
  if (decoded) keys.push({ name: "base64", bytes: decoded });

  // Every way the signed content might be assembled.
  const contents: { name: string; value: string }[] = [];
  if (id && timestamp) contents.push({ name: "id.ts.body", value: `${id}.${timestamp}.${body}` });
  if (timestamp) contents.push({ name: "ts.body", value: `${timestamp}.${body}` });
  contents.push({ name: "body", value: body });

  const attempted: string[] = [];

  for (const key of keys) {
    const cryptoKey = await crypto.subtle.importKey("raw", key.bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    for (const content of contents) {
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(content.value)));
      const digests = { base64: toBase64(mac), hex: toHex(mac) };
      for (const [encoding, expected] of Object.entries(digests)) {
        if (provided.some((sig) => timingSafeEqual(sig, expected))) {
          const scheme = `${key.name} | ${content.name} | ${encoding}`;
          // Enforce the replay window only once we know the signature is real.
          const ts = Number(timestamp);
          if (timestamp && Number.isFinite(ts) && Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
            return { valid: false, scheme, reason: `signature valid but timestamp is ${Math.abs(Math.floor(Date.now() / 1000) - ts)}s off — replay or clock skew` };
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
