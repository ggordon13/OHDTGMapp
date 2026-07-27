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

// This file runs on Supabase's Deno runtime, which provides `Deno`. The app's
// Node TypeScript doesn't know that global, so declare the bits we use here to
// keep the editor quiet (erased at runtime; the real Deno global is used).
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

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

  // "today" must match how the app stores daily_logs.date — the user's LOCAL
  // date. daily_logs are saved with the browser's local date, so we shift by the
  // audience's UTC offset (default +8 = PH) before taking the date. Set
  // REMINDER_UTC_OFFSET to your users' offset in hours. (For a truly global
  // audience, store a per-user timezone and compute this per row instead.)
  const OFFSET_HOURS = Number(Deno.env.get("REMINDER_UTC_OFFSET") ?? "8");
  const today = new Date(Date.now() + OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  if (error) return new Response(error.message, { status: 500 });

  // Users who already logged today are skipped. "Logged" matches the app's own
  // rule (isDayLogged): a day counts only once a WEIGHT is recorded — a row that
  // merely exists (e.g. a partial save, or a default "None" exercise) does not.
  const { data: logged } = await admin
    .from("daily_logs")
    .select("user_id")
    .eq("date", today)
    .not("weight", "is", null);
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

  console.log(
    `send-reminders: subscriptions=${(subs ?? []).length} loggedToday=${loggedSet.size} sent=${sent} removed=${removed}`,
  );

  return new Response(JSON.stringify({ sent, removed }), {
    headers: { "content-type": "application/json" },
  });
});
