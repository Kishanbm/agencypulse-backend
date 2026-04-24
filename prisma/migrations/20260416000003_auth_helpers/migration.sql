-- AgencyPulse: Auth Helpers Migration
-- Phase 1.4 — SECURITY DEFINER functions for auth operations that must
-- bypass RLS (login, refresh token lookup) in a strictly controlled way.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY SECURITY DEFINER?
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS requires `app.current_tenant` to be set before any query.
-- During login, we only have an email — no tenant context yet.
-- We cannot set `app.current_tenant` before we find the user.
--
-- SECURITY DEFINER functions run as the function OWNER (postgres/superuser),
-- which bypasses RLS. This lets us do the ONE lookup needed before tenant
-- context exists.
--
-- Security constraints applied to limit the blast radius:
--   1. Returns ONLY the fields the login flow needs — nothing more.
--   2. Takes only an email parameter — no arbitrary query injection possible.
--   3. Wrapped in a strict search_path to prevent schema injection.
--   4. GRANT EXECUTE only to the agencypulse app role.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── find_user_for_login ──────────────────────────────────────────────────────
-- Used by: AuthService.login()
-- Returns minimal fields: id, tenant_id, email, password_hash, role, is_active
-- Does NOT return: avatar_url, invited_by_id, etc. — irrelevant to login
--
-- Returns NULL if user does not exist (do NOT leak "user not found" vs
-- "wrong password" — the service layer returns the same error for both).

CREATE OR REPLACE FUNCTION find_user_for_login(p_email VARCHAR(255))
RETURNS TABLE (
  id           UUID,
  tenant_id    UUID,
  email        VARCHAR(255),
  password_hash VARCHAR(255),
  role         user_role,
  is_active    BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    u.id,
    u.tenant_id,
    u.email,
    u.password_hash,
    u.role,
    u.is_active
  FROM users u
  WHERE u.email = p_email
  LIMIT 1;
$$;

COMMENT ON FUNCTION find_user_for_login(VARCHAR) IS
  'SECURITY DEFINER: bypasses RLS to find a user by email for login. '
  'Returns minimal fields only. Use exclusively in the login flow before tenant context is established.';

GRANT EXECUTE ON FUNCTION find_user_for_login(VARCHAR) TO agencypulse;

-- ─── find_refresh_token ───────────────────────────────────────────────────────
-- Used by: TokenService.validateRefreshToken()
-- Refresh token lookup cannot use RLS because the client sends only the
-- raw token — we don't know the tenant until after we find and validate it.
-- After finding it, tenant context is established and subsequent queries
-- (update revoked_at, issue new token) run under normal RLS.
--
-- Returns only: id, tenant_id, user_id, expires_at, revoked_at
-- Does NOT return: user_agent, ip_address (not needed for validation)

CREATE OR REPLACE FUNCTION find_refresh_token(p_token_hash VARCHAR(64))
RETURNS TABLE (
  id         UUID,
  tenant_id  UUID,
  user_id    UUID,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    rt.id,
    rt.tenant_id,
    rt.user_id,
    rt.expires_at,
    rt.revoked_at
  FROM refresh_tokens rt
  WHERE rt.token_hash = p_token_hash
  LIMIT 1;
$$;

COMMENT ON FUNCTION find_refresh_token(VARCHAR) IS
  'SECURITY DEFINER: bypasses RLS to find a refresh token by hash. '
  'Returns minimal fields only. Use exclusively in the refresh flow before tenant context is established.';

GRANT EXECUTE ON FUNCTION find_refresh_token(VARCHAR) TO agencypulse;
