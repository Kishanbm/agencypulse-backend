import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AgencyOverviewService } from './agency-overview.service';
import {
  AgencyMetricsSummaryDto,
  CampaignRankingDto,
} from './dto/agency-overview.dto';

@ApiTags('agency-overview')
@Controller('agencies/me')
export class AgencyOverviewController {
  constructor(private readonly svc: AgencyOverviewService) {}

  /**
   * GET /agencies/me/metrics/summary
   *
   * Aggregate metrics across ALL campaigns for the authenticated agency,
   * with period-over-period delta percentages.
   * AGENCY_STAFF scope is applied automatically — staff only see campaigns
   * belonging to clients they are assigned to.
   */
  @Get('metrics/summary')
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({
    summary: 'Agency-wide metric aggregation with period-over-period delta',
    description: 'Returns summed metrics across all campaigns the caller can access, plus delta % vs. prior period of equal length.',
  })
  async getMetricsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: AgencyMetricsSummaryDto,
  ) {
    const staffUserId  = user.role === UserRole.AGENCY_STAFF ? user.id : null;
    const metricKeys   = dto.metrics ? dto.metrics.split(',').map((k) => k.trim()).filter(Boolean) : undefined;

    return this.svc.getMetricsSummary(
      user.tenantId,
      dto.from,
      dto.to,
      staffUserId,
      dto.platform,
      metricKeys,
    );
  }

  /**
   * GET /agencies/me/campaigns/ranking
   *
   * Rank campaigns by a given metric for a date range, with delta vs. prior
   * period. Useful for leaderboard / top-performer widgets on the Overview page.
   */
  @Get('campaigns/ranking')
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({
    summary: 'Rank campaigns by a metric with period-over-period delta',
    description: 'Returns top N campaigns ordered by the requested metric, enriched with delta % vs. prior period.',
  })
  async getCampaignRanking(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: CampaignRankingDto,
  ) {
    const staffUserId = user.role === UserRole.AGENCY_STAFF ? user.id : null;

    return this.svc.getCampaignRanking(
      user.tenantId,
      dto.metric,
      staffUserId,
      dto.from,
      dto.to,
      dto.platform,
      dto.limit ?? 10,
      dto.order,
    );
  }
}
