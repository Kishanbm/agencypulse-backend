import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Brevo (formerly Sendinblue) API service — email campaign performance.
 *
 * API version: v3
 * Docs: https://developers.brevo.com/reference/getEmailCampaigns
 *
 * Auth: `api-key: {key}` request header.
 * Base URL: https://api.brevo.com/v3
 *
 * Approach:
 *   1. `GET /emailCampaigns?status=sent&startDateSent={from}&endDateSent={to}`
 *   2. Each campaign includes aggregate stats (sentCount, openCnt, clickCnt, etc.)
 *   3. Use campaign `sentDate` as `recorded_at`.
 */
@Injectable()
export class BrevoApiService {
  private readonly logger = new Logger(BrevoApiService.name);
  private readonly BASE = 'https://api.brevo.com/v3';

  private headers(apiKey: string): Record<string, string> {
    return {
      'api-key': apiKey,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey    Brevo API key
   * @param _accountId Not needed; Brevo API key scopes to one account. Pass 'default'.
   * @param dateRange { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      status: 'sent',
      startDateSent: dateRange.from,
      endDateSent: dateRange.to,
      limit: '100',
      offset: '0',
    });

    const url = `${this.BASE}/emailCampaigns?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Brevo API key is invalid or unauthorized.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Brevo campaigns list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      campaigns: Array<{
        sentDate: string | null;    // ISO datetime e.g. "2024-01-15T10:00:00+00:00"
        statistics: {
          globalStats: {
            sent: number;
            delivered: number;
            opens: number;
            uniqueOpens: number;
            clickers: number;
            uniqueClicks: number;
            softBounces: number;
            hardBounces: number;
            unsubscriptions: number;
            spamReports: number;
          };
        };
      }>;
    };

    if (!body.campaigns) {
      this.logger.warn('BrevoApiService: unexpected response shape — missing campaigns');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const c of body.campaigns ?? []) {
      const recordedAt = c.sentDate ? c.sentDate.slice(0, 10) : dateRange.to;
      const s = c.statistics?.globalStats;
      if (!s) continue;

      if (s.delivered > 0) rows.push({ metricKey: 'delivered', value: String(safeInt(s.delivered)), recordedAt });
      if (s.uniqueOpens > 0) rows.push({ metricKey: 'opens', value: String(safeInt(s.uniqueOpens)), recordedAt });
      if (s.uniqueClicks > 0) rows.push({ metricKey: 'clicks', value: String(safeInt(s.uniqueClicks)), recordedAt });
      if (s.unsubscriptions > 0) rows.push({ metricKey: 'unsubscribes', value: String(safeInt(s.unsubscriptions)), recordedAt });
      const bounces = (s.softBounces ?? 0) + (s.hardBounces ?? 0);
      if (bounces > 0) rows.push({ metricKey: 'bounces', value: String(safeInt(bounces)), recordedAt });
      if (s.spamReports > 0) rows.push({ metricKey: 'spam_complaints', value: String(safeInt(s.spamReports)), recordedAt });
    }

    return rows;
  }
}
