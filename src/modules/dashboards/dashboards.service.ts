import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole, WidgetType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate, MetricGranularity } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { BatchWidgetDataDto } from './dto/batch-widget-data.dto';

// Widget types that show a single aggregate value (KPI cards)
const KPI_WIDGET_TYPES = new Set<WidgetType>([WidgetType.KPI]);

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  // ─── Dashboard CRUD ────────────────────────────────────────────────────────

  async create(
    user: AuthenticatedUser,
    campaignId: string,
    dto: CreateDashboardDto,
  ) {
    await this.assertCampaignAccess(user, campaignId);

    // If this is set as default, unset other defaults for this campaign first
    if (dto.isDefault) {
      await this.clearDefaultFlag(user.tenantId, campaignId);
    }

    return this.prisma.dashboard.create({
      data: {
        tenantId: user.tenantId,
        campaignId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
      },
      select: this.dashboardSelect(),
    });
  }

  async findAll(user: AuthenticatedUser, campaignId: string) {
    await this.assertCampaignAccess(user, campaignId);

    return this.prisma.dashboard.findMany({
      where: { tenantId: user.tenantId, campaignId, deletedAt: null },
      select: {
        ...this.dashboardSelect(),
        _count: { select: { widgets: { where: { deletedAt: null } } } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(user: AuthenticatedUser, campaignId: string, dashboardId: string) {
    await this.assertCampaignAccess(user, campaignId);

    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: {
        ...this.dashboardSelect(),
        widgets: {
          where: { deletedAt: null },
          select: this.widgetSelect(),
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!dashboard) throw new NotFoundException('Dashboard not found.');
    return dashboard;
  }

  async update(
    user: AuthenticatedUser,
    campaignId: string,
    dashboardId: string,
    dto: UpdateDashboardDto,
  ) {
    await this.assertCampaignAccess(user, campaignId);
    const existing = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Dashboard not found.');

    if (dto.isDefault) {
      await this.clearDefaultFlag(user.tenantId, campaignId);
    }

    return this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
      select: this.dashboardSelect(),
    });
  }

  async softDelete(user: AuthenticatedUser, campaignId: string, dashboardId: string) {
    await this.assertCampaignAccess(user, campaignId);
    const existing = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Dashboard not found.');

    await this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Dashboard deleted.' };
  }

  // ─── Widget CRUD ───────────────────────────────────────────────────────────

  async addWidget(
    user: AuthenticatedUser,
    campaignId: string,
    dashboardId: string,
    dto: CreateWidgetDto,
  ) {
    await this.assertDashboardAccess(user, campaignId, dashboardId);

    // Validate metric_keys against metric_definitions (AI fix #4)
    if (dto.metricKeys.length > 0 && dto.platform) {
      await this.validateMetricKeys(dto.platform, dto.metricKeys);
    }

    return this.prisma.dashboardWidget.create({
      data: {
        tenantId: user.tenantId,
        dashboardId,
        campaignId,
        widgetType: dto.widgetType,
        platform: dto.platform ?? null,
        metricKeys: dto.metricKeys,
        config: dto.config as unknown as Prisma.InputJsonValue,
        position: dto.position as unknown as Prisma.InputJsonValue,
      },
      select: this.widgetSelect(),
    });
  }

  async updateWidget(
    user: AuthenticatedUser,
    campaignId: string,
    dashboardId: string,
    widgetId: string,
    dto: UpdateWidgetDto,
  ) {
    await this.assertDashboardAccess(user, campaignId, dashboardId);
    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, platform: true, metricKeys: true },
    });
    if (!widget) throw new NotFoundException('Widget not found.');

    const platform = dto.platform ?? widget.platform;
    const metricKeys = dto.metricKeys ?? widget.metricKeys;

    if (metricKeys.length > 0 && platform) {
      await this.validateMetricKeys(platform, metricKeys);
    }

    return this.prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.metricKeys !== undefined && { metricKeys: dto.metricKeys }),
        ...(dto.config !== undefined && { config: dto.config as unknown as Prisma.InputJsonValue }),
        ...(dto.position !== undefined && { position: dto.position as unknown as Prisma.InputJsonValue }),
      },
      select: this.widgetSelect(),
    });
  }

  async removeWidget(
    user: AuthenticatedUser,
    campaignId: string,
    dashboardId: string,
    widgetId: string,
  ) {
    await this.assertDashboardAccess(user, campaignId, dashboardId);
    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!widget) throw new NotFoundException('Widget not found.');

    await this.prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Widget removed.' };
  }

  // ─── Batch widget data (AI fix #5) ────────────────────────────────────────
  // One endpoint returns data for all requested widgets — avoids N API calls.
  // KPI widgets → getMetricSummary; chart/table widgets → getMetrics.

  async getBatchWidgetData(
    user: AuthenticatedUser,
    campaignId: string,
    dashboardId: string,
    dto: BatchWidgetDataDto,
  ) {
    await this.assertDashboardAccess(user, campaignId, dashboardId);

    // Validate date range: from must be before to
    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to);
    if (fromDate >= toDate) {
      throw new BadRequestException('Date range invalid: "from" must be before "to"');
    }

    // Load only the requested widgets that belong to this dashboard
    const widgets = await this.prisma.dashboardWidget.findMany({
      where: {
        id: { in: dto.widgetIds },
        dashboardId,
        campaignId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
      select: this.widgetSelect(),
    });

    const foundIds = new Set(widgets.map(w => w.id));
    const missingIds = dto.widgetIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException(`Widgets not found: ${missingIds.join(', ')}`);
    }

    const WIDGET_DATA_TIMEOUT_MS = 10_000;

    // Resolves one widget's data with a per-widget timeout so a single slow platform
    // doesn't block the entire batch response.
    const resolveWidgetData = async (widget: (typeof widgets)[number]) => {
      if (!widget.platform || widget.metricKeys.length === 0) {
        return { widgetId: widget.id, widgetType: widget.widgetType, data: null };
      }

      const config = widget.config as { aggregation?: string; comparison?: string };
      const aggregate = this.resolveAggregate(config.aggregation);

      try {
        if (KPI_WIDGET_TYPES.has(widget.widgetType)) {
          const data = await this.metricsService.getMetricSummary(
            user.tenantId,
            widget.campaignId,
            widget.platform,
            dto.from,
            dto.to,
            widget.metricKeys,
            aggregate,
          );

          let comparison: unknown = undefined;
          if (config.comparison && config.comparison !== 'none') {
            const { from: cFrom, to: cTo } = this.shiftPeriod(
              dto.from,
              dto.to,
              config.comparison as 'previous_period' | 'previous_year',
            );
            comparison = await this.metricsService.getMetricSummary(
              user.tenantId,
              widget.campaignId,
              widget.platform,
              cFrom,
              cTo,
              widget.metricKeys,
              aggregate,
            );
          }

          return {
            widgetId: widget.id,
            widgetType: widget.widgetType,
            data: { current: data, ...(comparison !== undefined && { previous: comparison }) },
          };
        } else {
          const data = await this.metricsService.getMetrics(
            user.tenantId,
            widget.campaignId,
            widget.platform,
            dto.from,
            dto.to,
            widget.metricKeys,
            MetricGranularity.DAY,
            aggregate,
          );
          return { widgetId: widget.id, widgetType: widget.widgetType, data };
        }
      } catch {
        return { widgetId: widget.id, widgetType: widget.widgetType, data: null };
      }
    };

    const results = await Promise.all(
      widgets.map((widget) =>
        Promise.race([
          resolveWidgetData(widget),
          new Promise<{ widgetId: string; widgetType: WidgetType; data: null }>((resolve) =>
            setTimeout(
              () => resolve({ widgetId: widget.id, widgetType: widget.widgetType, data: null }),
              WIDGET_DATA_TIMEOUT_MS,
            ),
          ),
        ]),
      ),
    );

    return { results };
  }

  // ─── Default dashboard (Phase 5.3) ────────────────────────────────────────
  // Called by CampaignsService after campaign creation.
  // Creates a "Main Dashboard" with is_default=true and no widgets.
  // Widgets are added by the agency user via the dashboard editor.

  async createDefaultDashboard(tenantId: string, campaignId: string): Promise<void> {
    await this.prisma.dashboard.create({
      data: {
        tenantId,
        campaignId,
        name: 'Main Dashboard',
        isDefault: true,
      },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    campaignId: string,
  ): Promise<void> {
    const role = user.role as UserRole;
    const base: Prisma.CampaignWhereInput = {
      id: campaignId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { is: { deletedAt: null } },
    };

    if (role === UserRole.AGENCY_STAFF) {
      (base.client as any) = {
        is: { deletedAt: null, staffAssignments: { some: { userId: user.id } } },
      };
    } else if (role === UserRole.CLIENT_USER) {
      (base.client as any) = {
        is: { deletedAt: null, clientUserAssignments: { some: { userId: user.id } } },
      };
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: base,
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  private async assertDashboardAccess(
    user: AuthenticatedUser,
    campaignId: string,
    dashboardId: string,
  ): Promise<void> {
    await this.assertCampaignAccess(user, campaignId);

    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!dashboard) throw new NotFoundException('Dashboard not found.');
  }

  private async validateMetricKeys(
    platform: string,
    metricKeys: string[],
  ): Promise<void> {
    const definitions = await this.prisma.metricDefinition.findMany({
      where: { platform: platform as any, metricKey: { in: metricKeys } },
      select: { metricKey: true },
    });

    const valid = new Set(definitions.map(d => d.metricKey));
    const invalid = metricKeys.filter(k => !valid.has(k));

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid metric keys for platform ${platform}: ${invalid.join(', ')}`,
      );
    }
  }

  private async clearDefaultFlag(tenantId: string, campaignId: string): Promise<void> {
    await this.prisma.dashboard.updateMany({
      where: { tenantId, campaignId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }

  private resolveAggregate(value?: string): MetricAggregate {
    if (value === 'avg') return MetricAggregate.AVG;
    if (value === 'last') return MetricAggregate.LAST;
    return MetricAggregate.SUM;
  }

  private shiftPeriod(
    from: string,
    to: string,
    mode: 'previous_period' | 'previous_year',
  ): { from: string; to: string } {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffMs = toDate.getTime() - fromDate.getTime();

    if (mode === 'previous_year') {
      const pFrom = new Date(fromDate);
      pFrom.setFullYear(pFrom.getFullYear() - 1);
      const pTo = new Date(toDate);
      pTo.setFullYear(pTo.getFullYear() - 1);
      return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10) };
    }

    // previous_period: shift back by the same duration
    const pTo = new Date(fromDate.getTime() - 86400000); // day before `from`
    const pFrom = new Date(pTo.getTime() - diffMs);
    return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10) };
  }

  private dashboardSelect() {
    return {
      id: true,
      campaignId: true,
      name: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.DashboardSelect;
  }

  private widgetSelect() {
    return {
      id: true,
      dashboardId: true,
      campaignId: true,
      widgetType: true,
      platform: true,
      metricKeys: true,
      config: true,
      position: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.DashboardWidgetSelect;
  }
}
