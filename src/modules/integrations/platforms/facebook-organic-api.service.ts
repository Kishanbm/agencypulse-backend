import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Facebook Organic API service — Page insights (organic reach & engagement).
 *
 * API: Meta Graph API v19.0
 * Docs: https://developers.facebook.com/docs/graph-api/reference/v19.0/page/insights
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (FACEBOOK_ORGANIC in OAUTH_PLATFORM_CONFIGS).
 *   Requires pages_read_engagement and read_insights permissions.
 * Base URL: https://graph.facebook.com/v19.0
 *
 * Storage layout:
 *   accessToken       = OAuth access token
 *   externalAccountId = Facebook Page ID
 *
 * Approach:
 *   GET /{pageId}/insights?metric=page_impressions,page_reach,page_engaged_users,page_post_engagements
 *     &period=day&since={from}&until={to}
 *   Returns values array per metric per day. Response:
 *     data[].name = metric key, data[].values[].value = daily count, data[].values[].end_time = date
 */
@Injectable()
export class FacebookOrganicApiService {
  private readonly logger = new Logger(FacebookOrganicApiService.name);
  private readonly BASE = 'https://graph.facebook.com/v19.0';

  async fetchCoreMetrics(
    accessToken: string,
    pageId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      metric: 'page_impressions,page_reach,page_engaged_users,page_post_engagements',
      period: 'day',
      since: dateRange.from,
      until: dateRange.to,
      access_token: accessToken,
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/${pageId}/insights?${params.toString()}`,
      { headers: { Accept: 'application/json' } },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Facebook OAuth token is invalid or lacks page insights permissions.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Facebook Page insights API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data: Array<{
        name?: string;
        values?: Array<{ value?: number; end_time?: string }>;
      }>;
    };

    if (!body.data) {
      this.logger.warn('FacebookOrganicApiService: unexpected response shape — missing data');
      return [];
    }

    const metricKeyMap: Record<string, string> = {
      page_impressions:      'impressions',
      page_reach:            'reach',
      page_engaged_users:    'engaged_users',
      page_post_engagements: 'post_engagements',
    };

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
