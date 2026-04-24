-- CreateEnum
CREATE TYPE "alert_condition" AS ENUM (
  'ABOVE',
  'BELOW',
  'PERCENT_CHANGE_ABOVE',
  'PERCENT_CHANGE_BELOW'
);

-- CreateEnum
CREATE TYPE "alert_period_type" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "platform" "integration_platform" NOT NULL,
    "metric_key" VARCHAR(100) NOT NULL,
    "condition" "alert_condition" NOT NULL,
    "threshold" DECIMAL(20,6) NOT NULL,
    "period_type" "alert_period_type" NOT NULL DEFAULT 'DAILY',
    "severity" "alert_severity" NOT NULL DEFAULT 'WARNING',
    "recipient_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cooldown_hours" INTEGER NOT NULL DEFAULT 24,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: immutable audit log — no soft delete, no updated_at
CREATE TABLE "alert_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "triggered_value" DECIMAL(20,6) NOT NULL,
    "threshold_value" DECIMAL(20,6) NOT NULL,
    "condition" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "emails_sent" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_metric_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "formula" TEXT NOT NULL,
    "variable_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "platform" "integration_platform" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "custom_metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_alerts_campaign" ON "alerts"("tenant_id", "campaign_id", "deleted_at");
CREATE INDEX "idx_alerts_active" ON "alerts"("tenant_id", "campaign_id", "platform", "is_active") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_alert_events_alert" ON "alert_events"("tenant_id", "alert_id");
CREATE INDEX "idx_alert_events_campaign" ON "alert_events"("tenant_id", "campaign_id", "notified_at" DESC);
CREATE INDEX "idx_custom_metrics_tenant" ON "custom_metric_definitions"("tenant_id", "platform", "deleted_at");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "custom_metric_definitions" ADD CONSTRAINT "custom_metric_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "custom_metric_definitions" ADD CONSTRAINT "custom_metric_definitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Enable RLS
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_metric_definitions" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_isolation" ON "alerts"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY "tenant_isolation" ON "alert_events"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY "tenant_isolation" ON "custom_metric_definitions"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
