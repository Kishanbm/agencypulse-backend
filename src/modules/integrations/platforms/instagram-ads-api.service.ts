import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Instagram Ads API service — paid campaign metrics via Meta Graph API.
 *
 * API: Meta Graph API v19.0
 * Docs: https://developers.facebook.com/docs/marketing-api/insights
 *
 * Auth: OAuth 2.0 Bearer token (Meta, same as META_ADS flow).
 *   Via StandardTokenService — INSTAGRAM_ADS in OAUTH_PLATFORM_CONFIGS.
 * Base URL: https://graph.facebook.com/v19.0
 *
 * Storage layout:
 *   accessToken       = Meta OAuth access token
 *   externalAccountId = Meta ad account ID (format: "act_XXXXXXXXXX")
 *
 * Approach:
 *   GET /{adAccountId}/insights?level=account&fields=impressions,clicks,spend,ctr,cpc,
 *        actions&time_increment=1&time_range={since,until}&publisher_platforms=instagram
 *   Returns daily rows filtered to Instagram placements only.
 *
 * Note: This uses the same Meta Graph API as META_ADS but with publisher_platforms=instagram
 *   to isolate Instagram-only spend and performance.
 */
@Injectable()
export class InstagramAdsApiService {
  private readonly logger = new Logger(InstagramAdsApiService.name);
  private readonly GRAPH_BASE = 'https://graph.facebook.com/v19.0';

  async fetchCoreMetrics(
    accessToken: string,
    adAccountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      level:                 'account',
      fields:                'impressions,clicks,spend,ctr,cpc,actions',
      time_increment:        '1',
      time_range:            JSON.stringify({ since: dateRange.from, until: dateRange.to }),
      publisher_platforms:   'instagram',
      access_token:          accessToken,
    });

    const resp = await fetchWithRetry(
      `${this.GRAPH_BASE}/${adAccountId}/insights?${params.toString()}`,
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Instagram Ads Meta OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Instagram Ads insights API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date_start?: string;
        impressions?: string;
        clicks?: string;
        spend?: string;
        ctr?: string;
        cpc?: string;
        actions?: Array<{ action_type?: string; value?: string }>;
      }>;
    };

    if (!body.data) {
      this.logger.warn('InstagramAdsApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt   = day.date_start ?? dateRange.to;
      const impressions  = safeInt(day.impressions ?? '0');
      const clicks       = safeInt(day.clicks ?? '0');
      const spend        = safeFloat(day.spend ?? '0');
      const ctr          = safeFloat(day.ctr ?? '0');
      const cpc          = safeFloat(day.cpc ?? '0');
      const conversions  = (day.actions ?? [])
        .filter(a => a.action_type === 'purchase' || a.action_type === 'lead')
        .reduce((sum, a) => sum + safeFloat(a.value ?? '0'), 0);

      if (impressions > 0)  rows.push({ metricKey: 'impressions', value: String(impressions),  recordedAt });
      if (clicks > 0)       rows.push({ metricKey: 'clicks',      value: String(clicks),        recordedAt });
      if (spend > 0)        rows.push({ metricKey: 'spend',        value: spend.toFixed(2),      recordedAt });
      if (ctr > 0)          rows.push({ metricKey: 'ctr',          value: ctr.toFixed(4),        recordedAt });
      if (cpc > 0)          rows.push({ metricKey: 'avg_cpc',      value: cpc.toFixed(2),        recordedAt });
      if (conversions > 0)  rows.push({ metricKey: 'conversions',  value: conversions.toFixed(2), recordedAt });
    }
    return rows;
  }
}
