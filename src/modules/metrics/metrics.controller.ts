import {
  Controller,
  Get,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from './metrics.service';
import {
  QueryMetricsDto,
  QueryMetricSummaryDto,
  MetricGranularity,
  MetricAggregate,
} from './dto/query-metrics.dto';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Time-series chart data ────────────────────────────────────────────────
  // Returns periods with grouped metrics: [{ period, metrics: { clicks: 120 } }]
  // granularity defaults to 'day'; aggregate defaults to 'sum'

  @Get()
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Get time-series metric data grouped by period (day/week/month).' })
  async getMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: QueryMetricsDto,
  ) {
    await this.assertCampaignAccess(user, dto.campaignId);

    const metricKeys = this.parseMetricKeys(dto.metrics);

    return this.metricsService.getMetrics(
      user.tenantId,
      dto.campaignId,
      dto.platform,
      dto.from,
      dto.to,
      metricKeys,
      dto.granularity ?? MetricGranularity.DAY,
      dto.aggregate  ?? MetricAggregate.SUM,
    );
  }

  // ─── KPI summary ──────────────────────────────────────────────────────────
  // Returns a single aggregate value per metric: { metrics: { clicks: 12350 } }
  // Used by dashboard KPI cards to show totals for the selected date range.

  @Get('summary')
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Get aggregate summary (sum/avg/last) per metric for a date range.' })
  async getMetricSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: QueryMetricSummaryDto,
  ) {
    await this.assertCampaignAccess(user, dto.campaignId);

    const metricKeys = this.parseMetricKeys(dto.metrics);

    return this.metricsService.getMetricSummary(
      user.tenantId,
      dto.campaignId,
      dto.platform,
      dto.from,
      dto.to,
      metricKeys,
      dto.aggregate ?? MetricAggregate.SUM,
    );
  }

  // ─── Metric definitions ───────────────────────────────────────────────────
  // Returns available metrics + display info (label, category, unit, dataType).
  // Used by the frontend to build metric pickers and chart labels.

  @Get('definitions/:platform')
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Get available metric definitions for a platform.' })
  getDefinitions(@Param('platform') platform: IntegrationPlatform) {
    return this.metricsService.getMetricDefinitions(platform);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private parseMetricKeys(metrics?: string): string[] | undefined {
    if (!metrics) return undefined;
    const keys = metrics.split(',').map(k => k.trim()).filter(Boolean);
    return keys.length > 0 ? keys : undefined;
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    campaignId: string,
  ): Promise<void> {
    const role = user.role as UserRole;

    const base: any = {
      id: campaignId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { deletedAt: null },
    };

    if (role === UserRole.AGENCY_STAFF) {
      base.client = {
        is: { deletedAt: null, staffAssignments: { some: { userId: user.id } } },
      };
    } else if (role === UserRole.CLIENT_USER) {
      base.client = {
        is: { deletedAt: null, clientUserAssignments: { some: { userId: user.id } } },
      };
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: base,
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');
  }
}
