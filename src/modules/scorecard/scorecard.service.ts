import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  computePriorPeriod,
  computeChangePct,
  scorecardStatus,
  ScorecardStatus,
} from '../../common/metrics-utils';
import { ScorecardQueryDto } from './dto/scorecard-query.dto';

const SCORECARD_CACHE_TTL = 60; // 60 seconds

export interface ScorecardMetric {
  metricKey: string;
  currentValue: number;
  priorValue: number;
  changeAbsolute: number;
  changePct: number | null;
  status: ScorecardStatus;
}

export interface ScorecardResponse {
  campaignId: string;
  platform: IntegrationPlatform;
  currentPeriod: { from: string; to: string };
  priorPeriod: { from: string; to: string };
  metrics: ScorecardMetric[];
}

@Injectable()
export class ScorecardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
  ) {}

  async getScorecard(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: ScorecardQueryDto,
  ): Promise<ScorecardResponse> {
    await this.assertCampaignAccess(user, clientId, campaignId);

    const priorPeriod = computePriorPeriod(dto.from, dto.to);
    const metricKeysStr = dto.metricKeys?.join(',') ?? 'all';
    const cacheKey = `scorecard:${user.tenantId}:${campaignId}:${dto.platform}:${dto.from}:${dto.to}:${metricKeysStr}`;

    return this.cache.getOrSet(cacheKey, SCORECARD_CACHE_TTL, async () => {
      const [current, prior] = await Promise.all([
        this.metrics.getMetricSummary(
          user.tenantId, campaignId, dto.platform,
          dto.from, dto.to, dto.metricKeys, MetricAggregate.SUM,
        ),
        this.metrics.getMetricSummary(
          user.tenantId, campaignId, dto.platform,
          priorPeriod.from, priorPeriod.to, dto.metricKeys, MetricAggregate.SUM,
        ),
      ]);

      const metricKeys = dto.metricKeys?.length
        ? dto.metricKeys
        : Object.keys(current.metrics);

      const scorecardMetrics: ScorecardMetric[] = metricKeys.map(key => {
        const currentValue = current.metrics[key] ?? 0;
        const priorValue = prior.metrics[key] ?? 0;
        const changeAbsolute = currentValue - priorValue;
        const changePct = computeChangePct(currentValue, priorValue);
        const status = scorecardStatus(changePct);

        return { metricKey: key, currentValue, priorValue, changeAbsolute, changePct, status };
      });

      return {
        campaignId,
        platform: dto.platform,
        currentPeriod: { from: dto.from, to: dto.to },
        priorPeriod,
        metrics: scorecardMetrics,
      };
    });
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        clientId,
        tenantId: user.tenantId,
        deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }
}
