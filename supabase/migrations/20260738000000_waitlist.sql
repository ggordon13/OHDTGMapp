-- Launch email list. Anyone (even signed out) can add their email; the list is
-- readable only via the service role / dashboard, never publicly.

CREATE TABLE IF NOT EXISTS public.waitlist_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Insert-only for the public; no SELECT policy, so rows can't be read back.
DROP POLICY IF EXISTS "anyone can join the waitlist" ON public.waitlist_emails;
CREATE POLICY "anyone can join the waitlist" ON public.waitlist_emails
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
