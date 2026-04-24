import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationPlatform, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { computePriorPeriod, computeChangePct } from '../../common/metrics-utils';

const INSIGHTS_CACHE_TTL = 3600; // 1 hour
const MIN_ABSOLUTE_CHANGE_PCT = 10; // only surface changes >= 10%

export interface Insight {
  platform: string;
  metricKey: string;
  currentValue: number;
  priorValue: number;
  changePct: number;
  direction: 'UP' | 'DOWN';
  sentiment: 'POSITIVE' | 'NEGATIVE';
  headline: string;
}

/**
 * Proactive insights — surfaces the top 3 changes (biggest wins + biggest concerns)
 * from the last 7 days vs prior 7 days. Cheap to compute (no Claude call),
 * cached 1 hour. Frontend shows these in an "Insights" panel on the dashboard.
 */
@Injectable()
export class AiInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
  ) {}

  async getInsights(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ): Promise<{ insights: Insight[]; period: { from: string; to: string } }> {
    await this.assertCampaignAccess(user, clientId, campaignId);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const cacheKey = `ai-insights:${user.tenantId}:${campaignId}:${todayStr}`;

    return this.cache.getOrSet(cacheKey, INSIGHTS_CACHE_TTL, async () => {
      const to = todayStr;
      const from = new Date(today.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
      const prior = computePriorPeriod(from, to);

      // Only look at platforms this campaign actually has connected
      const connections = await this.prisma.integrationConnection.findMany({
        where: { tenantId: user.tenantId, campaignId, status: 'CONNECTED' },
        select: { platform: true },
      });

      const allInsights: Insight[] = [];

      for (const conn of connections) {
        const [cur, prev] = await Promise.all([
          this.metrics.getMetricSummary(
            user.tenantId, campaignId, conn.platform,
            from, to, undefined, MetricAggregate.SUM,
          ),
          this.metrics.getMetricSummary(
            user.tenantId, campaignId, conn.platform,
            prior.from, prior.to, undefined, MetricAggregate.SUM,
          ),
        ]);

        for (const key of Object.keys(cur.metrics)) {
          const c = cur.metrics[key] ?? 0;
          const p = prev.metrics[key] ?? 0;
          if (c === 0 && p === 0) continue;

          const pct = computeChangePct(c, p);
          if (pct === null) continue;
          if (Math.abs(pct) < MIN_ABSOLUTE_CHANGE_PCT) continue;

          const direction = pct >= 0 ? 'UP' : 'DOWN';
          const sentiment = this.sentimentFor(key, direction);

          allInsights.push({
            platform: String(conn.platform),
            metricKey: key,
            currentValue: c,
            priorValue: p,
            changePct: pct,
            direction,
            sentiment,
            headline: this.buildHeadline(conn.platform, key, c, p, pct, sentiment),
          });
        }
      }

      // Sort: biggest absolute change first, then mix positive + negative
      allInsights.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

      return {
        insights: allInsights.slice(0, 3),
        period: { from, to },
      };
    });
  }

  // ─── Heuristics ─────────────────────────────────────────────────────────────

  /**
   * Cost metrics: UP is bad, DOWN is good. Everything else: UP is good.
   */
  private sentimentFor(key: string, direction: 'UP' | 'DOWN'): 'POSITIVE' | 'NEGATIVE' {
    const costLike = ['cost', 'spend', 'cpc', 'cpm', 'cpa', 'bounceRate'];
    const isCost = costLike.some(c => key.toLowerCase().includes(c.toLowerCase()));
    if (isCost) return direction === 'UP' ? 'NEGATIVE' : 'POSITIVE';
    return direction === 'UP' ? 'POSITIVE' : 'NEGATIVE';
  }

  private buildHeadline(
    platform: IntegrationPlatform,
    key: string,
    cur: number,
    prev: number,
    pct: number,
    sentiment: 'POSITIVE' | 'NEGATIVE',
  ): string {
    const emoji = sentiment === 'POSITIVE' ? '↑' : '↓';
    const sign = pct >= 0 ? '+' : '';
    return `${platform} ${key} ${emoji} ${sign}${pct.toFixed(1)}% (${prev.toLocaleString()} → ${cur.toLocaleString()})`;
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
