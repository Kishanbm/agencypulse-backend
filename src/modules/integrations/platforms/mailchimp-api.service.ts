import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Mailchimp API service — email campaign performance metrics.
 *
 * API version: Marketing API v3
 * Docs: https://mailchimp.com/developer/marketing/api/campaigns/
 *
 * Auth: OAuth 2.0. Access token stored in DB; `dc` server prefix stored as
 * `externalAccountId` (fetched from /oauth2/metadata during OAuth callback).
 *
 * Base URL: `https://{dc}.api.mailchimp.com/3.0`
 * Authorization header: `Bearer {access_token}` (or `Basic base64(anystring:token)`)
 *
 * Note: Mailchimp does not issue refresh tokens. Tokens are long-lived (no expiry
 * documented; re-auth required if revoked). StandardTokenService handles this by
 * returning the stored token without refresh.
 *
 * Approach:
 *   1. `GET /campaigns?status=sent&since_send_time={from}&before_send_time={to}&count=100`
 *   2. Each campaign includes `report_summary` with aggregate stats.
 *   3. Use `send_time` as `recorded_at`.
 */
@Injectable()
export class MailchimpApiService {
  private readonly logger = new Logger(MailchimpApiService.name);

  private baseUrl(dc: string): string {
    return `https://${dc}.api.mailchimp.com/3.0`;
  }

  private headers(accessToken: string): Record<string, string> {
    // Mailchimp accepts either OAuth Bearer or Basic anystring:token
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param accessToken  OAuth access token
   * @param dc           Mailchimp data center prefix stored as externalAccountId (e.g. 'us1')
   * @param dateRange    { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    accessToken: string,
    dc: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!dc || dc === 'default') {
      throw new BadRequestException(
        'Mailchimp data center prefix (dc) is missing. Please reconnect the integration.',
      );
    }

    const params = new URLSearchParams({
      status: 'sent',
      since_send_time: `${dateRange.from}T00:00:00+00:00`,
      before_send_time: `${dateRange.to}T23:59:59+00:00`,
      count: '100',
      fields: 'campaigns.id,campaigns.send_time,campaigns.report_summary',
    });

    const url = `${this.baseUrl(dc)}/campaigns?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(accessToken) });

    if (resp.status === 401) {
      throw new BadRequestException('Mailchimp access token is invalid or expired. Please reconnect.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Mailchimp campaigns list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      campaigns?: Array<{
        id: string;
        send_time: string | null;
        report_summary: {
          emails_sent: number;
          unique_opens: number;
          click_rate: number;
          unique_clicks: number;
          subscriber_clicks: number;
          unsubscribed: number;
          bounces?: { hard_bounces: number; soft_bounces: number; syntax_errors: number };
        } | null;
      }>;
    };

    if (!body.campaigns) {
      this.logger.warn('MailchimpApiService: unexpected response shape — missing campaigns');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const c of body.campaigns ?? []) {
      const recordedAt = c.send_time ? c.send_time.slice(0, 10) : dateRange.to;
      const s = c.report_summary;
      if (!s) continue;

      if (s.emails_sent > 0)    rows.push({ metricKey: 'sends',       value: String(s.emails_sent),   recordedAt });
      if (s.unique_opens > 0)   rows.push({ metricKey: 'opens',       value: String(s.unique_opens),  recordedAt });
      if (s.unique_clicks > 0)  rows.push({ metricKey: 'clicks',      value: String(s.unique_clicks), recordedAt });
      if (s.unsubscribed > 0)   rows.push({ metricKey: 'unsubscribes', value: String(s.unsubscribed),  recordedAt });

      const bounces = (s.bounces?.hard_bounces ?? 0) + (s.bounces?.soft_bounces ?? 0);
      if (bounces > 0) rows.push({ metricKey: 'bounces', value: String(bounces), recordedAt });
    }

    return rows;
  }
}
