import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * AdRoll Reporting API service — campaign performance metrics.
 *
 * API: NextRoll (AdRoll) Reporting API v1
 * Docs: https://apidocs.nextroll.com/
 *       https://apidocs.nextroll.com/#reports
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — ADROLL in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://services.adroll.com/reporting/api/v1
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = advertiser EID (alphanumeric, from AdRoll dashboard)
 *
 * Approach:
 *   POST /query with JSON body specifying date range, metrics, and grouping.
 *   Returns daily performance rows per advertisable.
 */
@Injectable()
export class AdrollApiService {
  private readonly logger = new Logger(AdrollApiService.name);
  private readonly BASE = 'https://services.adroll.com/reporting/api/v1';

  async fetchCoreMetrics(
    accessToken: string,
    advertiserEid: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const queryBody = {
      date_from:    dateRange.from,
      date_to:      dateRange.to,
      currency:     'USD',
      time_rollup:  'day',
      attributors:  ['click_through'],
      dimensions:   ['date'],
      metrics:      ['impressions', 'clicks', 'spend', 'ctr', 'ecpc', 'total_conversions'],
      advertisables: [advertiserEid],
    };

    const resp = await fetchWithRetry(
      `${this.BASE}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(queryBody),
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('AdRoll OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`AdRoll reporting API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;
        ctr?: number;
        ecpc?: number;
        total_conversions?: number;
      }>;
    };

    if (!body.data) {
      this.logger.warn('AdrollApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      if ((day.impressions ?? 0) > 0)         rows.push({ metricKey: 'impressions', value: String(safeInt(day.impressions)),          recordedAt });
      if ((day.clicks ?? 0) > 0)              rows.push({ metricKey: 'clicks',      value: String(safeInt(day.clicks)),               recordedAt });
      if ((day.spend ?? 0) > 0)               rows.push({ metricKey: 'spend',        value: safeFloat(day.spend).toFixed(2),           recordedAt });
      if ((day.ctr ?? 0) > 0)                 rows.push({ metricKey: 'ctr',          value: safeFloat(day.ctr).toFixed(4),             recordedAt });
      if ((day.ecpc ?? 0) > 0)                rows.push({ metricKey: 'avg_cpc',      value: safeFloat(day.ecpc).toFixed(2),            recordedAt });
      if ((day.total_conversions ?? 0) > 0)   rows.push({ metricKey: 'conversions',  value: String(safeInt(day.total_conversions)),    recordedAt });
    }
    return rows;
  }
}
