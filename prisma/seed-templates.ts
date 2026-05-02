/**
 * Seeds production-ready global dashboard and report templates.
 * Safe to re-run — upserts by name.
 *
 * Run with: npx ts-node prisma/seed-templates.ts
 */

import { PrismaClient, IntegrationPlatform } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL } },
});

// ─── Widget helpers ────────────────────────────────────────────────────────────

const kpi = (metricKey: string, title: string, x: number, y: number, w = 3, h = 2) => ({
  widgetType: 'KPI', metricKeys: [metricKey], config: { title }, position: { x, y, w, h },
});

const line = (metricKeys: string[], title: string, x: number, y: number, w = 12, h = 4) => ({
  widgetType: 'LINE_CHART', metricKeys, config: { title }, position: { x, y, w, h },
});

const bar = (metricKeys: string[], title: string, x: number, y: number, w = 6, h = 4) => ({
  widgetType: 'BAR_CHART', metricKeys, config: { title }, position: { x, y, w, h },
});

const table = (metricKeys: string[], title: string, x: number, y: number, w = 12, h = 4) => ({
  widgetType: 'TABLE', metricKeys, config: { title }, position: { x, y, w, h },
});

const pie = (metricKeys: string[], title: string, x: number, y: number, w = 6, h = 4) => ({
  widgetType: 'PIE_CHART', metricKeys, config: { title }, position: { x, y, w, h },
});

// ─── Dashboard templates ───────────────────────────────────────────────────────

const DASHBOARD_TEMPLATES = [
  // 1. GA4 Performance Overview
  {
    name: 'GA4 Performance Overview',
    description: 'Complete Google Analytics 4 dashboard — sessions, users, page views, bounce rate and engagement trends.',
    category: 'SEO & Analytics',
    platform: 'GA4' as IntegrationPlatform,
    widgets: [
      kpi('sessions',               'Sessions',              0, 0),
      kpi('totalUsers',             'Total Users',           3, 0),
      kpi('newUsers',               'New Users',             6, 0),
      kpi('screenPageViews',        'Page Views',            9, 0),
      line(['sessions', 'totalUsers'], 'Sessions & Users Trend', 0, 2, 8, 4),
      kpi('bounceRate',             'Bounce Rate',           8, 2, 2, 2),
      kpi('averageSessionDuration', 'Avg Session Duration',  10, 2, 2, 2),
      table(['sessions', 'totalUsers', 'screenPageViews', 'bounceRate'], 'Traffic Breakdown', 0, 6),
    ],
  },

  // 2. Google Ads Campaign Performance
  {
    name: 'Google Ads Campaign Performance',
    description: 'Monitor Google Ads spend, clicks, impressions, CTR, CPC and conversion performance.',
    category: 'Paid Advertising',
    platform: 'GOOGLE_ADS' as IntegrationPlatform,
    widgets: [
      kpi('cost',        'Total Cost',    0, 0),
      kpi('clicks',      'Clicks',        3, 0),
      kpi('impressions', 'Impressions',   6, 0),
      kpi('conversions', 'Conversions',   9, 0),
      line(['cost', 'clicks'], 'Cost vs Clicks', 0, 2, 8, 4),
      kpi('ctr',     'CTR',      8, 2, 2, 2),
      kpi('avg_cpc', 'Avg CPC',  10, 2, 2, 2),
      bar(['conversions', 'clicks'], 'Conversions vs Clicks', 0, 6, 6, 4),
      table(['cost', 'clicks', 'impressions', 'ctr', 'avg_cpc', 'conversions'], 'Campaign Breakdown', 6, 6, 6, 4),
    ],
  },

  // 3. Meta Ads Overview
  {
    name: 'Meta Ads Overview',
    description: 'Facebook & Instagram ad performance — spend, reach, CTR, CPC and conversions in one view.',
    category: 'Paid Advertising',
    platform: 'META_ADS' as IntegrationPlatform,
    widgets: [
      kpi('spend',       'Total Spend',   0, 0),
      kpi('impressions', 'Impressions',   3, 0),
      kpi('clicks',      'Clicks',        6, 0),
      kpi('conversions', 'Conversions',   9, 0),
      line(['spend', 'clicks'], 'Spend vs Clicks', 0, 2, 8, 4),
      kpi('ctr', 'CTR', 8, 2, 2, 2),
      kpi('cpc', 'CPC', 10, 2, 2, 2),
      bar(['spend', 'conversions'], 'Spend vs Conversions', 0, 6, 6, 4),
      table(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions'], 'Ad Set Breakdown', 6, 6, 6, 4),
    ],
  },

  // 4. Google Search Console SEO Dashboard
  {
    name: 'Search Console SEO Dashboard',
    description: 'Track organic search performance — clicks, impressions, CTR and average position from Google Search Console.',
    category: 'SEO & Analytics',
    platform: 'GOOGLE_SEARCH_CONSOLE' as IntegrationPlatform,
    widgets: [
      kpi('clicks',      'Organic Clicks',  0, 0),
      kpi('impressions', 'Impressions',      3, 0),
      kpi('ctr',         'CTR',              6, 0),
      kpi('position',    'Avg. Position',    9, 0),
      line(['clicks', 'impressions'], 'Clicks & Impressions Trend', 0, 2, 8, 4),
      line(['position'], 'Position Trend', 8, 2, 4, 4),
      table(['clicks', 'impressions', 'ctr', 'position'], 'Top Pages / Queries', 0, 6),
    ],
  },

  // 5. YouTube Analytics Dashboard
  {
    name: 'YouTube Analytics Dashboard',
    description: 'YouTube channel performance — views, watch time, engagement and subscriber growth.',
    category: 'Social & Video',
    platform: 'YOUTUBE_ANALYTICS' as IntegrationPlatform,
    widgets: [
      kpi('views',                  'Total Views',           0, 0),
      kpi('estimatedMinutesWatched','Minutes Watched',        3, 0),
      kpi('subscribersGained',      'Subscribers Gained',    6, 0),
      kpi('likes',                  'Likes',                 9, 0),
      line(['views', 'estimatedMinutesWatched'], 'Views & Watch Time', 0, 2, 8, 4),
      bar(['subscribersGained', 'subscribersLost'], 'Subscriber Growth', 8, 2, 4, 4),
      table(['views', 'estimatedMinutesWatched', 'averageViewDuration', 'likes', 'comments'], 'Video Performance', 0, 6),
    ],
  },

  // 6. LinkedIn Ads Dashboard
  {
    name: 'LinkedIn Ads Dashboard',
    description: 'B2B LinkedIn advertising — impressions, clicks, spend, conversions and video views.',
    category: 'Paid Advertising',
    platform: 'LINKEDIN_ADS' as IntegrationPlatform,
    widgets: [
      kpi('spend',       'Total Spend',   0, 0),
      kpi('impressions', 'Impressions',   3, 0),
      kpi('clicks',      'Clicks',        6, 0),
      kpi('conversions', 'Conversions',   9, 0),
      line(['spend', 'clicks'], 'Spend vs Clicks', 0, 2, 8, 4),
      kpi('videoViews', 'Video Views', 8, 2, 4, 2),
      table(['spend', 'impressions', 'clicks', 'conversions', 'videoViews'], 'Campaign Breakdown', 0, 6),
    ],
  },

  // 7. TikTok Ads Dashboard
  {
    name: 'TikTok Ads Dashboard',
    description: 'TikTok ad campaign performance — spend, impressions, CTR, CPC and conversions.',
    category: 'Paid Advertising',
    platform: 'TIKTOK_ADS' as IntegrationPlatform,
    widgets: [
      kpi('spend',       'Total Spend',   0, 0),
      kpi('impressions', 'Impressions',   3, 0),
      kpi('clicks',      'Clicks',        6, 0),
      kpi('conversions', 'Conversions',   9, 0),
      line(['spend', 'impressions'], 'Spend & Impressions', 0, 2, 8, 4),
      kpi('ctr', 'CTR', 8, 2, 2, 2),
      kpi('cpc', 'CPC', 10, 2, 2, 2),
      table(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions'], 'Ad Group Breakdown', 0, 6),
    ],
  },

  // 8. Multi-Platform Paid Ads Summary
  {
    name: 'Multi-Platform Paid Ads Summary',
    description: 'Unified view across Google Ads, Meta Ads and LinkedIn Ads — total spend, clicks and conversions.',
    category: 'Paid Advertising',
    platform: null,
    widgets: [
      kpi('cost',        'Google Ads Cost',    0, 0),
      kpi('spend',       'Meta Ads Spend',     3, 0),
      kpi('spend',       'LinkedIn Spend',     6, 0),
      kpi('conversions', 'Total Conversions',  9, 0),
      line(['cost', 'spend'], 'Spend Trend (All Platforms)', 0, 2),
      bar(['clicks', 'conversions'], 'Clicks vs Conversions', 0, 6, 6, 4),
      table(['cost', 'clicks', 'impressions', 'conversions'], 'Platform Comparison', 6, 6, 6, 4),
    ],
  },

  // 9. E-commerce Overview (Amazon Ads + GA4)
  {
    name: 'E-commerce Performance Dashboard',
    description: 'E-commerce overview combining Amazon Ads spend, sales and orders with GA4 traffic data.',
    category: 'E-commerce',
    platform: 'AMAZON_ADS' as IntegrationPlatform,
    widgets: [
      kpi('sales',       'Total Sales',    0, 0),
      kpi('orders',      'Orders',         3, 0),
      kpi('spend',       'Ad Spend',       6, 0),
      kpi('clicks',      'Clicks',         9, 0),
      line(['sales', 'spend'], 'Sales vs Ad Spend', 0, 2, 8, 4),
      kpi('impressions', 'Impressions', 8, 2, 4, 2),
      table(['spend', 'clicks', 'impressions', 'sales', 'orders'], 'Campaign Breakdown', 0, 6),
    ],
  },

  // 10. Full-Funnel Marketing Dashboard
  {
    name: 'Full-Funnel Marketing Dashboard',
    description: 'Top-to-bottom marketing funnel — organic traffic (GA4 + GSC), paid ads (Google + Meta) and conversions.',
    category: 'Multi-Platform',
    platform: null,
    widgets: [
      kpi('sessions',    'Organic Sessions',  0, 0),
      kpi('clicks',      'Search Clicks',     3, 0),
      kpi('cost',        'Paid Spend',        6, 0),
      kpi('conversions', 'Conversions',       9, 0),
      line(['sessions', 'totalUsers'], 'Organic Traffic Trend', 0, 2, 6, 4),
      line(['cost', 'conversions'], 'Paid Performance Trend', 6, 2, 6, 4),
      bar(['clicks', 'impressions'], 'Search Visibility', 0, 6, 6, 4),
      table(['sessions', 'clicks', 'cost', 'conversions'], 'Channel Summary', 6, 6, 6, 4),
    ],
  },
];

// ─── Report templates ──────────────────────────────────────────────────────────

const REPORT_TEMPLATES = [
  // 1. Monthly SEO Report
  {
    name: 'Monthly SEO Report',
    description: 'Professional monthly SEO report — organic traffic, search rankings, top pages and conversion summary.',
    category: 'SEO & Analytics',
    platform: 'GA4' as IntegrationPlatform,
    sections: [
      { type: 'HEADER', config: { title: 'Monthly SEO Report', subtitle: 'Organic Search Performance' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GA4', metrics: ['sessions', 'totalUsers', 'newUsers', 'screenPageViews'], title: 'Traffic Overview' } },
      { type: 'LINE_CHART', config: { platform: 'GA4', metric: 'sessions', title: 'Sessions Trend' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_SEARCH_CONSOLE', metrics: ['clicks', 'impressions', 'ctr', 'position'], title: 'Search Console Performance' } },
      { type: 'LINE_CHART', config: { platform: 'GOOGLE_SEARCH_CONSOLE', metric: 'clicks', title: 'Organic Clicks Trend' } },
      { type: 'TABLE', config: { platform: 'GOOGLE_SEARCH_CONSOLE', metrics: ['clicks', 'impressions', 'ctr', 'position'], title: 'Top Pages' } },
      { type: 'TEXT', config: { title: 'Key Takeaways', placeholder: 'Add your analysis and recommendations here.' } },
    ],
  },

  // 2. Google Ads Monthly Report
  {
    name: 'Google Ads Monthly Report',
    description: 'Monthly Google Ads performance report — spend, clicks, impressions, CTR, CPC and conversion analysis.',
    category: 'Paid Advertising',
    platform: 'GOOGLE_ADS' as IntegrationPlatform,
    sections: [
      { type: 'HEADER', config: { title: 'Google Ads Performance Report', subtitle: 'Monthly Campaign Analysis' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_ADS', metrics: ['cost', 'clicks', 'impressions', 'conversions'], title: 'Key Metrics' } },
      { type: 'LINE_CHART', config: { platform: 'GOOGLE_ADS', metric: 'cost', title: 'Spend Over Time' } },
      { type: 'BAR_CHART', config: { platform: 'GOOGLE_ADS', metrics: ['clicks', 'conversions'], title: 'Clicks vs Conversions' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_ADS', metrics: ['ctr', 'avg_cpc'], title: 'Efficiency Metrics' } },
      { type: 'TABLE', config: { platform: 'GOOGLE_ADS', metrics: ['cost', 'clicks', 'impressions', 'ctr', 'conversions'], title: 'Campaign Breakdown' } },
      { type: 'TEXT', config: { title: 'Recommendations', placeholder: 'Add optimisation recommendations here.' } },
    ],
  },

  // 3. Meta Ads Monthly Report
  {
    name: 'Meta Ads Monthly Report',
    description: 'Monthly Facebook & Instagram ads report — spend, reach, engagement and conversion performance.',
    category: 'Paid Advertising',
    platform: 'META_ADS' as IntegrationPlatform,
    sections: [
      { type: 'HEADER', config: { title: 'Meta Ads Performance Report', subtitle: 'Facebook & Instagram' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'META_ADS', metrics: ['spend', 'impressions', 'clicks', 'conversions'], title: 'Campaign Highlights' } },
      { type: 'LINE_CHART', config: { platform: 'META_ADS', metric: 'spend', title: 'Spend Over Time' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'META_ADS', metrics: ['ctr', 'cpc'], title: 'Efficiency Metrics' } },
      { type: 'BAR_CHART', config: { platform: 'META_ADS', metrics: ['spend', 'conversions'], title: 'Spend vs Conversions' } },
      { type: 'TABLE', config: { platform: 'META_ADS', metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions'], title: 'Ad Set Breakdown' } },
      { type: 'TEXT', config: { title: 'Insights & Next Steps', placeholder: 'Add creative insights and next steps here.' } },
    ],
  },

  // 4. Monthly Executive Summary
  {
    name: 'Monthly Executive Summary',
    description: 'High-level monthly marketing summary for clients and stakeholders — all channels in one concise report.',
    category: 'Multi-Platform',
    platform: null,
    sections: [
      { type: 'HEADER', config: { title: 'Monthly Marketing Report', subtitle: 'Executive Summary' } },
      { type: 'TEXT', config: { title: 'Month Overview', placeholder: 'Summarise the key highlights and results for the month.' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GA4', metrics: ['sessions', 'totalUsers', 'conversions'], title: 'Website Traffic' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_ADS', metrics: ['cost', 'clicks', 'conversions'], title: 'Google Ads' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'META_ADS', metrics: ['spend', 'clicks', 'conversions'], title: 'Meta Ads' } },
      { type: 'LINE_CHART', config: { platform: 'GA4', metric: 'sessions', title: 'Overall Traffic Trend' } },
      { type: 'TEXT', config: { title: 'Key Wins', placeholder: 'List the biggest wins this month.' } },
      { type: 'TEXT', config: { title: 'Next Month Focus', placeholder: 'Outline priorities and planned actions for next month.' } },
    ],
  },

  // 5. Paid Ads Performance Report (multi-platform)
  {
    name: 'Paid Ads Performance Report',
    description: 'Combined Google Ads, Meta Ads and LinkedIn Ads spend, ROAS and conversion summary.',
    category: 'Paid Advertising',
    platform: null,
    sections: [
      { type: 'HEADER', config: { title: 'Paid Advertising Report', subtitle: 'All Channels Combined' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_ADS', metrics: ['cost', 'clicks', 'impressions', 'conversions'], title: 'Google Ads' } },
      { type: 'LINE_CHART', config: { platform: 'GOOGLE_ADS', metric: 'cost', title: 'Google Ads Spend Trend' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'META_ADS', metrics: ['spend', 'clicks', 'impressions', 'conversions'], title: 'Meta Ads' } },
      { type: 'LINE_CHART', config: { platform: 'META_ADS', metric: 'spend', title: 'Meta Ads Spend Trend' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'LINKEDIN_ADS', metrics: ['spend', 'clicks', 'conversions'], title: 'LinkedIn Ads' } },
      { type: 'TEXT', config: { title: 'Budget Recommendations', placeholder: 'Add budget allocation recommendations here.' } },
    ],
  },

  // 6. Quarterly Business Review
  {
    name: 'Quarterly Business Review',
    description: 'In-depth quarterly review across all marketing channels — trends, wins, optimisations and Q+1 strategy.',
    category: 'Multi-Platform',
    platform: null,
    sections: [
      { type: 'HEADER', config: { title: 'Quarterly Business Review', subtitle: 'Marketing Performance Analysis' } },
      { type: 'TEXT', config: { title: 'Quarter Summary', placeholder: 'High-level overview of the quarter — goals, results, context.' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GA4', metrics: ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'conversions'], title: 'Website Performance' } },
      { type: 'LINE_CHART', config: { platform: 'GA4', metric: 'sessions', title: 'Quarterly Traffic Trend' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_SEARCH_CONSOLE', metrics: ['clicks', 'impressions', 'ctr', 'position'], title: 'Organic Search' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_ADS', metrics: ['cost', 'clicks', 'conversions'], title: 'Google Ads' } },
      { type: 'METRICS_SUMMARY', config: { platform: 'META_ADS', metrics: ['spend', 'clicks', 'conversions'], title: 'Meta Ads' } },
      { type: 'BAR_CHART', config: { platform: 'GOOGLE_ADS', metrics: ['cost', 'conversions'], title: 'Paid Performance vs Goal' } },
      { type: 'TEXT', config: { title: 'Key Achievements', placeholder: 'List the major wins and milestones this quarter.' } },
      { type: 'TEXT', config: { title: 'Challenges & Learnings', placeholder: 'What obstacles were encountered and what did we learn?' } },
      { type: 'TEXT', config: { title: 'Next Quarter Strategy', placeholder: 'Outline goals, focus areas and planned initiatives for next quarter.' } },
    ],
  },
];

// ─── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding production templates...\n');

  let dashCreated = 0, dashSkipped = 0;
  for (const tpl of DASHBOARD_TEMPLATES) {
    const existing = await (prisma as any).dashboardTemplate.findFirst({ where: { name: tpl.name }, select: { id: true } });
    if (existing) {
      await (prisma as any).dashboardTemplate.update({
        where: { id: existing.id },
        data: { description: tpl.description, category: tpl.category, platform: tpl.platform, widgets: tpl.widgets, isActive: true },
      });
      dashSkipped++;
    } else {
      await (prisma as any).dashboardTemplate.create({
        data: { name: tpl.name, description: tpl.description, category: tpl.category, platform: tpl.platform, widgets: tpl.widgets, isActive: true },
      });
      dashCreated++;
    }
    console.log(`  ✅ Dashboard template: ${tpl.name}`);
  }

  let repCreated = 0, repSkipped = 0;
  for (const tpl of REPORT_TEMPLATES) {
    const existing = await (prisma as any).reportTemplate.findFirst({ where: { name: tpl.name }, select: { id: true } });
    if (existing) {
      await (prisma as any).reportTemplate.update({
        where: { id: existing.id },
        data: { description: tpl.description, category: tpl.category, platform: tpl.platform, sections: tpl.sections, isActive: true },
      });
      repSkipped++;
    } else {
      await (prisma as any).reportTemplate.create({
        data: { name: tpl.name, description: tpl.description, category: tpl.category, platform: tpl.platform, sections: tpl.sections, isActive: true },
      });
      repCreated++;
    }
    console.log(`  ✅ Report template:    ${tpl.name}`);
  }

  console.log(`\n🚀 Done — ${dashCreated} dashboard templates created, ${dashSkipped} updated`);
  console.log(`          ${repCreated} report templates created, ${repSkipped} updated`);
}

main()
  .catch((e) => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
