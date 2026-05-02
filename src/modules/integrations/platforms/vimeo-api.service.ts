import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Vimeo API service — Video account analytics (organic video performance).
 *
 * API: Vimeo API v3.4
 * Docs: https://developer.vimeo.com/api/reference/videos#get_videos
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (VIMEO in OAUTH_PLATFORM_CONFIGS).
 *   Requires public and private scopes.
 * Base URL: https://api.vimeo.com
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = 'default' (user-level endpoint — no separate account ID)
 *
 * Approach:
 *   GET /me/videos?fields=uri,stats&per_page=100&sort=date&direction=desc
 *   Returns all videos with lifetime stats. Aggregated as snapshot at dateRange.to.
 *   Metrics: total_plays, total_likes, total_comments.
 *
 * Note: Vimeo daily granularity analytics require PRO+ plan with the Analytics API
 *   (/me/analytics). Using video stats aggregation avoids a plan-gated endpoint
 *   while still surfacing the key organic reach metrics agencies care about.
 */
@Injectable()
export class VimeoApiService {
  private readonly logger = new Logger(VimeoApiService.name);
  private readonly BASE = 'https://api.vimeo.com';

  async fetchCoreMetrics(
    accessToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      fields:     'uri,stats',
      per_page:   '100',
      sort:       'date',
      direction:  'desc',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/me/videos?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.vimeo.*+json;version=3.4',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Vimeo OAuth token is invalid or lacks video access.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Vimeo videos API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        stats?: {
          plays?:    number;
          likes?:    number;
          comments?: number;
        };
      }>;
    };

    let totalPlays    = 0;
    let totalLikes    = 0;
    let totalComments = 0;

    for (const video of body.data ?? []) {
      totalPlays    += video.stats?.plays    ?? 0;
      totalLikes    += video.stats?.likes    ?? 0;
      totalComments += video.stats?.comments ?? 0;
    }

    const recordedAt = dateRange.to;
    if (!body.data) {
      this.logger.warn('VimeoApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    if (totalPlays > 0)    rows.push({ metricKey: 'total_plays',    value: String(safeInt(totalPlays)),    recordedAt });
    if (totalLikes > 0)    rows.push({ metricKey: 'total_likes',    value: String(safeInt(totalLikes)),    recordedAt });
    if (totalComments > 0) rows.push({ metricKey: 'total_comments', value: String(safeInt(totalComments)), recordedAt });
    return rows;
  }
}
