ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'dev')),
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'free'
    CHECK (access_level IN ('free', 'premium'));

CREATE TABLE IF NOT EXISTS public.premium_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  access_level TEXT NOT NULL DEFAULT 'premium' CHECK (access_level IN ('free', 'premium')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can manage premium allowlist"
  ON public.premium_allowlist
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'dev')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'dev')
    )
  );

CREATE POLICY "Users can view active premium allowlist entries"
  ON public.premium_allowlist
  FOR SELECT
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_premium_allowlist_updated_at
BEFORE UPDATE ON public.premium_allowlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
