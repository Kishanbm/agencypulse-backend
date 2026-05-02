import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * X Ads (Twitter Ads) API service — campaign performance metrics.
 *
 * API: X Ads API v12
 * Docs: https://developer.x.com/en/docs/x-ads-api/campaign-management/api-reference/campaigns
 *       https://developer.x.com/en/docs/x-ads-api/analytics/api-reference/stats
 *
 * Auth: OAuth 2.0 Bearer token (PKCE flow, via StandardTokenService — X_ADS in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://ads-api.x.com/12
 *
 * Storage layout:
 *   accessToken       = OAuth 2.0 Bearer token
 *   externalAccountId = accountId (ads account ID, e.g. "18ce54d4x5t")
 *
 * Approach:
 *   POST /stats/accounts/{accountId} with entity_type=CAMPAIGN, granularity=DAY,
 *   metric_groups=BILLING,ENGAGEMENT,VIDEO, start_time/end_time.
 *   Returns synchronous stats breakdown per day.
 *
 * Note: X Ads uses "engagements" for clicks/interactions. Spend is in micro-USD (÷ 1_000_000).
 */
@Injectable()
export class XAdsApiService {
  private readonly logger = new Logger(XAdsApiService.name);
  private readonly BASE = 'https://ads-api.x.com/12';

  async fetchCoreMetrics(
    accessToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      entity_type:   'CAMPAIGN',
      granularity:   'DAY',
      metric_groups: 'BILLING,ENGAGEMENT',
      start_time:    `${dateRange.from}T00:00:00Z`,
      end_time:      `${dateRange.to}T23:59:59Z`,
      placement:     'ALL_ON_TWITTER',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/stats/accounts/${accountId}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('X Ads OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`X Ads stats API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        id?: string;
        id_data?: Array<{
          metrics?: {
            impressions?: (number | null)[];
            clicks?: (number | null)[];
            billed_charge_local_micro?: (number | null)[];
            engagements?: (number | null)[];
            conversions?: (number | null)[];
          };
        }>;
        time_series?: string[];
      }>;
    };

    if (!body.data) {
      this.logger.warn('XAdsApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const entity of body.data ?? []) {
      const timeSeries = entity.time_series ?? [];
      for (const idData of entity.id_data ?? []) {
        const m = idData.metrics ?? {};
        timeSeries.forEach((dateStr, idx) => {
          const recordedAt = dateStr.slice(0, 10);
          const impressions = m.impressions?.[idx] ?? 0;
          const clicks      = m.clicks?.[idx] ?? m.engagements?.[idx] ?? 0;
          const spendMicro  = m.billed_charge_local_micro?.[idx] ?? 0;
          const conversions = m.conversions?.[idx] ?? 0;
          const spendUsd    = (spendMicro ?? 0) / 1_000_000;

          if ((impressions ?? 0) > 0) rows.push({ metricKey: 'impressions', value: String(impressions), recordedAt });
          if ((clicks ?? 0) > 0)     rows.push({ metricKey: 'clicks',      value: String(clicks),      recordedAt });
          if (spendUsd > 0)           rows.push({ metricKey: 'spend',       value: spendUsd.toFixed(2), recordedAt });
          if ((conversions ?? 0) > 0) rows.push({ metricKey: 'conversions', value: String(conversions), recordedAt });
        });
      }
    }
    return rows;
  }
}
