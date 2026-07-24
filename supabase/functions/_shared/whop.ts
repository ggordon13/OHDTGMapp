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
 * Verify a Whop webhook using the Standard Webhooks (Svix) scheme, confirmed
 * from real Whop headers: webhook-id / webhook-timestamp / webhook-signature.
 *
 *   signedContent = `${id}.${timestamp}.${rawBody}`
 *   key           = base64-decode(secret after the "whsec_" prefix)
 *   expected      = base64( HMAC-SHA256(signedContent, key) )
 *
 * The signature header may hold several space-separated "v1,<sig>" entries; a
 * match against any one passes. A 5-minute timestamp tolerance guards replays.
 */
export async function verifyStandardWebhook(opts: {
  id: string;
  timestamp: string;
  body: string;
  signatureHeader: string;
  secret: string;
}): Promise<boolean> {
  const { id, timestamp, body, signatureHeader, secret } = opts;
  if (!secret || !signatureHeader || !id || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  for (const part of signatureHeader.split(" ")) {
    const sig = part.split(",")[1];
    if (sig && sig.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
      if (diff === 0) return true;
    }
  }
  return false;
}
