import { IntegrationPlatform } from '@prisma/client';

export interface BuiltInKpi {
  key: string;
  label: string;
  formula: string;         // human-readable, for docs
  variables: string[];     // base metric keys needed
  compute: (m: Record<string, number>) => number | null;
}

const safe = (fn: () => number): number | null => {
  try {
    const result = fn();
    return isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

// Per-platform built-in KPIs
export const BUILT_IN_KPIS: Partial<Record<IntegrationPlatform, BuiltInKpi[]>> = {
  [IntegrationPlatform.GOOGLE_ADS]: [
    {
      key: 'ctr_calc',
      label: 'CTR (calculated)',
      formula: 'clicks / impressions * 100',
      variables: ['clicks', 'impressions'],
      compute: m => safe(() => m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null!),
    },
    {
      key: 'cpc_calc',
      label: 'CPC (calculated)',
      formula: 'cost / clicks',
      variables: ['cost', 'clicks'],
      compute: m => safe(() => m.clicks > 0 ? m.cost / m.clicks : null!),
    },
    {
      key: 'cpm',
      label: 'CPM',
      formula: 'cost / impressions * 1000',
      variables: ['cost', 'impressions'],
      compute: m => safe(() => m.impressions > 0 ? (m.cost / m.impressions) * 1000 : null!),
    },
    {
      key: 'cpa',
      label: 'Cost per Acquisition',
      formula: 'cost / conversions',
      variables: ['cost', 'conversions'],
      compute: m => safe(() => m.conversions > 0 ? m.cost / m.conversions : null!),
    },
    {
      key: 'conversion_rate',
      label: 'Conversion Rate',
      formula: 'conversions / clicks * 100',
      variables: ['conversions', 'clicks'],
      compute: m => safe(() => m.clicks > 0 ? (m.conversions / m.clicks) * 100 : null!),
    },
  ],

  [IntegrationPlatform.META_ADS]: [
    {
      key: 'ctr_calc',
      label: 'CTR (calculated)',
      formula: 'clicks / impressions * 100',
      variables: ['clicks', 'impressions'],
      compute: m => safe(() => m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null!),
    },
    {
      key: 'cpc_calc',
      label: 'CPC (calculated)',
      formula: 'spend / clicks',
      variables: ['spend', 'clicks'],
      compute: m => safe(() => m.clicks > 0 ? m.spend / m.clicks : null!),
    },
    {
      key: 'cpm',
      label: 'CPM',
      formula: 'spend / impressions * 1000',
      variables: ['spend', 'impressions'],
      compute: m => safe(() => m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null!),
    },
    {
      key: 'cpa',
      label: 'Cost per Acquisition',
      formula: 'spend / conversions',
      variables: ['spend', 'conversions'],
      compute: m => safe(() => m.conversions > 0 ? m.spend / m.conversions : null!),
    },
    {
      key: 'conversion_rate',
      label: 'Conversion Rate',
      formula: 'conversions / clicks * 100',
      variables: ['conversions', 'clicks'],
      compute: m => safe(() => m.clicks > 0 ? (m.conversions / m.clicks) * 100 : null!),
    },
  ],

  [IntegrationPlatform.GA4]: [
    {
      key: 'pages_per_session',
      label: 'Pages per Session',
      formula: 'screenPageViews / sessions',
      variables: ['screenPageViews', 'sessions'],
      compute: m => safe(() => m.sessions > 0 ? m.screenPageViews / m.sessions : null!),
    },
  ],
};
