-- Record of explicit consent to process health data.
--
-- Weight, calories, water, steps and exercise are "special category" data under
-- GDPR Art. 9 and "sensitive personal information" under the PH Data Privacy
-- Act. Both require explicit, unbundled consent — a Terms-of-Service link or a
-- "by using this app you agree" line does not carry it, and the burden of proof
-- that consent was given sits with us.
--
-- One nullable timestamp: set the first time the user ticks the box in profile
-- setup, never cleared by a later profile edit. Withdrawal is account deletion,
-- which removes the data outright.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS health_data_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.health_data_consent_at IS
  'When the user explicitly consented to health-data processing (GDPR Art. 9 / PH DPA). Null = not yet given.';

-- Deliberately left writable by the user: it is their consent to give, the
-- client stamps it at setup, and the worst a malicious value achieves is
-- claiming they consented earlier than they did — which harms only themselves.
-- Everything privilege- or score-bearing stays revoked (see 20260740000000).
