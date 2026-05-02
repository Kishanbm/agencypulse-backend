import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * GoHighLevel (HighLevel) API service — CRM and pipeline metrics.
 *
 * API: GoHighLevel API v1 (Lead Connector API)
 * Docs: https://highlevel.stoplight.io/docs/integrations/
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (HIGHLEVEL in OAUTH_PLATFORM_CONFIGS).
 *   Requires contacts.readonly scope.
 * Base URL: https://services.leadconnectorhq.com
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = HighLevel location ID (sub-account)
 *
 * Approach:
 *   GET /contacts/?locationId={locationId}&startDate={from}&endDate={to}&limit=100
 *   Paginates via startAfterId cursor. Counts new_contacts in range.
 *   GET /opportunities/search?location_id={locationId}&date={from}&endDate={to}&status=won
 *   Counts won opportunities and sums monetary_value.
 *   Stored as snapshot at dateRange.to.
 */
@Injectable()
export class HighlevelApiService {
  private readonly logger = new Logger(HighlevelApiService.name);
  private readonly BASE = 'https://services.leadconnectorhq.com';

  async fetchCoreMetrics(
    accessToken: string,
    locationId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Version: '2021-07-28',
      Accept: 'application/json',
    };

    // New contacts
    let newContacts   = 0;
    let startAfterId: string | null = null;
    let hasMore = true;
    const MAX_PAGES = 100;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) { this.logger.warn('HighlevelApiService: pagination cap (100 pages) reached'); break; }
      const params = new URLSearchParams({
        locationId,
        startDate: `${dateRange.from}T00:00:00.000Z`,
        endDate:   `${dateRange.to}T23:59:59.999Z`,
        limit:     '100',
      });
      if (startAfterId) params.set('startAfterId', startAfterId);

      const resp = await fetchWithRetry(`${this.BASE}/contacts/?${params}`, { headers });
      if (resp.status === 401 || resp.status === 403) {
        throw new BadRequestException('HighLevel OAuth token is invalid or lacks contacts.readonly scope.');
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new BadRequestException(`HighLevel contacts API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
      }
      const body = await resp.json() as {
        contacts?: Array<{ id?: string }>;
        meta?: { startAfterId?: string; total?: number };
      };
      if (!body.contacts) {
        this.logger.warn('HighlevelApiService: unexpected response shape — missing contacts');
        break;
      }
      const contacts = body.contacts ?? [];
      newContacts   += contacts.length;
      startAfterId   = body.meta?.startAfterId ?? null;
      hasMore        = !!startAfterId && contacts.length === 100;
    }

    // Won opportunities
    let wonOpps    = 0;
    let oppRevenue = 0;
    const oppParams = new URLSearchParams({
      location_id: locationId,
      date:        `${dateRange.from}`,
      endDate:     `${dateRange.to}`,
      status:      'won',
      limit:       '100',
    });
    const oppResp = await fetchWithRetry(`${this.BASE}/opportunities/search?${oppParams}`, { headers });
    if (oppResp.ok) {
      const oppBody = await oppResp.json() as {
        opportunities?: Array<{ monetaryValue?: number }>;
      };
      for (const opp of oppBody.opportunities ?? []) {
        wonOpps++;
        oppRevenue += opp.monetaryValue ?? 0;
      }
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (newContacts > 0) rows.push({ metricKey: 'new_contacts', value: String(newContacts), recordedAt });
    if (wonOpps > 0)     rows.push({ metricKey: 'won_deals',    value: String(wonOpps),     recordedAt });
    if (oppRevenue > 0)  rows.push({ metricKey: 'deal_revenue', value: oppRevenue.toFixed(2), recordedAt });
    return rows;
  }
}
