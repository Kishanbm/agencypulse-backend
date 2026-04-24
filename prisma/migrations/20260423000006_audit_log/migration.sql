-- ─── Phase Audit Log: audit_logs table ───────────────────────────────────────
-- Immutable append-only log of all significant mutations per tenant.
-- No FK constraints on user_id / resource_id — records must survive user/resource deletion.
-- RLS policy: tenants can only read their own rows (no writes via app role).

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL,
  user_id         UUID,                          -- NULL for system actions
  user_email      VARCHAR(255),
  action          VARCHAR(50) NOT NULL,          -- CREATE | UPDATE | DELETE | CONNECT | DISCONNECT | GENERATE
  resource_type   VARCHAR(100) NOT NULL,         -- Client | Campaign | User | Integration | Report | Billing
  resource_id     VARCHAR(255),                  -- UUID or other identifier
  resource_name   VARCHAR(255),                  -- Human-readable label at time of action
  metadata        JSONB,                         -- { before: {...}, after: {...} } or relevant context
  ip_address      VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_audit_logs PRIMARY KEY (id)
);

-- Fast paginated reads per tenant, newest first
CREATE INDEX idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

-- Filter by resource type within a tenant
CREATE INDEX idx_audit_logs_tenant_resource
  ON audit_logs (tenant_id, resource_type, created_at DESC);

-- Filter by user within a tenant
CREATE INDEX idx_audit_logs_tenant_user
  ON audit_logs (tenant_id, user_id, created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- App role reads own tenant rows only; writes bypass RLS (systemPrisma / owner role)
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR SELECT
  TO agencypulse
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
