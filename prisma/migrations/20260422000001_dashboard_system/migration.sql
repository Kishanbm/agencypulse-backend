-- Phase 5.1 — Dashboard System
-- Creates dashboards and dashboard_widgets tables.
--
-- Design decisions (from AI review):
--   - Multiple dashboards per campaign (no UNIQUE campaign_id) — is_default flag instead
--   - No layout column on dashboards — position lives on each widget only
--   - campaign_id directly on dashboard_widgets for integrity + query speed
--   - config JSONB is validated as structured DTO in the application layer
--   - Soft deletes on both tables for recovery + audit

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE widget_type AS ENUM ('KPI', 'LINE_CHART', 'BAR_CHART', 'TABLE', 'PIE_CHART');

-- ─── dashboards ───────────────────────────────────────────────────────────────

CREATE TABLE dashboards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES agencies(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  name        VARCHAR(255) NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Fast lookup: all dashboards for a campaign (most common query)
CREATE INDEX idx_dashboards_campaign ON dashboards (tenant_id, campaign_id);

-- ─── dashboard_widgets ────────────────────────────────────────────────────────

CREATE TABLE dashboard_widgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES agencies(id),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id),
  widget_type  widget_type NOT NULL,
  platform     integration_platform,
  metric_keys  TEXT[] NOT NULL DEFAULT '{}',
  config       JSONB NOT NULL DEFAULT '{}',
  position     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

-- Fast lookup: all widgets for a dashboard (dashboard load query)
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets (tenant_id, dashboard_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dashboards
  USING (current_setting('app.current_tenant', TRUE) IS NOT NULL AND current_setting('app.current_tenant', TRUE) != '' AND tenant_id = current_setting('app.current_tenant', TRUE)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON dashboards TO agencypulse_app;

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dashboard_widgets
  USING (current_setting('app.current_tenant', TRUE) IS NOT NULL AND current_setting('app.current_tenant', TRUE) != '' AND tenant_id = current_setting('app.current_tenant', TRUE)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_widgets TO agencypulse_app;
