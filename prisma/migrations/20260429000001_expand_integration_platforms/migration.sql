-- Migration: expand_integration_platforms
-- Adds ~73 new platform enum values and the IntegrationCategory enum
-- Uses ADD VALUE IF NOT EXISTS (safe to re-run)

-- ─── IntegrationCategory enum (new) ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "integration_category" AS ENUM (
    'PPC', 'SEO', 'SOCIAL', 'EMAIL', 'ECOMMERCE',
    'ANALYTICS', 'CALL_TRACKING', 'LOCAL', 'DATABASE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── PPC ────────────────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'PINTEREST_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SNAPCHAT_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'X_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'REDDIT_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'ADROLL';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_MANAGER';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_DV360';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_LOCAL_SERVICES_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'INSTAGRAM_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SPOTIFY_ADS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'STACKADAPT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SIMPLIFI';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CHOOZLE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GROUNDTRUTH';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BASIS_PLATFORM';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'YELP_ADS';

-- ─── SEO ────────────────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'AHREFS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'MOZ';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SE_RANKING';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'MAJESTIC_SEO';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BING_WEBMASTER_TOOLS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_BUSINESS_PROFILE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_LIGHTHOUSE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_PAGESPEED';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'RANK_TRACKER';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BACKLINK_MONITOR';

-- ─── Social ─────────────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'FACEBOOK_ORGANIC';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'INSTAGRAM_ORGANIC';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'PINTEREST_ORGANIC';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'VIMEO';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'X_ORGANIC';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'TIKTOK_ORGANIC';

-- ─── Email Marketing ────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'KLAVIYO';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'ACTIVECAMPAIGN';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BREVO';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CONSTANT_CONTACT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CAMPAIGN_MONITOR';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CONVERTKIT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'DRIP';

-- ─── Ecommerce ──────────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'WOOCOMMERCE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BIGCOMMERCE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'STRIPE_ECOMMERCE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'KEAP';

-- ─── Analytics & CRM ────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'HUBSPOT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'MATOMO';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SALESFORCE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SHARPSPRING';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GRAVITY_FORMS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'UNBOUNCE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'HIGHLEVEL';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_SHEETS';

-- ─── Call Tracking ──────────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CALLRAIL';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CALLTRACKING_METRICS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'TWILIO';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'WHATCONVERTS';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'MARCHEX';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'AVANSER';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'CALLSOURCE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'DELACON';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'WILDJAR';

-- ─── Local & Reputation ─────────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BRIGHTLOCAL';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'TRUSTPILOT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'YELP';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'BIRDEYE';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'YEXT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GATHERUP';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GRADE_US';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SYNUP';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'VENDASTA';

-- ─── Database / Warehouse ───────────────────────────────────────────────────
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'GOOGLE_BIGQUERY';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'AMAZON_REDSHIFT';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'MYSQL_DB';
ALTER TYPE "integration_platform" ADD VALUE IF NOT EXISTS 'SNOWFLAKE';
