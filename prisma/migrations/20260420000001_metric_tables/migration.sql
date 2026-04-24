-- Phase 4.1 — Metrics Data Model
-- Creates metric_definitions (global reference) and metric_values (tenant-scoped time-series).
-- Plain PostgreSQL with BTREE indexes (per STACK.md — no TimescaleDB).
--
-- Partitioning note: metric_values is NOT partitioned now, but is designed for future
-- PARTITION BY RANGE (recorded_at) — recorded_at is included in all unique/query indexes.
-- To partition later: CREATE TABLE metric_values_partitioned (LIKE metric_values),
-- add PARTITION BY RANGE, migrate data, swap names.

-- ─── metric_definitions (global, no RLS) ─────────────────────────────────────

CREATE TABLE metric_definitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform   integration_platform NOT NULL,
  metric_key VARCHAR(100) NOT NULL,
  label      VARCHAR(200) NOT NULL,
  category   VARCHAR(50)  NOT NULL,
  data_type  VARCHAR(20)  NOT NULL,
  unit       VARCHAR(20),

  UNIQUE(platform, metric_key)
);

-- AI1 fix: index on platform for "get all metric definitions for GA4" queries
CREATE INDEX idx_metric_definitions_platform ON metric_definitions (platform);

-- Global read-only reference — no RLS, read-only for app role
GRANT SELECT ON metric_definitions TO agencypulse_app;

-- ─── metric_values (tenant-scoped, RLS enforced) ─────────────────────────────

CREATE TABLE metric_values (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES agencies(id),
  campaign_id    UUID NOT NULL REFERENCES campaigns(id),
  platform       integration_platform NOT NULL,
  metric_key     VARCHAR(100) NOT NULL,
  recorded_at    DATE NOT NULL,
  value          DECIMAL(20,6) NOT NULL,
  dimension_key  VARCHAR(100),
  dimension_val  VARCHAR(200),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- AI1 fix: CHECK constraint — all stored metrics are non-negative
  -- (sessions, clicks, impressions, cost, bounce rate — all >= 0)
  CONSTRAINT chk_metric_value_non_negative CHECK (value >= 0)
);

-- Primary dashboard query: "all metrics for this campaign between these dates"
CREATE INDEX idx_metric_values_campaign_date
  ON metric_values (tenant_id, campaign_id, platform, recorded_at DESC);

-- Specific metric lookup: "sessions for this campaign on this date"
CREATE INDEX idx_metric_values_lookup
  ON metric_values (tenant_id, campaign_id, platform, metric_key, recorded_at);

-- AI1 fix: tenant_id included in UNIQUE index (defense-in-depth for cross-tenant isolation)
-- AI2 fix: COALESCE on dimension_key/val — prevents NULL vs '' duplicate conflicts
-- This enables ON CONFLICT DO UPDATE for idempotent upserts (safe with 1-day sync overlap).
CREATE UNIQUE INDEX idx_metric_values_upsert
  ON metric_values (
    tenant_id,
    campaign_id,
    platform,
    metric_key,
    recorded_at,
    COALESCE(dimension_key, ''),
    COALESCE(dimension_val, '')
  );

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE metric_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON metric_values
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON metric_values TO agencypulse_app;
