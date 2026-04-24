-- AgencyPulse: RLS Policies Migration
-- Phase 1.3 — Multi-tenancy enforcement via PostgreSQL Row Level Security
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW THIS WORKS
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Two DB roles:
--    - `postgres` (or your migration superuser)  → OWNS the tables, BYPASSES RLS
--    - `agencypulse`                             → used by Prisma/app, SUBJECT TO RLS
--
-- 2. Before every Prisma query, PrismaService executes:
--      SET app.current_tenant = '<uuid>';
--    This sets a session-level PostgreSQL GUC (Grand Unified Configuration) variable.
--    RLS policies read this variable via current_setting('app.current_tenant', true).
--
-- 3. Each table has two policies:
--    - SELECT / UPDATE / DELETE — tenant-scoped: only rows where tenant_id matches
--    - INSERT — tenant is always set from the JWT context, not user input
--
-- 4. The `agencies` table is special:
--    - No tenant_id column (it IS the tenant)
--    - Only the row whose id = current_tenant is visible
--    - Applies only to the `agencypulse` app role
--
-- 5. PLATFORM_OWNER bypass:
--    - The app role itself has no superuser privileges
--    - Platform-owner queries are handled at the application layer (Phase 1.5)
--    - All app queries go through RLS — even platform owner routes use a different
--      code path that temporarily BYPASSES via the migration role, not by
--      violating RLS from the app role.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PREREQUISITE: create the app role
-- Run this ONCE as a superuser (not included in migration automation):
--
--   CREATE ROLE agencypulse LOGIN PASSWORD '<strong-password>';
--   GRANT CONNECT ON DATABASE agencypulse_db TO agencypulse;
--   GRANT USAGE ON SCHEMA public TO agencypulse;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agencypulse;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agencypulse;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agencypulse;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT USAGE, SELECT ON SEQUENCES TO agencypulse;
--
-- The DATABASE_URL in .env must use this agencypulse role, not postgres.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper function ──────────────────────────────────────────────────────────
-- Safe wrapper around current_setting() that returns NULL instead of throwing
-- when the GUC is not set (e.g. during migrations or raw admin queries).

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_tenant_id() IS
  'Returns the tenant UUID from the current session GUC app.current_tenant. '
  'Returns NULL if not set. Used by all RLS policies.';

-- ─── agencies ─────────────────────────────────────────────────────────────────
-- agencies IS the tenant. A row is visible only when its `id` matches the
-- current tenant context. This prevents Agency A from reading Agency B's settings.
--
-- The migration role (postgres/superuser) bypasses RLS and can see all agencies
-- for migrations, seeding, and admin ops.

CREATE POLICY agencies_isolation
  ON "agencies"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    id = current_tenant_id()
  )
  WITH CHECK (
    id = current_tenant_id()
  );

-- ─── users ────────────────────────────────────────────────────────────────────
-- Users are scoped to their agency tenant.
--
-- Special case: the login endpoint must find a user by email without a tenant
-- context. That query runs as the `postgres` role (bypasses RLS) or via a
-- SECURITY DEFINER function (Phase 1.4). ALL other user queries run through RLS.

CREATE POLICY users_isolation
  ON "users"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    tenant_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
  );

-- ─── clients ─────────────────────────────────────────────────────────────────
-- Standard tenant isolation.
-- Soft-deleted clients (deleted_at IS NOT NULL) remain visible within the
-- tenant for audit — we filter deleted_at in the application layer, not RLS,
-- so admins can still access archived data when needed.

CREATE POLICY clients_isolation
  ON "clients"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    tenant_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
  );

-- ─── campaigns ───────────────────────────────────────────────────────────────
-- Standard tenant isolation.
-- Same soft-delete note as clients above.

CREATE POLICY campaigns_isolation
  ON "campaigns"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    tenant_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
  );

-- ─── staff_client_assignments ─────────────────────────────────────────────────
-- Standard tenant isolation.

CREATE POLICY staff_client_assignments_isolation
  ON "staff_client_assignments"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    tenant_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
  );

-- ─── refresh_tokens ───────────────────────────────────────────────────────────
-- Standard tenant isolation.
-- Tokens are also scoped by user_id in application logic (Phase 1.4),
-- but RLS ensures cross-tenant token access is impossible at the DB level.

CREATE POLICY refresh_tokens_isolation
  ON "refresh_tokens"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    tenant_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
  );

-- ─── Grant execution rights on helper function ───────────────────────────────
GRANT EXECUTE ON FUNCTION current_tenant_id() TO agencypulse;
