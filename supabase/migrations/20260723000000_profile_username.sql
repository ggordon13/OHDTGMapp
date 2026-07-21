-- Public nickname shown on the dashboard and in the admin directory (instead of
-- the user's real first/last name or email, for privacy).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Enforce the format at the DB level too: letters and numbers, with at most one
-- single space in between, max 16 chars. Null is allowed (not yet set).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (
    username IS NULL
    OR (username ~ '^[A-Za-z0-9]+( [A-Za-z0-9]+)?$' AND char_length(username) <= 16)
  );
