import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Pinterest Organic API service — User account analytics (organic content performance).
 *
 * API: Pinterest API v5
 * Docs: https://developers.pinterest.com/docs/api/v5/#tag/user_account/operation/user_account/analytics
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (PINTEREST_ORGANIC in OAUTH_PLATFORM_CONFIGS).
 *   Requires user_accounts:read scope.
 * Base URL: https://api.pinterest.com/v5
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = 'default' (user-level endpoint — no account ID needed)
 *
 * Approach:
 *   GET /user_account/analytics?start_date={from}&end_date={to}&granularity=DAY
 *   Returns daily breakdown for organic pins and repins:
 *     all.daily_metrics[].metrics.IMPRESSION, OUTBOUND_CLICK, SAVE, ENGAGEMENT, PIN_CLICK
 */
@Injectable()
export class PinterestOrganicApiService {
  private readonly logger = new Logger(PinterestOrganicApiService.name);
  private readonly BASE = 'https://api.pinterest.com/v5';

  async fetchCoreMetrics(
    accessToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      start_date:  dateRange.from,
      end_date:    dateRange.to,
      granularity: 'DAY',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/user_account/analytics?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Pinterest OAuth token is invalid or lacks user_accounts:read scope.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Pinterest user analytics API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      all?: {
        daily_metrics?: Array<{
          date?: string;
          metrics?: {
            IMPRESSION?: number;
            OUTBOUND_CLICK?: number;
            SAVE?: number;
            ENGAGEMENT?: number;
            PIN_CLICK?: number;
          };
        }>;
      };
    };

    if (!body.all) {
      this.logger.warn('PinterestOrganicApiService: unexpected response shape — missing all');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const day of body.all?.daily_metrics ?? []) {
      const recordedAt = day.date ?? dateRange.to;
      const m = day.metrics ?? {};
      if ((m.IMPRESSION ?? 0) > 0)      rows.push({ metricKey: 'impressions',    value: String(safeInt(m.IMPRESSION)),    recordedAt });
      if ((m.OUTBOUND_CLICK ?? 0) > 0)  rows.push({ metricKey: 'outbound_clicks', value: String(safeInt(m.OUTBOUND_CLICK)), recordedAt });
      if ((m.SAVE ?? 0) > 0)            rows.push({ metricKey: 'saves',           value: String(safeInt(m.SAVE)),          recordedAt });
      if ((m.ENGAGEMENT ?? 0) > 0)      rows.push({ metricKey: 'engagements',     value: String(safeInt(m.ENGAGEMENT)),    recordedAt });
      if ((m.PIN_CLICK ?? 0) > 0)       rows.push({ metricKey: 'pin_clicks',      value: String(safeInt(m.PIN_CLICK)),     recordedAt });
    }
    return rows;
  }
}
