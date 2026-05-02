import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Choozle API service — campaign performance metrics.
 *
 * API: Choozle REST API v1
 * Docs: https://app.choozle.com/api/v1/docs
 *
 * Auth: API key passed as Bearer token.
 *   `Authorization: Bearer {api_key}`
 * Base URL: https://app.choozle.com/api/v1
 *
 * Storage layout:
 *   accessToken       = Choozle API key
 *   externalAccountId = account_id (numeric, from Choozle dashboard)
 *
 * Approach:
 *   GET /reports?account_id={id}&date_start={from}&date_end={to}&interval=day
 *   Returns daily performance rows with standard PPC metrics.
 */
@Injectable()
export class ChoozleApiService {
  private readonly logger = new Logger(ChoozleApiService.name);
  private readonly BASE = 'https://app.choozle.com/api/v1';

  async fetchCoreMetrics(
    apiKey: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      account_id:  accountId,
      date_start:  dateRange.from,
      date_end:    dateRange.to,
      interval:    'day',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/reports?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Choozle API key is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Choozle reports API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;
        conversions?: number;
        ctr?: number;
        cpc?: number;
      }>;
    };

    if (!body.data) {
      this.logger.warn('ChoozleApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      if ((day.impressions ?? 0) > 0)  rows.push({ metricKey: 'impressions', value: String(safeInt(day.impressions)),      recordedAt });
      if ((day.clicks ?? 0) > 0)       rows.push({ metricKey: 'clicks',      value: String(safeInt(day.clicks)),           recordedAt });
      if ((day.spend ?? 0) > 0)        rows.push({ metricKey: 'spend',        value: safeFloat(day.spend).toFixed(2),      recordedAt });
      if ((day.ctr ?? 0) > 0)          rows.push({ metricKey: 'ctr',          value: safeFloat(day.ctr).toFixed(4),        recordedAt });
      if ((day.cpc ?? 0) > 0)          rows.push({ metricKey: 'avg_cpc',      value: safeFloat(day.cpc).toFixed(2),        recordedAt });
      if ((day.conversions ?? 0) > 0)  rows.push({ metricKey: 'conversions',  value: String(safeInt(day.conversions)),     recordedAt });
    }
    return rows;
  }
}
