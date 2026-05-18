import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt } from '../../../common/utils/safe-parse';

/**
 * Campaign Monitor API service — email campaign performance.
 *
 * API version: v3.3
 * Docs: https://www.campaignmonitor.com/api/campaigns/
 *
 * Auth: HTTP Basic with API key as username, any string as password.
 *   `Authorization: Basic base64({apiKey}:x)`
 *
 * Approach:
 *   1. `GET /api/v3.3/clients/{clientId}/campaigns.json?sentfromdate=...&senttodate=...`
 *   2. The clientId must be stored as `externalAccountId` — user provides it during connect.
 *   3. Campaign list includes: CampaignID, Subject, SentDate, TotalRecipients, Opens, Clicks, etc.
 *
 * Note: For simplicity, the Campaign Monitor client ID is stored as externalAccountId.
 * If not set, we fall back to listing all campaigns across the account.
 */
@Injectable()
export class CampaignMonitorApiService {
  private readonly logger = new Logger(CampaignMonitorApiService.name);
  private readonly BASE = 'https://api.createsend.com/api/v3.3';

  private headers(apiKey: string): Record<string, string> {
    // Campaign Monitor uses HTTP Basic auth: API key as username, "x" as password
    const creds = Buffer.from(`${apiKey}:x`).toString('base64');
    return {
      Authorization: `Basic ${creds}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey    Campaign Monitor API key
   * @param clientId  Campaign Monitor client ID (stored as externalAccountId). Pass 'default' if not set.
   * @param dateRange { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    clientId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    // If clientId not set, try to get the first client for this account
    const resolvedClientId = (clientId === 'default') ? await this.getFirstClientId(apiKey) : clientId;

    const params = new URLSearchParams({
      sentfromdate: dateRange.from,
      senttodate: dateRange.to,
    });

    const url = `${this.BASE}/clients/${resolvedClientId}/campaigns.json?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (resp.status === 401 || resp.status === 400) {
      throw new BadRequestException('Campaign Monitor API key is invalid or client ID is incorrect.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Campaign Monitor campaigns list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      Results: Array<{
        CampaignID: string;
        SentDate: string;    // "YYYY-MM-DD HH:MM:SS"
        TotalRecipients: number;
        Opens: number;
        UniqueOpens: number;
        Clicks: number;
        UniqueClicks: number;
        Unsubscribed: number;
        Bounced: number;
        SpamComplaints: number;
      }>;
    };
    const campaigns = body.Results ?? [];

    const rows: MetricRowInput[] = [];

    for (const c of campaigns) {
      const recordedAt = c.SentDate ? c.SentDate.slice(0, 10) : dateRange.to;

      if (c.TotalRecipients > 0)  rows.push({ metricKey: 'sends',        value: String(safeInt(c.TotalRecipients)), recordedAt });
      if (c.UniqueOpens > 0)      rows.push({ metricKey: 'opens',        value: String(safeInt(c.UniqueOpens)),     recordedAt });
      if (c.UniqueClicks > 0)     rows.push({ metricKey: 'clicks',       value: String(safeInt(c.UniqueClicks)),    recordedAt });
      if (c.Unsubscribed > 0)     rows.push({ metricKey: 'unsubscribes', value: String(safeInt(c.Unsubscribed)),    recordedAt });
      if (c.Bounced > 0)          rows.push({ metricKey: 'bounces',      value: String(safeInt(c.Bounced)),         recordedAt });
      if (c.SpamComplaints > 0)   rows.push({ metricKey: 'spam_complaints', value: String(safeInt(c.SpamComplaints)), recordedAt });
    }

    return rows;
  }

  // ─── Private: get first client ID for this API key ────────────────────────

  private async getFirstClientId(apiKey: string): Promise<string> {
    // GET /api/v3.3/clients.json — returns list of clients accessible to this API key
    const resp = await fetchWithRetry(`${this.BASE}/clients.json`, {
      headers: this.headers(apiKey),
    });
    if (!resp.ok) {
      throw new BadRequestException(
        'Campaign Monitor: could not list clients. Provide a client ID during connect.',
      );
    }
    const clients = await resp.json() as Array<{ ClientID: string; Name: string }>;
    if (!clients?.length) {
      throw new BadRequestException('Campaign Monitor: no clients found for this API key.');
    }
    this.logger.debug(`Campaign Monitor: using first client "${clients[0].Name}" (${clients[0].ClientID})`);
    return clients[0].ClientID;
  }
}
