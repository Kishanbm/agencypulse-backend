import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Drip API service — email campaign (broadcast) performance.
 *
 * API version: v2
 * Docs: https://developer.drip.com/
 *
 * Auth: HTTP Basic with API token as username, empty password.
 *   `Authorization: Basic base64({apiToken}:)`
 *
 * The account ID is required for all API calls and is stored as `externalAccountId`.
 * Users must provide their Drip account ID during connect.
 *
 * Approach:
 *   1. `GET /v2/{accountId}/broadcasts?status=sent` — lists sent email broadcasts.
 *   2. Filter by `send_at` field within the date range.
 *   3. Each broadcast includes subscriber_count, open_count, click_count stats.
 */
@Injectable()
export class DripApiService {
  private readonly logger = new Logger(DripApiService.name);
  private readonly BASE = 'https://api.getdrip.com/v2';

  private headers(apiToken: string): Record<string, string> {
    // Drip HTTP Basic: token as username, empty password
    const creds = Buffer.from(`${apiToken}:`).toString('base64');
    return {
      Authorization: `Basic ${creds}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * @param apiToken  Drip API token
   * @param accountId Drip account ID (stored as externalAccountId). Required.
   * @param dateRange { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!accountId || accountId === 'default') {
      throw new BadRequestException(
        'Drip requires an account ID. Reconnect and supply your Drip account ID.',
      );
    }

    const resp = await fetchWithRetry(
      `${this.BASE}/${accountId}/broadcasts?status=sent&per_page=50`,
      { headers: this.headers(apiToken) },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Drip API token is invalid or lacks permission.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Drip broadcasts list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      broadcasts?: Array<{
        id: string;
        send_at: string | null;           // ISO datetime
        status: string;
        subscriber_count: number;
        open_count: number;
        unique_open_count: number;
        click_count: number;
        unique_click_count: number;
        unsubscribe_count: number;
        hard_bounce_count: number;
        soft_bounce_count: number;
        spam_complaint_count: number;
      }>;
    };

    if (!body.broadcasts) {
      this.logger.warn('DripApiService: unexpected response shape — missing broadcasts');
      return [];
    }

    const fromMs = new Date(`${dateRange.from}T00:00:00Z`).getTime();
    const toMs   = new Date(`${dateRange.to}T23:59:59Z`).getTime();

    const rows: MetricRowInput[] = [];

    for (const b of body.broadcasts ?? []) {
      if (!b.send_at) continue;
      const sendMs = new Date(b.send_at).getTime();
      if (sendMs < fromMs || sendMs > toMs) continue;

      const recordedAt = b.send_at.slice(0, 10);

      if (b.subscriber_count > 0)  rows.push({ metricKey: 'sends',        value: String(b.subscriber_count),    recordedAt });
      if (b.unique_open_count > 0) rows.push({ metricKey: 'opens',        value: String(b.unique_open_count),   recordedAt });
      if (b.unique_click_count > 0) rows.push({ metricKey: 'clicks',      value: String(b.unique_click_count),  recordedAt });
      if (b.unsubscribe_count > 0) rows.push({ metricKey: 'unsubscribes', value: String(b.unsubscribe_count),   recordedAt });
      const bounces = (b.hard_bounce_count ?? 0) + (b.soft_bounce_count ?? 0);
      if (bounces > 0)             rows.push({ metricKey: 'bounces',      value: String(bounces),               recordedAt });
      if (b.spam_complaint_count > 0) rows.push({ metricKey: 'spam_complaints', value: String(b.spam_complaint_count), recordedAt });
    }

    return rows;
  }
}
