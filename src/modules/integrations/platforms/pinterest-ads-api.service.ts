import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Pinterest Ads API service — campaign performance metrics.
 *
 * API: Pinterest Ads API v5
 * Docs: https://developers.pinterest.com/docs/api/v5/ad_account-analytics
 *
 * Auth: OAuth 2.0 Bearer token (ads:read scope).
 *   Via StandardTokenService — PINTEREST_ADS in OAUTH_PLATFORM_CONFIGS.
 * Base URL: https://api.pinterest.com/v5
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = ad_account_id (numeric string)
 *
 * Approach:
 *   GET /ad_accounts/{ad_account_id}/analytics?start_date={from}&end_date={to}&columns=...&granularity=DAY
 *   Returns daily rows with spend, impressions, clicks, conversions.
 */
@Injectable()
export class PinterestAdsApiService {
  private readonly logger = new Logger(PinterestAdsApiService.name);
  private readonly BASE = 'https://api.pinterest.com/v5';

  async fetchCoreMetrics(
    accessToken: string,
    adAccountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      start_date:  dateRange.from,
      end_date:    dateRange.to,
      columns:     'SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,TOTAL_CONVERSIONS,CTR,CPC_IN_DOLLAR',
      granularity: 'DAY',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/ad_accounts/${adAccountId}/analytics?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Pinterest Ads OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Pinterest Ads analytics API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as Array<{
      DATE?: string;
      SPEND_IN_DOLLAR?: number;
      IMPRESSION_1?: number;
      CLICKTHROUGH_1?: number;
      TOTAL_CONVERSIONS?: number;
      CTR?: number;
      CPC_IN_DOLLAR?: number;
    }>;

    const rows: MetricRowInput[] = [];
    for (const day of body) {
      const recordedAt = day.DATE ?? dateRange.to;
      if (day.IMPRESSION_1 && day.IMPRESSION_1 > 0)        rows.push({ metricKey: 'impressions', value: String(safeInt(day.IMPRESSION_1)),                    recordedAt });
      if (day.CLICKTHROUGH_1 && day.CLICKTHROUGH_1 > 0)    rows.push({ metricKey: 'clicks',      value: String(safeInt(day.CLICKTHROUGH_1)),                  recordedAt });
      if (day.SPEND_IN_DOLLAR && day.SPEND_IN_DOLLAR > 0)  rows.push({ metricKey: 'spend',       value: safeFloat(day.SPEND_IN_DOLLAR).toFixed(2),              recordedAt });
      if (day.CTR && day.CTR > 0)                          rows.push({ metricKey: 'ctr',         value: safeFloat(day.CTR).toFixed(4),                          recordedAt });
      if (day.CPC_IN_DOLLAR && day.CPC_IN_DOLLAR > 0)      rows.push({ metricKey: 'avg_cpc',     value: safeFloat(day.CPC_IN_DOLLAR).toFixed(2),                recordedAt });
      if (day.TOTAL_CONVERSIONS && day.TOTAL_CONVERSIONS > 0) rows.push({ metricKey: 'conversions', value: String(safeInt(day.TOTAL_CONVERSIONS)),            recordedAt });
    }
    return rows;
  }
}
