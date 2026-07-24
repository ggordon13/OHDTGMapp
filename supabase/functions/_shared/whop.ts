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
 * Verify a webhook signature. Whop signs the raw request body with your webhook
 * secret; the exact header name + algorithm MUST be confirmed from Whop's webhook
 * docs. This implements hex HMAC-SHA256(raw body), a common scheme, with a
 * length-safe comparison.
 */
export async function verifyWhopSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const provided = signature.replace(/^sha256=/, "").trim();
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
