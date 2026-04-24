-- Phase 3.7: Add YOUTUBE_ANALYTICS and AMAZON_ADS to integration_platform enum
-- GOOGLE_SEARCH_CONSOLE, LINKEDIN_ADS, TIKTOK_ADS already exist in the enum

ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'YOUTUBE_ANALYTICS';
ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'AMAZON_ADS';
