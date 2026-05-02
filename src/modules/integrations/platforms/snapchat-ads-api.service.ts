import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Snapchat Ads API service — campaign performance metrics.
 *
 * API: Snapchat Marketing API v1
 * Docs: https://marketingapi.snapchat.com/docs/
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — SNAPCHAT_ADS in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://adsapi.snapchat.com/v1
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = ad_account_id (UUID)
 *
 * Approach:
 *   GET /adaccounts/{ad_account_id}/stats?fields=impressions,swipes,spend,conversions&granularity=DAY
 *                                          &start_time={from}T00:00:00Z&end_time={to}T23:59:59Z
 *   Returns timeseries array with daily stat rows.
 *
 * Note: Snapchat uses "swipes" for clicks. Spend is in micro-currency (divide by 1_000_000).
 */
@Injectable()
export class SnapchatAdsApiService {
  private readonly logger = new Logger(SnapchatAdsApiService.name);
  private readonly BASE = 'https://adsapi.snapchat.com/v1';

  async fetchCoreMetrics(
    accessToken: string,
    adAccountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      fields:      'impressions,swipes,spend,conversions,swipe_up_attribution_installs',
      granularity: 'DAY',
      start_time:  `${dateRange.from}T00:00:00Z`,
      end_time:    `${dateRange.to}T23:59:59Z`,
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/adaccounts/${adAccountId}/stats?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Snapchat Ads OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Snapchat Ads stats API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      timeseries_stats?: Array<{
        timeseries?: Array<{
          start_time?: string;
          end_time?: string;
          stats?: {
            impressions?: number;
            swipes?: number;
            spend?: number;          // micro-currency
            conversions?: number;
          };
        }>;
      }>;
    };

    if (!body.timeseries_stats) {
      this.logger.warn('SnapchatAdsApiService: unexpected response shape — missing timeseries_stats');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const tsObj of body.timeseries_stats ?? []) {
      for (const ts of tsObj.timeseries ?? []) {
        const recordedAt = (ts.start_time ?? dateRange.to).slice(0, 10);
        const s = ts.stats ?? {};
        const spendUsd = (s.spend ?? 0) / 1_000_000; // micro → USD

        if ((s.impressions ?? 0) > 0)  rows.push({ metricKey: 'impressions', value: String(safeInt(s.impressions)),      recordedAt });
        if ((s.swipes ?? 0) > 0)       rows.push({ metricKey: 'clicks',      value: String(safeInt(s.swipes)),           recordedAt });
        if (spendUsd > 0)              rows.push({ metricKey: 'spend',        value: safeFloat(spendUsd).toFixed(2),        recordedAt });
        if ((s.conversions ?? 0) > 0)  rows.push({ metricKey: 'conversions', value: String(safeInt(s.conversions)),      recordedAt });
      }
    }
    return rows;
  }
}
