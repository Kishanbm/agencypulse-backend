import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Yelp Ads API service — CPC advertising performance metrics.
 *
 * API: Yelp Partner API v1 (Advertising)
 * Docs: https://docs.developer.yelp.com/docs/partner-api
 *
 * Auth: API key via Authorization Bearer header.
 *   `Authorization: Bearer {api_key}`
 *   Requires Yelp Ads partner access (separate from Yelp Fusion API key).
 * Base URL: https://partner-api.yelp.com/v1
 *
 * Storage layout:
 *   accessToken       = Yelp Ads partner API key
 *   externalAccountId = business_id (Yelp business alias or encoded ID)
 *
 * Approach:
 *   GET /advertising/performance?business_id={id}&start_date={from}&end_date={to}&interval=day
 *   Returns daily CPC ad performance: impressions, clicks, spend, CTR.
 */
@Injectable()
export class YelpAdsApiService {
  private readonly logger = new Logger(YelpAdsApiService.name);
  private readonly BASE = 'https://partner-api.yelp.com/v1';

  async fetchCoreMetrics(
    apiKey: string,
    businessId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      business_id: businessId,
      start_date:  dateRange.from,
      end_date:    dateRange.to,
      interval:    'day',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/advertising/performance?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Yelp Ads API key is invalid or lacks partner access.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Yelp Ads performance API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;
        ctr?: number;
        conversions?: number;
      }>;
    };

    if (!body.data) {
      this.logger.warn('YelpAdsApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      if ((day.impressions ?? 0) > 0)  rows.push({ metricKey: 'impressions', value: String(safeInt(day.impressions)),        recordedAt });
      if ((day.clicks ?? 0) > 0)       rows.push({ metricKey: 'clicks',      value: String(safeInt(day.clicks)),              recordedAt });
      if ((day.spend ?? 0) > 0)        rows.push({ metricKey: 'spend',        value: safeFloat(day.spend).toFixed(2),         recordedAt });
      if ((day.ctr ?? 0) > 0)          rows.push({ metricKey: 'ctr',          value: safeFloat(day.ctr).toFixed(4),            recordedAt });
      if ((day.conversions ?? 0) > 0)  rows.push({ metricKey: 'conversions',  value: String(safeInt(day.conversions)),         recordedAt });
    }
    return rows;
  }
}
