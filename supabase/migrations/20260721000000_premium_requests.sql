-- Premium upgrade requests + the 30-day lock timestamp for starting data.

-- When the user last changed a locked "starting data" field (target weight or
-- Day 1 date). Null means never changed since the feature shipped, so the first
-- change is always allowed. Free users can't change these at all; premium users
-- are limited to once per 30 days off this timestamp.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS starting_data_updated_at TIMESTAMPTZ;

-- A user's request to be granted premium, reviewed by an admin/dev. Approving a
-- request adds the email to premium_allowlist (the existing grant mechanism).
CREATE TABLE IF NOT EXISTS public.premium_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- At most one open request per user, so re-clicking "Get Premium" can't spam the
-- admin queue. Resolved (approved/rejected) requests don't count, so a rejected
-- user can ask again later.
CREATE UNIQUE INDEX IF NOT EXISTS premium_requests_one_pending_per_user
  ON public.premium_requests (user_id)
  WHERE status = 'pending';

ALTER TABLE public.premium_requests ENABLE ROW LEVEL SECURITY;

-- A user can raise and see their own requests.
CREATE POLICY "Users manage their own premium requests"
  ON public.premium_requests
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own premium requests"
  ON public.premium_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins and devs can see and act on every request.
CREATE POLICY "Admins and devs can view all premium requests"
  ON public.premium_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'dev')
    )
  );

CREATE POLICY "Admins and devs can update premium requests"
  ON public.premium_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'dev')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'dev')
    )
  );
