-- Phase 5 — Dashboard System Constraints
-- Adds database-level integrity constraints for dashboards and validation

-- ─── Dashboard Constraints ─────────────────────────────────────────────────────
-- UNIQUE index: enforce single default dashboard per campaign
-- Filters WHERE is_default=true AND deleted_at IS NULL to allow:
--   - Soft-deleted dashboards to not block new defaults
--   - Re-creating a default after soft-deleting the previous one
CREATE UNIQUE INDEX ux_default_dashboard_per_campaign
  ON dashboards (campaign_id)
  WHERE is_default = true AND deleted_at IS NULL;
