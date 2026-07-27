-- Web Push subscriptions, one row per browser/device endpoint.
--
-- The client (src/lib/pwa.ts) stores its PushSubscription here. Sending pushes
-- needs a VAPID keypair + a small edge function using the `web-push` library —
-- this table is the storage half so that server piece can be added later.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own push subs select" ON public.push_subscriptions;
CREATE POLICY "own push subs select" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own push subs insert" ON public.push_subscriptions;
CREATE POLICY "own push subs insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own push subs update" ON public.push_subscriptions;
CREATE POLICY "own push subs update" ON public.push_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own push subs delete" ON public.push_subscriptions;
CREATE POLICY "own push subs delete" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());
