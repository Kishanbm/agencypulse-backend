import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Basis (Centro) Platform API service — campaign performance metrics.
 *
 * API: Basis Technologies REST API v1
 * Docs: https://api.basis.net/docs
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — BASIS_PLATFORM in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://api.basis.net/v1
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = account_id (numeric, from Basis dashboard)
 *
 * Approach:
 *   GET /campaigns/reporting?account_id={id}&start_date={from}&end_date={to}&interval=day
 *   Returns daily campaign performance: impressions, clicks, spend, conversions.
 *
 * Note: Basis is an enterprise DSP. The API requires partner-level access.
 *   Metrics aggregated at account level across all active campaigns.
 */
@Injectable()
export class BasisApiService {
  private readonly logger = new Logger(BasisApiService.name);
  private readonly BASE = 'https://api.basis.net/v1';

  async fetchCoreMetrics(
    accessToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      account_id: accountId,
      start_date: dateRange.from,
      end_date:   dateRange.to,
      interval:   'day',
      metrics:    'impressions,clicks,spend,conversions,ctr,cpc',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/campaigns/reporting?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Basis Platform OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Basis Platform reporting API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
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
      this.logger.warn('BasisApiService: unexpected response shape — missing data');
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
