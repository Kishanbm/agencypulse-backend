import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';

/**
 * Klaviyo API service — fetches email campaign performance metrics.
 *
 * API version: 2023-12-15 (latest stable)
 * Docs: https://developers.klaviyo.com/en/v2023-12-15/reference
 *
 * Auth: Private API key in `Authorization: Klaviyo-API-Key {key}` header.
 * Every request must include `revision: 2023-12-15` header.
 *
 * Approach:
 *   1. `POST /api/campaign-values-reports/` — returns aggregate stats per campaign
 *      for a given date range (sent_at in range). One row per campaign.
 *   2. We use each campaign's `send_time` as `recorded_at` so metrics are
 *      anchored to the actual send date for time-series charts.
 *
 * Metrics fetched per campaign:
 *   delivered_count, open_count, click_count, unsubscribed_count, bounce_count,
 *   spam_complaint_count
 */
@Injectable()
export class KlaviyoApiService {
  private readonly logger = new Logger(KlaviyoApiService.name);
  private readonly BASE = 'https://a.klaviyo.com';
  private readonly REVISION = '2023-12-15';

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: this.REVISION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch campaign performance metrics for the given date range.
   * Uses the Campaign Values Report endpoint (POST /api/campaign-values-reports/).
   * Returns MetricRowInput[] ready for upsert.
   *
   * @param apiKey     Klaviyo private API key
   * @param _accountId Not used by Klaviyo (API key already scopes to one account). Pass 'default'.
   * @param dateRange  { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
   */
  async fetchCoreMetrics(
    apiKey: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const campaigns = await this.listCampaigns(apiKey, dateRange);

    if (campaigns.length === 0) {
      this.logger.debug('Klaviyo: no campaigns found in date range');
      return [];
    }

    const campaignIds = campaigns.map((c) => c.id);
    const stats = await this.fetchCampaignStats(apiKey, campaignIds, dateRange);

    // Build lookup: campaignId → send_time (YYYY-MM-DD)
    const sendDateMap = new Map<string, string>();
    for (const c of campaigns) {
      if (c.send_time) {
        sendDateMap.set(c.id, c.send_time.slice(0, 10));
      }
    }

    const rows: MetricRowInput[] = [];

    for (const stat of stats) {
      const recordedAt = sendDateMap.get(stat.id) ?? dateRange.to;
      const a = stat.attributes;

      if (a.delivered_count != null) rows.push({ metricKey: 'delivered', value: String(a.delivered_count), recordedAt });
      if (a.open_count != null)      rows.push({ metricKey: 'opens', value: String(a.open_count), recordedAt });
      if (a.click_count != null)     rows.push({ metricKey: 'clicks', value: String(a.click_count), recordedAt });
      if (a.unsubscribed_count != null) rows.push({ metricKey: 'unsubscribes', value: String(a.unsubscribed_count), recordedAt });
      if (a.bounce_count != null)    rows.push({ metricKey: 'bounces', value: String(a.bounce_count), recordedAt });
      if (a.spam_complaint_count != null) rows.push({ metricKey: 'spam_complaints', value: String(a.spam_complaint_count), recordedAt });
    }

    return rows;
  }

  // ─── Private: list campaigns in date range ────────────────────────────────────

  private async listCampaigns(
    apiKey: string,
    dateRange: { from: string; to: string },
  ): Promise<Array<{ id: string; send_time: string | null }>> {
    // Klaviyo does not support filtering by send_time on the campaigns list endpoint.
    // Fetch all email campaigns and filter by send_time in-memory.
    const filter = encodeURIComponent(`equals(messages.channel,'email')`);
    const url = `${this.BASE}/api/campaigns/?filter=${filter}&fields[campaign]=send_time,status`;

    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Klaviyo campaigns list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      data: Array<{ id: string; attributes: { send_time: string | null } }>;
    };

    // Filter in-memory: only campaigns whose send_time falls in the date range
    const from = new Date(`${dateRange.from}T00:00:00Z`).getTime();
    const to   = new Date(`${dateRange.to}T23:59:59Z`).getTime();

    return (body.data ?? [])
      .map((d) => ({ id: d.id, send_time: d.attributes.send_time }))
      .filter((c) => {
        if (!c.send_time) return false;
        const t = new Date(c.send_time).getTime();
        return t >= from && t <= to;
      });
  }

  // ─── Private: fetch campaign stats ───────────────────────────────────────────

  private async fetchCampaignStats(
    apiKey: string,
    campaignIds: string[],
    _dateRange: { from: string; to: string },
  ): Promise<Array<{
    id: string;
    attributes: {
      delivered_count: number | null;
      open_count: number | null;
      click_count: number | null;
      unsubscribed_count: number | null;
      bounce_count: number | null;
      spam_complaint_count: number | null;
    };
  }>> {
    // POST /api/campaign-values-reports/ — returns per-campaign aggregate stats
    // for the given campaign IDs and date range.
    const payload = {
      data: {
        type: 'campaign-values-report',
        attributes: {
          statistics: [
            'delivered_count',
            'open_count',
            'click_count',
            'unsubscribed_count',
            'bounce_count',
            'spam_complaint_count',
          ],
          filter: `any(campaign_ids,[${campaignIds.map((id) => `'${id}'`).join(',')}])`,
        },
      },
    };

    const resp = await fetchWithRetry(
      `${this.BASE}/api/campaign-values-reports/`,
      {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify(payload),
      },
    );

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Klaviyo campaign values report failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      data: Array<{
        id: string;
        attributes: {
          delivered_count: number | null;
          open_count: number | null;
          click_count: number | null;
          unsubscribed_count: number | null;
          bounce_count: number | null;
          spam_complaint_count: number | null;
        };
      }>;
    };

    return body.data ?? [];
  }
}
