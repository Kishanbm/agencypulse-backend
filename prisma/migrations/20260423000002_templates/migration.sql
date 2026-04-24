-- Phase 8.11 — Template Marketplace

-- Tier 1: Global system templates (no RLS — visible to all tenants)
CREATE TABLE "dashboard_templates" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          VARCHAR(255) NOT NULL,
  "description"   TEXT,
  "category"      VARCHAR(100),
  "platform"      "integration_platform",
  "thumbnail_url" VARCHAR(1000),
  "widgets"       JSONB NOT NULL DEFAULT '[]',
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "clone_count"   INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dashboard_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_templates" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          VARCHAR(255) NOT NULL,
  "description"   TEXT,
  "category"      VARCHAR(100),
  "platform"      "integration_platform",
  "thumbnail_url" VARCHAR(1000),
  "sections"      JSONB NOT NULL DEFAULT '[]',
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "clone_count"   INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_dashboard_templates_category" ON "dashboard_templates"("category", "platform", "is_active");
CREATE INDEX "idx_report_templates_category"    ON "report_templates"("category", "platform", "is_active");

-- Tier 2: Agency private templates — add flag to existing tables
ALTER TABLE "dashboards"
  ADD COLUMN "is_template"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "template_name"        VARCHAR(255),
  ADD COLUMN "template_description" TEXT;

ALTER TABLE "reports"
  ADD COLUMN "is_template"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "template_name"        VARCHAR(255),
  ADD COLUMN "template_description" TEXT;

CREATE INDEX "idx_dashboards_is_template" ON "dashboards"("tenant_id", "is_template") WHERE "is_template" = true AND "deleted_at" IS NULL;
CREATE INDEX "idx_reports_is_template"    ON "reports"("tenant_id", "is_template") WHERE "is_template" = true AND "deleted_at" IS NULL;
