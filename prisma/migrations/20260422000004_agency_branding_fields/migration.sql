-- Extend agency branding: favicon, secondary color, per-agency email sender

ALTER TABLE "agencies"
  ALTER COLUMN "logo_url" TYPE VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "favicon_url"         VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "secondary_color"     VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "email_from_name"     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "email_from_address"  VARCHAR(255);

-- Index for custom-domain host resolution (queried on every unauthenticated request)
CREATE INDEX IF NOT EXISTS "idx_agencies_custom_domain" ON "agencies"("custom_domain") WHERE "custom_domain" IS NOT NULL;

-- Index for slug-based subdomain resolution
CREATE INDEX IF NOT EXISTS "idx_agencies_slug" ON "agencies"("slug");
