-- Payment records written by the Whop webhook Edge Function. Writes happen with
-- the service-role key (which bypasses RLS), so there are no INSERT/UPDATE
-- policies — only a read policy so users can see their own payments.
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: the Whop buyer email may not map to an app account at write time.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  whop_payment_id TEXT UNIQUE,
  product_id TEXT,
  amount NUMERIC,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'refunded', 'failed')),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_email_idx ON public.payments (lower(email));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own payments" ON public.payments;
CREATE POLICY "Users read their own payments" ON public.payments
  FOR SELECT USING (
    user_id = auth.uid()
    OR lower(email) = lower((SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid()))
  );
