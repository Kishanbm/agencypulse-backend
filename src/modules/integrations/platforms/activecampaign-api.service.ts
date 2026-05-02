import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * ActiveCampaign API service — fetches email campaign performance metrics.
 *
 * API version: v3 (current)
 * Docs: https://developers.activecampaign.com/reference
 *
 * Auth: `Api-Token: {key}` request header.
 * Base URL is per-account: `https://{accountName}.api-us1.com`
 * The `apiUrl` is stored in `externalAccountId` as JSON: `{"apiUrl":"https://..."}`.
 *
 * Approach:
 *   1. `GET /api/3/campaigns` filtered by send date range.
 *   2. Each campaign record already contains aggregate stats (sends, opens, clicks, etc.).
 *   3. Use `sdate` (send date) as `recorded_at`.
 *
 * Metrics: sends (totalrecipients), unique opens (uniqueopens), unique clicks (uniqueclicks),
 *          unsubscribes, bounces (hardbounces + softbounces).
 */
@Injectable()
export class ActiveCampaignApiService {
  private readonly logger = new Logger(ActiveCampaignApiService.name);

  private headers(apiKey: string): Record<string, string> {
    return {
      'Api-Token': apiKey,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey       ActiveCampaign API key
   * @param accountId    JSON string `{"apiUrl":"https://account.api-us1.com"}` from externalAccountId
   * @param dateRange    { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const apiUrl = this.resolveApiUrl(accountId);

    const params = new URLSearchParams({
      limit: '100',
      'filters[sdate_after]': `${dateRange.from} 00:00:00`,
      'filters[sdate_before]': `${dateRange.to} 23:59:59`,
    });

    const url = `${apiUrl}/api/3/campaigns?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('ActiveCampaign API key is invalid or lacks permission.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `ActiveCampaign campaigns list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      campaigns: Array<{
        sdate: string | null;         // send date "YYYY-MM-DD HH:MM:SS" or ISO
        totalrecipients: string;      // total sends (string in API)
        uniqueopens: string;
        uniqueclicks: string;
        unsubscribes: string;
        hardbounces: string;
        softbounces: string;
      }>;
    };

    if (!body.campaigns) {
      this.logger.warn('ActiveCampaignApiService: unexpected response shape — missing campaigns');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const c of body.campaigns ?? []) {
      const recordedAt = c.sdate ? c.sdate.slice(0, 10) : dateRange.to;

      const sends        = safeInt(c.totalrecipients ?? '0');
      const opens        = safeInt(c.uniqueopens ?? '0');
      const clicks       = safeInt(c.uniqueclicks ?? '0');
      const unsubscribes = safeInt(c.unsubscribes ?? '0');
      const bounces      = safeInt(c.hardbounces ?? '0') + safeInt(c.softbounces ?? '0');

      if (sends > 0) rows.push({ metricKey: 'sends', value: String(sends), recordedAt });
      if (opens > 0) rows.push({ metricKey: 'opens', value: String(opens), recordedAt });
      if (clicks > 0) rows.push({ metricKey: 'clicks', value: String(clicks), recordedAt });
      if (unsubscribes > 0) rows.push({ metricKey: 'unsubscribes', value: String(unsubscribes), recordedAt });
      if (bounces > 0) rows.push({ metricKey: 'bounces', value: String(bounces), recordedAt });
    }

    return rows;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * `accountId` is stored as:
   *   '{"apiUrl":"https://account.api-us1.com"}'  — when user provided apiUrl
   *   'default'  — fallback (shouldn't happen for ActiveCampaign; user must supply apiUrl)
   */
  private resolveApiUrl(accountId: string): string {
    if (accountId === 'default') {
      throw new BadRequestException(
        'ActiveCampaign requires an account API URL. ' +
        'Reconnect and supply the account base URL (e.g. https://myaccount.api-us1.com).',
      );
    }
    try {
      const parsed = JSON.parse(accountId) as { apiUrl?: string };
      if (!parsed.apiUrl) throw new Error('missing apiUrl');
      return parsed.apiUrl.replace(/\/$/, '');
    } catch {
      // Fallback: treat accountId itself as the URL (legacy / manual entry)
      return accountId.replace(/\/$/, '');
    }
  }
}
