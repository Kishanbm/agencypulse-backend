/**
 * Seed script for local development.
 * Creates one agency with an owner and a test client + campaign + dashboard.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient, UserRole, AgencyPlan, ClientStatus, CampaignStatus, WidgetType, IntegrationPlatform } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // 1. Agency
  const agency = await prisma.agency.create({
    data: {
      name: 'Demo Agency',
      slug: 'demo-agency',
      plan: AgencyPlan.AGENCY,
      isActive: true,
    },
  });

  console.log(`✅ Agency created: ${agency.name} (${agency.id})`);

  // 2. Agency Owner (using real Bcrypt matches Auth module)
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const owner = await prisma.user.create({
    data: {
      tenantId: agency.id,
      email: 'owner@demo-agency.com',
      passwordHash,
      firstName: 'Agency',
      lastName: 'Owner',
      role: UserRole.AGENCY_OWNER,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.agency.update({
    where: { id: agency.id },
    data: { ownerId: owner.id },
  });

  console.log(`✅ Owner created: ${owner.email}`);

  // 3. Metric Definitions
  const metrics = [
    { key: 'sessions', label: 'Sessions', cat: 'Traffic', type: 'number' },
    { key: 'conversions', label: 'Conversions', cat: 'Conversion', type: 'number' },
    { key: 'spend', label: 'Spend', cat: 'Financial', type: 'currency' },
    { key: 'revenue', label: 'Revenue', cat: 'Financial', type: 'currency' },
    { key: 'aov', label: 'Avg. Order Value', cat: 'Financial', type: 'currency' },
    { key: 'conv_rate', label: 'Conv. Rate', cat: 'Conversion', type: 'percent' },
  ];

  for (const m of metrics) {
    await prisma.metricDefinition.upsert({
      where: { platform_metricKey: { platform: IntegrationPlatform.GA4, metricKey: m.key } },
      update: {},
      create: {
        platform: IntegrationPlatform.GA4,
        metricKey: m.key,
        label: m.label,
        category: m.cat,
        dataType: m.type,
      },
    });
  }
  console.log('✅ Metric definitions seeded');

  // 4. Client
  const client = await prisma.client.create({
    data: {
      tenantId: agency.id,
      name: 'Acme Corp',
      website: 'https://acmecorp.com',
      status: ClientStatus.ACTIVE,
      createdById: owner.id,
    },
  });

  // 5. Campaign
  const campaign = await prisma.campaign.create({
    data: {
      tenantId: agency.id,
      clientId: client.id,
      name: 'Q1 Growth Campaign',
      status: CampaignStatus.ACTIVE,
      createdById: owner.id,
    },
  });

  console.log(`✅ Campaign created: ${campaign.id}`);

  // 6. Dashboard
  const dashboard = await prisma.dashboard.create({
    data: {
      tenantId: agency.id,
      campaignId: campaign.id,
      name: 'Overview Dashboard',
      isDefault: true,
      widgets: {
        create: [
          {
            tenantId: agency.id,
            campaignId: campaign.id,
            widgetType: WidgetType.KPI,
            platform: IntegrationPlatform.GA4,
            metricKeys: ['sessions'],
            config: { title: 'Total Sessions' },
            position: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            tenantId: agency.id,
            campaignId: campaign.id,
            widgetType: WidgetType.KPI,
            platform: IntegrationPlatform.GA4,
            metricKeys: ['conversions'],
            config: { title: 'Total Conversions' },
            position: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            tenantId: agency.id,
            campaignId: campaign.id,
            widgetType: WidgetType.LINE_CHART,
            platform: IntegrationPlatform.GA4,
            metricKeys: ['sessions'],
            config: { title: 'Sessions Trend' },
            position: { x: 0, y: 2, w: 6, h: 4 },
          },
          {
            tenantId: agency.id,
            campaignId: campaign.id,
            widgetType: WidgetType.TABLE,
            platform: IntegrationPlatform.GA4,
            metricKeys: ['sessions', 'conversions'],
            config: { title: 'Top Sources' },
            position: { x: 6, y: 0, w: 6, h: 6 },
          }
        ]
      }
    }
  });

  console.log(`✅ Dashboard created: ${dashboard.id}`);

  // 7. Mock Metric Values (Last 30 days)
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    
    await prisma.metricValue.createMany({
      data: [
        {
          tenantId: agency.id,
          campaignId: campaign.id,
          platform: IntegrationPlatform.GA4,
          metricKey: 'sessions',
          value: 100 + Math.floor(Math.random() * 50),
          recordedAt: date,
        },
        {
          tenantId: agency.id,
          campaignId: campaign.id,
          platform: IntegrationPlatform.GA4,
          metricKey: 'conversions',
          value: 5 + Math.floor(Math.random() * 5),
          recordedAt: date,
        }
      ]
    });
  }

  console.log('✅ Metric values seeded (30 days)');

  // 8. Metric Definitions for Phase 3.7 platforms
  const platformMetrics: Array<{ platform: IntegrationPlatform; key: string; label: string; cat: string; type: string }> = [
    // Google Search Console
    { platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, key: 'clicks', label: 'Clicks', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, key: 'impressions', label: 'Impressions', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, key: 'ctr', label: 'CTR', cat: 'Engagement', type: 'percent' },
    { platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, key: 'position', label: 'Avg. Position', cat: 'SEO', type: 'number' },
    // YouTube Analytics
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'views', label: 'Views', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'estimatedMinutesWatched', label: 'Minutes Watched', cat: 'Engagement', type: 'number' },
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'averageViewDuration', label: 'Avg. View Duration (s)', cat: 'Engagement', type: 'number' },
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'likes', label: 'Likes', cat: 'Engagement', type: 'number' },
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'comments', label: 'Comments', cat: 'Engagement', type: 'number' },
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'subscribersGained', label: 'Subscribers Gained', cat: 'Growth', type: 'number' },
    { platform: IntegrationPlatform.YOUTUBE_ANALYTICS, key: 'subscribersLost', label: 'Subscribers Lost', cat: 'Growth', type: 'number' },
    // LinkedIn Ads
    { platform: IntegrationPlatform.LINKEDIN_ADS, key: 'impressions', label: 'Impressions', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.LINKEDIN_ADS, key: 'clicks', label: 'Clicks', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.LINKEDIN_ADS, key: 'spend', label: 'Spend', cat: 'Financial', type: 'currency' },
    { platform: IntegrationPlatform.LINKEDIN_ADS, key: 'conversions', label: 'Conversions', cat: 'Conversion', type: 'number' },
    { platform: IntegrationPlatform.LINKEDIN_ADS, key: 'videoViews', label: 'Video Views', cat: 'Engagement', type: 'number' },
    // TikTok Ads
    { platform: IntegrationPlatform.TIKTOK_ADS, key: 'spend', label: 'Spend', cat: 'Financial', type: 'currency' },
    { platform: IntegrationPlatform.TIKTOK_ADS, key: 'impressions', label: 'Impressions', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.TIKTOK_ADS, key: 'clicks', label: 'Clicks', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.TIKTOK_ADS, key: 'ctr', label: 'CTR', cat: 'Engagement', type: 'percent' },
    { platform: IntegrationPlatform.TIKTOK_ADS, key: 'cpc', label: 'CPC', cat: 'Financial', type: 'currency' },
    { platform: IntegrationPlatform.TIKTOK_ADS, key: 'conversions', label: 'Conversions', cat: 'Conversion', type: 'number' },
    // Amazon Ads
    { platform: IntegrationPlatform.AMAZON_ADS, key: 'impressions', label: 'Impressions', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.AMAZON_ADS, key: 'clicks', label: 'Clicks', cat: 'Traffic', type: 'number' },
    { platform: IntegrationPlatform.AMAZON_ADS, key: 'spend', label: 'Spend', cat: 'Financial', type: 'currency' },
    { platform: IntegrationPlatform.AMAZON_ADS, key: 'sales', label: 'Sales (7-day)', cat: 'Financial', type: 'currency' },
    { platform: IntegrationPlatform.AMAZON_ADS, key: 'orders', label: 'Orders', cat: 'Conversion', type: 'number' },
  ];

  for (const m of platformMetrics) {
    await prisma.metricDefinition.upsert({
      where: { platform_metricKey: { platform: m.platform, metricKey: m.key } },
      update: {},
      create: { platform: m.platform, metricKey: m.key, label: m.label, category: m.cat, dataType: m.type },
    });
  }
  console.log('✅ Phase 3.7 metric definitions seeded');

  // 9. Global system templates (Phase 8.11 — visible to all tenants)
  await seedGlobalTemplates();
  console.log('✅ Global templates seeded');

  console.log('\n🚀 SEED COMPLETE');
  console.log('--------------------------------------------------');
  console.log('Credentials: owner@demo-agency.com / Password123!');
  console.log(`Campaign ID (Client ID in route): ${client.id}`);
  console.log(`Dashboard ID: ${dashboard.id}`);
}

async function seedGlobalTemplates(): Promise<void> {
  // Dashboard templates — upsert by name so re-seeding is safe
  const dashboardTemplates = [
    {
      name: 'GA4 Performance Overview',
      description: 'Sessions, conversions, bounce rate and top-channel breakdown for Google Analytics 4.',
      category: 'SEO & Analytics',
      platform: IntegrationPlatform.GA4,
      widgets: [
        { widgetType: 'KPI', metricKeys: ['sessions'], config: { title: 'Sessions' }, position: { x: 0, y: 0, w: 3, h: 2 } },
        { widgetType: 'KPI', metricKeys: ['conversions'], config: { title: 'Conversions' }, position: { x: 3, y: 0, w: 3, h: 2 } },
        { widgetType: 'LINE_CHART', metricKeys: ['sessions'], config: { title: 'Sessions Trend' }, position: { x: 0, y: 2, w: 6, h: 4 } },
        { widgetType: 'TABLE', metricKeys: ['sessions', 'conversions'], config: { title: 'Channel Breakdown' }, position: { x: 6, y: 0, w: 6, h: 6 } },
      ],
    },
    {
      name: 'Google Ads Campaign Dashboard',
      description: 'Spend, clicks, impressions and ROAS for Google Ads campaigns.',
      category: 'Paid Advertising',
      platform: IntegrationPlatform.GOOGLE_ADS,
      widgets: [
        { widgetType: 'KPI', metricKeys: ['spend'], config: { title: 'Total Spend' }, position: { x: 0, y: 0, w: 3, h: 2 } },
        { widgetType: 'KPI', metricKeys: ['clicks'], config: { title: 'Clicks' }, position: { x: 3, y: 0, w: 3, h: 2 } },
        { widgetType: 'KPI', metricKeys: ['impressions'], config: { title: 'Impressions' }, position: { x: 6, y: 0, w: 3, h: 2 } },
        { widgetType: 'LINE_CHART', metricKeys: ['spend'], config: { title: 'Spend Over Time' }, position: { x: 0, y: 2, w: 12, h: 4 } },
      ],
    },
    {
      name: 'Meta Ads Overview',
      description: 'Facebook & Instagram ad performance: spend, reach, clicks and conversions.',
      category: 'Paid Advertising',
      platform: IntegrationPlatform.META_ADS,
      widgets: [
        { widgetType: 'KPI', metricKeys: ['spend'], config: { title: 'Total Spend' }, position: { x: 0, y: 0, w: 3, h: 2 } },
        { widgetType: 'KPI', metricKeys: ['impressions'], config: { title: 'Impressions' }, position: { x: 3, y: 0, w: 3, h: 2 } },
        { widgetType: 'KPI', metricKeys: ['clicks'], config: { title: 'Clicks' }, position: { x: 6, y: 0, w: 3, h: 2 } },
        { widgetType: 'LINE_CHART', metricKeys: ['spend', 'clicks'], config: { title: 'Spend vs Clicks' }, position: { x: 0, y: 2, w: 12, h: 4 } },
      ],
    },
  ];

  for (const tpl of dashboardTemplates) {
    const existing = await (prisma as any).dashboardTemplate.findFirst({
      where: { name: tpl.name },
      select: { id: true },
    });
    if (!existing) {
      await (prisma as any).dashboardTemplate.create({
        data: {
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          platform: tpl.platform,
          widgets: tpl.widgets,
        },
      });
    }
  }

  // Report templates
  const reportTemplates = [
    {
      name: 'Monthly SEO Report',
      description: 'Google Analytics 4 monthly summary: traffic, conversions, top pages.',
      category: 'SEO & Analytics',
      platform: IntegrationPlatform.GA4,
      sections: [
        { type: 'HEADER', config: { title: 'Monthly SEO Report', subtitle: 'Powered by AgencyPulse' } },
        { type: 'METRICS_SUMMARY', config: { platform: 'GA4', metrics: ['sessions', 'conversions', 'conv_rate'], title: 'Key Metrics' } },
        { type: 'LINE_CHART', config: { platform: 'GA4', metric: 'sessions', title: 'Sessions Trend' } },
      ],
    },
    {
      name: 'Paid Ads Performance Report',
      description: 'Google Ads & Meta Ads combined spend, ROAS and conversion summary.',
      category: 'Paid Advertising',
      platform: null,
      sections: [
        { type: 'HEADER', config: { title: 'Paid Advertising Report' } },
        { type: 'METRICS_SUMMARY', config: { platform: 'GOOGLE_ADS', metrics: ['spend', 'clicks', 'impressions'], title: 'Google Ads' } },
        { type: 'METRICS_SUMMARY', config: { platform: 'META_ADS', metrics: ['spend', 'clicks', 'impressions'], title: 'Meta Ads' } },
      ],
    },
  ];

  for (const tpl of reportTemplates) {
    const existing = await (prisma as any).reportTemplate.findFirst({
      where: { name: tpl.name },
      select: { id: true },
    });
    if (!existing) {
      await (prisma as any).reportTemplate.create({
        data: {
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          platform: tpl.platform as IntegrationPlatform | null,
          sections: tpl.sections,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
