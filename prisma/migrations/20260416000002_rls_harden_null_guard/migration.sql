-- AgencyPulse: RLS Hardening — NULL tenant guard
-- Phase 1.3 patch — addresses two correctness issues:
--
-- 1. NULL-tenant ambiguity:
--    `tenant_id = NULL` evaluates to NULL (not FALSE) in SQL.
--    PostgreSQL treats NULL as "not true" in USING clauses, so no rows are
--    returned — which is safe. But the intent is ambiguous and future changes
--    could introduce bugs. The fix: `current_tenant_id() IS NOT NULL AND
--    tenant_id = current_tenant_id()` — explicit block when tenant is unset.
--
-- 2. agencies table NULL case:
--    `id = NULL` has the same ambiguity. Same fix applied.
--
-- We DROP and recreate each policy because ALTER POLICY cannot change the
-- USING expression in all PostgreSQL versions reliably.

-- ─── agencies ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS agencies_isolation ON "agencies";

CREATE POLICY agencies_isolation
  ON "agencies"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    current_tenant_id() IS NOT NULL
    AND id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NOT NULL
    AND id = current_tenant_id()
  );

-- ─── users ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS users_isolation ON "users";

CREATE POLICY users_isolation
  ON "users"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  );

-- ─── clients ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS clients_isolation ON "clients";

CREATE POLICY clients_isolation
  ON "clients"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  );

-- ─── campaigns ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS campaigns_isolation ON "campaigns";

CREATE POLICY campaigns_isolation
  ON "campaigns"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  );

-- ─── staff_client_assignments ─────────────────────────────────────────────────

DROP POLICY IF EXISTS staff_client_assignments_isolation ON "staff_client_assignments";

CREATE POLICY staff_client_assignments_isolation
  ON "staff_client_assignments"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  );

-- ─── refresh_tokens ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS refresh_tokens_isolation ON "refresh_tokens";

CREATE POLICY refresh_tokens_isolation
  ON "refresh_tokens"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse
  USING (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NOT NULL
    AND tenant_id = current_tenant_id()
  );
