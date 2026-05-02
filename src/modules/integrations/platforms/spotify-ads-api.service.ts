import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Spotify Ad Analytics API service — campaign performance metrics.
 *
 * API: Spotify Ad Analytics API v1.4
 * Docs: https://developer.spotify.com/documentation/ads-api
 *
 * Auth: OAuth 2.0 Bearer token (client_credentials flow).
 *   Token endpoint: POST https://accounts.spotify.com/api/token
 *   Via StandardTokenService — SPOTIFY_ADS in OAUTH_PLATFORM_CONFIGS.
 * Base URL: https://api-partner.spotify.com/ads/v1.4
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = ad_account_id (from Spotify Ad Studio)
 *
 * Approach:
 *   GET /reports?account_id={id}&start_date={from}&end_date={to}&granularity=daily
 *   Returns daily impressions, clicks, spend, and completion rates for audio/video ads.
 */
@Injectable()
export class SpotifyAdsApiService {
  private readonly logger = new Logger(SpotifyAdsApiService.name);
  private readonly BASE = 'https://api-partner.spotify.com/ads/v1.4';

  async fetchCoreMetrics(
    accessToken: string,
    adAccountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      account_id:  adAccountId,
      start_date:  dateRange.from,
      end_date:    dateRange.to,
      granularity: 'daily',
      metrics:     'impressions,clicks,spend,video_completions,audio_completions,ctr',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/reports?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Spotify Ads OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Spotify Ads reports API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;
        impressions?: number;
        clicks?: number;
        spend?: number;
        video_completions?: number;
        audio_completions?: number;
        ctr?: number;
      }>;
    };

    if (!body.data) {
      this.logger.warn('SpotifyAdsApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.data ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      if ((day.impressions ?? 0) > 0)          rows.push({ metricKey: 'impressions',         value: String(safeInt(day.impressions)),          recordedAt });
      if ((day.clicks ?? 0) > 0)               rows.push({ metricKey: 'clicks',              value: String(safeInt(day.clicks)),               recordedAt });
      if ((day.spend ?? 0) > 0)                rows.push({ metricKey: 'spend',               value: safeFloat(day.spend).toFixed(2),      recordedAt });
      if ((day.ctr ?? 0) > 0)                  rows.push({ metricKey: 'ctr',                 value: safeFloat(day.ctr).toFixed(4),        recordedAt });
      if ((day.video_completions ?? 0) > 0)    rows.push({ metricKey: 'video_completions',   value: String(safeInt(day.video_completions)),    recordedAt });
    }
    return rows;
  }
}
