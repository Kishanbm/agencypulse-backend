import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * GroundTruth Ads Manager API service — campaign performance metrics.
 *
 * API: GroundTruth Ads Manager API v1
 * Docs: https://developer.groundtruth.com/ (requires partner access)
 *
 * Auth: API key in Authorization Bearer header (partner API credentials).
 * Base URL: https://api.groundtruth.com/v1
 *
 * Storage layout:
 *   accessToken       = GroundTruth API key
 *   externalAccountId = account_id (numeric, from GroundTruth Ads Manager)
 *
 * Approach:
 *   GET /campaigns/stats?account_id={id}&start_date={from}&end_date={to}&granularity=daily
 *   Returns daily performance: impressions, clicks, spend, visits (location visits), CTR.
 *
 * Note: GroundTruth is a location-based advertising platform. Key differentiating metric
 *   is store_visits (attributed physical store visits from ad exposure).
 */
@Injectable()
export class GroundtruthApiService {
  private readonly logger = new Logger(GroundtruthApiService.name);
  private readonly BASE = 'https://api.groundtruth.com/v1';

  async fetchCoreMetrics(
    apiKey: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      account_id:  accountId,
      start_date:  dateRange.from,
      end_date:    dateRange.to,
      granularity: 'daily',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/campaigns/stats?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('GroundTruth API key is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`GroundTruth campaign stats API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;
        store_visits?: number;
        ctr?: number;
      }>;
    };

    if (!body.data) {
      this.logger.warn('GroundtruthApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      if ((day.impressions ?? 0) > 0)   rows.push({ metricKey: 'impressions',  value: String(safeInt(day.impressions)),      recordedAt });
      if ((day.clicks ?? 0) > 0)        rows.push({ metricKey: 'clicks',       value: String(safeInt(day.clicks)),           recordedAt });
      if ((day.spend ?? 0) > 0)         rows.push({ metricKey: 'spend',         value: safeFloat(day.spend).toFixed(2), recordedAt });
      if ((day.ctr ?? 0) > 0)           rows.push({ metricKey: 'ctr',           value: safeFloat(day.ctr).toFixed(4),   recordedAt });
      if ((day.store_visits ?? 0) > 0)  rows.push({ metricKey: 'store_visits',  value: String(safeInt(day.store_visits)),    recordedAt });
    }
    return rows;
  }
}
