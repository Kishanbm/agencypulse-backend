-- Phase 2.1: client_user_assignments table
--
-- Design decision: separate assignments table (NOT clientId on users)
-- Reason: a CLIENT_USER may be invited to multiple clients (multiple brands,
-- multiple accounts). A foreign key on users locks them to exactly one client
-- forever — a schema change later would be destructive.
-- This mirrors the existing staff_client_assignments pattern exactly.
--
-- RLS: follows the same pattern as staff_client_assignments —
-- PERMISSIVE policy on tenant_id added in Phase 1.3 migration.

CREATE TABLE "client_user_assignments" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID        NOT NULL,
  "user_id"        UUID        NOT NULL,   -- must be CLIENT_USER role
  "client_id"      UUID        NOT NULL,
  "assigned_by_id" UUID        NOT NULL,   -- who created this assignment (audit)
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "client_user_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_user_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT,
  CONSTRAINT "client_user_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "client_user_assignments_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE,
  CONSTRAINT "client_user_assignments_assigned_by_id_fkey"
    FOREIGN KEY ("assigned_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  -- A client user can only be assigned to the same client once
  CONSTRAINT "client_user_assignments_user_id_client_id_key"
    UNIQUE ("user_id", "client_id")
);

-- Find all client users for a given client
CREATE INDEX "client_user_assignments_tenant_id_client_id_idx"
  ON "client_user_assignments" ("tenant_id", "client_id");

-- Find all clients a client user can access
CREATE INDEX "client_user_assignments_user_id_idx"
  ON "client_user_assignments" ("user_id");

-- Enable RLS — policies inherited from Phase 1.3 pattern
ALTER TABLE "client_user_assignments" ENABLE ROW LEVEL SECURITY;

-- RLS policy: agencypulse_app can only see rows matching current tenant
-- (matches the PERMISSIVE policy pattern from Phase 1.3)
CREATE POLICY "tenant_isolation_client_user_assignments"
  ON "client_user_assignments"
  FOR ALL
  TO agencypulse_app
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
