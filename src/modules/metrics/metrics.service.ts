import { Injectable, Logger } from '@nestjs/common';
import { IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { normalizeMetricValue } from './constants/metric-transforms';
import { METRIC_SEEDS } from './constants/metric-seeds';
import {
  MetricRowInput,
  MetricGranularity,
  MetricAggregate,
  MetricPeriodRow,
  MetricSummaryResult,
} from './dto/query-metrics.dto';

const UPSERT_BATCH_SIZE = 500;
const METRICS_CACHE_TTL = 300; // 5 minutes — data syncs every 6h, safe TTL


@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── Upsert (called by sync processors) ──────────────────────────────────

  async upsertMetrics(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    rows: MetricRowInput[],
  ): Promise<number> {
    if (rows.length === 0) return 0;

    let total = 0;
    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      total += await this.upsertBatch(tenantId, campaignId, platform, rows.slice(i, i + UPSERT_BATCH_SIZE));
    }

    // Versioned cache invalidation — increment version so any cached queries
    // for this campaign+platform become stale without needing SCAN or DELETE.
    await this.cache.incrementVersion(this.buildVersionKey(tenantId, campaignId, platform));

    return total;
  }

  // ─── Time-series (chart data) ─────────────────────────────────────────────

  async getMetrics(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    from: string,
    to: string,
    metricKeys?: string[],
    granularity: MetricGranularity = MetricGranularity.DAY,
    aggregate: MetricAggregate = MetricAggregate.SUM,
  ): Promise<MetricPeriodRow[]> {
    this.assertAggregateAllowed(aggregate, metricKeys);

    const cacheKey = await this.buildCacheKey(
      tenantId, campaignId, platform, from, to, granularity, aggregate, metricKeys,
    );

    return this.cache.getOrSet(cacheKey, METRICS_CACHE_TTL, async () => {
      const rows = await this.queryTimeSeries(
        tenantId, campaignId, platform, from, to, metricKeys, granularity, aggregate,
      );
      return this.fillMissingPeriods(rows, from, to, granularity, metricKeys);
    });
  }

  // ─── Summary (KPI card totals) ────────────────────────────────────────────

  async getMetricSummary(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    from: string,
    to: string,
    metricKeys?: string[],
    aggregate: MetricAggregate = MetricAggregate.SUM,
  ): Promise<MetricSummaryResult> {
    this.assertAggregateAllowed(aggregate, metricKeys);

    const cacheKey = await this.buildCacheKey(
      tenantId, campaignId, platform, from, to, 'summary', aggregate, metricKeys,
    );

    return this.cache.getOrSet(cacheKey, METRICS_CACHE_TTL, () =>
      this.querySummary(tenantId, campaignId, platform, from, to, metricKeys, aggregate),
    );
  }

  // ─── Definitions ──────────────────────────────────────────────────────────

  async getMetricDefinitions(platform: IntegrationPlatform) {
    return this.prisma.metricDefinition.findMany({
      where: { platform },
      orderBy: { category: 'asc' },
    });
  }

  // ─── Seed (called at startup) ─────────────────────────────────────────────

  async seedMetricDefinitions(): Promise<void> {
    for (const seed of METRIC_SEEDS) {
      await this.systemPrisma.metricDefinition.upsert({
        where: { platform_metricKey: { platform: seed.platform, metricKey: seed.metricKey } },
        create: seed,
        update: { label: seed.label, category: seed.category, dataType: seed.dataType, unit: seed.unit },
      });
    }
    this.logger.log(`Seeded ${METRIC_SEEDS.length} metric definitions`);
  }

  // ─── Private: SQL time-series ─────────────────────────────────────────────

  private async queryTimeSeries(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    from: string,
    to: string,
    metricKeys: string[] | undefined,
    granularity: MetricGranularity,
    aggregate: MetricAggregate,
  ): Promise<Array<{ period: string; metric_key: string; value: number }>> {
    // LAST doesn't apply to time-series (it's per-period — same as last row in period).
    // Fall back to SUM, which is the safe default for time-series charts.
    const aggFn = aggregate === MetricAggregate.AVG ? 'AVG' : 'SUM';

    const params: unknown[] = [tenantId, campaignId, platform, from, to];
    const [metricFilter, metricParams] = this.buildMetricKeyFilter(metricKeys, params.length);
    params.push(...metricParams);

    // AI2 fix: explicitly AT TIME ZONE 'UTC' to prevent week/month boundary shifts
    const sql = `
      SELECT
        DATE_TRUNC('${granularity}', recorded_at::timestamp AT TIME ZONE 'UTC')::date AS period,
        metric_key,
        ${aggFn}(value)::float8 AS value
      FROM metric_values
      WHERE
        tenant_id = $1::uuid
        AND campaign_id = $2::uuid
        AND platform = $3::integration_platform
        AND recorded_at >= $4::date
        AND recorded_at <= $5::date
        ${metricFilter}
      GROUP BY period, metric_key
      ORDER BY period ASC, metric_key ASC
    `;

    const rawRows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return tx.$queryRawUnsafe<
        Array<{ period: Date | string; metric_key: string; value: number }>
      >(sql, ...params);
    });

    return rawRows.map(r => ({
      period: r.period instanceof Date
        ? r.period.toISOString().slice(0, 10)
        : String(r.period).slice(0, 10),
      metric_key: r.metric_key,
      value: Number(r.value),
    }));
  }

  // ─── Private: SQL summary ─────────────────────────────────────────────────

  private async querySummary(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    from: string,
    to: string,
    metricKeys: string[] | undefined,
    aggregate: MetricAggregate,
  ): Promise<MetricSummaryResult> {
    const params: unknown[] = [tenantId, campaignId, platform, from, to];
    const [metricFilter, metricParams] = this.buildMetricKeyFilter(metricKeys, params.length);
    params.push(...metricParams);

    let rows: Array<{ metric_key: string; value: number }>;

    if (aggregate === MetricAggregate.LAST) {
      // AI2 fix: LAST = value from the most recent row per metric_key.
      // Cannot use GROUP BY — must use DISTINCT ON with ORDER BY recorded_at DESC.
      // AI1 fix: filter to non-dimension rows only — otherwise DISTINCT ON may pick
      // a breakdown row (e.g. clicks by device) instead of the campaign total.
      const sql = `
        SELECT DISTINCT ON (metric_key)
          metric_key,
          value::float8 AS value
        FROM metric_values
        WHERE
          tenant_id = $1::uuid
          AND campaign_id = $2::uuid
          AND platform = $3::integration_platform
          AND recorded_at >= $4::date
          AND recorded_at <= $5::date
          AND dimension_key IS NULL
          AND dimension_val IS NULL
          ${metricFilter}
        ORDER BY metric_key, recorded_at DESC
      `;
      rows = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
        return tx.$queryRawUnsafe<Array<{ metric_key: string; value: number }>>(sql, ...params);
      });
    } else {
      const aggFn = aggregate === MetricAggregate.AVG ? 'AVG' : 'SUM';
      const sql = `
        SELECT
          metric_key,
          ${aggFn}(value)::float8 AS value
        FROM metric_values
        WHERE
          tenant_id = $1::uuid
          AND campaign_id = $2::uuid
          AND platform = $3::integration_platform
          AND recorded_at >= $4::date
          AND recorded_at <= $5::date
          ${metricFilter}
        GROUP BY metric_key
        ORDER BY metric_key ASC
      `;
      rows = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
        return tx.$queryRawUnsafe<Array<{ metric_key: string; value: number }>>(sql, ...params);
      });
    }

    const metrics: Record<string, number> = {};
    for (const row of rows) {
      metrics[row.metric_key] = Number(row.value);
    }
    return { metrics };
  }

  // ─── Private: period filling ──────────────────────────────────────────────

  /**
   * Reshapes flat SQL rows into period-grouped format and fills any missing periods
   * with 0 values so charts always receive a continuous series.
   */
  private fillMissingPeriods(
    rows: Array<{ period: string; metric_key: string; value: number }>,
    from: string,
    to: string,
    granularity: MetricGranularity,
    metricKeys?: string[],
  ): MetricPeriodRow[] {
    // Build map: period → { metricKey → value }
    const dataMap = new Map<string, Record<string, number>>();
    const seenKeys = new Set<string>(metricKeys);

    for (const row of rows) {
      seenKeys.add(row.metric_key);
      if (!dataMap.has(row.period)) dataMap.set(row.period, {});
      dataMap.get(row.period)![row.metric_key] = row.value;
    }

    const allKeys = [...seenKeys].sort();
    const periods = this.generatePeriods(from, to, granularity);

    return periods.map(period => ({
      period,
      metrics: Object.fromEntries(
        allKeys.map(k => [k, dataMap.get(period)?.[k] ?? 0]),
      ),
    }));
  }

  /**
   * Generates period labels matching what PostgreSQL DATE_TRUNC returns.
   * WEEK aligns to ISO Monday (same as PG default). MONTH aligns to 1st.
   */
  private generatePeriods(from: string, to: string, granularity: MetricGranularity): string[] {
    const toDate = new Date(to + 'T00:00:00Z');
    const periods: string[] = [];

    let current: Date;
    if (granularity === MetricGranularity.MONTH) {
      const d = new Date(from + 'T00:00:00Z');
      current = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    } else if (granularity === MetricGranularity.WEEK) {
      // DATE_TRUNC('week') returns the Monday of the ISO week
      const d = new Date(from + 'T00:00:00Z');
      const dow = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
      const daysToMonday = dow === 0 ? -6 : 1 - dow;
      current = new Date(d);
      current.setUTCDate(d.getUTCDate() + daysToMonday);
    } else {
      current = new Date(from + 'T00:00:00Z');
    }

    while (current <= toDate) {
      periods.push(current.toISOString().slice(0, 10));
      const next = new Date(current);
      if (granularity === MetricGranularity.DAY) next.setUTCDate(next.getUTCDate() + 1);
      else if (granularity === MetricGranularity.WEEK) next.setUTCDate(next.getUTCDate() + 7);
      else next.setUTCMonth(next.getUTCMonth() + 1);
      current = next;
    }

    return periods;
  }

  // ─── Private: validation ──────────────────────────────────────────────────

  /**
   * No-op — avg is allowed for all stored metrics including ratio metrics (CTR, CPC).
   * Averaging daily ratio values (e.g. avg of daily CTR %) is standard analytics
   * dashboard practice and gives a meaningful "average rate over period" display.
   */
  private assertAggregateAllowed(
    _aggregate: MetricAggregate,
    _metricKeys?: string[],
  ): void {
    // no restriction
  }

  // ─── Private: cache key helpers ───────────────────────────────────────────

  private buildVersionKey(tenantId: string, campaignId: string, platform: string): string {
    return `mv:${tenantId}:${campaignId}:${platform}`;
  }

  private async buildCacheKey(
    tenantId: string,
    campaignId: string,
    platform: string,
    from: string,
    to: string,
    granularity: string,
    aggregate: string,
    metricKeys?: string[],
  ): Promise<string> {
    const version = await this.cache.getVersion(this.buildVersionKey(tenantId, campaignId, platform));
    // AI1+AI2 fix: sort metricKeys so clicks,impressions and impressions,clicks hit the same key
    const keysStr = metricKeys && metricKeys.length > 0
      ? [...metricKeys].sort().join(',')
      : 'all';
    return `metrics:v${version}:${tenantId}:${campaignId}:${platform}:${from}:${to}:${granularity}:${aggregate}:${keysStr}`;
  }

  // ─── Private: SQL helpers ─────────────────────────────────────────────────

  /**
   * Builds an IN clause for metric_key filtering.
   * Returns [sqlFragment, params] — params are appended after the fixed 5 params.
   */
  private buildMetricKeyFilter(
    metricKeys: string[] | undefined,
    currentParamCount: number,
  ): [string, unknown[]] {
    if (!metricKeys || metricKeys.length === 0) return ['', []];
    const placeholders = metricKeys.map((_, i) => `$${currentParamCount + 1 + i}`).join(', ');
    return [`AND metric_key IN (${placeholders})`, metricKeys];
  }

  // ─── Private: bulk upsert ─────────────────────────────────────────────────

  private async upsertBatch(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    rows: MetricRowInput[],
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const valuePlaceholders: string[] = [];
    const params: unknown[] = [];
    let pi = 1;

    for (const row of rows) {
      const { metricKey, value } = normalizeMetricValue(platform, row.metricKey, row.value);
      const dimKey = row.dimensionKey?.trim() || null;
      const dimVal = row.dimensionVal?.trim() || null;
      const recordedAt = row.recordedAt.slice(0, 10);

      valuePlaceholders.push(
        `($${pi++}::uuid, $${pi++}::uuid, $${pi++}::integration_platform, $${pi++}, $${pi++}::date, $${pi++}::decimal(20,6), $${pi++}, $${pi++})`,
      );
      params.push(tenantId, campaignId, platform, metricKey, recordedAt, value, dimKey, dimVal);
    }

    const sql = `
      INSERT INTO metric_values
        (tenant_id, campaign_id, platform, metric_key, recorded_at, value, dimension_key, dimension_val)
      VALUES
        ${valuePlaceholders.join(',\n        ')}
      ON CONFLICT (tenant_id, campaign_id, platform, metric_key, recorded_at, COALESCE(dimension_key, ''), COALESCE(dimension_val, ''))
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now()
    `;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return tx.$executeRawUnsafe(sql, ...params);
    });
  }
}
