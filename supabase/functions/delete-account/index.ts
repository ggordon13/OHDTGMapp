// Permanently delete the calling user's account and all their data.
//
// Runs as the authenticated user (platform verifies their JWT), reads their id
// from the token, then uses the service role to delete the auth user — which
// cascades every table that references auth.users(id) ON DELETE CASCADE
// (profiles, daily_logs, quest_claims, achievements, challenges,
// challenge_participants, hundred_day_runs, push_subscriptions). payments are
// unlinked (SET NULL). The two non-cascading references are cleared first.
//
// Deploy with:  supabase functions deploy delete-account   (JWT verification ON)

import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not authenticated" }, 401);

  // Identify the caller strictly from their own JWT — they can only delete self.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Clear the two references that don't cascade on user deletion.
  if (user.email) {
    await admin.from("premium_allowlist").delete().ilike("email", user.email);
  }
  await admin.from("premium_requests").update({ reviewed_by: null }).eq("reviewed_by", user.id);

  // Delete the auth user — everything owned by them cascades away.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
