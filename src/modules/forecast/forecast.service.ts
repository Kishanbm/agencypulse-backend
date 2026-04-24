import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricGranularity, MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { olsRegression, buildForecast } from './utils/linear-regression';
import { ForecastQueryDto } from './dto/forecast-query.dto';

const FORECAST_CACHE_TTL = 3600; // 1 hour — historical data doesn't change
const MIN_DATA_POINTS = 7;

@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
  ) {}

  async getForecast(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: ForecastQueryDto,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    const forecastDays = dto.forecastDays ?? 30;
    const cacheKey = `forecast:${user.tenantId}:${campaignId}:${dto.platform}:${dto.metricKey}:${dto.from}:${dto.to}:${forecastDays}`;

    return this.cache.getOrSet(cacheKey, FORECAST_CACHE_TTL, async () => {
      const timeSeries = await this.metrics.getMetrics(
        user.tenantId, campaignId, dto.platform,
        dto.from, dto.to,
        [dto.metricKey],
        MetricGranularity.DAY,
        MetricAggregate.SUM,
      );

      if (timeSeries.length < MIN_DATA_POINTS) {
        return {
          insufficient_data: true,
          dataPoints: timeSeries.length,
          minimumRequired: MIN_DATA_POINTS,
          metricKey: dto.metricKey,
          platform: dto.platform,
        };
      }

      const values = timeSeries.map(row => row.metrics[dto.metricKey] ?? 0);
      const historical = timeSeries.map(row => ({
        date: row.period,
        actual: row.metrics[dto.metricKey] ?? 0,
      }));

      const regression = olsRegression(values);
      const forecast = buildForecast(regression, values.length, forecastDays, dto.to);

      const projectedTotal = forecast.reduce((sum, p) => sum + p.projected, 0);

      return {
        insufficient_data: false,
        metricKey: dto.metricKey,
        platform: dto.platform,
        // FIX #4: expose low confidence flag prominently
        trend: {
          slope: regression.slope,
          intercept: regression.intercept,
          r2: regression.r2,
          direction: regression.direction,
          lowConfidence: regression.lowConfidence,
          confidenceNote: regression.lowConfidence
            ? 'R² < 0.3 — trend fit is weak, forecast may be unreliable'
            : null,
        },
        currentPeriod: { from: dto.from, to: dto.to },
        forecastPeriod: {
          from: forecast[0]?.date ?? null,
          to: forecast[forecast.length - 1]?.date ?? null,
          days: forecastDays,
        },
        historical,
        forecast,
        forecastSummary: {
          projectedTotal: Math.round(projectedTotal * 100) / 100,
          projectedEndValue: forecast[forecast.length - 1]?.projected ?? 0,
          confidenceLevel: 0.95,
        },
      };
    });
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser, clientId: string, campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId, clientId, tenantId: user.tenantId, deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }
}
