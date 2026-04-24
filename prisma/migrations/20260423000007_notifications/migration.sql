-- ─── Notifications ───────────────────────────────────────────────────────────
-- Per-user notification rows. RLS enforces tenant + user isolation.
-- Soft-delete not needed — users can dismiss via mark-read; old rows pruned by cron.

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL,
  user_id       UUID          NOT NULL,
  type          VARCHAR(50)   NOT NULL,   -- ALERT_TRIGGERED | SYNC_FAILED | REPORT_READY | INVITE_ACCEPTED | SYNC_CONNECTED
  title         VARCHAR(255)  NOT NULL,
  message       TEXT,
  resource_type VARCHAR(100),             -- Campaign | Integration | Report | User
  resource_id   VARCHAR(255),
  is_read       BOOLEAN       NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_notifications PRIMARY KEY (id)
);

-- Fast unread badge count + paginated list
CREATE INDEX idx_notifications_user_unread
  ON notifications (tenant_id, user_id, is_read, created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- App role: users see only their own notifications within their tenant
CREATE POLICY notifications_user_isolation ON notifications
  FOR ALL
  TO agencypulse
  USING (
    tenant_id = current_setting('app.current_tenant_id')::uuid
  );
