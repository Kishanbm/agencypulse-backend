import { Injectable, Logger } from '@nestjs/common';
import { IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import {
  AgencyMetricsSummaryResult,
  CampaignRankingItem,
  MetricWithDelta,
  RankingOrder,
} from './dto/agency-overview.dto';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class AgencyOverviewService {
  private readonly logger = new Logger(AgencyOverviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── Agency-wide metrics summary ──────────────────────────────────────────

  async getMetricsSummary(
    tenantId: string,
    from: string,
    to: string,
    staffUserId: string | null,
    platform?: IntegrationPlatform,
    metricKeys?: string[],
  ): Promise<AgencyMetricsSummaryResult> {
    const priorPeriod = this.calcPriorPeriod(from, to);

    const cacheKey = `agency-overview:summary:${tenantId}:${from}:${to}:${staffUserId ?? 'all'}:${platform ?? 'all'}:${metricKeys?.join(',') ?? 'all'}`;

    return this.cache.getOrSet(cacheKey, CACHE_TTL, async () => {
      const [current, prior] = await Promise.all([
        this.queryAggregatedMetrics(tenantId, from, to, staffUserId, platform, metricKeys),
        this.queryAggregatedMetrics(tenantId, priorPeriod.from, priorPeriod.to, staffUserId, platform, metricKeys),
      ]);

      // Merge into delta-enriched result
      const allKeys = new Set([...Object.keys(current), ...Object.keys(prior)]);
      const metrics: Record<string, MetricWithDelta> = {};

      for (const key of allKeys) {
        const value = current[key] ?? 0;
        const priorValue = prior[key] ?? null;
        const delta = priorValue !== null && priorValue !== 0
          ? ((value - priorValue) / priorValue) * 100
          : null;

        metrics[key] = {
          value,
          prior: priorValue,
          delta: delta !== null ? Math.round(delta * 100) / 100 : null,
        };
      }

      return {
        metrics,
        period: { from, to },
        priorPeriod,
      };
    });
  }

  // ─── Campaign ranking ─────────────────────────────────────────────────────

  async getCampaignRanking(
    tenantId: string,
    metric: string,
    staffUserId: string | null,
    from?: string,
    to?: string,
    platform?: IntegrationPlatform,
    limit: number = 10,
    order: RankingOrder = RankingOrder.DESC,
  ): Promise<CampaignRankingItem[]> {
    // Default to last 30 days when no date range supplied
    const resolvedTo   = to   ?? new Date().toISOString().slice(0, 10);
    const resolvedFrom = from ?? this.subtractDays(resolvedTo, 29);

    const priorPeriod = this.calcPriorPeriod(resolvedFrom, resolvedTo);

    const cacheKey = `agency-overview:ranking:${tenantId}:${metric}:${resolvedFrom}:${resolvedTo}:${staffUserId ?? 'all'}:${platform ?? 'all'}:${limit}:${order}`;

    return this.cache.getOrSet(cacheKey, CACHE_TTL, async () => {
      const [currentRows, priorRows] = await Promise.all([
        this.queryRankingRows(tenantId, metric, resolvedFrom, resolvedTo, staffUserId, platform, limit, order),
        this.queryRankingRows(tenantId, metric, priorPeriod.from, priorPeriod.to, staffUserId, platform, limit, order),
      ]);

      // Build prior lookup by campaignId
      const priorMap = new Map<string, number>();
      for (const row of priorRows) {
        priorMap.set(row.campaign_id as string, Number(row.value));
      }

      return currentRows.map((row) => {
        const value      = Number(row.value);
        const priorValue = priorMap.get(row.campaign_id as string) ?? null;
        const delta      = priorValue !== null && priorValue !== 0
          ? Math.round(((value - priorValue) / priorValue) * 100 * 100) / 100
          : null;

        return {
          campaignId:   row.campaign_id   as string,
          campaignName: row.campaign_name as string,
          clientId:     row.client_id     as string,
          clientName:   row.client_name   as string,
          value,
          priorValue,
          delta,
        };
      });
    });
  }

  // ─── Private: SQL helpers ─────────────────────────────────────────────────

  private async queryAggregatedMetrics(
    tenantId: string,
    from: string,
    to: string,
    staffUserId: string | null,
    platform?: IntegrationPlatform,
    metricKeys?: string[],
  ): Promise<Record<string, number>> {
    // Build dynamic WHERE clauses after the fixed params
    const params: unknown[] = [tenantId, from, to, staffUserId];
    // $1 = tenantId, $2 = from, $3 = to, $4 = staffUserId (null = no STAFF scoping)

    const platformClause = platform
      ? ` AND mv.platform = $${params.push(platform)}::integration_platform`
      : '';

    let metricClause = '';
    if (metricKeys && metricKeys.length > 0) {
      const placeholders = metricKeys.map((k) => `$${params.push(k)}`).join(', ');
      metricClause = ` AND mv.metric_key IN (${placeholders})`;
    }

    const sql = `
      SELECT
        mv.metric_key,
        SUM(mv.value)::float8 AS value
      FROM metric_values mv
      JOIN campaigns c ON c.id = mv.campaign_id AND c.tenant_id = mv.tenant_id
      WHERE
        mv.tenant_id     = $1::uuid
        AND mv.recorded_at >= $2::date
        AND mv.recorded_at <= $3::date
        AND mv.dimension_key IS NULL
        AND mv.dimension_val IS NULL
        -- STAFF scoping: if $4 is non-null, restrict to campaigns the staff member is assigned to
        AND (
          $4::uuid IS NULL
          OR EXISTS (
            SELECT 1 FROM staff_client_assignments sca
            WHERE sca.client_id = c.client_id
              AND sca.user_id   = $4::uuid
              AND sca.tenant_id = mv.tenant_id
          )
        )
        ${platformClause}
        ${metricClause}
      GROUP BY mv.metric_key
      ORDER BY mv.metric_key ASC
    `;

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return tx.$queryRawUnsafe<Array<{ metric_key: string; value: number }>>(sql, ...params);
    });

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.metric_key] = Number(row.value);
    }
    return result;
  }

  private async queryRankingRows(
    tenantId: string,
    metric: string,
    from: string,
    to: string,
    staffUserId: string | null,
    platform?: IntegrationPlatform,
    limit: number = 10,
    order: RankingOrder = RankingOrder.DESC,
  ): Promise<Array<Record<string, unknown>>> {
    const params: unknown[] = [tenantId, from, to, staffUserId, metric];
    // $1=tenantId $2=from $3=to $4=staffUserId $5=metric

    const platformClause = platform
      ? ` AND mv.platform = $${params.push(platform)}::integration_platform`
      : '';

    const limitClause = ` LIMIT $${params.push(limit)}::int`;
    const orderDir    = order === RankingOrder.ASC ? 'ASC' : 'DESC';

    const sql = `
      SELECT
        c.id          AS campaign_id,
        c.name        AS campaign_name,
        cl.id         AS client_id,
        cl.name       AS client_name,
        SUM(mv.value)::float8 AS value
      FROM metric_values mv
      JOIN campaigns c  ON c.id    = mv.campaign_id AND c.tenant_id  = mv.tenant_id
      JOIN clients   cl ON cl.id   = c.client_id    AND cl.tenant_id = mv.tenant_id
      WHERE
        mv.tenant_id     = $1::uuid
        AND mv.recorded_at >= $2::date
        AND mv.recorded_at <= $3::date
        AND mv.dimension_key IS NULL
        AND mv.dimension_val IS NULL
        AND mv.metric_key   = $5
        AND (
          $4::uuid IS NULL
          OR EXISTS (
            SELECT 1 FROM staff_client_assignments sca
            WHERE sca.client_id = c.client_id
              AND sca.user_id   = $4::uuid
              AND sca.tenant_id = mv.tenant_id
          )
        )
        ${platformClause}
      GROUP BY c.id, c.name, cl.id, cl.name
      ORDER BY value ${orderDir}
      ${limitClause}
    `;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
    });
  }

  // ─── Date helpers ─────────────────────────────────────────────────────────

  private calcPriorPeriod(from: string, to: string): { from: string; to: string } {
    const fromDate  = new Date(from);
    const toDate    = new Date(to);
    const diffDays  = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    const priorTo   = new Date(fromDate.getTime() - 86_400_000); // day before from
    const priorFrom = new Date(priorTo.getTime() - (diffDays - 1) * 86_400_000);

    return {
      from: priorFrom.toISOString().slice(0, 10),
      to:   priorTo.toISOString().slice(0, 10),
    };
  }

  private subtractDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
}
