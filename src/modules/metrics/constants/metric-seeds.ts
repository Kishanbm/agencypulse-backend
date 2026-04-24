import { IntegrationPlatform } from '@prisma/client';

/**
 * Seed data for metric_definitions — defines what metrics each platform produces.
 * Used by dashboards to know what's available and how to display it.
 *
 * category: traffic | engagement | cost | conversion
 * dataType: integer | decimal | percentage | currency
 */
export const METRIC_SEEDS: Array<{
  platform: IntegrationPlatform;
  metricKey: string;
  label: string;
  category: string;
  dataType: string;
  unit: string | null;
}> = [
  // ─── GA4 ──────────────────────────────────────────────────────────────
  { platform: 'GA4', metricKey: 'sessions',                label: 'Sessions',                 category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'totalUsers',              label: 'Total Users',              category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'newUsers',                label: 'New Users',                category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'screenPageViews',         label: 'Page Views',               category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'bounceRate',              label: 'Bounce Rate',              category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'GA4', metricKey: 'averageSessionDuration',  label: 'Avg Session Duration',     category: 'engagement', dataType: 'decimal',    unit: 'seconds' },

  // ─── Google Ads (values normalized before storage: micros → USD, ctr → %) ──
  { platform: 'GOOGLE_ADS', metricKey: 'clicks',       label: 'Clicks',        category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GOOGLE_ADS', metricKey: 'impressions',   label: 'Impressions',   category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GOOGLE_ADS', metricKey: 'ctr',           label: 'CTR',           category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'GOOGLE_ADS', metricKey: 'avg_cpc',       label: 'Avg CPC',       category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'GOOGLE_ADS', metricKey: 'cost',          label: 'Cost',          category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'GOOGLE_ADS', metricKey: 'conversions',   label: 'Conversions',   category: 'conversion', dataType: 'decimal',    unit: 'count' },

  // ─── Meta Ads ─────────────────────────────────────────────────────────
  { platform: 'META_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'META_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'META_ADS', metricKey: 'spend',         label: 'Spend',        category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'META_ADS', metricKey: 'ctr',           label: 'CTR',          category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'META_ADS', metricKey: 'cpc',           label: 'CPC',          category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'META_ADS', metricKey: 'conversions',   label: 'Conversions',  category: 'conversion', dataType: 'decimal',    unit: 'count' },
];
