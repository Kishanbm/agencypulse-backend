/**
 * Unit tests — MetricsController
 *
 * Covers:
 *   Area 6:  Multi-tenant isolation — controller rejects wrong-tenant campaign
 *   Area 8:  Query API — GET /metrics and GET /metrics/definitions/:platform
 *   Area 10: Soft delete — deleted campaign/client returns 404, no data leaked
 *
 * MetricsService and PrismaService are directly mocked (no NestJS DI overhead).
 */

import { NotFoundException } from '@nestjs/common';
import { IntegrationPlatform, UserRole } from '@prisma/client';
import { MetricsController } from '../metrics.controller';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const TENANT_B = '00000000-0000-4000-8000-000000000002';
const CAMPAIGN_1 = '00000000-0000-4000-8000-000000000010';
const CAMPAIGN_B = '00000000-0000-4000-8000-000000000020';

// ─── Mock factories ──────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    tenantId: TENANT_A,
    email: 'admin@acme.com',
    role: UserRole.AGENCY_ADMIN,
    ...overrides,
  } as AuthenticatedUser;
}

function makeMetricsServiceMock() {
  return {
    getMetrics: jest.fn().mockResolvedValue([]),
    getMetricDefinitions: jest.fn().mockResolvedValue([]),
  };
}

function makePrismaMock(campaignFound = true) {
  return {
    campaign: {
      findFirst: jest.fn().mockResolvedValue(campaignFound ? { id: CAMPAIGN_1 } : null),
    },
  };
}

const BASE_QUERY = {
  campaignId: CAMPAIGN_1,
  platform: IntegrationPlatform.GA4,
  from: '2024-01-01',
  to: '2024-01-31',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: ReturnType<typeof makeMetricsServiceMock>;
  let prisma: ReturnType<typeof makePrismaMock>;

  function buildController(campaignFound = true): void {
    prisma = makePrismaMock(campaignFound);
    metricsService = makeMetricsServiceMock();
    controller = new MetricsController(metricsService as any, prisma as any);
  }

  beforeEach(() => {
    buildController(true);
  });

  // ─── Area 8: GET /metrics ────────────────────────────────────────────────

  describe('GET /metrics — Area 8: Query API', () => {
    it('calls metricsService.getMetrics with correct tenantId, campaignId, platform, dates', async () => {
      await controller.getMetrics(makeUser(), BASE_QUERY as any);

      expect(metricsService.getMetrics).toHaveBeenCalledWith(
        TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, '2024-01-01', '2024-01-31',
        undefined, 'day', 'sum',
      );
    });

    it('parses comma-separated metrics query param into array', async () => {
      await controller.getMetrics(makeUser(), { ...BASE_QUERY, metrics: 'sessions,totalUsers,newUsers' } as any);

      expect(metricsService.getMetrics).toHaveBeenCalledWith(
        TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, '2024-01-01', '2024-01-31',
        ['sessions', 'totalUsers', 'newUsers'], 'day', 'sum',
      );
    });

    it('trims whitespace from each metric key', async () => {
      await controller.getMetrics(makeUser(), { ...BASE_QUERY, metrics: ' sessions , totalUsers ' } as any);

      const metricKeys = metricsService.getMetrics.mock.calls[0][5];
      expect(metricKeys).toEqual(['sessions', 'totalUsers']);
    });

    it('passes undefined metricKeys when metrics param omitted', async () => {
      await controller.getMetrics(makeUser(), BASE_QUERY as any);

      expect(metricsService.getMetrics.mock.calls[0][5]).toBeUndefined();
    });

    it('filters empty strings from metrics param (trailing comma)', async () => {
      await controller.getMetrics(makeUser(), { ...BASE_QUERY, metrics: 'sessions,' } as any);

      const metricKeys = metricsService.getMetrics.mock.calls[0][5];
      expect(metricKeys).toEqual(['sessions']);
    });

    it('returns data from metricsService', async () => {
      const mockData = [{ metricKey: 'sessions', value: '1000', recordedAt: new Date('2024-01-15'), dimensionKey: null, dimensionVal: null }];
      metricsService.getMetrics.mockResolvedValueOnce(mockData);

      const result = await controller.getMetrics(makeUser(), BASE_QUERY as any);

      expect(result).toEqual(mockData);
    });
  });

  // ─── Area 6: Multi-tenant isolation ─────────────────────────────────────

  describe('Area 6 — Multi-tenant isolation via campaign access check', () => {
    it('throws 404 when campaign not found (cross-tenant attempt)', async () => {
      buildController(false); // prisma.campaign.findFirst returns null

      await expect(
        controller.getMetrics(makeUser(), { ...BASE_QUERY, campaignId: CAMPAIGN_B } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('does NOT call metricsService.getMetrics when access check fails', async () => {
      buildController(false);

      await controller.getMetrics(makeUser(), BASE_QUERY as any).catch(() => {});

      expect(metricsService.getMetrics).not.toHaveBeenCalled();
    });

    it('access check WHERE clause includes tenantId from the authenticated user', async () => {
      await controller.getMetrics(makeUser(), BASE_QUERY as any);

      const whereClause = prisma.campaign.findFirst.mock.calls[0][0].where;
      expect(whereClause.tenantId).toBe(TENANT_A);
    });

    it('AGENCY_STAFF access check filters by staffAssignments', async () => {
      const staffUser = makeUser({ role: UserRole.AGENCY_STAFF });

      await controller.getMetrics(staffUser, BASE_QUERY as any).catch(() => {});

      const whereClause = prisma.campaign.findFirst.mock.calls[0][0].where;
      expect(JSON.stringify(whereClause)).toContain('staffAssignments');
    });

    it('CLIENT_USER access check filters by clientUserAssignments', async () => {
      const clientUser = makeUser({ role: UserRole.CLIENT_USER });

      await controller.getMetrics(clientUser, BASE_QUERY as any).catch(() => {});

      const whereClause = prisma.campaign.findFirst.mock.calls[0][0].where;
      expect(JSON.stringify(whereClause)).toContain('clientUserAssignments');
    });
  });

  // ─── Area 10: Soft delete behavior ──────────────────────────────────────

  describe('Area 10 — Soft delete behavior', () => {
    it('throws 404 when campaign is soft-deleted (access check returns null)', async () => {
      buildController(false); // soft-deleted campaign → prisma returns null

      await expect(
        controller.getMetrics(makeUser(), BASE_QUERY as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('access check WHERE includes deletedAt: null for campaign', async () => {
      await controller.getMetrics(makeUser(), BASE_QUERY as any);

      const whereClause = prisma.campaign.findFirst.mock.calls[0][0].where;
      expect(whereClause.deletedAt).toBeNull();
    });

    it('access check WHERE includes deletedAt guard for client (nested)', async () => {
      await controller.getMetrics(makeUser(), BASE_QUERY as any);

      const whereClause = prisma.campaign.findFirst.mock.calls[0][0].where;
      // client soft-delete guard must appear somewhere in the nested client filter
      expect(JSON.stringify(whereClause)).toContain('deletedAt');
    });

    it('metricsService.getMetrics not called for soft-deleted campaign', async () => {
      buildController(false);

      await controller.getMetrics(makeUser(), BASE_QUERY as any).catch(() => {});

      expect(metricsService.getMetrics).not.toHaveBeenCalled();
    });
  });

  // ─── Area 8: GET /metrics/definitions/:platform ──────────────────────────

  describe('GET /metrics/definitions/:platform — Area 8: Definitions endpoint', () => {
    it('calls getMetricDefinitions with correct platform for GA4', async () => {
      metricsService.getMetricDefinitions.mockResolvedValueOnce([{ platform: 'GA4', metricKey: 'sessions' }]);

      const result = await controller.getDefinitions(IntegrationPlatform.GA4);

      expect(metricsService.getMetricDefinitions).toHaveBeenCalledWith(IntegrationPlatform.GA4);
      expect(result).toHaveLength(1);
    });

    it('calls getMetricDefinitions with GOOGLE_ADS platform', async () => {
      await controller.getDefinitions(IntegrationPlatform.GOOGLE_ADS);

      expect(metricsService.getMetricDefinitions).toHaveBeenCalledWith(IntegrationPlatform.GOOGLE_ADS);
    });

    it('calls getMetricDefinitions with META_ADS platform', async () => {
      await controller.getDefinitions(IntegrationPlatform.META_ADS);

      expect(metricsService.getMetricDefinitions).toHaveBeenCalledWith(IntegrationPlatform.META_ADS);
    });

    it('returns whatever the service returns', async () => {
      const defs = [
        { platform: 'GOOGLE_ADS', metricKey: 'clicks', label: 'Clicks', category: 'traffic', dataType: 'integer', unit: 'count' },
        { platform: 'GOOGLE_ADS', metricKey: 'cost', label: 'Cost', category: 'cost', dataType: 'currency', unit: 'USD' },
      ];
      metricsService.getMetricDefinitions.mockResolvedValueOnce(defs);

      const result = await controller.getDefinitions(IntegrationPlatform.GOOGLE_ADS);

      expect(result).toEqual(defs);
    });
  });
});
