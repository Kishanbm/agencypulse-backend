import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * TikTok Organic API service — User content metrics (organic video performance).
 *
 * API: TikTok OpenAPI v2 (Login Kit / Content Posting API)
 * Docs: https://developers.tiktok.com/doc/tiktok-api-v2-video-list
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (TIKTOK_ORGANIC in OAUTH_PLATFORM_CONFIGS).
 *   Requires user.info.basic and video.list scopes.
 *   The TIKTOK_ADS platform uses TikTokAdsOAuthService (separate flow); this uses TikTok Login Kit.
 * Base URL: https://open.tiktokapis.com/v2
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token (TikTok user access token)
 *   externalAccountId = 'default' (user-level endpoint — no separate account ID)
 *
 * Approach:
 *   POST /video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count
 *   Filters by create_time in the date range. Aggregates as snapshot at dateRange.to.
 *   Metrics: total_views, total_likes, total_comments, total_shares.
 *
 * Note: TikTok's API returns video-level lifetime stats, not daily breakdowns.
 *   We filter by the video create_time window (new videos published during dateRange)
 *   and aggregate their current stats as a snapshot.
 */
@Injectable()
export class TiktokOrganicApiService {
  private readonly logger = new Logger(TiktokOrganicApiService.name);
  private readonly BASE = 'https://open.tiktokapis.com/v2';

  async fetchCoreMetrics(
    accessToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const fromTs = Math.floor(new Date(dateRange.from).getTime() / 1000);
    const toTs   = Math.floor(new Date(dateRange.to + 'T23:59:59Z').getTime() / 1000);

    const resp = await fetchWithRetry(
      `${this.BASE}/video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ max_count: 20, cursor: 0 }),
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('TikTok OAuth token is invalid or lacks video.list scope.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`TikTok video list API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: {
        videos?: Array<{
          create_time?:   number;
          view_count?:    number;
          like_count?:    number;
          comment_count?: number;
          share_count?:   number;
        }>;
      };
    };

    if (!body.data) {
      this.logger.warn('TiktokOrganicApiService: unexpected response shape — missing data');
      return [];
    }

    let totalViews    = 0;
    let totalLikes    = 0;
    let totalComments = 0;
    let totalShares   = 0;

    for (const video of body.data?.videos ?? []) {
      const ct = video.create_time ?? 0;
      if (ct < fromTs || ct > toTs) continue;
      totalViews    += video.view_count    ?? 0;
      totalLikes    += video.like_count    ?? 0;
      totalComments += video.comment_count ?? 0;
      totalShares   += video.share_count   ?? 0;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (totalViews > 0)    rows.push({ metricKey: 'total_views',    value: String(totalViews),    recordedAt });
    if (totalLikes > 0)    rows.push({ metricKey: 'total_likes',    value: String(totalLikes),    recordedAt });
    if (totalComments > 0) rows.push({ metricKey: 'total_comments', value: String(totalComments), recordedAt });
    if (totalShares > 0)   rows.push({ metricKey: 'total_shares',   value: String(totalShares),   recordedAt });
    return rows;
  }
}
