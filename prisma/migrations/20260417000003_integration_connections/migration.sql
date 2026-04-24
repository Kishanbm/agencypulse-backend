-- Phase 3.1 — Integration Framework
-- Creates integration_connections table with OAuth token storage (encrypted),
-- platform enum, connection status enum, RLS policy, and indexes.

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "integration_platform" AS ENUM (
  'GA4',
  'GOOGLE_ADS',
  'META_ADS',
  'GOOGLE_SEARCH_CONSOLE',
  'LINKEDIN_ADS',
  'MAILCHIMP',
  'SHOPIFY',
  'SEMRUSH',
  'TIKTOK_ADS',
  'MICROSOFT_ADS'
);

CREATE TYPE "connection_status" AS ENUM (
  'CONNECTED',
  'EXPIRED',
  'ERROR',
  'DISCONNECTED'
);

-- ─── Table ────────────────────────────────────────────────────────────────────
-- access_token_enc and refresh_token_enc store AES-256-GCM ciphertext in the
-- format: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
-- These columns are NEVER selected in any HTTP response — internal use only.

CREATE TABLE "integration_connections" (
  "id"                       UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                UUID          NOT NULL,
  "campaign_id"              UUID          NOT NULL,
  "platform"                 "integration_platform" NOT NULL,
  "status"                   "connection_status"    NOT NULL DEFAULT 'DISCONNECTED',

  -- Encrypted OAuth tokens — NEVER return these in API responses
  "access_token_enc"         TEXT,
  "refresh_token_enc"        TEXT,

  "token_expires_at"         TIMESTAMP(3),
  "refresh_token_expires_at" TIMESTAMP(3),
  "scopes"                   TEXT,
  "external_account_id"      VARCHAR(255),
  "platform_account_type"    VARCHAR(100),

  "last_sync_at"             TIMESTAMP(3),
  "last_error_at"            TIMESTAMP(3),
  "last_error_message"       TEXT,

  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "integration_connections_pkey"
    PRIMARY KEY ("id"),

  -- One connection per platform per campaign (upsert target)
  CONSTRAINT "integration_connections_campaign_id_platform_key"
    UNIQUE ("campaign_id", "platform"),

  CONSTRAINT "integration_connections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT "integration_connections_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Find all connections for a tenant by status (e.g. EXPIRED → trigger re-auth)
CREATE INDEX "integration_connections_tenant_id_status_idx"
  ON "integration_connections"("tenant_id", "status");

-- Worker pattern: find all CONNECTED integrations for a specific platform to sync
CREATE INDEX "integration_connections_tenant_id_platform_status_idx"
  ON "integration_connections"("tenant_id", "platform", "status");

-- ─── updated_at trigger ───────────────────────────────────────────────────────
-- set_updated_at() function already exists from the initial schema migration.

CREATE TRIGGER "set_updated_at_integration_connections"
  BEFORE UPDATE ON "integration_connections"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- agencypulse_app role can only see rows where tenant_id matches the current
-- session setting (set by PrismaService middleware before every query).

ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_integration_connections"
  ON "integration_connections"
  AS PERMISSIVE
  FOR ALL
  TO agencypulse_app
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', TRUE)::uuid);
