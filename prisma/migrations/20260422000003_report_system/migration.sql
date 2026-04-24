-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "report_status" NOT NULL DEFAULT 'DRAFT',
    "pdf_url" VARCHAR(1000),
    "pdf_generated_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "cron_expression" VARCHAR(100) NOT NULL,
    "next_run_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "recipient_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "date_range_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_share_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "schedule_id" UUID,
    "status" "delivery_status" NOT NULL DEFAULT 'PENDING',
    "pdf_url" VARCHAR(1000),
    "error_msg" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_reports_campaign" ON "reports"("tenant_id", "campaign_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_report_schedules_active" ON "report_schedules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_report_schedules_report" ON "report_schedules"("report_id");

-- CreateIndex
CREATE INDEX "idx_report_schedules_next_run" ON "report_schedules"("next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_share_links_token_key" ON "report_share_links"("token");

-- CreateIndex
CREATE INDEX "idx_report_share_links_report" ON "report_share_links"("tenant_id", "report_id");

-- CreateIndex
CREATE INDEX "idx_report_deliveries_report" ON "report_deliveries"("tenant_id", "report_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Enable RLS
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_share_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_deliveries" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_isolation" ON "reports"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "report_schedules"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "report_share_links"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "report_deliveries"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
