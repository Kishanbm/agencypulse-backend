import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Constant Contact API service — email campaign performance.
 *
 * API version: v3
 * Docs: https://developer.constantcontact.com/api_reference/index.html
 *
 * Auth: OAuth 2.0. `Authorization: Bearer {access_token}` header.
 * Base URL: https://api.cc.email/v3
 * Token refresh: handled by StandardTokenService (hasRefreshToken: true).
 *
 * Approach:
 *   1. `GET /emails/activities?status=COMPLETE&limit=50&include_single_use=true`
 *   2. Filter activities by `scheduled_date` within the date range.
 *   3. For each email activity, use `GET /reports/email_reports/{campaign_activity_id}/tracking/unique_opens`
 *      is expensive — so we use the aggregated stats from the campaign_activity itself.
 *
 * Simpler approach: `GET /reports/email_reports?limit=50&after={from}&before={to}`
 * Returns per-campaign aggregate stats directly.
 */
@Injectable()
export class ConstantContactApiService {
  private readonly logger = new Logger(ConstantContactApiService.name);
  private readonly BASE = 'https://api.cc.email/v3';

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param accessToken  Constant Contact OAuth access token
   * @param _accountId   Not needed; token scopes to account. Pass 'default'.
   * @param dateRange    { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    accessToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    // Fetch email campaign activities (sends) completed in date range
    const params = new URLSearchParams({
      status: 'COMPLETE',
      limit: '50',
      // Constant Contact uses ISO datetime filters
      after: `${dateRange.from}T00:00:00-00:00`,
      before: `${dateRange.to}T23:59:59-00:00`,
    });

    const url = `${this.BASE}/emails/activities?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(accessToken) });

    if (resp.status === 401) {
      throw new BadRequestException('Constant Contact access token expired. Please reconnect.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Constant Contact email activities failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      campaign_activities: Array<{
        campaign_activity_id: string;
        scheduled_date: string | null;     // ISO datetime
        unique_sends: number;
        opens: number;
        unique_opens: number;
        clicks: number;
        unique_clicks: number;
        optouts: number;
        bounces: number;
        spam_count: number;
      }>;
    };

    if (!body.campaign_activities) {
      this.logger.warn('ConstantContactApiService: unexpected response shape — missing campaign_activities');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const a of body.campaign_activities ?? []) {
      const recordedAt = a.scheduled_date ? a.scheduled_date.slice(0, 10) : dateRange.to;

      if (a.unique_sends > 0)  rows.push({ metricKey: 'sends',        value: String(safeInt(a.unique_sends)),  recordedAt });
      if (a.unique_opens > 0)  rows.push({ metricKey: 'opens',        value: String(safeInt(a.unique_opens)),  recordedAt });
      if (a.unique_clicks > 0) rows.push({ metricKey: 'clicks',       value: String(safeInt(a.unique_clicks)), recordedAt });
      if (a.optouts > 0)       rows.push({ metricKey: 'unsubscribes', value: String(safeInt(a.optouts)),       recordedAt });
      if (a.bounces > 0)       rows.push({ metricKey: 'bounces',      value: String(safeInt(a.bounces)),       recordedAt });
      if (a.spam_count > 0)    rows.push({ metricKey: 'spam_complaints', value: String(safeInt(a.spam_count)), recordedAt });
    }

    return rows;
  }
}
