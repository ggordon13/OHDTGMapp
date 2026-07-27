// Daily "log your day" push reminder.
//
// Sends a Web Push to every subscribed user who hasn't logged yet today, and
// prunes subscriptions the push service reports as gone (404/410). Meant to be
// invoked once a day by a scheduler (pg_cron → pg_net, or Supabase Cron), which
// must present the shared CRON_SECRET header.
//
// Required function secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// Provided automatically by the platform:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy with:  supabase functions deploy send-reminders --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  // Only the scheduler (holding the shared secret) may trigger a send.
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // NOTE: "today" is UTC. Good enough for a daily nudge; if your users are all
  // in one timezone, shift this (e.g. subtract 8h for PH time) or store a tz.
  const today = new Date().toISOString().slice(0, 10);

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  if (error) return new Response(error.message, { status: 500 });

  // Users who already logged today are skipped.
  const { data: logged } = await admin.from("daily_logs").select("user_id").eq("date", today);
  const loggedSet = new Set((logged ?? []).map((r) => r.user_id as string));

  const payload = JSON.stringify({
    title: "GGLvlup",
    body: "Time to log today — keep your streak alive! 🔥",
    url: "/",
  });

  let sent = 0;
  let removed = 0;

  for (const s of (subs ?? []) as SubRow[]) {
    if (loggedSet.has(s.user_id)) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410 = the subscription is dead; drop it so we stop trying.
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
        removed++;
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed }), {
    headers: { "content-type": "application/json" },
  });
});
