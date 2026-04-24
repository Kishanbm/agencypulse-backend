-- Migration: Correct RLS policies to target agencypulse_app role
--
-- Problems fixed:
-- 1. Original policies targeted `agencypulse` (table owner) — owners bypass
--    RLS unconditionally, so policies were completely ineffective.
-- 2. FOR ALL with WITH CHECK does NOT override the USING clause for INSERT.
--    In PostgreSQL, for INSERT commands, only WITH CHECK applies (no USING).
--    But for FOR ALL, if only USING is specified, it is used for ALL commands
--    including INSERT. Using separate per-command policies is the correct approach.
--
-- Design:
--   - agencies, users, refresh_tokens: INSERT is open (public auth routes need
--     to create these without a tenant context yet).
--   - clients, campaigns, staff_client_assignments: both INSERT and SELECT/UPDATE/DELETE
--     require tenant context (only reachable from authenticated routes).
--
-- The agencypulse_app role is created by scripts/setup-db-role.sql.

-- ─── Drop all existing policies ───────────────────────────────────────────────
DROP POLICY IF EXISTS users_isolation ON users;
DROP POLICY IF EXISTS agencies_isolation ON agencies;
DROP POLICY IF EXISTS clients_isolation ON clients;
DROP POLICY IF EXISTS campaigns_isolation ON campaigns;
DROP POLICY IF EXISTS staff_client_assignments_isolation ON staff_client_assignments;
DROP POLICY IF EXISTS refresh_tokens_isolation ON refresh_tokens;

-- ─── agencies ─────────────────────────────────────────────────────────────────
CREATE POLICY agencies_select ON agencies
  FOR SELECT TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND id = current_tenant_id());
CREATE POLICY agencies_update ON agencies
  FOR UPDATE TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NOT NULL AND id = current_tenant_id());
CREATE POLICY agencies_delete ON agencies
  FOR DELETE TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND id = current_tenant_id());
CREATE POLICY agencies_insert ON agencies
  FOR INSERT TO agencypulse_app
  WITH CHECK (true);  -- register() creates a new tenant, no context exists yet

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE POLICY users_select ON users
  FOR SELECT TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
CREATE POLICY users_update ON users
  FOR UPDATE TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
CREATE POLICY users_delete ON users
  FOR DELETE TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
CREATE POLICY users_insert ON users
  FOR INSERT TO agencypulse_app
  WITH CHECK (true);  -- register() creates first user before context is set

-- ─── refresh_tokens ───────────────────────────────────────────────────────────
CREATE POLICY refresh_tokens_select ON refresh_tokens
  FOR SELECT TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
CREATE POLICY refresh_tokens_update ON refresh_tokens
  FOR UPDATE TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
CREATE POLICY refresh_tokens_delete ON refresh_tokens
  FOR DELETE TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
CREATE POLICY refresh_tokens_insert ON refresh_tokens
  FOR INSERT TO agencypulse_app
  WITH CHECK (true);  -- storeRefreshToken called at login before context is set

-- ─── clients (authenticated routes only — tenant context always present) ──────
CREATE POLICY clients_isolation ON clients
  FOR ALL TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());

-- ─── campaigns ────────────────────────────────────────────────────────────────
CREATE POLICY campaigns_isolation ON campaigns
  FOR ALL TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());

-- ─── staff_client_assignments ─────────────────────────────────────────────────
CREATE POLICY staff_client_assignments_isolation ON staff_client_assignments
  FOR ALL TO agencypulse_app
  USING (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id());
