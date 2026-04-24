/**
 * Seed script for system-level dashboard + report templates.
 * Run via:   ts-node src/modules/templates/seed/seed-templates.ts
 *
 * Idempotent — skips templates whose name already exists in the DB.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WidgetSeed {
  widgetType: string;
  platform: string | null;
  metricKeys: string[];
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

function kpi(
  platform: string,
  metricKey: string,
  title: string,
  pos: { x: number; y: number; w: number; h: number },
): WidgetSeed {
  return {
    widgetType: 'KPI',
    platform,
    metricKeys: [metricKey],
    config: { title, aggregation: 'SUM' },
    position: pos,
  };
}

function chart(
  platform: string,
  metricKeys: string[],
  title: string,
  chartType: 'LINE' | 'BAR',
  pos: { x: number; y: number; w: number; h: number },
): WidgetSeed {
  return {
    widgetType: chartType === 'LINE' ? 'LINE_CHART' : 'BAR_CHART',
    platform,
    metricKeys,
    config: { title, granularity: 'day' },
    position: pos,
  };
}

const DASHBOARD_TEMPLATES = [
  {
    name: 'Google Ads Performance',
    description: 'Impressions, clicks, CTR, CPC, cost and conversions for Google Ads campaigns.',
    category: 'Google Ads',
    platform: 'GOOGLE_ADS',
    widgets: [
      kpi('GOOGLE_ADS', 'impressions', 'Impressions', { x: 0, y: 0, w: 3, h: 2 }),
      kpi('GOOGLE_ADS', 'clicks', 'Clicks', { x: 3, y: 0, w: 3, h: 2 }),
      kpi('GOOGLE_ADS', 'ctr', 'CTR', { x: 6, y: 0, w: 3, h: 2 }),
      kpi('GOOGLE_ADS', 'cost', 'Cost', { x: 9, y: 0, w: 3, h: 2 }),
      chart('GOOGLE_ADS', ['clicks', 'impressions'], 'Clicks vs Impressions', 'LINE', { x: 0, y: 2, w: 12, h: 4 }),
      chart('GOOGLE_ADS', ['cost', 'conversions'], 'Cost vs Conversions', 'BAR', { x: 0, y: 6, w: 12, h: 4 }),
    ],
  },
  {
    name: 'Meta Ads Overview',
    description: 'Reach, spend, CPM, CPA and ROAS for Meta (Facebook & Instagram) campaigns.',
    category: 'Social Media',
    platform: 'META_ADS',
    widgets: [
      kpi('META_ADS', 'reach', 'Reach', { x: 0, y: 0, w: 3, h: 2 }),
      kpi('META_ADS', 'spend', 'Spend', { x: 3, y: 0, w: 3, h: 2 }),
      kpi('META_ADS', 'cpm', 'CPM', { x: 6, y: 0, w: 3, h: 2 }),
      kpi('META_ADS', 'conversions', 'Conversions', { x: 9, y: 0, w: 3, h: 2 }),
      chart('META_ADS', ['impressions', 'clicks'], 'Impressions vs Clicks', 'LINE', { x: 0, y: 2, w: 12, h: 4 }),
    ],
  },
  {
    name: 'GA4 Website Analytics',
    description: 'Sessions, users, bounce rate, session duration and page views.',
    category: 'SEO / Analytics',
    platform: 'GA4',
    widgets: [
      kpi('GA4', 'sessions', 'Sessions', { x: 0, y: 0, w: 3, h: 2 }),
      kpi('GA4', 'totalUsers', 'Total Users', { x: 3, y: 0, w: 3, h: 2 }),
      kpi('GA4', 'screenPageViews', 'Page Views', { x: 6, y: 0, w: 3, h: 2 }),
      kpi('GA4', 'averageSessionDuration', 'Avg. Session', { x: 9, y: 0, w: 3, h: 2 }),
      chart('GA4', ['sessions', 'totalUsers'], 'Sessions vs Users', 'LINE', { x: 0, y: 2, w: 12, h: 4 }),
    ],
  },
  {
    name: 'Multi-Platform Overview',
    description: 'Combined view of GA4, Google Ads and Meta Ads performance at a glance.',
    category: 'Multi-Platform',
    platform: null,
    widgets: [
      kpi('GA4', 'sessions', 'GA4 Sessions', { x: 0, y: 0, w: 4, h: 2 }),
      kpi('GOOGLE_ADS', 'clicks', 'Ads Clicks', { x: 4, y: 0, w: 4, h: 2 }),
      kpi('META_ADS', 'impressions', 'Meta Impressions', { x: 8, y: 0, w: 4, h: 2 }),
      chart('GA4', ['sessions'], 'GA4 Traffic Trend', 'LINE', { x: 0, y: 2, w: 6, h: 4 }),
      chart('GOOGLE_ADS', ['cost'], 'Google Ads Spend', 'BAR', { x: 6, y: 2, w: 6, h: 4 }),
    ],
  },
  {
    name: 'Conversion Funnel',
    description: 'End-to-end funnel view: ad impressions → clicks → site sessions → conversions.',
    category: 'Multi-Platform',
    platform: null,
    widgets: [
      kpi('GOOGLE_ADS', 'impressions', 'Ad Impressions', { x: 0, y: 0, w: 3, h: 2 }),
      kpi('GOOGLE_ADS', 'clicks', 'Ad Clicks', { x: 3, y: 0, w: 3, h: 2 }),
      kpi('GA4', 'sessions', 'Sessions', { x: 6, y: 0, w: 3, h: 2 }),
      kpi('GOOGLE_ADS', 'conversions', 'Conversions', { x: 9, y: 0, w: 3, h: 2 }),
    ],
  },
];

const REPORT_TEMPLATES = [
  {
    name: 'Monthly Client Performance Report',
    description: 'Executive summary + per-platform KPIs + trend charts. Used for monthly check-ins.',
    category: 'Monthly',
    platform: null,
    sections: [
      { type: 'COVER', title: 'Monthly Performance Report', subtitle: 'Prepared by {{agencyName}}' },
      { type: 'KPI_SUMMARY', platform: 'GA4', title: 'Website Analytics' },
      { type: 'KPI_SUMMARY', platform: 'GOOGLE_ADS', title: 'Google Ads' },
      { type: 'KPI_SUMMARY', platform: 'META_ADS', title: 'Meta Ads' },
      { type: 'CHART', platform: 'GA4', metricKeys: ['sessions'], title: 'Traffic Trend' },
      { type: 'CHART', platform: 'GOOGLE_ADS', metricKeys: ['cost'], title: 'Ad Spend' },
      { type: 'GOALS', title: 'Goal Progress' },
    ],
  },
  {
    name: 'Quarterly Business Review',
    description: 'Strategic 90-day review with forecasts and YoY comparison.',
    category: 'Quarterly',
    platform: null,
    sections: [
      { type: 'COVER', title: 'Quarterly Business Review' },
      { type: 'EXECUTIVE_SUMMARY', title: 'Executive Summary' },
      { type: 'KPI_SUMMARY', platform: null, title: 'Cross-Platform Performance' },
      { type: 'FORECAST', title: 'Forecast: Next Quarter' },
    ],
  },
  {
    name: 'SEO Snapshot',
    description: 'GA4-focused SEO report: organic traffic, landing pages, conversions.',
    category: 'SEO',
    platform: 'GA4',
    sections: [
      { type: 'COVER', title: 'SEO Performance Report' },
      { type: 'KPI_SUMMARY', platform: 'GA4', title: 'Traffic KPIs' },
      { type: 'CHART', platform: 'GA4', metricKeys: ['sessions', 'totalUsers'], title: 'Sessions & Users' },
    ],
  },
];

async function main() {
  console.log('Seeding dashboard templates...');
  for (const tpl of DASHBOARD_TEMPLATES) {
    const existing = await (prisma as any).dashboardTemplate.findFirst({
      where: { name: tpl.name },
    });
    if (existing) {
      console.log(`  - skipped (exists): ${tpl.name}`);
      continue;
    }
    await (prisma as any).dashboardTemplate.create({ data: tpl });
    console.log(`  + created: ${tpl.name}`);
  }

  console.log('Seeding report templates...');
  for (const tpl of REPORT_TEMPLATES) {
    const existing = await (prisma as any).reportTemplate.findFirst({
      where: { name: tpl.name },
    });
    if (existing) {
      console.log(`  - skipped (exists): ${tpl.name}`);
      continue;
    }
    await (prisma as any).reportTemplate.create({ data: tpl });
    console.log(`  + created: ${tpl.name}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
