-- Phase 8.12 — Billing (Stripe subscriptions)

-- Add Stripe fields to agencies
ALTER TABLE "agencies"
  ADD COLUMN "stripe_customer_id"       VARCHAR(255),
  ADD COLUMN "stripe_subscription_id"   VARCHAR(255),
  ADD COLUMN "stripe_price_id"          VARCHAR(255),
  ADD COLUMN "subscription_status"      VARCHAR(50)  NOT NULL DEFAULT 'trialing',
  ADD COLUMN "subscription_period_end"  TIMESTAMPTZ(6),
  ADD COLUMN "trial_ends_at"            TIMESTAMPTZ(6);

-- Unique indexes (nullable — partial indexes)
CREATE UNIQUE INDEX "idx_agencies_stripe_customer"
  ON "agencies"("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;

CREATE UNIQUE INDEX "idx_agencies_stripe_subscription"
  ON "agencies"("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

-- Immutable audit log of every Stripe webhook received
CREATE TABLE "billing_events" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID,
  "stripe_event_id"  VARCHAR(255) NOT NULL,
  "event_type"       VARCHAR(100) NOT NULL,
  "data"             JSONB NOT NULL,
  "processed_at"     TIMESTAMPTZ(6),
  "error"            TEXT,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_billing_events_stripe_id" ON "billing_events"("stripe_event_id");
CREATE INDEX "idx_billing_events_tenant"           ON "billing_events"("tenant_id", "created_at" DESC);
CREATE INDEX "idx_billing_events_type"             ON "billing_events"("event_type", "created_at" DESC);

-- FK to agencies (nullable — webhook may arrive before customer linked)
ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- RLS — tenant_id nullable so we use a permissive policy.
-- Webhook handler runs under SystemPrismaService (RLS bypass) so tenant=null rows are fine.
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "billing_events"
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant', true)::uuid);
