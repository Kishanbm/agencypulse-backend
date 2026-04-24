/**
 * Unit tests — DashboardsService
 *
 * Covers:
 *   Area 11: Dashboard CRUD — create, findAll, findOne, update, softDelete
 *   Area 12: Default dashboard constraint — only one default per campaign
 *   Area 13: Widget CRUD — add, update, remove widgets
 *   Area 14: Metric keys validation — valid/invalid keys, platform consistency
 *   Area 15: Campaign consistency — cross-campaign widget creation fails
 *   Area 16: Batch widget data — single call returns all widgets, KPI vs chart types
 *   Area 17: Comparison logic — previous_period and previous_year calculations
 *   Area 18: Multi-tenant isolation — different tenants see different dashboards
 *   Area 19: Soft delete behavior — deleted dashboards/widgets excluded from queries
 *   Area 20: Edge cases — empty metrics, invalid dates, missing resources
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole, WidgetType, IntegrationPlatform } from '@prisma/client';
import { DashboardsService } from '../dashboards.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MetricsService } from '../../metrics/metrics.service';

// ─── Test Constants ──────────────────────────────────────────────────────────

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const TENANT_B = '00000000-0000-4000-8000-000000000002';
const CAMPAIGN_A = '00000000-0000-4000-8000-000000000010';
const CAMPAIGN_B = '00000000-0000-4000-8000-000000000020';
const DASHBOARD_A = '00000000-0000-4000-8000-000000000030';
const DASHBOARD_B = '00000000-0000-4000-8000-000000000031';
const WIDGET_A = '00000000-0000-4000-8000-000000000040';
const WIDGET_B = '00000000-0000-4000-8000-000000000041';

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

function makePrismaMock() {
  return {
    campaign: {
      findFirst: jest.fn(),
    },
    dashboard: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    dashboardWidget: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    metricDefinition: {
      findMany: jest.fn(),
    },
  };
}

function makeMetricsServiceMock() {
  return {
    getMetricSummary: jest.fn(),
    getMetrics: jest.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DashboardsService', () => {
  let service: DashboardsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let metricsService: ReturnType<typeof makeMetricsServiceMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrismaMock();
    metricsService = makeMetricsServiceMock();
    service = new DashboardsService(prisma as any, metricsService as any);

    // Default campaign access check to pass
    prisma.campaign.findFirst.mockResolvedValue({ id: CAMPAIGN_A });
  });

  // ─── Area 11: Dashboard CRUD ──────────────────────────────────────────────

  describe('Area 11 — Dashboard CRUD', () => {
    describe('create', () => {
      it('creates dashboard with tenantId and campaignId from user', async () => {
        const now = new Date();
        prisma.dashboard.create.mockResolvedValueOnce({
          id: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          name: 'My Dashboard',
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        });

        const result = await service.create(
          makeUser(),
          CAMPAIGN_A,
          { name: 'My Dashboard' }
        );

        expect(prisma.dashboard.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            campaignId: CAMPAIGN_A,
            name: 'My Dashboard',
            isDefault: false,
          }),
          select: expect.any(Object),
        });
        expect(result.id).toBe(DASHBOARD_A);
      });

      it('sets isDefault to false by default', async () => {
        prisma.dashboard.create.mockResolvedValueOnce({
          id: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          name: 'Dashboard',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await service.create(makeUser(), CAMPAIGN_A, { name: 'Dashboard' });

        const call = prisma.dashboard.create.mock.calls[0][0];
        expect(call.data.isDefault).toBe(false);
      });

      it('clears other defaults when creating new default dashboard', async () => {
        prisma.dashboard.create.mockResolvedValueOnce({
          id: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          name: 'Default Dashboard',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        prisma.dashboard.updateMany.mockResolvedValueOnce({ count: 1 });

        await service.create(
          makeUser(),
          CAMPAIGN_A,
          { name: 'Default Dashboard', isDefault: true }
        );

        expect(prisma.dashboard.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: TENANT_A,
            campaignId: CAMPAIGN_A,
            isDefault: true,
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      });

      it('throws 404 when campaign not found (access check)', async () => {
        prisma.campaign.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.create(makeUser(), CAMPAIGN_B, { name: 'Dashboard' })
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('findAll', () => {
      it('returns list of non-deleted dashboards ordered by isDefault desc, createdAt asc', async () => {
        const now = new Date();
        const dashboards = [
          { id: DASHBOARD_A, campaignId: CAMPAIGN_A, tenantId: TENANT_A, name: 'Default', isDefault: true, createdAt: now, updatedAt: now, _count: { widgets: 2 } },
          { id: DASHBOARD_B, campaignId: CAMPAIGN_A, tenantId: TENANT_A, name: 'Secondary', isDefault: false, createdAt: new Date(now.getTime() + 1000), updatedAt: new Date(), _count: { widgets: 0 } },
        ];
        prisma.dashboard.findMany.mockResolvedValueOnce(dashboards);

        const result = await service.findAll(makeUser(), CAMPAIGN_A);

        expect(prisma.dashboard.findMany).toHaveBeenCalledWith({
          where: { tenantId: TENANT_A, campaignId: CAMPAIGN_A, deletedAt: null },
          select: expect.any(Object),
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        });
        expect(result).toEqual(dashboards);
      });

      it('excludes deleted dashboards (deletedAt: null check)', async () => {
        prisma.dashboard.findMany.mockResolvedValueOnce([]);

        await service.findAll(makeUser(), CAMPAIGN_A);

        const where = prisma.dashboard.findMany.mock.calls[0][0].where;
        expect(where.deletedAt).toBeNull();
      });

      it('enforces tenant isolation', async () => {
        prisma.dashboard.findMany.mockResolvedValueOnce([]);

        await service.findAll(makeUser({ tenantId: TENANT_B }), CAMPAIGN_A);

        const where = prisma.dashboard.findMany.mock.calls[0][0].where;
        expect(where.tenantId).toBe(TENANT_B);
      });

      it('throws 404 when campaign not found', async () => {
        prisma.campaign.findFirst.mockResolvedValueOnce(null);

        await expect(service.findAll(makeUser(), CAMPAIGN_B)).rejects.toThrow(NotFoundException);
      });
    });

    describe('findOne', () => {
      it('returns dashboard with non-deleted widgets', async () => {
        const now = new Date();
        const dashboard = {
          id: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          name: 'Dashboard',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
          widgets: [
            { id: WIDGET_A, dashboardId: DASHBOARD_A, campaignId: CAMPAIGN_A, widgetType: WidgetType.KPI, platform: IntegrationPlatform.GA4, metricKeys: ['sessions'], config: {}, position: {}, createdAt: now, updatedAt: now },
          ],
        };
        prisma.dashboard.findFirst.mockResolvedValueOnce(dashboard);

        const result = await service.findOne(makeUser(), CAMPAIGN_A, DASHBOARD_A);

        expect(prisma.dashboard.findFirst).toHaveBeenCalledWith({
          where: {
            id: DASHBOARD_A,
            campaignId: CAMPAIGN_A,
            tenantId: TENANT_A,
            deletedAt: null,
          },
          select: expect.objectContaining({ widgets: expect.any(Object) }),
        });
        expect(result.id).toBe(DASHBOARD_A);
        expect(result.widgets).toHaveLength(1);
      });

      it('throws 404 when dashboard not found', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce(null);

        await expect(service.findOne(makeUser(), CAMPAIGN_A, DASHBOARD_A)).rejects.toThrow(NotFoundException);
      });

      it('throws 404 for soft-deleted dashboard', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce(null); // deletedAt: null filter excludes it

        await expect(service.findOne(makeUser(), CAMPAIGN_A, DASHBOARD_A)).rejects.toThrow(NotFoundException);
      });
    });

    describe('update', () => {
      it('updates name and isDefault fields', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboard.update.mockResolvedValueOnce({
          id: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          name: 'Updated',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await service.update(makeUser(), CAMPAIGN_A, DASHBOARD_A, { name: 'Updated', isDefault: true });

        expect(prisma.dashboard.update).toHaveBeenCalledWith({
          where: { id: DASHBOARD_A },
          data: expect.objectContaining({
            name: 'Updated',
            isDefault: true,
          }),
          select: expect.any(Object),
        });
      });

      it('clears other defaults when setting isDefault to true', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboard.updateMany.mockResolvedValueOnce({ count: 1 });
        prisma.dashboard.update.mockResolvedValueOnce({
          id: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          name: 'Dashboard',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await service.update(makeUser(), CAMPAIGN_A, DASHBOARD_A, { isDefault: true });

        expect(prisma.dashboard.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ isDefault: true }) })
        );
      });

      it('throws 404 when dashboard not found', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.update(makeUser(), CAMPAIGN_A, DASHBOARD_A, { name: 'Updated' })
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('softDelete', () => {
      it('sets deletedAt timestamp', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboard.update.mockResolvedValueOnce({ id: DASHBOARD_A });

        await service.softDelete(makeUser(), CAMPAIGN_A, DASHBOARD_A);

        expect(prisma.dashboard.update).toHaveBeenCalledWith({
          where: { id: DASHBOARD_A },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        });
      });

      it('throws 404 when dashboard not found or already deleted', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce(null);

        await expect(service.softDelete(makeUser(), CAMPAIGN_A, DASHBOARD_A)).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ─── Area 13: Widget CRUD ──────────────────────────────────────────────────

  describe('Area 13 — Widget CRUD', () => {
    describe('addWidget', () => {
      const validPosition = { x: 0, y: 0, w: 3, h: 2 };
      const validConfig = { title: 'Sessions', aggregation: 'sum' as const };

      it('creates widget with tenantId, dashboardId, campaignId', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.metricDefinition.findMany.mockResolvedValueOnce([
          { metricKey: 'sessions' },
        ]);
        prisma.dashboardWidget.create.mockResolvedValueOnce({
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { title: 'Sessions', aggregation: 'sum' },
          position: validPosition,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: validConfig,
          position: validPosition,
        });

        expect(prisma.dashboardWidget.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tenantId: TENANT_A,
              dashboardId: DASHBOARD_A,
              campaignId: CAMPAIGN_A,
            }),
          })
        );
      });

      it('validates metric keys against metric_definitions', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.metricDefinition.findMany.mockResolvedValueOnce([
          { metricKey: 'sessions' },
        ]);

        await service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: validConfig,
          position: validPosition,
        });

        expect(prisma.metricDefinition.findMany).toHaveBeenCalledWith({
          where: {
            platform: IntegrationPlatform.GA4,
            metricKey: { in: ['sessions'] },
          },
          select: { metricKey: true },
        });
      });

      it('throws BadRequestException for invalid metric keys', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.metricDefinition.findMany.mockResolvedValueOnce([]); // no matching definitions

        await expect(
          service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
            widgetType: WidgetType.KPI,
            platform: IntegrationPlatform.GA4,
            metricKeys: ['invalid_metric'],
            config: validConfig,
            position: validPosition,
          })
        ).rejects.toThrow(BadRequestException);
      });

      it('throws 404 when dashboard not found', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
            widgetType: WidgetType.KPI,
            metricKeys: ['sessions'],
            config: validConfig,
            position: validPosition,
          })
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('updateWidget', () => {
      it('updates widget config, metrics, or platform', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboardWidget.findFirst.mockResolvedValueOnce({
          id: WIDGET_A,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
        });
        prisma.metricDefinition.findMany.mockResolvedValueOnce([
          { metricKey: 'users' },
        ]);
        prisma.dashboardWidget.update.mockResolvedValueOnce({
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['users'],
          config: { title: 'Users', aggregation: 'sum' },
          position: { x: 0, y: 0, w: 3, h: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await service.updateWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, WIDGET_A, {
          metricKeys: ['users'],
          config: { title: 'Users', aggregation: 'sum' },
        });

        expect(prisma.dashboardWidget.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              metricKeys: ['users'],
              config: expect.objectContaining({ title: 'Users' }),
            }),
          })
        );
      });

      it('throws 404 when widget not found', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboardWidget.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.updateWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, WIDGET_A, {})
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('removeWidget', () => {
      it('soft deletes widget (sets deletedAt)', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboardWidget.findFirst.mockResolvedValueOnce({ id: WIDGET_A });
        prisma.dashboardWidget.update.mockResolvedValueOnce({ id: WIDGET_A });

        await service.removeWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, WIDGET_A);

        expect(prisma.dashboardWidget.update).toHaveBeenCalledWith({
          where: { id: WIDGET_A },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        });
      });

      it('throws 404 when widget not found', async () => {
        prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
        prisma.dashboardWidget.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.removeWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, WIDGET_A)
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ─── Area 16: Batch widget data ────────────────────────────────────────────

  describe('Area 16 — Batch widget data', () => {
    it('fetches data for multiple widgets in single call', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { aggregation: 'sum' },
          position: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      metricsService.getMetricSummary.mockResolvedValueOnce({ sessions: 1000 });

      const result = await service.getBatchWidgetData(
        user,
        CAMPAIGN_A,
        DASHBOARD_A,
        {
          widgetIds: [WIDGET_A],
          from: '2024-01-01',
          to: '2024-01-31',
        }
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].widgetId).toBe(WIDGET_A);
    });

    it('returns KPI widget data as summary with current period', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { title: 'Sessions', aggregation: 'sum', comparison: 'none' },
          position: { x: 0, y: 0, w: 3, h: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const summary = { sessions: 1000 };
      metricsService.getMetricSummary.mockResolvedValueOnce(summary);

      const result = await service.getBatchWidgetData(
        user,
        CAMPAIGN_A,
        DASHBOARD_A,
        { widgetIds: [WIDGET_A], from: '2024-01-01', to: '2024-01-31' }
      );

      expect(result.results[0].data).toEqual({ current: summary });
    });

    it('includes previous comparison period when requested', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { title: 'Sessions', aggregation: 'sum', comparison: 'previous_period' },
          position: { x: 0, y: 0, w: 3, h: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      metricsService.getMetricSummary
        .mockResolvedValueOnce({ sessions: 1000 })
        .mockResolvedValueOnce({ sessions: 800 });

      const result = await service.getBatchWidgetData(
        user,
        CAMPAIGN_A,
        DASHBOARD_A,
        { widgetIds: [WIDGET_A], from: '2024-01-01', to: '2024-01-31' }
      );

      expect(metricsService.getMetricSummary).toHaveBeenCalledTimes(2);
      expect(result.results[0].data).toEqual({ current: { sessions: 1000 }, previous: { sessions: 800 } });
    });

    it('returns chart/table widget data as time-series', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.LINE_CHART,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { aggregation: 'sum' },
          position: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const timeSeries = [
        { period: '2024-01-01', metrics: { sessions: 100 } },
        { period: '2024-01-02', metrics: { sessions: 120 } },
      ];
      metricsService.getMetrics.mockResolvedValueOnce(timeSeries);

      const result = await service.getBatchWidgetData(
        user,
        CAMPAIGN_A,
        DASHBOARD_A,
        { widgetIds: [WIDGET_A], from: '2024-01-01', to: '2024-01-31' }
      );

      expect(result.results[0].data).toEqual(timeSeries);
    });

    it('throws 404 for missing widgets in batch request', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([]); // empty result

      await expect(
        service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
          widgetIds: [WIDGET_A, WIDGET_B],
          from: '2024-01-01',
          to: '2024-01-31',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid date range (from >= to)', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });

      await expect(
        service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
          widgetIds: [WIDGET_A],
          from: '2024-01-31',
          to: '2024-01-01', // to < from
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Area 17: Comparison logic ──────────────────────────────────────────────

  describe('Area 17 — Comparison logic', () => {
    it('shifts period back by same duration for previous_period', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { aggregation: 'sum', comparison: 'previous_period' },
          position: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      metricsService.getMetricSummary
        .mockResolvedValueOnce({ sessions: 1000 })
        .mockResolvedValueOnce({ sessions: 800 });

      await service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [WIDGET_A],
        from: '2024-01-15',
        to: '2024-01-31', // 16 days
      });

      const secondCall = metricsService.getMetricSummary.mock.calls[1];
      const [, , , cFrom, cTo] = secondCall;
      // Verify dates shifted back
      expect(new Date(cFrom) < new Date('2024-01-15')).toBe(true);
      expect(new Date(cTo) < new Date('2024-01-31')).toBe(true);
    });

    it('shifts year back by 1 year for previous_year', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { aggregation: 'sum', comparison: 'previous_year' },
          position: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      metricsService.getMetricSummary
        .mockResolvedValueOnce({ sessions: 1000 })
        .mockResolvedValueOnce({ sessions: 900 });

      await service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [WIDGET_A],
        from: '2024-01-15',
        to: '2024-01-31',
      });

      const secondCall = metricsService.getMetricSummary.mock.calls[1];
      const [, , , cFrom, cTo] = secondCall;
      // Year should be 2023
      expect(cFrom).toContain('2023');
      expect(cTo).toContain('2023');
    });
  });

  // ─── Area 18: Multi-tenant isolation ────────────────────────────────────────

  describe('Area 18 — Multi-tenant isolation', () => {
    it('enforces tenantId in all dashboard queries', async () => {
      const userB = makeUser({ tenantId: TENANT_B });
      prisma.dashboard.findMany.mockResolvedValueOnce([]);

      await service.findAll(userB, CAMPAIGN_A);

      const where = prisma.dashboard.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT_B);
    });

    it('enforces tenantId in batch widget data fetch', async () => {
      const userB = makeUser({ tenantId: TENANT_B });
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([]);

      await service.getBatchWidgetData(userB, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [],
        from: '2024-01-01',
        to: '2024-01-31',
      }).catch(() => {});

      const where = prisma.dashboardWidget.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT_B);
    });
  });

  // ─── Area 19: Soft delete behavior ──────────────────────────────────────────

  describe('Area 19 — Soft delete behavior', () => {
    it('excludes soft-deleted dashboards from findAll (deletedAt: null)', async () => {
      prisma.dashboard.findMany.mockResolvedValueOnce([]);

      await service.findAll(makeUser(), CAMPAIGN_A);

      const where = prisma.dashboard.findMany.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
    });

    it('excludes soft-deleted dashboards from findOne (deletedAt: null)', async () => {
      prisma.dashboard.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(makeUser(), CAMPAIGN_A, DASHBOARD_A)).rejects.toThrow();

      const where = prisma.dashboard.findFirst.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
    });

    it('excludes soft-deleted widgets from widget list in findOne', async () => {
      prisma.dashboard.findFirst.mockResolvedValueOnce({
        id: DASHBOARD_A,
        campaignId: CAMPAIGN_A,
        tenantId: TENANT_A,
        name: 'Dashboard',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        widgets: [],
      });

      await service.findOne(makeUser(), CAMPAIGN_A, DASHBOARD_A);

      const select = prisma.dashboard.findFirst.mock.calls[0][0].select;
      const widgetWhere = select.widgets.where;
      expect(widgetWhere.deletedAt).toBeNull();
    });
  });

  // ─── Area 20: Edge cases ───────────────────────────────────────────────────

  describe('Area 20 — Edge cases', () => {
    it('returns null data when widget has no platform or metricKeys', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: null,
          metricKeys: [],
          config: { title: 'Widget' },
          position: { x: 0, y: 0, w: 3, h: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [WIDGET_A],
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(result.results[0].data).toBeNull();
      expect(metricsService.getMetricSummary).not.toHaveBeenCalled();
    });

    it('returns null data when metrics fetch fails, but continues for other widgets', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { title: 'Sessions', aggregation: 'sum' },
          position: { x: 0, y: 0, w: 3, h: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      metricsService.getMetricSummary.mockRejectedValueOnce(new Error('Service down'));

      const result = await service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [WIDGET_A],
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(result.results[0].data).toBeNull();
    });

    it('defaults aggregation to SUM when undefined', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([
        {
          id: WIDGET_A,
          dashboardId: DASHBOARD_A,
          campaignId: CAMPAIGN_A,
          tenantId: TENANT_A,
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['sessions'],
          config: { title: 'Sessions' }, // no aggregation field
          position: { x: 0, y: 0, w: 3, h: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      metricsService.getMetricSummary.mockResolvedValueOnce({ sessions: 1000 });

      await service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [WIDGET_A],
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(metricsService.getMetricSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        'sum', // defaults to SUM
      );
    });
  });

  // ─── Area 12: Default dashboard constraint ──────────────────────────────────

  describe('Area 12 — Default dashboard constraint', () => {
    it('only one default dashboard per campaign', async () => {
      prisma.dashboard.create.mockResolvedValueOnce({
        id: DASHBOARD_A,
        campaignId: CAMPAIGN_A,
        tenantId: TENANT_A,
        name: 'Default',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.dashboard.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.create(makeUser(), CAMPAIGN_A, { name: 'Default', isDefault: true });

      expect(prisma.dashboard.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignId: CAMPAIGN_A,
            isDefault: true,
          }),
        })
      );
    });
  });

  // ─── Area 14: Metric keys validation ────────────────────────────────────────

  describe('Area 14 — Metric keys validation', () => {
    it('skips validation when platform not provided', async () => {
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.create.mockResolvedValueOnce({
        id: WIDGET_A,
        dashboardId: DASHBOARD_A,
        campaignId: CAMPAIGN_A,
        tenantId: TENANT_A,
        widgetType: WidgetType.KPI,
        platform: null,
        metricKeys: [],
        config: {},
        position: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
        widgetType: WidgetType.KPI,
        metricKeys: [],
        config: { title: 'Test Widget' },
        position: { x: 0, y: 0, w: 3, h: 2 },
      });

      expect(prisma.metricDefinition.findMany).not.toHaveBeenCalled();
    });

    it('rejects invalid metric keys with specific error message', async () => {
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.metricDefinition.findMany.mockResolvedValueOnce([]);

      await expect(
        service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
          widgetType: WidgetType.KPI,
          platform: IntegrationPlatform.GA4,
          metricKeys: ['unknown_metric'],
          config: { title: 'Test Widget' },
          position: { x: 0, y: 0, w: 3, h: 2 },
        })
      ).rejects.toThrow(/Invalid metric keys/);
    });
  });

  // ─── Area 15: Campaign consistency ──────────────────────────────────────────

  describe('Area 15 — Campaign consistency', () => {
    it('rejects widget addition if dashboard belongs to different campaign', async () => {
      prisma.dashboard.findFirst.mockResolvedValueOnce(null); // different campaign

      await expect(
        service.addWidget(makeUser(), CAMPAIGN_A, DASHBOARD_A, {
          widgetType: WidgetType.KPI,
          metricKeys: [],
          config: { title: 'Test Widget' },
          position: { x: 0, y: 0, w: 3, h: 2 },
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces campaignId match in batch widget data', async () => {
      const user = makeUser();
      prisma.dashboard.findFirst.mockResolvedValueOnce({ id: DASHBOARD_A });
      prisma.dashboardWidget.findMany.mockResolvedValueOnce([]);

      await service.getBatchWidgetData(user, CAMPAIGN_A, DASHBOARD_A, {
        widgetIds: [],
        from: '2024-01-01',
        to: '2024-01-31',
      }).catch(() => {});

      const where = prisma.dashboardWidget.findMany.mock.calls[0][0].where;
      expect(where.campaignId).toBe(CAMPAIGN_A);
    });
  });
});
