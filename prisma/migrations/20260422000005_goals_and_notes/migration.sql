-- CreateEnum
CREATE TYPE "goal_period_type" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "goal_status" AS ENUM ('ON_TRACK', 'AT_RISK', 'BEHIND', 'ACHIEVED');

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "platform" "integration_platform" NOT NULL,
    "metric_key" VARCHAR(100) NOT NULL,
    "target_value" DECIMAL(20,6) NOT NULL,
    "period_type" "goal_period_type" NOT NULL DEFAULT 'MONTHLY',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "campaign_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_goals_campaign" ON "goals"("tenant_id", "campaign_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_goals_period" ON "goals"("tenant_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "idx_campaign_notes_campaign" ON "campaign_notes"("tenant_id", "campaign_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_campaign_notes_pinned" ON "campaign_notes"("tenant_id", "campaign_id", "is_pinned") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "idx_campaign_notes_created_at" ON "campaign_notes"("tenant_id", "campaign_id", "created_at" DESC) WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "campaign_notes" ADD CONSTRAINT "campaign_notes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "campaign_notes" ADD CONSTRAINT "campaign_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "campaign_notes" ADD CONSTRAINT "campaign_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Enable RLS
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_notes" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_isolation" ON "goals"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "campaign_notes"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
