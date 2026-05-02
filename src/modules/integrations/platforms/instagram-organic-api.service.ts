import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Instagram Organic API service — Business Account insights (organic reach & engagement).
 *
 * API: Meta Graph API v19.0 — Instagram Business Insights
 * Docs: https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (INSTAGRAM_ORGANIC in OAUTH_PLATFORM_CONFIGS).
 *   Requires instagram_basic and instagram_manage_insights permissions.
 *   The token is a Facebook User access token linked to the Instagram Business Account.
 * Base URL: https://graph.facebook.com/v19.0
 *
 * Storage layout:
 *   accessToken       = OAuth access token (Facebook User token)
 *   externalAccountId = Instagram Business Account ID (igUserId — numeric string)
 *
 * Approach:
 *   GET /{igUserId}/insights?metric=impressions,reach,profile_views,follower_count
 *     &period=day&since={from}&until={to}
 *   Returns values array per metric per day.
 *
 * Note: follower_count is daily net new followers; impressions/reach are content-level aggregates.
 */
@Injectable()
export class InstagramOrganicApiService {
  private readonly logger = new Logger(InstagramOrganicApiService.name);
  private readonly BASE = 'https://graph.facebook.com/v19.0';

  async fetchCoreMetrics(
    accessToken: string,
    igUserId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      metric: 'impressions,reach,profile_views,follower_count',
      period: 'day',
      since: dateRange.from,
      until: dateRange.to,
      access_token: accessToken,
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/${igUserId}/insights?${params.toString()}`,
      { headers: { Accept: 'application/json' } },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Instagram OAuth token is invalid or lacks manage_insights permission.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Instagram Insights API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        name?: string;
        values?: Array<{ value?: number; end_time?: string }>;
      }>;
    };

    const metricKeyMap: Record<string, string> = {
      impressions:    'impressions',
      reach:          'reach',
      profile_views:  'profile_views',
      follower_count: 'new_followers',
    };

    if (!body.data) {
      this.logger.warn('InstagramOrganicApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const metric of body.data ?? []) {
      const metricKey = metricKeyMap[metric.name ?? ''];
      if (!metricKey) continue;
      for (const day of metric.values ?? []) {
        const value = day.value ?? 0;
        if (value <= 0) continue;
        const recordedAt = day.end_time
          ? day.end_time.slice(0, 10)
          : dateRange.to;
        rows.push({ metricKey, value: String(value), recordedAt });
      }
    }
    return rows;
  }
}
