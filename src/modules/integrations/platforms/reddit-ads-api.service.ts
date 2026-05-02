import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Reddit Ads API service — campaign performance metrics.
 *
 * API: Reddit Ads API v3
 * Docs: https://ads-api.reddit.com/docs/v3
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — REDDIT_ADS in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://ads-api.reddit.com/api/v3
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = account_id (e.g. "t2_xxxxxxxx")
 *
 * Approach:
 *   GET /accounts/{account_id}/reports?date_start={from}&date_end={to}&interval=day
 *        &fields=impressions,clicks,spend,conversions,ctr,cpc
 *   Returns daily breakdown per campaign.
 */
@Injectable()
export class RedditAdsApiService {
  private readonly logger = new Logger(RedditAdsApiService.name);
  private readonly BASE = 'https://ads-api.reddit.com/api/v3';

  async fetchCoreMetrics(
    accessToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      date_start: dateRange.from,
      date_end:   dateRange.to,
      interval:   'day',
      fields:     'impressions,clicks,spend,conversions,ctr,cpc',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/accounts/${accountId}/reports?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Reddit Ads OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Reddit Ads reports API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;       // in USD
        conversions?: number;
        ctr?: number;
        cpc?: number;
      }>;
    };

    if (!body.data) {
      this.logger.warn('RedditAdsApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      if ((day.impressions ?? 0) > 0)  rows.push({ metricKey: 'impressions', value: String(safeInt(day.impressions)), recordedAt });
      if ((day.clicks ?? 0) > 0)       rows.push({ metricKey: 'clicks',      value: String(safeInt(day.clicks)),      recordedAt });
      if ((day.spend ?? 0) > 0)        rows.push({ metricKey: 'spend',        value: safeFloat(day.spend).toFixed(2), recordedAt });
      if ((day.ctr ?? 0) > 0)          rows.push({ metricKey: 'ctr',          value: safeFloat(day.ctr).toFixed(4),   recordedAt });
      if ((day.cpc ?? 0) > 0)          rows.push({ metricKey: 'avg_cpc',      value: safeFloat(day.cpc).toFixed(2),   recordedAt });
      if ((day.conversions ?? 0) > 0)  rows.push({ metricKey: 'conversions',  value: String(safeInt(day.conversions)),     recordedAt });
    }
    return rows;
  }
}
