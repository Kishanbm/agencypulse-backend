-- ─── Auth Extras: email verification, password reset, expanded signup ───────
-- Adds support for:
--   1) Email verification tokens (per-user, hashed in DB)
--   2) Password reset tokens (per-user, hashed in DB)
--   3) Expanded agency profile fields (collected during 3-step signup)
--   4) Optional user phone

-- ─── Users ────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone                              VARCHAR(40),
  ADD COLUMN IF NOT EXISTS email_verification_token_hash      VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS password_reset_expires_at          TIMESTAMPTZ;

-- Index for fast lookup-by-token-hash (verify and reset endpoints)
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
  ON users (password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;

-- ─── Agencies ─────────────────────────────────────────────────────────────────
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS website                VARCHAR(500),
  ADD COLUMN IF NOT EXISTS size                   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country                VARCHAR(2),
  ADD COLUMN IF NOT EXISTS timezone               VARCHAR(64),
  ADD COLUMN IF NOT EXISTS interests              TEXT[],
  ADD COLUMN IF NOT EXISTS client_count_estimate  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS referral_source        VARCHAR(50);

-- ─── SECURITY DEFINER lookup functions ────────────────────────────────────────
-- Both forgot-password and verify-email need to find a user by token hash
-- BEFORE tenant context is known — same pattern as find_user_for_login.

CREATE OR REPLACE FUNCTION find_user_by_email_verification_token(p_token_hash TEXT)
RETURNS TABLE (
  id                              UUID,
  tenant_id                       UUID,
  email                           VARCHAR(255),
  email_verification_expires_at   TIMESTAMPTZ,
  email_verified_at               TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tenant_id, email, email_verification_expires_at, email_verified_at
  FROM users
  WHERE email_verification_token_hash = p_token_hash
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION find_user_by_password_reset_token(p_token_hash TEXT)
RETURNS TABLE (
  id                          UUID,
  tenant_id                   UUID,
  email                       VARCHAR(255),
  password_reset_expires_at   TIMESTAMPTZ,
  is_active                   BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tenant_id, email, password_reset_expires_at, is_active
  FROM users
  WHERE password_reset_token_hash = p_token_hash
  LIMIT 1;
$$;

-- find_user_for_password_reset: looks up user by email (forgot-password flow)
-- Pre-tenant-context, hence SECURITY DEFINER (mirror find_user_for_login).
CREATE OR REPLACE FUNCTION find_user_for_password_reset(p_email TEXT)
RETURNS TABLE (
  id          UUID,
  tenant_id   UUID,
  email       VARCHAR(255),
  first_name  VARCHAR(100),
  is_active   BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tenant_id, email, first_name, is_active
  FROM users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
$$;
