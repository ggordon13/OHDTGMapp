# Whop premium purchase — setup from scratch

How "Get Premium" works end to end, and how to wire it up cleanly.

```
[Get Premium button]  →  whop.com/gglvlup/gglvlup-premium/  →  user pays
                                                                   │
                                     Whop fires payment_succeeded  ▼
                          Supabase Edge Function  whop-webhook  (verifies signature)
                                                                   │
                    writes premium_allowlist + profiles + payments  ▼
                          app reads it on next profile load  →  user is premium
```

Project ref: `fmvzcourofsnhhufurdt` · Function URL:
`https://fmvzcourofsnhhufurdt.functions.supabase.co/whop-webhook`

**The thing that bites:** pushing to GitHub deploys the *frontend* to Vercel. It
does **not** deploy Supabase Edge Functions. If you change
`supabase/functions/**` and only push, Supabase keeps running the old build —
which looks exactly like "my fix didn't work".

---

## 1. Database

The webhook writes to `premium_allowlist` (created by
`supabase/migrations/20260720000000_access_roles.sql`) and `payments`
(`20260729000000_payments.sql`). If migrations haven't been applied to the
hosted project, open **Supabase → SQL Editor**, paste each file's contents and
run it. Both are idempotent (`CREATE TABLE IF NOT EXISTS`).

Confirm:

```sql
select count(*) from public.premium_allowlist;
select count(*) from public.payments;
```

## 2. Deploy the Edge Function

`supabase/functions/whop-webhook/index.ts` is deliberately a single file with no
local imports, so any of these work. Keep it that way.

**a. Supabase dashboard (no tooling needed).** Edge Functions → `whop-webhook` →
edit → paste the whole file → Deploy. Turn **off** "Verify JWT" — Whop calls
without a Supabase token.

**b. GitHub Actions.** `.github/workflows/deploy-whop-webhook.yml` deploys on
every push touching `supabase/functions/**`. Add repo secret
`SUPABASE_ACCESS_TOKEN` (from https://supabase.com/dashboard/account/tokens)
once; until then the job skips with a warning. This is the option worth doing —
it removes the whole class of "I pushed but nothing changed" confusion.

**c. CLI**, if you have Node installed:

```
npx supabase functions deploy whop-webhook --project-ref fmvzcourofsnhhufurdt --no-verify-jwt
```

## 3. Create the Whop webhook

In Whop, open your company (gglvlup) → **Developer → Webhooks** (Whop moves this
around; it may sit under Settings). Delete any old endpoint so there's one
source of truth, then create a new one:

- **URL:** `https://fmvzcourofsnhhufurdt.functions.supabase.co/whop-webhook`
- **Events:** `payment_succeeded`. Add `payment_refunded` and
  `membership_went_invalid` too if you want refunds to revoke access — the
  function already handles them.
- **Copy the signing secret.**

## 4. Give Supabase the secret

Supabase → Edge Functions → **Secrets** (or Project Settings → Edge Functions):

| Name | Value | Required |
| --- | --- | --- |
| `WHOP_WEBHOOK_SECRET` | the signing secret, pasted exactly | yes |
| `WHOP_API_KEY` | Whop API key | optional — only used to look up a buyer email when the payload omits it |
| `WHOP_WEBHOOK_ALLOW_UNVERIFIED` | `true` | **testing only**, see below |

No quotes around values. **Redeploy the function after changing secrets** — a
warm instance keeps the old environment.

## 5. Verify

Send a test event from **Whop's** webhook page (the Supabase function tester
can't sign a request, so it can never pass verification — see below). Then read
Supabase → Edge Functions → `whop-webhook` → **Logs**:

```
whop-webhook boot: build=2026-07-25-multischeme secret=set(len 40, prefix ws_) allowUnverified=false
whop signature ok (scheme: raw-unprefixed | id.ts.body | base64)
whop event type=payment.succeeded status=paid email=… → grant
```

- No `boot:` line → the deployed build is older than your code. Back to step 2.
- `secret=MISSING` → step 4 didn't take.
- `whop signature rejected: …` → the line names the cause and prints received vs
  expected signature prefixes. "no signature scheme matched" means the secret is
  wrong or belongs to a different endpoint.

**The confirmed scheme** (verified 2026-07-25) is `raw | id.ts.body | base64`:
the HMAC key is the whole `ws_…` secret as raw UTF-8 bytes — *not* base64-decoded —
over `${webhook-id}.${webhook-timestamp}.${rawBody}`, compared base64. If that
line ever names a different scheme, Whop changed convention.

**Whop's dashboard test event carries `status: "draft"`** — an unpaid receipt. The
function logs `→ ignore (unpaid status)` for it and grants nothing. That's
correct: use it to prove signatures verify, not to test the grant path.

## 6. Vercel

The frontend needs only these (Vercel → Project → Settings → Environment
Variables). **Redeploy after changing them** — Vite bakes them in at build time.

| Name | Notes |
| --- | --- |
| `VITE_SUPABASE_URL` | required |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | required, anon key |
| `VITE_SUPABASE_PROJECT_ID` | required |
| `VITE_WHOP_CHECKOUT_URL` | optional; defaults to the gglvlup product page in `src/lib/whop.ts` |

Never put `WHOP_WEBHOOK_SECRET` or `WHOP_API_KEY` here — anything `VITE_`-prefixed
ships to the browser.

## 7. End-to-end test

Click **Get Premium** in the app, pay with the **same email as your app
account**, and you should land back on the app as premium within a few seconds
(`useProfile` polls after checkout). Check `payments` for the row.

Cleanup after a test purchase:

```sql
delete from public.payments where email = 'test@example.com';
delete from public.premium_allowlist where email = 'test@example.com';
update public.profiles set access_level = 'free' where email = 'test@example.com';
```

---

## Notes and limits

**Email is the only link between a buyer and an app account.** Confirmed on a
real purchase (2026-07-25): the checkout URL is tagged with `email` and
`metadata[app_user_id]`, but Whop's *product page* drops them — the webhook
logged `appUserId=-`. So a buyer who pays with a different address than their app
login won't be matched. The webhook still allowlists whatever email Whop reports,
so premium activates if they later sign up with it; otherwise an admin adds the
address in the Premium Access Manager. The log line `whop buyer matched app user
…` / `whop buyer has no app account yet …` tells you which happened.

**`WHOP_WEBHOOK_ALLOW_UNVERIFIED=true`** processes events even when the signature
fails, so you can test the grant path before signatures work. While it's on,
anyone who finds the function URL can grant themselves premium. Unset it and
redeploy as soon as step 5 passes.

**The Supabase function tester** (Edge Functions → Test) sends no
`webhook-signature` header, so it returns 401 by design. It's only usable with
the flag above, and then only to exercise the grant logic:

```json
{
  "type": "payment.succeeded",
  "data": {
    "id": "pay_test_001",
    "status": "paid",
    "user_email": "test@example.com",
    "product_id": "prod_test",
    "final_amount": 9.99,
    "currency": "usd"
  }
}
```
