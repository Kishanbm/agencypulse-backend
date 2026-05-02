import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * X (Twitter) Organic API service — Organic tweet engagement metrics.
 *
 * API: X API v2
 * Docs: https://developer.x.com/en/docs/x-api/tweets/timelines/api-reference/get-users-id-tweets
 *
 * Auth: OAuth 2.0 PKCE Bearer token via StandardTokenService (X_ORGANIC in OAUTH_PLATFORM_CONFIGS).
 *   Requires tweet.read and users.read scopes.
 * Base URL: https://api.x.com/2
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token (user context)
 *   externalAccountId = X numeric user ID
 *
 * Approach:
 *   GET /users/{userId}/tweets?tweet.fields=public_metrics,created_at
 *     &max_results=100&start_time={from}T00:00:00Z&end_time={to}T23:59:59Z
 *   Aggregates impressions, likes, retweets, replies across all tweets in the date range.
 *   Stored as a single snapshot at dateRange.to (not per-day — tweet-level data only).
 *
 * Note: X API v2 Basic/Elevated access required for public_metrics on other users' tweets.
 *   For user's own tweets (user context with tweet.read), public_metrics is available on Free tier.
 */
@Injectable()
export class XOrganicApiService {
  private readonly logger = new Logger(XOrganicApiService.name);
  private readonly BASE = 'https://api.x.com/2';

  async fetchCoreMetrics(
    accessToken: string,
    userId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      'tweet.fields': 'public_metrics,created_at',
      max_results:    '100',
      start_time:     `${dateRange.from}T00:00:00Z`,
      end_time:       `${dateRange.to}T23:59:59Z`,
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/users/${userId}/tweets?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('X OAuth token is invalid or lacks tweet.read scope.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`X (Twitter) tweets API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        public_metrics?: {
          impression_count?: number;
          like_count?:       number;
          retweet_count?:    number;
          reply_count?:      number;
          quote_count?:      number;
        };
      }>;
    };

    if (!body.data) {
      this.logger.warn('XOrganicApiService: unexpected response shape — missing data');
      return [];
    }

    let impressions = 0;
    let likes       = 0;
    let retweets    = 0;
    let replies     = 0;

    for (const tweet of body.data ?? []) {
      const m = tweet.public_metrics ?? {};
      impressions += m.impression_count ?? 0;
      likes       += m.like_count       ?? 0;
      retweets    += m.retweet_count    ?? 0;
      replies     += m.reply_count      ?? 0;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (impressions > 0) rows.push({ metricKey: 'impressions', value: String(impressions), recordedAt });
    if (likes > 0)       rows.push({ metricKey: 'likes',       value: String(likes),       recordedAt });
    if (retweets > 0)    rows.push({ metricKey: 'retweets',    value: String(retweets),    recordedAt });
    if (replies > 0)     rows.push({ metricKey: 'replies',     value: String(replies),     recordedAt });
    return rows;
  }
}
