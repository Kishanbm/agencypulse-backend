/**
 * Meeting demo seed — populates Qodet Agency Co with realistic, production-quality data
 * covering every feature: clients, campaigns, integrations, metrics (90 days),
 * dashboards, reports, goals, alerts, notes, custom KPIs, team, notifications, audit log.
 *
 * Run with:  npx ts-node prisma/seed-meeting.ts
 *
 * Uses MIGRATION_DATABASE_URL (superuser) to bypass RLS.
 */

import {
  PrismaClient,
  UserRole,
  ClientStatus,
  CampaignStatus,
  WidgetType,
  IntegrationPlatform,
  ConnectionStatus,
  ReportStatus,
  DeliveryStatus,
  GoalPeriodType,
  AlertCondition,
  AlertPeriodType,
  AlertSeverity,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL } },
});

// ─── Known IDs ────────────────────────────────────────────────────────────────

const AGENCY_ID = 'bfbcb52b-f98a-48ed-b30d-7a58158dc659';
const OWNER_ID = 'b333633b-66d4-492b-a136-49f08da144e8';
const CLIENT_TEST1_ID = 'f29d1ec8-a2ad-4729-ab51-fddec096e7f9';
const CAMPAIGN_TEST_ID = '38b93ef7-d5e0-4b80-9e5d-7c94378cbeaa';
const CAMPAIGN_TEST2_ID = '61659f6e-0174-417b-818c-f7c1b98d99c9';

// ─── Utility helpers ──────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateOnly(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Deterministic-ish noise: returns a value between -range and +range. */
function noise(seed: number, range: number): number {
  return ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1) * 2 * range - range;
}

/** Generate a realistic trending time-series for `days` days ending today. */
function series(
  base: number,
  trend: number,  // per-day linear growth
  noise_pct: number, // noise as fraction of base
  days: number,
  weekendMultiplier = 1.0,
): number[] {
  const result: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const value =
      base +
      trend * (days - 1 - i) +
      noise(i, base * noise_pct) +
      (isWeekend ? base * (weekendMultiplier - 1) : 0);
    result.push(Math.max(0, Math.round(value * 100) / 100));
  }
  return result;
}

async function upsertIntegration(
  campaignId: string,
  platform: IntegrationPlatform,
  externalAccountId?: string,
): Promise<void> {
  await prisma.integrationConnection.upsert({
    where: { campaignId_platform: { campaignId, platform } },
    update: {
      status: ConnectionStatus.CONNECTED,
      lastSyncAt: daysAgo(0),
    },
    create: {
      tenantId: AGENCY_ID,
      campaignId,
      platform,
      status: ConnectionStatus.CONNECTED,
      accessTokenEnc: 'enc_demo_token_' + platform.toLowerCase(),
      scopes: 'read',
      externalAccountId: externalAccountId ?? `acct_${platform.toLowerCase()}_001`,
      lastSyncAt: daysAgo(0),
    },
  });
}

async function seedMetrics(
  campaignId: string,
  platform: IntegrationPlatform,
  metrics: { key: string; values: number[] }[],
  days: number,
): Promise<void> {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = daysAgo(days - 1 - i);
    for (const m of metrics) {
      rows.push({
        tenantId: AGENCY_ID,
        campaignId,
        platform,
        metricKey: m.key,
        recordedAt: dateOnly(date),
        value: m.values[i],
      });
    }
  }
  await prisma.metricValue.createMany({ data: rows, skipDuplicates: true });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding meeting demo data for Qodet Agency Co...\n');

  // ── 1. Update agency branding ────────────────────────────────────────────────
  await prisma.agency.update({
    where: { id: AGENCY_ID },
    data: {
      name: 'Qodet Agency Co',
      website: 'https://qodet.com',
      size: '11-50',
      country: 'US',
      timezone: 'America/New_York',
      primaryColor: '#5B47E0',
      secondaryColor: '#FF8FA9',
      emailFromName: 'Qodet Agency',
      emailFromAddress: 'reports@qodet.com',
      plan: 'AGENCY',
      subscriptionStatus: 'active',
      trialEndsAt: null,
    },
  });
  console.log('✅ Agency branding updated');

  // ── 2. Team members ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'sarah.chen@qodet.com' },
    update: {},
    create: {
      tenantId: AGENCY_ID,
      email: 'sarah.chen@qodet.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Chen',
      role: UserRole.AGENCY_ADMIN,
      isActive: true,
      emailVerifiedAt: daysAgo(45),
      invitedById: OWNER_ID,
      lastLoginAt: daysAgo(1),
    },
  });

  const staffUser1 = await prisma.user.upsert({
    where: { email: 'james.patel@qodet.com' },
    update: {},
    create: {
      tenantId: AGENCY_ID,
      email: 'james.patel@qodet.com',
      passwordHash,
      firstName: 'James',
      lastName: 'Patel',
      role: UserRole.AGENCY_STAFF,
      isActive: true,
      emailVerifiedAt: daysAgo(30),
      invitedById: OWNER_ID,
      lastLoginAt: daysAgo(2),
    },
  });

  const staffUser2 = await prisma.user.upsert({
    where: { email: 'mia.torres@qodet.com' },
    update: {},
    create: {
      tenantId: AGENCY_ID,
      email: 'mia.torres@qodet.com',
      passwordHash,
      firstName: 'Mia',
      lastName: 'Torres',
      role: UserRole.AGENCY_STAFF,
      isActive: true,
      emailVerifiedAt: daysAgo(20),
      invitedById: adminUser.id,
      lastLoginAt: daysAgo(0),
    },
  });

  const clientPortalUser = await prisma.user.upsert({
    where: { email: 'cmo@northstarfitness.com' },
    update: {},
    create: {
      tenantId: AGENCY_ID,
      email: 'cmo@northstarfitness.com',
      passwordHash,
      firstName: 'Derek',
      lastName: 'Ashworth',
      role: UserRole.CLIENT_USER,
      isActive: true,
      emailVerifiedAt: daysAgo(15),
      invitedById: OWNER_ID,
    },
  });

  console.log('✅ Team members created (admin + 2 staff + 1 portal user)');

  // ── 3. Clients ────────────────────────────────────────────────────────────────
  const northstar = await prisma.client.upsert({
    where: { id: 'a0000001-0000-0000-0000-000000000001' as any },
    update: {},
    create: {
      id: 'a0000001-0000-0000-0000-000000000001',
      tenantId: AGENCY_ID,
      name: 'Northstar Fitness & Wellness',
      website: 'https://northstarfitness.com',
      color: '#10B981',
      status: ClientStatus.ACTIVE,
      createdById: OWNER_ID,
    } as any,
  }).catch(() =>
    prisma.client.findFirst({ where: { tenantId: AGENCY_ID, name: 'Northstar Fitness & Wellness' } })
  );

  const mapleRidge = await prisma.client.upsert({
    where: { id: 'a0000002-0000-0000-0000-000000000002' as any },
    update: {},
    create: {
      id: 'a0000002-0000-0000-0000-000000000002',
      tenantId: AGENCY_ID,
      name: 'Maple Ridge Dental Group',
      website: 'https://mapleridgedental.com',
      color: '#3B82F6',
      status: ClientStatus.ACTIVE,
      createdById: OWNER_ID,
    } as any,
  }).catch(() =>
    prisma.client.findFirst({ where: { tenantId: AGENCY_ID, name: 'Maple Ridge Dental Group' } })
  );

  const velo = await prisma.client.upsert({
    where: { id: 'a0000003-0000-0000-0000-000000000003' as any },
    update: {},
    create: {
      id: 'a0000003-0000-0000-0000-000000000003',
      tenantId: AGENCY_ID,
      name: 'Velo Commerce',
      website: 'https://velocommerce.com',
      color: '#F59E0B',
      status: ClientStatus.ACTIVE,
      createdById: adminUser.id,
    } as any,
  }).catch(() =>
    prisma.client.findFirst({ where: { tenantId: AGENCY_ID, name: 'Velo Commerce' } })
  );

  // Resolve to actual objects (handles both create and catch paths)
  const northstarClient = northstar!;
  const mapleRidgeClient = mapleRidge!;
  const veloClient = velo!;

  // Staff assignments
  const existingAssignments = await prisma.staffClientAssignment.findMany({
    where: { tenantId: AGENCY_ID },
    select: { userId: true, clientId: true },
  });
  const assignmentSet = new Set(existingAssignments.map((a) => `${a.userId}:${a.clientId}`));

  async function assignStaff(userId: string, clientId: string) {
    if (!assignmentSet.has(`${userId}:${clientId}`)) {
      await prisma.staffClientAssignment.create({
        data: { tenantId: AGENCY_ID, userId, clientId, assignedById: OWNER_ID },
      });
    }
  }

  await assignStaff(staffUser1.id, northstarClient.id);
  await assignStaff(staffUser1.id, mapleRidgeClient.id);
  await assignStaff(staffUser2.id, northstarClient.id);
  await assignStaff(staffUser2.id, veloClient.id);
  await assignStaff(adminUser.id, northstarClient.id);
  await assignStaff(adminUser.id, mapleRidgeClient.id);
  await assignStaff(adminUser.id, veloClient.id);
  await assignStaff(adminUser.id, CLIENT_TEST1_ID);

  // Client portal assignment
  const existingPortalAssignment = await prisma.clientUserAssignment.findFirst({
    where: { userId: clientPortalUser.id, clientId: northstarClient.id },
  });
  if (!existingPortalAssignment) {
    await prisma.clientUserAssignment.create({
      data: {
        tenantId: AGENCY_ID,
        userId: clientPortalUser.id,
        clientId: northstarClient.id,
        assignedById: OWNER_ID,
      },
    });
  }

  console.log('✅ Clients created & staff assigned');

  // ── 4. Campaigns ─────────────────────────────────────────────────────────────
  async function upsertCampaign(id: string, clientId: string, name: string, description: string, createdById: string) {
    return prisma.campaign.upsert({
      where: { id },
      update: { name, description },
      create: {
        id,
        tenantId: AGENCY_ID,
        clientId,
        name,
        description,
        status: CampaignStatus.ACTIVE,
        createdById,
      },
    });
  }

  // Test Client 1 campaigns already exist — update descriptions
  await prisma.campaign.update({
    where: { id: CAMPAIGN_TEST_ID },
    data: {
      name: 'Q2 2025 — Organic Growth',
      description: 'SEO, content, and Google Analytics performance tracking for Q2 2025.',
    },
  });
  await prisma.campaign.update({
    where: { id: CAMPAIGN_TEST2_ID },
    data: {
      name: 'Paid Media — Q2 2025',
      description: 'Google Ads and Meta Ads performance across all ad sets and audiences.',
    },
  });

  const nsQ2 = await upsertCampaign(
    'b0000001-0000-0000-0000-000000000001',
    northstarClient.id,
    'Q2 2025 — Brand & Lead Gen',
    'Multi-channel brand awareness and lead generation for new gym memberships in Q2 2025.',
    staffUser1.id,
  );
  const nsSummer = await upsertCampaign(
    'b0000002-0000-0000-0000-000000000002',
    northstarClient.id,
    'Summer Membership Push',
    'Paid and organic push targeting summer fitness resolutions. June–August 2025.',
    staffUser2.id,
  );
  const mrAcquisition = await upsertCampaign(
    'b0000003-0000-0000-0000-000000000003',
    mapleRidgeClient.id,
    '2025 Patient Acquisition',
    'Full-funnel patient acquisition — Google Ads, local SEO, and call tracking.',
    staffUser1.id,
  );
  const mrImplants = await upsertCampaign(
    'b0000004-0000-0000-0000-000000000004',
    mapleRidgeClient.id,
    'Implants Awareness Q2',
    'Awareness and retargeting campaign for dental implant services. Meta + Google.',
    adminUser.id,
  );
  const veloPerf = await upsertCampaign(
    'b0000005-0000-0000-0000-000000000005',
    veloClient.id,
    'Summer 2025 — Performance',
    'Google Ads and Meta Ads driving summer cycling gear sales.',
    staffUser2.id,
  );
  const veloEmail = await upsertCampaign(
    'b0000006-0000-0000-0000-000000000006',
    veloClient.id,
    'Email & Retention Q2',
    'Klaviyo email flows, win-back sequences, and loyalty programme for existing customers.',
    adminUser.id,
  );

  console.log('✅ Campaigns created / updated');

  // ── 5. Integrations ──────────────────────────────────────────────────────────

  // Test Client 1 — Organic campaign
  await upsertIntegration(CAMPAIGN_TEST_ID, IntegrationPlatform.GA4, 'G-DEMO12345');
  await upsertIntegration(CAMPAIGN_TEST_ID, IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, 'sc-domain:testclient1.com');
  await upsertIntegration(CAMPAIGN_TEST_ID, IntegrationPlatform.SEMRUSH, 'sr_testclient1');
  await upsertIntegration(CAMPAIGN_TEST_ID, IntegrationPlatform.AHREFS, 'ah_testclient1');

  // Test Client 1 — Paid campaign
  await upsertIntegration(CAMPAIGN_TEST2_ID, IntegrationPlatform.GA4, 'G-DEMO12345');
  await upsertIntegration(CAMPAIGN_TEST2_ID, IntegrationPlatform.GOOGLE_ADS, '850-234-1122');
  await upsertIntegration(CAMPAIGN_TEST2_ID, IntegrationPlatform.META_ADS, 'act_1234567890');
  await upsertIntegration(CAMPAIGN_TEST2_ID, IntegrationPlatform.MICROSOFT_ADS, 'ms_44556677');

  // Northstar Fitness — Q2 Brand
  await upsertIntegration(nsQ2.id, IntegrationPlatform.GA4, 'G-NS11111');
  await upsertIntegration(nsQ2.id, IntegrationPlatform.GOOGLE_ADS, '801-445-9923');
  await upsertIntegration(nsQ2.id, IntegrationPlatform.META_ADS, 'act_9876543210');
  await upsertIntegration(nsQ2.id, IntegrationPlatform.MAILCHIMP, 'ns_mailchimp_1');
  await upsertIntegration(nsQ2.id, IntegrationPlatform.INSTAGRAM_ORGANIC, 'northstar_fitness');

  // Northstar Fitness — Summer
  await upsertIntegration(nsSummer.id, IntegrationPlatform.GA4, 'G-NS11111');
  await upsertIntegration(nsSummer.id, IntegrationPlatform.GOOGLE_ADS, '801-445-9923');
  await upsertIntegration(nsSummer.id, IntegrationPlatform.META_ADS, 'act_9876543210');
  await upsertIntegration(nsSummer.id, IntegrationPlatform.TIKTOK_ADS, 'tt_ns_2025');

  // Maple Ridge — Patient Acquisition
  await upsertIntegration(mrAcquisition.id, IntegrationPlatform.GA4, 'G-MR22222');
  await upsertIntegration(mrAcquisition.id, IntegrationPlatform.GOOGLE_ADS, '770-882-3341');
  await upsertIntegration(mrAcquisition.id, IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, 'sc-domain:mapleridgedental.com');
  await upsertIntegration(mrAcquisition.id, IntegrationPlatform.CALLRAIL, 'cr_maple_001');
  await upsertIntegration(mrAcquisition.id, IntegrationPlatform.BRIGHTLOCAL, 'bl_maple_001');

  // Maple Ridge — Implants
  await upsertIntegration(mrImplants.id, IntegrationPlatform.GA4, 'G-MR22222');
  await upsertIntegration(mrImplants.id, IntegrationPlatform.META_ADS, 'act_5544332211');
  await upsertIntegration(mrImplants.id, IntegrationPlatform.GOOGLE_ADS, '770-882-3341');

  // Velo Commerce — Performance
  await upsertIntegration(veloPerf.id, IntegrationPlatform.GA4, 'G-VC33333');
  await upsertIntegration(veloPerf.id, IntegrationPlatform.GOOGLE_ADS, '930-115-8847');
  await upsertIntegration(veloPerf.id, IntegrationPlatform.META_ADS, 'act_7766554433');
  await upsertIntegration(veloPerf.id, IntegrationPlatform.SHOPIFY, 'velocommerce.myshopify.com');
  await upsertIntegration(veloPerf.id, IntegrationPlatform.SEMRUSH, 'sr_velocommerce');

  // Velo Commerce — Email
  await upsertIntegration(veloEmail.id, IntegrationPlatform.KLAVIYO, 'kl_velo_001');
  await upsertIntegration(veloEmail.id, IntegrationPlatform.SHOPIFY, 'velocommerce.myshopify.com');
  await upsertIntegration(veloEmail.id, IntegrationPlatform.GA4, 'G-VC33333');

  console.log('✅ Integrations connected');

  // ── 6. Metric values (90 days) ───────────────────────────────────────────────
  const DAYS = 90;

  // ── Test Client 1 — Organic (GA4 + GSC + SEMrush) ──────────────────────────
  await seedMetrics(CAMPAIGN_TEST_ID, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(1420, 4.5, 0.12, DAYS, 0.75) },
    { key: 'users', values: series(1180, 3.8, 0.11, DAYS, 0.75) },
    { key: 'pageviews', values: series(4200, 12, 0.14, DAYS, 0.72) },
    { key: 'conversions', values: series(38, 0.22, 0.18, DAYS, 0.80) },
    { key: 'conv_rate', values: series(2.68, 0.008, 0.06, DAYS) },
    { key: 'bounce_rate', values: series(46.2, -0.05, 0.04, DAYS) },
    { key: 'avg_session_duration', values: series(214, 0.3, 0.08, DAYS) },
  ], DAYS);

  await seedMetrics(CAMPAIGN_TEST_ID, IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, [
    { key: 'clicks', values: series(620, 2.1, 0.13, DAYS) },
    { key: 'impressions', values: series(22400, 55, 0.10, DAYS) },
    { key: 'ctr', values: series(2.77, 0.003, 0.05, DAYS) },
    { key: 'position', values: series(14.2, -0.04, 0.06, DAYS) },
  ], DAYS);

  await seedMetrics(CAMPAIGN_TEST_ID, IntegrationPlatform.SEMRUSH, [
    { key: 'organic_keywords', values: series(512, 1.2, 0.05, DAYS) },
    { key: 'domain_authority', values: series(41, 0.03, 0.01, DAYS) },
    { key: 'backlinks', values: series(3140, 4.5, 0.04, DAYS) },
  ], DAYS);

  // ── Test Client 1 — Paid (GA4 + Google Ads + Meta + Microsoft) ─────────────
  await seedMetrics(CAMPAIGN_TEST2_ID, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(980, 2.2, 0.14, DAYS, 0.82) },
    { key: 'conversions', values: series(44, 0.18, 0.20, DAYS, 0.85) },
    { key: 'conv_rate', values: series(4.49, 0.005, 0.07, DAYS) },
    { key: 'bounce_rate', values: series(38.5, -0.04, 0.05, DAYS) },
  ], DAYS);

  await seedMetrics(CAMPAIGN_TEST2_ID, IntegrationPlatform.GOOGLE_ADS, [
    { key: 'spend', values: series(285, 0.8, 0.10, DAYS) },
    { key: 'clicks', values: series(430, 1.2, 0.13, DAYS) },
    { key: 'impressions', values: series(14200, 28, 0.12, DAYS) },
    { key: 'ctr', values: series(3.03, 0.004, 0.05, DAYS) },
    { key: 'cpc', values: series(1.76, -0.003, 0.06, DAYS) },
    { key: 'conversions', values: series(28, 0.12, 0.18, DAYS) },
    { key: 'cost_per_conversion', values: series(10.18, -0.02, 0.08, DAYS) },
    { key: 'roas', values: series(4.82, 0.012, 0.09, DAYS) },
  ], DAYS);

  await seedMetrics(CAMPAIGN_TEST2_ID, IntegrationPlatform.META_ADS, [
    { key: 'spend', values: series(192, 0.5, 0.12, DAYS) },
    { key: 'impressions', values: series(32500, 60, 0.14, DAYS) },
    { key: 'clicks', values: series(640, 1.8, 0.15, DAYS) },
    { key: 'ctr', values: series(1.97, 0.003, 0.06, DAYS) },
    { key: 'cpm', values: series(5.91, -0.008, 0.07, DAYS) },
    { key: 'conversions', values: series(22, 0.08, 0.20, DAYS) },
    { key: 'cost_per_result', values: series(8.73, -0.015, 0.09, DAYS) },
    { key: 'reach', values: series(24000, 40, 0.12, DAYS) },
  ], DAYS);

  // ── Northstar Fitness — Q2 Brand (GA4 + Google Ads + Meta + Mailchimp) ──────
  await seedMetrics(nsQ2.id, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(1680, 5.5, 0.11, DAYS, 0.90) },
    { key: 'users', values: series(1340, 4.2, 0.10, DAYS, 0.88) },
    { key: 'pageviews', values: series(5100, 16, 0.13, DAYS, 0.90) },
    { key: 'conversions', values: series(52, 0.28, 0.16, DAYS, 0.95) },
    { key: 'conv_rate', values: series(3.10, 0.007, 0.05, DAYS) },
    { key: 'bounce_rate', values: series(42.8, -0.06, 0.04, DAYS) },
    { key: 'avg_session_duration', values: series(198, 0.4, 0.07, DAYS) },
  ], DAYS);

  await seedMetrics(nsQ2.id, IntegrationPlatform.GOOGLE_ADS, [
    { key: 'spend', values: series(318, 1.1, 0.10, DAYS) },
    { key: 'clicks', values: series(520, 1.8, 0.12, DAYS) },
    { key: 'impressions', values: series(18400, 42, 0.11, DAYS) },
    { key: 'ctr', values: series(2.83, 0.005, 0.05, DAYS) },
    { key: 'cpc', values: series(1.62, -0.004, 0.07, DAYS) },
    { key: 'conversions', values: series(32, 0.15, 0.17, DAYS) },
    { key: 'cost_per_conversion', values: series(9.94, -0.025, 0.08, DAYS) },
    { key: 'roas', values: series(5.24, 0.015, 0.10, DAYS) },
  ], DAYS);

  await seedMetrics(nsQ2.id, IntegrationPlatform.META_ADS, [
    { key: 'spend', values: series(224, 0.7, 0.11, DAYS) },
    { key: 'impressions', values: series(41200, 85, 0.13, DAYS) },
    { key: 'clicks', values: series(780, 2.2, 0.14, DAYS) },
    { key: 'ctr', values: series(1.89, 0.004, 0.06, DAYS) },
    { key: 'cpm', values: series(5.44, -0.01, 0.07, DAYS) },
    { key: 'conversions', values: series(29, 0.10, 0.18, DAYS) },
    { key: 'cost_per_result', values: series(7.72, -0.02, 0.08, DAYS) },
    { key: 'reach', values: series(32000, 55, 0.11, DAYS) },
    { key: 'frequency', values: series(1.62, 0.002, 0.04, DAYS) },
  ], DAYS);

  // Mailchimp — weekly campaigns (emit ~13 data points over 90 days)
  await seedMetrics(nsQ2.id, IntegrationPlatform.MAILCHIMP, [
    { key: 'emails_sent', values: series(8200, 15, 0.08, DAYS) },
    { key: 'open_rate', values: series(28.4, 0.04, 0.06, DAYS) },
    { key: 'click_rate', values: series(4.12, 0.02, 0.08, DAYS) },
    { key: 'unsubscribes', values: series(18, -0.05, 0.15, DAYS) },
  ], DAYS);

  // Instagram Organic
  await seedMetrics(nsQ2.id, IntegrationPlatform.INSTAGRAM_ORGANIC, [
    { key: 'impressions', values: series(12400, 28, 0.14, DAYS) },
    { key: 'reach', values: series(9800, 20, 0.12, DAYS) },
    { key: 'followers', values: series(11240, 8, 0.02, DAYS) },
    { key: 'engagement_rate', values: series(4.82, 0.008, 0.06, DAYS) },
    { key: 'profile_visits', values: series(840, 2.2, 0.14, DAYS) },
  ], DAYS);

  // ── Northstar Fitness — Summer (GA4 + Google Ads + Meta + TikTok) ───────────
  await seedMetrics(nsSummer.id, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(2180, 18, 0.12, DAYS, 1.05) },
    { key: 'conversions', values: series(68, 0.55, 0.17, DAYS, 1.08) },
    { key: 'conv_rate', values: series(3.12, 0.006, 0.06, DAYS) },
    { key: 'bounce_rate', values: series(40.2, -0.07, 0.05, DAYS) },
  ], DAYS);

  await seedMetrics(nsSummer.id, IntegrationPlatform.GOOGLE_ADS, [
    { key: 'spend', values: series(412, 2.8, 0.10, DAYS) },
    { key: 'clicks', values: series(680, 4.5, 0.12, DAYS) },
    { key: 'impressions', values: series(22800, 95, 0.11, DAYS) },
    { key: 'ctr', values: series(2.98, 0.006, 0.05, DAYS) },
    { key: 'cpc', values: series(1.54, -0.005, 0.07, DAYS) },
    { key: 'conversions', values: series(42, 0.30, 0.16, DAYS) },
    { key: 'roas', values: series(5.88, 0.018, 0.09, DAYS) },
  ], DAYS);

  await seedMetrics(nsSummer.id, IntegrationPlatform.META_ADS, [
    { key: 'spend', values: series(285, 1.8, 0.11, DAYS) },
    { key: 'impressions', values: series(52000, 180, 0.13, DAYS) },
    { key: 'clicks', values: series(1020, 6.5, 0.14, DAYS) },
    { key: 'conversions', values: series(38, 0.22, 0.18, DAYS) },
    { key: 'cost_per_result', values: series(7.50, -0.025, 0.08, DAYS) },
    { key: 'reach', values: series(42000, 140, 0.11, DAYS) },
  ], DAYS);

  await seedMetrics(nsSummer.id, IntegrationPlatform.TIKTOK_ADS, [
    { key: 'spend', values: series(145, 1.2, 0.13, DAYS) },
    { key: 'impressions', values: series(68000, 420, 0.15, DAYS) },
    { key: 'clicks', values: series(1840, 12, 0.16, DAYS) },
    { key: 'ctr', values: series(2.71, 0.005, 0.07, DAYS) },
    { key: 'cpc', values: series(0.79, -0.004, 0.09, DAYS) },
    { key: 'conversions', values: series(24, 0.15, 0.20, DAYS) },
  ], DAYS);

  // ── Maple Ridge Dental — Patient Acquisition ─────────────────────────────────
  await seedMetrics(mrAcquisition.id, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(820, 2.0, 0.12, DAYS, 0.60) },
    { key: 'users', values: series(680, 1.6, 0.11, DAYS, 0.58) },
    { key: 'conversions', values: series(24, 0.12, 0.18, DAYS, 0.65) },
    { key: 'conv_rate', values: series(2.93, 0.006, 0.06, DAYS) },
    { key: 'bounce_rate', values: series(44.6, -0.04, 0.04, DAYS) },
    { key: 'avg_session_duration', values: series(188, 0.3, 0.07, DAYS) },
  ], DAYS);

  await seedMetrics(mrAcquisition.id, IntegrationPlatform.GOOGLE_ADS, [
    { key: 'spend', values: series(224, 0.6, 0.10, DAYS) },
    { key: 'clicks', values: series(310, 0.9, 0.12, DAYS) },
    { key: 'impressions', values: series(9800, 22, 0.11, DAYS) },
    { key: 'ctr', values: series(3.16, 0.004, 0.05, DAYS) },
    { key: 'cpc', values: series(2.11, -0.003, 0.06, DAYS) },
    { key: 'conversions', values: series(18, 0.09, 0.17, DAYS) },
    { key: 'cost_per_conversion', values: series(12.44, -0.03, 0.08, DAYS) },
  ], DAYS);

  await seedMetrics(mrAcquisition.id, IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, [
    { key: 'clicks', values: series(340, 1.1, 0.12, DAYS) },
    { key: 'impressions', values: series(11200, 28, 0.10, DAYS) },
    { key: 'ctr', values: series(3.04, 0.003, 0.05, DAYS) },
    { key: 'position', values: series(11.8, -0.04, 0.06, DAYS) },
  ], DAYS);

  // CallRail — call tracking
  await seedMetrics(mrAcquisition.id, IntegrationPlatform.CALLRAIL, [
    { key: 'total_calls', values: series(28, 0.08, 0.16, DAYS, 0.50) },
    { key: 'answered_calls', values: series(22, 0.06, 0.14, DAYS, 0.50) },
    { key: 'missed_calls', values: series(6, -0.02, 0.20, DAYS) },
    { key: 'avg_call_duration', values: series(4.2, 0.01, 0.08, DAYS) },
  ], DAYS);

  // BrightLocal — reputation
  await seedMetrics(mrAcquisition.id, IntegrationPlatform.BRIGHTLOCAL, [
    { key: 'google_rating', values: series(4.7, 0.001, 0.005, DAYS) },
    { key: 'google_review_count', values: series(184, 0.3, 0.02, DAYS) },
    { key: 'local_visibility_score', values: series(78.4, 0.08, 0.03, DAYS) },
  ], DAYS);

  // ── Maple Ridge — Implants ───────────────────────────────────────────────────
  await seedMetrics(mrImplants.id, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(420, 1.8, 0.14, DAYS, 0.65) },
    { key: 'conversions', values: series(12, 0.08, 0.22, DAYS, 0.70) },
    { key: 'conv_rate', values: series(2.86, 0.007, 0.07, DAYS) },
  ], DAYS);

  await seedMetrics(mrImplants.id, IntegrationPlatform.META_ADS, [
    { key: 'spend', values: series(168, 0.8, 0.12, DAYS) },
    { key: 'impressions', values: series(28400, 65, 0.14, DAYS) },
    { key: 'clicks', values: series(480, 2.0, 0.15, DAYS) },
    { key: 'ctr', values: series(1.69, 0.004, 0.07, DAYS) },
    { key: 'conversions', values: series(14, 0.06, 0.20, DAYS) },
    { key: 'cost_per_result', values: series(12.00, -0.02, 0.09, DAYS) },
    { key: 'reach', values: series(22000, 50, 0.12, DAYS) },
  ], DAYS);

  await seedMetrics(mrImplants.id, IntegrationPlatform.GOOGLE_ADS, [
    { key: 'spend', values: series(148, 0.5, 0.10, DAYS) },
    { key: 'clicks', values: series(198, 0.7, 0.12, DAYS) },
    { key: 'ctr', values: series(2.24, 0.003, 0.05, DAYS) },
    { key: 'cost_per_conversion', values: series(14.80, -0.03, 0.09, DAYS) },
    { key: 'conversions', values: series(10, 0.05, 0.20, DAYS) },
  ], DAYS);

  // ── Velo Commerce — Performance (GA4 + Google Ads + Meta + Shopify + SEMrush)
  await seedMetrics(veloPerf.id, IntegrationPlatform.GA4, [
    { key: 'sessions', values: series(3240, 12, 0.12, DAYS, 1.08) },
    { key: 'users', values: series(2680, 10, 0.11, DAYS, 1.06) },
    { key: 'pageviews', values: series(9800, 35, 0.13, DAYS, 1.08) },
    { key: 'conversions', values: series(98, 0.42, 0.16, DAYS, 1.12) },
    { key: 'conv_rate', values: series(3.02, 0.005, 0.05, DAYS) },
    { key: 'bounce_rate', values: series(36.8, -0.05, 0.04, DAYS) },
    { key: 'avg_session_duration', values: series(242, 0.5, 0.07, DAYS) },
  ], DAYS);

  await seedMetrics(veloPerf.id, IntegrationPlatform.GOOGLE_ADS, [
    { key: 'spend', values: series(448, 2.2, 0.10, DAYS) },
    { key: 'clicks', values: series(720, 3.5, 0.12, DAYS) },
    { key: 'impressions', values: series(24800, 80, 0.11, DAYS) },
    { key: 'ctr', values: series(2.90, 0.005, 0.05, DAYS) },
    { key: 'cpc', values: series(1.48, -0.005, 0.07, DAYS) },
    { key: 'conversions', values: series(58, 0.28, 0.15, DAYS) },
    { key: 'cost_per_conversion', values: series(7.72, -0.02, 0.08, DAYS) },
    { key: 'roas', values: series(6.42, 0.018, 0.09, DAYS) },
  ], DAYS);

  await seedMetrics(veloPerf.id, IntegrationPlatform.META_ADS, [
    { key: 'spend', values: series(312, 1.5, 0.11, DAYS) },
    { key: 'impressions', values: series(58000, 180, 0.13, DAYS) },
    { key: 'clicks', values: series(1280, 6, 0.14, DAYS) },
    { key: 'ctr', values: series(2.21, 0.004, 0.06, DAYS) },
    { key: 'cpm', values: series(5.38, -0.01, 0.07, DAYS) },
    { key: 'conversions', values: series(48, 0.22, 0.17, DAYS) },
    { key: 'cost_per_result', values: series(6.50, -0.02, 0.08, DAYS) },
    { key: 'roas', values: series(7.84, 0.022, 0.09, DAYS) },
    { key: 'reach', values: series(46000, 140, 0.11, DAYS) },
  ], DAYS);

  await seedMetrics(veloPerf.id, IntegrationPlatform.SHOPIFY, [
    { key: 'orders', values: series(88, 0.38, 0.14, DAYS, 1.14) },
    { key: 'revenue', values: series(8820, 38, 0.12, DAYS, 1.14) },
    { key: 'avg_order_value', values: series(100.23, 0.02, 0.04, DAYS) },
    { key: 'sessions', values: series(4200, 15, 0.12, DAYS, 1.10) },
    { key: 'conversion_rate', values: series(2.10, 0.004, 0.06, DAYS) },
    { key: 'returning_customer_rate', values: series(32.4, 0.06, 0.05, DAYS) },
  ], DAYS);

  await seedMetrics(veloPerf.id, IntegrationPlatform.SEMRUSH, [
    { key: 'organic_keywords', values: series(680, 2.2, 0.05, DAYS) },
    { key: 'domain_authority', values: series(52, 0.04, 0.01, DAYS) },
    { key: 'backlinks', values: series(5840, 8.5, 0.04, DAYS) },
    { key: 'organic_traffic_estimate', values: series(18400, 48, 0.08, DAYS) },
  ], DAYS);

  // ── Velo Commerce — Email (Klaviyo + Shopify) ────────────────────────────────
  await seedMetrics(veloEmail.id, IntegrationPlatform.KLAVIYO, [
    { key: 'emails_sent', values: series(14800, 22, 0.08, DAYS) },
    { key: 'open_rate', values: series(34.2, 0.05, 0.06, DAYS) },
    { key: 'click_rate', values: series(5.84, 0.02, 0.08, DAYS) },
    { key: 'revenue_attributed', values: series(3240, 14, 0.12, DAYS) },
    { key: 'unsubscribes', values: series(24, -0.05, 0.15, DAYS) },
    { key: 'list_growth_rate', values: series(1.82, 0.005, 0.07, DAYS) },
  ], DAYS);

  await seedMetrics(veloEmail.id, IntegrationPlatform.SHOPIFY, [
    { key: 'orders', values: series(42, 0.18, 0.12, DAYS) },
    { key: 'revenue', values: series(4200, 18, 0.11, DAYS) },
    { key: 'returning_customer_rate', values: series(44.8, 0.08, 0.05, DAYS) },
  ], DAYS);

  console.log('✅ Metric values seeded (90 days × 8 campaigns)');

  // ── 7. Dashboards ────────────────────────────────────────────────────────────

  async function ensureDashboard(campaignId: string, name: string, isDefault: boolean, widgets: any[]) {
    const existing = await prisma.dashboard.findFirst({
      where: { campaignId, name, deletedAt: null },
    });
    if (existing) return existing;
    // Don't set isDefault=true if a default already exists for this campaign
    const hasDefault = await prisma.dashboard.findFirst({
      where: { campaignId, isDefault: true, deletedAt: null },
    });
    const useDefault = isDefault && !hasDefault;
    return prisma.dashboard.create({
      data: {
        tenantId: AGENCY_ID,
        campaignId,
        name,
        isDefault: useDefault,
        widgets: {
          create: widgets.map((w) => ({
            tenantId: AGENCY_ID,
            campaignId,
            widgetType: w.type,
            platform: w.platform,
            metricKeys: w.metricKeys,
            config: w.config,
            position: w.position,
          })),
        },
      },
    });
  }

  // Test Client 1 — Organic
  await ensureDashboard(CAMPAIGN_TEST_ID, 'SEO & Traffic Overview', true, [
    { type: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['sessions'], config: { title: 'Sessions', comparison: 'prev_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['conversions'], config: { title: 'Conversions', comparison: 'prev_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['conv_rate'], config: { title: 'Conv. Rate', format: 'percent' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, metricKeys: ['clicks'], config: { title: 'Organic Clicks' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.GA4, metricKeys: ['sessions', 'users'], config: { title: 'Sessions vs Users — 90 Days' }, position: { x: 0, y: 2, w: 8, h: 4 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.SEMRUSH, metricKeys: ['organic_keywords'], config: { title: 'Ranked Keywords' }, position: { x: 8, y: 2, w: 4, h: 2 } },
    { type: WidgetType.BAR_CHART, platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, metricKeys: ['clicks', 'impressions'], config: { title: 'GSC Clicks vs Impressions' }, position: { x: 0, y: 6, w: 6, h: 4 } },
    { type: WidgetType.TABLE, platform: IntegrationPlatform.GA4, metricKeys: ['sessions', 'conversions', 'conv_rate'], config: { title: 'Channel Performance' }, position: { x: 6, y: 6, w: 6, h: 4 } },
  ]);

  // Test Client 1 — Paid
  await ensureDashboard(CAMPAIGN_TEST2_ID, 'Paid Media Overview', true, [
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['spend'], config: { title: 'Google Ads Spend', format: 'currency' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.META_ADS, metricKeys: ['spend'], config: { title: 'Meta Ads Spend', format: 'currency' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['roas'], config: { title: 'Google ROAS' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['cost_per_conversion'], config: { title: 'Cost / Conv.', format: 'currency' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['spend', 'conversions'], config: { title: 'Google Ads — Spend vs Conversions' }, position: { x: 0, y: 2, w: 6, h: 4 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.META_ADS, metricKeys: ['spend', 'conversions'], config: { title: 'Meta Ads — Spend vs Conversions' }, position: { x: 6, y: 2, w: 6, h: 4 } },
    { type: WidgetType.BAR_CHART, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['clicks', 'impressions'], config: { title: 'Google Ads Traffic' }, position: { x: 0, y: 6, w: 6, h: 4 } },
    { type: WidgetType.TABLE, platform: IntegrationPlatform.META_ADS, metricKeys: ['impressions', 'clicks', 'ctr', 'cpm'], config: { title: 'Meta Campaign Breakdown' }, position: { x: 6, y: 6, w: 6, h: 4 } },
  ]);

  // Northstar Fitness — Q2
  await ensureDashboard(nsQ2.id, 'Marketing Performance Overview', true, [
    { type: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['sessions'], config: { title: 'Website Sessions' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['conversions'], config: { title: 'Lead Form Fills' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['roas'], config: { title: 'Google ROAS' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.INSTAGRAM_ORGANIC, metricKeys: ['followers'], config: { title: 'Instagram Followers' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.GA4, metricKeys: ['sessions', 'conversions'], config: { title: 'Sessions & Leads — Trend' }, position: { x: 0, y: 2, w: 8, h: 4 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.MAILCHIMP, metricKeys: ['open_rate'], config: { title: 'Email Open Rate', format: 'percent' }, position: { x: 8, y: 2, w: 4, h: 2 } },
    { type: WidgetType.BAR_CHART, platform: IntegrationPlatform.META_ADS, metricKeys: ['reach', 'impressions'], config: { title: 'Meta Reach & Impressions' }, position: { x: 0, y: 6, w: 6, h: 4 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.INSTAGRAM_ORGANIC, metricKeys: ['engagement_rate', 'reach'], config: { title: 'Instagram Engagement' }, position: { x: 6, y: 6, w: 6, h: 4 } },
  ]);

  await ensureDashboard(nsQ2.id, 'Google Ads Detail', false, [
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['spend'], config: { title: 'Total Spend', format: 'currency' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['clicks'], config: { title: 'Clicks' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['cpc'], config: { title: 'Avg. CPC', format: 'currency' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['cost_per_conversion'], config: { title: 'Cost / Lead', format: 'currency' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['spend', 'conversions', 'roas'], config: { title: 'Spend · Conversions · ROAS' }, position: { x: 0, y: 2, w: 12, h: 5 } },
    { type: WidgetType.TABLE, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['clicks', 'spend', 'conversions', 'cpc'], config: { title: 'Campaign Breakdown' }, position: { x: 0, y: 7, w: 12, h: 4 } },
  ]);

  // Velo Commerce — Performance
  await ensureDashboard(veloPerf.id, 'Ecommerce & Ads Overview', true, [
    { type: WidgetType.KPI, platform: IntegrationPlatform.SHOPIFY, metricKeys: ['revenue'], config: { title: 'Daily Revenue', format: 'currency' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.SHOPIFY, metricKeys: ['orders'], config: { title: 'Orders' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.SHOPIFY, metricKeys: ['avg_order_value'], config: { title: 'Avg. Order Value', format: 'currency' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['roas'], config: { title: 'Google ROAS' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.SHOPIFY, metricKeys: ['revenue', 'orders'], config: { title: 'Revenue & Orders — 90 Days' }, position: { x: 0, y: 2, w: 8, h: 4 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.META_ADS, metricKeys: ['roas'], config: { title: 'Meta ROAS' }, position: { x: 8, y: 2, w: 4, h: 2 } },
    { type: WidgetType.BAR_CHART, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['spend', 'conversions'], config: { title: 'Google Ads Performance' }, position: { x: 0, y: 6, w: 6, h: 4 } },
    { type: WidgetType.PIE_CHART, platform: IntegrationPlatform.GA4, metricKeys: ['sessions'], config: { title: 'Traffic by Channel' }, position: { x: 6, y: 6, w: 6, h: 4 } },
  ]);

  // Maple Ridge — Patient Acquisition
  await ensureDashboard(mrAcquisition.id, 'Patient Acquisition Dashboard', true, [
    { type: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['sessions'], config: { title: 'Website Sessions' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.CALLRAIL, metricKeys: ['total_calls'], config: { title: 'Total Calls' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.BRIGHTLOCAL, metricKeys: ['google_rating'], config: { title: 'Google Rating' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { type: WidgetType.KPI, platform: IntegrationPlatform.BRIGHTLOCAL, metricKeys: ['google_review_count'], config: { title: 'Google Reviews' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.GOOGLE_ADS, metricKeys: ['spend', 'conversions'], config: { title: 'Ad Spend vs New Patients' }, position: { x: 0, y: 2, w: 8, h: 4 } },
    { type: WidgetType.LINE_CHART, platform: IntegrationPlatform.CALLRAIL, metricKeys: ['total_calls', 'answered_calls'], config: { title: 'Call Volume' }, position: { x: 8, y: 2, w: 4, h: 4 } },
    { type: WidgetType.BAR_CHART, platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, metricKeys: ['clicks', 'impressions'], config: { title: 'Local Search Visibility' }, position: { x: 0, y: 6, w: 12, h: 4 } },
  ]);

  console.log('✅ Dashboards created');

  // ── 8. Reports ────────────────────────────────────────────────────────────────

  const aiSummaryText = (clientName: string, period: string) => `
## ${period} Performance Summary — ${clientName}

This period demonstrated strong momentum across all channels. Organic traffic continued its upward trajectory, driven by improved keyword rankings and stronger click-through rates from the Google Search Console. Paid campaigns delivered consistent returns with ROAS trending above target.

**Key highlights:**
- **Sessions grew 12% MoM**, outpacing our Q2 target of 8% growth. The improvement is primarily attributed to top-of-funnel content performing well in organic search.
- **Conversion rate improved from 2.9% to 3.1%**, reflecting better landing page alignment with ad intent and recent CRO changes.
- **Google Ads CPC decreased by 8%** — campaign restructuring and Quality Score improvements are delivering efficiency gains.
- **Meta Ads ROAS climbed to 5.8x**, exceeding the 4.5x benchmark. The creative refresh in Week 3 drove a notable uplift in CTR.

**Areas of focus for next period:**
- Accelerate email list growth through better lead magnet placement on high-traffic pages.
- Test new responsive search ad variations for branded campaigns.
- Expand retargeting audiences using Lookalike segments from highest-LTV customer cohorts.

*AI-generated summary based on 90-day metric data. Reviewed and approved by Qodet Agency Co.*
`.trim();

  async function createReport(
    campaignId: string,
    name: string,
    status: ReportStatus,
    hasAi: boolean,
    clientName: string,
    createdDaysAgo: number,
  ) {
    const existing = await prisma.report.findFirst({
      where: { campaignId, name, deletedAt: null },
    });
    if (existing) return existing;

    const sections = [
      { id: 'sec1', type: 'HEADER', order: 1, config: { title: name, subtitle: 'Prepared by Qodet Agency Co', period: 'Last 30 days' } },
      { id: 'sec2', type: 'METRICS_SUMMARY', order: 2, config: { title: 'Key Performance Indicators', metrics: ['sessions', 'conversions', 'conv_rate'] } },
      { id: 'sec3', type: 'LINE_CHART', order: 3, config: { title: 'Traffic Trend', metric: 'sessions' } },
      { id: 'sec4', type: 'BAR_CHART', order: 4, config: { title: 'Channel Breakdown', metric: 'sessions' } },
      { id: 'sec5', type: 'AI_SUMMARY', order: 5, config: { title: 'AI Executive Summary', generated: hasAi } },
      { id: 'sec6', type: 'TEXT_BLOCK', order: 6, config: { title: 'Recommendations', content: 'See executive summary above for strategic recommendations for the next reporting period.' } },
    ];

    return prisma.report.create({
      data: {
        tenantId: AGENCY_ID,
        campaignId,
        name,
        status,
        sections,
        version: 1,
        createdById: OWNER_ID,
        aiSummary: hasAi ? aiSummaryText(clientName, name) : null,
        aiSummaryGeneratedAt: hasAi ? daysAgo(createdDaysAgo - 1) : null,
        aiSummaryModel: hasAi ? 'claude-sonnet-4-6' : null,
        aiSummaryVersion: hasAi ? 1 : null,
        pdfUrl: status === ReportStatus.PUBLISHED ? `https://storage.qodet.com/reports/${campaignId.slice(0, 8)}-${Date.now()}.pdf` : null,
        pdfGeneratedAt: status === ReportStatus.PUBLISHED ? daysAgo(createdDaysAgo) : null,
        createdAt: daysAgo(createdDaysAgo),
      },
    });
  }

  const reportTest1Q2 = await createReport(CAMPAIGN_TEST_ID, 'April 2025 — SEO Performance Report', ReportStatus.PUBLISHED, true, 'Test Client 1', 35);
  const reportTest1May = await createReport(CAMPAIGN_TEST_ID, 'May 2025 — Monthly SEO Summary', ReportStatus.PUBLISHED, true, 'Test Client 1', 5);
  await createReport(CAMPAIGN_TEST_ID, 'June 2025 Report (Draft)', ReportStatus.DRAFT, false, 'Test Client 1', 1);

  const reportTest2Apr = await createReport(CAMPAIGN_TEST2_ID, 'April 2025 — Paid Media Report', ReportStatus.PUBLISHED, true, 'Test Client 1 Paid', 34);
  const reportTest2May = await createReport(CAMPAIGN_TEST2_ID, 'May 2025 — Google & Meta Summary', ReportStatus.PUBLISHED, true, 'Test Client 1 Paid', 4);

  const reportNsQ2Apr = await createReport(nsQ2.id, 'April 2025 — Campaign Performance', ReportStatus.PUBLISHED, true, 'Northstar Fitness', 33);
  const reportNsQ2May = await createReport(nsQ2.id, 'May 2025 — Multi-Channel Report', ReportStatus.PUBLISHED, true, 'Northstar Fitness', 3);
  await createReport(nsQ2.id, 'Q2 2025 Executive Summary (Draft)', ReportStatus.DRAFT, false, 'Northstar Fitness', 0);

  const reportVeloApr = await createReport(veloPerf.id, 'April 2025 — Ecommerce & Ads', ReportStatus.PUBLISHED, true, 'Velo Commerce', 32);
  const reportVeloMay = await createReport(veloPerf.id, 'May 2025 — Revenue Performance Report', ReportStatus.PUBLISHED, true, 'Velo Commerce', 2);

  const reportMrApr = await createReport(mrAcquisition.id, 'April 2025 — Patient Acquisition Report', ReportStatus.PUBLISHED, true, 'Maple Ridge Dental', 31);
  const reportMrMay = await createReport(mrAcquisition.id, 'May 2025 — Local & Paid Summary', ReportStatus.PUBLISHED, true, 'Maple Ridge Dental', 2);

  console.log('✅ Reports created (published + drafts with AI summaries)');

  // ── 9. Report schedules + deliveries + share links ───────────────────────────

  async function addScheduleAndDeliveries(reportId: string, tenantId: string) {
    const existing = await prisma.reportSchedule.findFirst({ where: { reportId } });
    if (existing) return;

    const schedule = await prisma.reportSchedule.create({
      data: {
        tenantId,
        reportId,
        cronExpression: '0 8 1 * *', // 1st of every month at 8am
        isActive: true,
        recipientEmails: ['client@example.com', 'kishan@qodet.com'],
        dateRangeDays: 30,
        nextRunAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1, 8, 0, 0),
      },
    });

    // Past deliveries
    for (let i = 0; i < 3; i++) {
      await prisma.reportDelivery.create({
        data: {
          tenantId,
          reportId,
          scheduleId: schedule.id,
          status: DeliveryStatus.SENT,
          pdfUrl: `https://storage.qodet.com/reports/${reportId.slice(0, 8)}-month-${i}.pdf`,
          sentAt: daysAgo(30 * (i + 1)),
          createdAt: daysAgo(30 * (i + 1)),
        },
      });
    }
  }

  async function addShareLink(reportId: string) {
    const existing = await prisma.reportShareLink.findFirst({ where: { reportId } });
    if (existing) return;
    await prisma.reportShareLink.create({
      data: {
        tenantId: AGENCY_ID,
        reportId,
        token: `share_${reportId.slice(0, 8)}_${Math.random().toString(36).slice(2, 10)}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  }

  for (const r of [reportTest1Q2, reportTest1May, reportTest2Apr, reportTest2May, reportNsQ2Apr, reportNsQ2May, reportVeloApr, reportVeloMay, reportMrApr, reportMrMay]) {
    await addScheduleAndDeliveries(r.id, AGENCY_ID);
    await addShareLink(r.id);
  }

  console.log('✅ Report schedules, deliveries & share links created');

  // ── 10. Goals ─────────────────────────────────────────────────────────────────

  async function ensureGoal(
    campaignId: string,
    name: string,
    platform: IntegrationPlatform,
    metricKey: string,
    targetValue: number,
    periodType: GoalPeriodType,
    startDaysAgo: number,
    endDaysAgo: number,
  ) {
    const existing = await prisma.goal.findFirst({ where: { campaignId, name, deletedAt: null } });
    if (existing) return;
    await prisma.goal.create({
      data: {
        tenantId: AGENCY_ID,
        campaignId,
        name,
        platform,
        metricKey,
        targetValue,
        periodType,
        periodStart: daysAgo(startDaysAgo),
        periodEnd: daysAgo(endDaysAgo),
        createdById: OWNER_ID,
        createdAt: daysAgo(startDaysAgo),
      },
    });
  }

  // Test Client 1 — Organic
  await ensureGoal(CAMPAIGN_TEST_ID, 'Reach 50,000 Monthly Organic Sessions', IntegrationPlatform.GA4, 'sessions', 50000, GoalPeriodType.MONTHLY, 60, 30);
  await ensureGoal(CAMPAIGN_TEST_ID, 'Achieve 800 Monthly GSC Clicks', IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, 'clicks', 800, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(CAMPAIGN_TEST_ID, 'Rank 650 Keywords in Top 100', IntegrationPlatform.SEMRUSH, 'organic_keywords', 650, GoalPeriodType.QUARTERLY, 90, 0);

  // Test Client 1 — Paid
  await ensureGoal(CAMPAIGN_TEST2_ID, 'Maintain Google Ads ROAS Above 4.5x', IntegrationPlatform.GOOGLE_ADS, 'roas', 4.5, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(CAMPAIGN_TEST2_ID, 'Reduce Google CPC Below $1.60', IntegrationPlatform.GOOGLE_ADS, 'cpc', 1.6, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(CAMPAIGN_TEST2_ID, 'Drive 800 Meta Ads Conversions', IntegrationPlatform.META_ADS, 'conversions', 800, GoalPeriodType.QUARTERLY, 90, 0);

  // Northstar Fitness — Q2
  await ensureGoal(nsQ2.id, 'Generate 1,500 Monthly Leads via All Channels', IntegrationPlatform.GA4, 'conversions', 1500, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(nsQ2.id, 'Grow Instagram to 13,000 Followers', IntegrationPlatform.INSTAGRAM_ORGANIC, 'followers', 13000, GoalPeriodType.QUARTERLY, 90, 0);
  await ensureGoal(nsQ2.id, 'Achieve 30% Email Open Rate', IntegrationPlatform.MAILCHIMP, 'open_rate', 30, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(nsQ2.id, 'Google Ads ROAS Above 5.0x', IntegrationPlatform.GOOGLE_ADS, 'roas', 5.0, GoalPeriodType.MONTHLY, 30, 0);

  // Velo Commerce — Performance
  await ensureGoal(veloPerf.id, 'Hit $900,000 Quarterly Revenue via Shopify', IntegrationPlatform.SHOPIFY, 'revenue', 900000, GoalPeriodType.QUARTERLY, 90, 0);
  await ensureGoal(veloPerf.id, 'Google Ads ROAS Above 6.0x', IntegrationPlatform.GOOGLE_ADS, 'roas', 6.0, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(veloPerf.id, 'Grow Organic Keywords to 750', IntegrationPlatform.SEMRUSH, 'organic_keywords', 750, GoalPeriodType.QUARTERLY, 90, 0);

  // Velo Commerce — Email
  await ensureGoal(veloEmail.id, 'Achieve 36% Email Open Rate', IntegrationPlatform.KLAVIYO, 'open_rate', 36, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(veloEmail.id, 'Generate $120,000 Email-Attributed Revenue Q2', IntegrationPlatform.KLAVIYO, 'revenue_attributed', 120000, GoalPeriodType.QUARTERLY, 90, 0);

  // Maple Ridge
  await ensureGoal(mrAcquisition.id, 'Generate 50 New Patient Enquiries/Month', IntegrationPlatform.GA4, 'conversions', 50, GoalPeriodType.MONTHLY, 30, 0);
  await ensureGoal(mrAcquisition.id, 'Reach 200 Google Reviews', IntegrationPlatform.BRIGHTLOCAL, 'google_review_count', 200, GoalPeriodType.QUARTERLY, 90, 0);
  await ensureGoal(mrAcquisition.id, 'Reduce Cost per Enquiry Below $12', IntegrationPlatform.GOOGLE_ADS, 'cost_per_conversion', 12, GoalPeriodType.MONTHLY, 30, 0);

  console.log('✅ Goals created');

  // ── 11. Campaign Notes ────────────────────────────────────────────────────────

  async function ensureNote(campaignId: string, authorId: string, body: string, isPinned: boolean, createdDaysAgo: number) {
    const existing = await prisma.campaignNote.findFirst({ where: { campaignId, body: { startsWith: body.slice(0, 40) }, deletedAt: null } });
    if (existing) return;
    await prisma.campaignNote.create({
      data: { tenantId: AGENCY_ID, campaignId, authorId, body, isPinned, createdAt: daysAgo(createdDaysAgo) },
    });
  }

  // Test Client 1 — Organic
  await ensureNote(CAMPAIGN_TEST_ID, OWNER_ID, '📌 CLIENT CONTEXT: Test Client 1 is a mid-market B2B SaaS company. Primary goal is MQL generation via organic search. Decision-maker is the VP of Marketing. Monthly review call on the 3rd Thursday.', true, 20);
  await ensureNote(CAMPAIGN_TEST_ID, staffUser1.id, 'GSC data shows the /pricing page jumped from avg position 18 to 11 after the title tag update on May 2nd. Keep monitoring — if it holds, worth replicating on the /features page.', false, 15);
  await ensureNote(CAMPAIGN_TEST_ID, adminUser.id, 'Client requested we pause all blog publishing during their product launch week (May 19–23). Content calendar updated. Resume May 26 with the backlog of 3 ready-to-publish posts.', false, 10);
  await ensureNote(CAMPAIGN_TEST_ID, staffUser2.id, 'Core Web Vitals audit completed. LCP improved from 3.8s to 2.4s after image optimization and lazy loading fix. This should positively impact rankings over the next 4–6 weeks.', false, 5);

  // Northstar Fitness — Q2
  await ensureNote(nsQ2.id, OWNER_ID, '📌 KEY INFO: Northstar is adding 2 new locations (Denver + Phoenix) in August. Budget increasing by $8,000/mo from July 1. Start scoping campaign expansion — need location-specific landing pages and ad groups.', true, 18);
  await ensureNote(nsQ2.id, staffUser2.id, 'Instagram Reels test results from last month: Reels get 3.4× more reach than static posts for this audience. Recommending we shift 70% of organic content to video format. Flagged for client approval.', false, 12);
  await ensureNote(nsQ2.id, staffUser1.id, 'Mailchimp unsubscribe rate spiked to 0.8% on the May 8 send. Subject line was too salesy ("Get 50% off today only"). Reverting to value-first approach and testing benefit-led subject lines going forward.', false, 8);
  await ensureNote(nsQ2.id, adminUser.id, 'Q2 budget review: Google Ads is 22% under monthly allocation due to low auction competition in April. Meta is on pace. Recommended reallocating $2k/mo from Google to TikTok to capture younger demographic.', false, 3);

  // Velo Commerce — Performance
  await ensureNote(veloPerf.id, adminUser.id, '📌 CRITICAL: Shopify inventory for the Apex Carbon frame (SKU: VL-APEX-CF) running critically low — 18 units left. Client confirmed restock delayed until June 28. Pause PMax ads targeting this SKU. Do NOT promote in email until restock confirmed.', true, 7);
  await ensureNote(veloPerf.id, staffUser2.id, 'Summer collection launch on June 15. New SKUs: 3 jerseys, 2 bibs, 1 helmet. Creative assets received from client. Meta campaign structure drafted — 3 ad sets: prospecting (Lookalike 1%), retargeting (site visitors 30d), and retention (past purchasers 180d).', false, 5);
  await ensureNote(veloPerf.id, adminUser.id, 'Meta ROAS hit 8.1x during the Bank Holiday weekend May 5–7. The "Performance Kit" bundle ad creative outperformed all others. Extending that ad into June and building 2 more variations based on same hook.', false, 2);

  // Maple Ridge
  await ensureNote(mrAcquisition.id, OWNER_ID, '📌 COMPLIANCE NOTE: All ad copy must comply with GDC advertising guidelines. No comparative claims, no patient testimonials without consent form on file. Run all new creatives through Sarah for compliance review before launch.', true, 25);
  await ensureNote(mrAcquisition.id, staffUser1.id, 'CallRail data for last 30 days: 62% of inbound calls originated from Google Ads click-to-call. Average call duration: 4.2 minutes (up from 3.5 — better call quality). Recommend testing call recording summary feature.', false, 14);
  await ensureNote(mrAcquisition.id, staffUser1.id, 'Google Business Profile had 3 new 1-star reviews in the past week (all responding to a negative Yelp post). Client is addressing internally. BrightLocal monitoring active. Flagged for reputation management follow-up.', false, 6);

  console.log('✅ Campaign notes created');

  // ── 12. Alerts ────────────────────────────────────────────────────────────────

  async function ensureAlert(
    campaignId: string,
    name: string,
    platform: IntegrationPlatform,
    metricKey: string,
    condition: AlertCondition,
    threshold: number,
    severity: AlertSeverity,
    periodType: AlertPeriodType,
    recipientEmails: string[],
    eventValues: number[],
  ) {
    const existing = await prisma.alert.findFirst({ where: { campaignId, name, deletedAt: null } });
    if (existing) return;

    const alert = await prisma.alert.create({
      data: {
        tenantId: AGENCY_ID,
        campaignId,
        name,
        platform,
        metricKey,
        condition,
        threshold,
        severity,
        periodType,
        recipientEmails,
        cooldownHours: 24,
        isActive: true,
        createdById: OWNER_ID,
        lastTriggeredAt: eventValues.length > 0 ? daysAgo(3) : null,
      },
    });

    // Alert events (past firings)
    for (let i = 0; i < eventValues.length; i++) {
      await prisma.alertEvent.create({
        data: {
          tenantId: AGENCY_ID,
          alertId: alert.id,
          campaignId,
          triggeredValue: eventValues[i],
          thresholdValue: threshold,
          condition: condition.toString(),
          severity: severity.toString(),
          emailsSent: recipientEmails,
          notifiedAt: daysAgo(3 + i * 7),
        },
      });
    }
  }

  // Test Client 1 — Organic
  await ensureAlert(CAMPAIGN_TEST_ID, 'Organic Sessions Drop >20% Week-over-Week', IntegrationPlatform.GA4, 'sessions', AlertCondition.PERCENT_CHANGE_BELOW, -20, AlertSeverity.WARNING, AlertPeriodType.WEEKLY, ['kishan@qodet.com'], []);
  await ensureAlert(CAMPAIGN_TEST_ID, 'Bounce Rate Exceeds 60%', IntegrationPlatform.GA4, 'bounce_rate', AlertCondition.ABOVE, 60, AlertSeverity.INFO, AlertPeriodType.DAILY, ['kishan@qodet.com'], []);
  await ensureAlert(CAMPAIGN_TEST_ID, 'GSC CTR Drops Below 2%', IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, 'ctr', AlertCondition.BELOW, 2.0, AlertSeverity.WARNING, AlertPeriodType.WEEKLY, ['kishan@qodet.com', 'sarah.chen@qodet.com'], []);

  // Test Client 1 — Paid
  await ensureAlert(CAMPAIGN_TEST2_ID, 'Google Ads CPC Exceeds $2.50', IntegrationPlatform.GOOGLE_ADS, 'cpc', AlertCondition.ABOVE, 2.5, AlertSeverity.WARNING, AlertPeriodType.DAILY, ['kishan@qodet.com'], [2.74, 2.61]);
  await ensureAlert(CAMPAIGN_TEST2_ID, 'Google ROAS Falls Below 3.5x', IntegrationPlatform.GOOGLE_ADS, 'roas', AlertCondition.BELOW, 3.5, AlertSeverity.CRITICAL, AlertPeriodType.WEEKLY, ['kishan@qodet.com', 'sarah.chen@qodet.com'], []);
  await ensureAlert(CAMPAIGN_TEST2_ID, 'Meta Cost per Result Exceeds $15', IntegrationPlatform.META_ADS, 'cost_per_result', AlertCondition.ABOVE, 15, AlertSeverity.WARNING, AlertPeriodType.DAILY, ['kishan@qodet.com'], []);

  // Northstar Fitness
  await ensureAlert(nsQ2.id, 'Instagram Engagement Rate Below 3%', IntegrationPlatform.INSTAGRAM_ORGANIC, 'engagement_rate', AlertCondition.BELOW, 3.0, AlertSeverity.INFO, AlertPeriodType.WEEKLY, ['james.patel@qodet.com'], []);
  await ensureAlert(nsQ2.id, 'Google Ads ROAS Falls Below 4.0x', IntegrationPlatform.GOOGLE_ADS, 'roas', AlertCondition.BELOW, 4.0, AlertSeverity.CRITICAL, AlertPeriodType.WEEKLY, ['kishan@qodet.com', 'sarah.chen@qodet.com'], [3.82]);
  await ensureAlert(nsQ2.id, 'Email Unsubscribe Rate Above 0.5%', IntegrationPlatform.MAILCHIMP, 'unsubscribes', AlertCondition.ABOVE, 40, AlertSeverity.WARNING, AlertPeriodType.WEEKLY, ['james.patel@qodet.com'], [45]);

  // Velo Commerce
  await ensureAlert(veloPerf.id, 'Shopify Daily Revenue Below $5,000', IntegrationPlatform.SHOPIFY, 'revenue', AlertCondition.BELOW, 5000, AlertSeverity.CRITICAL, AlertPeriodType.DAILY, ['kishan@qodet.com', 'mia.torres@qodet.com'], []);
  await ensureAlert(veloPerf.id, 'Meta Ads ROAS Falls Below 5.0x', IntegrationPlatform.META_ADS, 'roas', AlertCondition.BELOW, 5.0, AlertSeverity.WARNING, AlertPeriodType.WEEKLY, ['mia.torres@qodet.com'], []);
  await ensureAlert(veloPerf.id, 'Google Ads Spend Exceeds $500/day', IntegrationPlatform.GOOGLE_ADS, 'spend', AlertCondition.ABOVE, 500, AlertSeverity.WARNING, AlertPeriodType.DAILY, ['kishan@qodet.com'], [512.44, 498.20]);

  // Maple Ridge
  await ensureAlert(mrAcquisition.id, 'Daily Call Volume Below 15', IntegrationPlatform.CALLRAIL, 'total_calls', AlertCondition.BELOW, 15, AlertSeverity.WARNING, AlertPeriodType.DAILY, ['sarah.chen@qodet.com'], [12, 11]);
  await ensureAlert(mrAcquisition.id, 'Google Rating Drops Below 4.5', IntegrationPlatform.BRIGHTLOCAL, 'google_rating', AlertCondition.BELOW, 4.5, AlertSeverity.CRITICAL, AlertPeriodType.DAILY, ['kishan@qodet.com', 'sarah.chen@qodet.com'], []);

  console.log('✅ Alerts created (with historical events)');

  // ── 13. Custom KPI Definitions ────────────────────────────────────────────────

  const kpiDefs = [
    {
      name: 'Blended ROAS',
      formula: 'shopify_revenue / (google_ads_spend + meta_ads_spend)',
      variableKeys: ['shopify_revenue', 'google_ads_spend', 'meta_ads_spend'],
      platform: IntegrationPlatform.SHOPIFY,
    },
    {
      name: 'Total Paid Spend',
      formula: 'google_ads_spend + meta_ads_spend + tiktok_ads_spend',
      variableKeys: ['google_ads_spend', 'meta_ads_spend', 'tiktok_ads_spend'],
      platform: IntegrationPlatform.GOOGLE_ADS,
    },
    {
      name: 'Blended CPA',
      formula: '(google_ads_spend + meta_ads_spend) / (google_ads_conversions + meta_ads_conversions)',
      variableKeys: ['google_ads_spend', 'meta_ads_spend', 'google_ads_conversions', 'meta_ads_conversions'],
      platform: IntegrationPlatform.GOOGLE_ADS,
    },
    {
      name: 'Email Revenue Share',
      formula: 'klaviyo_revenue_attributed / shopify_revenue * 100',
      variableKeys: ['klaviyo_revenue_attributed', 'shopify_revenue'],
      platform: IntegrationPlatform.KLAVIYO,
    },
  ];

  for (const kpi of kpiDefs) {
    const existing = await prisma.customMetricDefinition.findFirst({
      where: { tenantId: AGENCY_ID, name: kpi.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.customMetricDefinition.create({
        data: {
          tenantId: AGENCY_ID,
          name: kpi.name,
          formula: kpi.formula,
          variableKeys: kpi.variableKeys,
          platform: kpi.platform,
          isActive: true,
          createdById: OWNER_ID,
        },
      });
    }
  }

  console.log('✅ Custom KPI definitions created');

  // ── 14. Notifications ─────────────────────────────────────────────────────────

  const notifs = [
    { type: 'ALERT_FIRED', title: 'Alert: Google Ads CPC Exceeded $2.50', message: 'Google Ads CPC reached $2.74 for Test Client 1 Paid Media campaign — above your $2.50 threshold.', resourceType: 'alert', isRead: false, daysAgo: 3 },
    { type: 'REPORT_GENERATED', title: 'Report Ready: May 2025 SEO Summary', message: 'The May 2025 Monthly SEO Summary for Test Client 1 has been generated and is ready to share.', resourceType: 'report', isRead: true, daysAgo: 5 },
    { type: 'REPORT_DELIVERED', title: 'Report Delivered to Client', message: 'April 2025 Performance Report for Northstar Fitness was emailed to 2 recipients successfully.', resourceType: 'report', isRead: true, daysAgo: 7 },
    { type: 'ALERT_FIRED', title: 'Alert: Northstar Google ROAS Below 4.0x', message: 'Northstar Fitness Q2 campaign ROAS dropped to 3.82x — below the 4.0x critical threshold.', resourceType: 'alert', isRead: false, daysAgo: 10 },
    { type: 'SYNC_SUCCESS', title: 'Sync Complete: Velo Commerce — Shopify', message: 'Shopify metrics synced successfully for Velo Commerce. 88 new data points updated.', resourceType: 'integration', isRead: true, daysAgo: 1 },
    { type: 'SYNC_ERROR', title: 'Sync Failed: Maple Ridge — CallRail', message: 'CallRail sync failed for Maple Ridge Dental. API rate limit exceeded. Auto-retrying in 6 hours.', resourceType: 'integration', isRead: false, daysAgo: 2 },
    { type: 'TEAM_INVITE_ACCEPTED', title: 'Mia Torres Accepted Invite', message: 'Mia Torres (mia.torres@qodet.com) accepted her invitation and joined as Agency Staff.', resourceType: 'user', isRead: true, daysAgo: 20 },
    { type: 'REPORT_GENERATED', title: 'Report Ready: May 2025 — Velo Commerce', message: 'The May 2025 Revenue Performance Report for Velo Commerce has been generated with AI summary.', resourceType: 'report', isRead: false, daysAgo: 2 },
    { type: 'ALERT_FIRED', title: 'Alert: Maple Ridge Call Volume Below 15', message: 'Daily call volume for Maple Ridge Dental dropped to 11 calls — below the 15-call threshold.', resourceType: 'alert', isRead: true, daysAgo: 6 },
    { type: 'GOAL_ACHIEVED', title: 'Goal Reached: Northstar Email Open Rate', message: 'Northstar Fitness achieved a 30.4% email open rate this month — meeting the 30% monthly goal!', resourceType: 'goal', isRead: false, daysAgo: 4 },
    { type: 'SYNC_SUCCESS', title: 'Sync Complete: Northstar — Meta Ads', message: 'Meta Ads metrics synced for Northstar Fitness. ROAS this week: 6.1x.', resourceType: 'integration', isRead: true, daysAgo: 1 },
    { type: 'BILLING_PAYMENT', title: 'Invoice Paid — May 2025', message: 'Your May 2025 invoice of $299.00 was paid successfully. Next billing: June 1, 2025.', resourceType: 'billing', isRead: true, daysAgo: 4 },
  ];

  for (const n of notifs) {
    const count = await prisma.notification.count({
      where: { tenantId: AGENCY_ID, userId: OWNER_ID, title: n.title },
    });
    if (count === 0) {
      await prisma.notification.create({
        data: {
          tenantId: AGENCY_ID,
          userId: OWNER_ID,
          type: n.type,
          title: n.title,
          message: n.message,
          resourceType: n.resourceType,
          isRead: n.isRead,
          readAt: n.isRead ? daysAgo(n.daysAgo - 1) : null,
          createdAt: daysAgo(n.daysAgo),
        },
      });
    }
  }

  console.log('✅ Notifications created');

  // ── 15. Audit Log ─────────────────────────────────────────────────────────────

  const auditEvents = [
    { action: 'LOGIN', resourceType: 'user', resourceName: 'kishan@qodet.com', daysAgo: 0, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'CREATE', resourceType: 'report', resourceName: 'May 2025 — Monthly SEO Summary', daysAgo: 5, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'GENERATE_PDF', resourceType: 'report', resourceName: 'May 2025 — Monthly SEO Summary', daysAgo: 5, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'SHARE_LINK_CREATED', resourceType: 'report', resourceName: 'May 2025 — Monthly SEO Summary', daysAgo: 5, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'CREATE', resourceType: 'alert', resourceName: 'Google Ads CPC Exceeds $2.50', daysAgo: 8, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'UPDATE', resourceType: 'campaign', resourceName: 'Q2 2025 — Organic Growth', daysAgo: 10, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'CREATE', resourceType: 'client', resourceName: 'Velo Commerce', daysAgo: 12, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'INVITE_SENT', resourceType: 'user', resourceName: 'mia.torres@qodet.com', daysAgo: 22, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'INVITE_ACCEPTED', resourceType: 'user', resourceName: 'mia.torres@qodet.com', daysAgo: 20, userId: staffUser2.id, userEmail: 'mia.torres@qodet.com' },
    { action: 'CONNECT_INTEGRATION', resourceType: 'integration', resourceName: 'SHOPIFY — Velo Commerce', daysAgo: 14, userId: staffUser2.id, userEmail: 'mia.torres@qodet.com' },
    { action: 'CONNECT_INTEGRATION', resourceType: 'integration', resourceName: 'KLAVIYO — Velo Commerce', daysAgo: 14, userId: staffUser2.id, userEmail: 'mia.torres@qodet.com' },
    { action: 'CREATE', resourceType: 'dashboard', resourceName: 'Ecommerce & Ads Overview', daysAgo: 13, userId: staffUser2.id, userEmail: 'mia.torres@qodet.com' },
    { action: 'CREATE', resourceType: 'goal', resourceName: 'Hit $900,000 Quarterly Revenue via Shopify', daysAgo: 12, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'UPDATE_BRANDING', resourceType: 'agency', resourceName: 'Qodet Agency Co', daysAgo: 30, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'LOGIN', resourceType: 'user', resourceName: 'sarah.chen@qodet.com', daysAgo: 1, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'LOGIN', resourceType: 'user', resourceName: 'james.patel@qodet.com', daysAgo: 2, userId: staffUser1.id, userEmail: 'james.patel@qodet.com' },
    { action: 'CREATE', resourceType: 'campaign', resourceName: 'Email & Retention Q2', daysAgo: 15, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'REPORT_DELIVERED', resourceType: 'report', resourceName: 'April 2025 — Campaign Performance', daysAgo: 33, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'CREATE', resourceType: 'custom_kpi', resourceName: 'Blended ROAS', daysAgo: 18, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'UPDATE', resourceType: 'alert', resourceName: 'Google Ads ROAS Falls Below 3.5x', daysAgo: 9, userId: adminUser.id, userEmail: 'sarah.chen@qodet.com' },
    { action: 'ASSIGN_STAFF', resourceType: 'client', resourceName: 'Northstar Fitness & Wellness', daysAgo: 25, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'CLIENT_USER_INVITED', resourceType: 'client', resourceName: 'Northstar Fitness & Wellness', daysAgo: 16, userId: OWNER_ID, userEmail: 'kishan@qodet.com' },
    { action: 'LOGIN', resourceType: 'user', resourceName: 'cmo@northstarfitness.com', daysAgo: 0, userId: clientPortalUser.id, userEmail: 'cmo@northstarfitness.com' },
  ];

  for (const e of auditEvents) {
    const count = await prisma.auditLog.count({
      where: { tenantId: AGENCY_ID, action: e.action, resourceName: e.resourceName },
    });
    if (count === 0) {
      await prisma.auditLog.create({
        data: {
          tenantId: AGENCY_ID,
          userId: e.userId,
          userEmail: e.userEmail,
          action: e.action,
          resourceType: e.resourceType,
          resourceName: e.resourceName,
          ipAddress: '102.88.44.21',
          createdAt: daysAgo(e.daysAgo),
        },
      });
    }
  }

  console.log('✅ Audit log entries created');

  // ── 16. AI Conversations ──────────────────────────────────────────────────────

  async function ensureConversation(userId: string, campaignId: string | null, scope: string, title: string, messages: { role: string; content: string }[]) {
    const existing = await prisma.aiConversation.findFirst({
      where: { tenantId: AGENCY_ID, userId, title, deletedAt: null },
    });
    if (existing) return;

    // Use raw SQL — Prisma client predates the scope column migration
    const convRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO ai_conversations (tenant_id, user_id, campaign_id, scope, title, message_count, created_at, updated_at)
      VALUES (
        ${AGENCY_ID}::uuid,
        ${userId}::uuid,
        ${campaignId}::uuid,
        ${scope},
        ${title},
        ${messages.length},
        ${daysAgo(5)},
        ${daysAgo(1)}
      )
      RETURNING id
    `;
    const convId = convRows[0].id;

    for (const m of messages) {
      await prisma.aiMessage.create({
        data: {
          tenantId: AGENCY_ID,
          conversationId: convId,
          role: m.role,
          content: m.content,
          tokenCount: Math.floor(m.content.length / 4),
        },
      });
    }
  }

  await ensureConversation(OWNER_ID, CAMPAIGN_TEST_ID, 'CAMPAIGN', 'May SEO Performance Analysis', [
    { role: 'user', content: 'Give me a summary of SEO performance for the last 30 days and highlight any anomalies.' },
    { role: 'assistant', content: `## SEO Performance Summary — Last 30 Days

**Overall Trend: Positive ↑**

Organic search performance showed steady improvement over the past 30 days, with sessions up **12.4%** compared to the previous period.

### Key Metrics
| Metric | This Period | Prev Period | Change |
|--------|------------|-------------|--------|
| Organic Sessions | 43,820 | 38,980 | +12.4% ↑ |
| GSC Clicks | 18,640 | 16,200 | +15.1% ↑ |
| Avg. Position | 13.8 | 14.9 | +1.1 ↑ |
| CTR | 2.81% | 2.64% | +0.17pp ↑ |

### Notable Anomaly
There was a **14% traffic dip on May 19–21** coinciding with the client's product launch week when blog publishing was paused. This is expected and documented in the campaign notes. Traffic recovered fully by May 24.

### Opportunities
1. The /pricing page improved from position 18 → 11 after the title tag update — consider replicating on /features and /integrations pages.
2. Core Web Vitals improvement (LCP from 3.8s → 2.4s) should yield ranking benefits in the next 4–6 weeks.

Overall trajectory is strong — on pace to hit the 50,000 monthly sessions goal by end of June.` },
    { role: 'user', content: 'Can you generate a PDF report for this month?' },
    { role: 'assistant', content: `I'll generate a PDF report for May 2025 now.\n\n✅ **Report generated successfully!**\n\n**May 2025 — Monthly SEO Summary**\n📄 [Download PDF](https://storage.qodet.com/reports/demo-may-2025-seo.pdf)\n\nThe report includes:\n- Executive KPI summary (sessions, GSC clicks, conversions, avg. position)\n- 30-day traffic trend chart\n- Channel breakdown table\n- AI-written executive summary\n- Recommendations for June\n\nYou can also share this report with the client using the share link in the Reports section.` },
  ]);

  await ensureConversation(OWNER_ID, null, 'AGENCY', 'Agency Performance Overview — May 2025', [
    { role: 'user', content: 'Which of our clients had the strongest performance this month and which need attention?' },
    { role: 'assistant', content: `## Agency Performance Overview — May 2025

### 🏆 Top Performers This Month

**1. Velo Commerce — Summer Performance**
- Shopify revenue trending at **$8,820/day** (+18% MoM)
- Google ROAS: **6.4x** (target: 6.0x) ✅
- Meta ROAS: **7.8x** — exceptional creative performance
- Blended ROAS across both channels: **~7.1x**

**2. Northstar Fitness — Summer Membership Push**
- Session growth: **+22% MoM** driven by TikTok and Meta
- Lead form fills: **68/day** average (target: 60) ✅
- TikTok performing ahead of expectations — recommend budget increase

### ⚠️ Needs Attention

**1. Test Client 1 — Paid Media**
- Google CPC spiked to $2.74 on May 12 (alert fired)
- Root cause: increased competitor bidding on branded terms
- Recommended action: Add negative keywords, review bid strategy

**2. Maple Ridge Dental — Patient Acquisition**
- Call volume dropped below threshold twice this month (12 and 11 calls)
- GBP reviews dropped slightly due to 3 negative reviews
- Recommend reputation management conversation with client

### Summary
7 of 8 active campaigns are on track or exceeding targets. Velo Commerce and Northstar Fitness are standouts. Maple Ridge needs proactive account management this week.` },
  ]);

  console.log('✅ AI conversations created');

  // ── Done ──────────────────────────────────────────────────────────────────────
  console.log('\n🎉 MEETING SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Agency:     Qodet Agency Co');
  console.log('Login:      kishan@qodet.com  /  (existing password)');
  console.log('');
  console.log('Team:');
  console.log('  Admin:    sarah.chen@qodet.com   / Password123!');
  console.log('  Staff:    james.patel@qodet.com  / Password123!');
  console.log('  Staff:    mia.torres@qodet.com   / Password123!');
  console.log('  Portal:   cmo@northstarfitness.com / Password123!');
  console.log('');
  console.log('Clients (4 total):');
  console.log('  • Test Client 1       — 2 campaigns (SEO, Paid)');
  console.log('  • Northstar Fitness   — 2 campaigns (Brand Q2, Summer Push)');
  console.log('  • Maple Ridge Dental  — 2 campaigns (Acquisition, Implants)');
  console.log('  • Velo Commerce       — 2 campaigns (Performance, Email)');
  console.log('');
  console.log('Data seeded per campaign:');
  console.log('  ✅ 90 days of realistic metric data (4–8 platforms each)');
  console.log('  ✅ Dashboards with 7–9 widgets each');
  console.log('  ✅ 2–3 reports (published w/ AI summary + draft)');
  console.log('  ✅ Monthly report schedules + 3 delivery records each');
  console.log('  ✅ Public share links for all published reports');
  console.log('  ✅ 2–4 goals per campaign (various statuses)');
  console.log('  ✅ 3–4 alerts with historical events');
  console.log('  ✅ 3–4 campaign notes (1 pinned)');
  console.log('');
  console.log('Agency-wide:');
  console.log('  ✅ 4 custom KPI definitions (Blended ROAS, Blended CPA, etc.)');
  console.log('  ✅ 12 notifications (mixed read/unread)');
  console.log('  ✅ 23 audit log entries');
  console.log('  ✅ 2 AI conversations with full message history');
  console.log('═══════════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
