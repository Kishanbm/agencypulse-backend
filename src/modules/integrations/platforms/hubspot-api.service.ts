import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * HubSpot API service — CRM contact and deal metrics.
 *
 * API: HubSpot CRM API v3
 * Docs: https://developers.hubspot.com/docs/api/crm/contacts
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (HUBSPOT in OAUTH_PLATFORM_CONFIGS).
 *   Requires crm.objects.contacts.read and crm.objects.deals.read scopes.
 * Base URL: https://api.hubapi.com
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = 'default' (account-level, portal ID resolved from token)
 *
 * Approach:
 *   GET /crm/v3/objects/contacts?limit=1&createdAfter={from}&createdBefore={to}
 *     → new_contacts (paginates, only needs total from paging.total)
 *   GET /crm/v3/objects/deals?limit=100&properties=dealstage,amount,closedate&
 *     createdAfter={from}&createdBefore={to}
 *     → new_deals, deal_revenue (sum of amounts for Closed Won deals)
 *   Stored as snapshot at dateRange.to.
 */
@Injectable()
export class HubspotApiService {
  private readonly logger = new Logger(HubspotApiService.name);
  private readonly BASE = 'https://api.hubapi.com';

  async fetchCoreMetrics(
    accessToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // New contacts
    const contactParams = new URLSearchParams({
      limit:          '1',
      createdAfter:   `${dateRange.from}T00:00:00Z`,
      createdBefore:  `${dateRange.to}T23:59:59Z`,
    });
    const contactResp = await fetchWithRetry(
      `${this.BASE}/crm/v3/objects/contacts?${contactParams}`,
      { headers },
    );
    if (contactResp.status === 401 || contactResp.status === 403) {
      throw new BadRequestException('HubSpot OAuth token is invalid or lacks CRM read scopes.');
    }
    if (!contactResp.ok) {
      const txt = await contactResp.text().catch(() => '');
      throw new BadRequestException(`HubSpot contacts API failed (HTTP ${contactResp.status}): ${txt.slice(0, 200)}`);
    }
    const contactBody = await contactResp.json() as { paging?: { total?: number } };
    const newContacts = contactBody.paging?.total ?? 0;

    // Deals created in range — sum Closed Won amounts
    const dealParams = new URLSearchParams({
      limit:          '100',
      properties:     'dealstage,amount,closedate',
      createdAfter:   `${dateRange.from}T00:00:00Z`,
      createdBefore:  `${dateRange.to}T23:59:59Z`,
    });
    let newDeals    = 0;
    let dealRevenue = 0;
    let dealsUrl: string | null = `${this.BASE}/crm/v3/objects/deals?${dealParams}`;
    const MAX_PAGES = 100;
    let pages = 0;
    while (dealsUrl) {
      if (++pages > MAX_PAGES) { this.logger.warn('HubspotApiService: pagination cap (100 pages) reached'); break; }
      const dealResp = await fetchWithRetry(dealsUrl, { headers });
      if (!dealResp.ok) break;
      const dealBody = await dealResp.json() as {
        results?: Array<{ properties?: { dealstage?: string; amount?: string } }>;
        paging?: { next?: { link?: string } };
      };
      for (const deal of dealBody.results ?? []) {
        newDeals++;
        const stage = deal.properties?.dealstage ?? '';
        if (stage.toLowerCase().includes('closed') && stage.toLowerCase().includes('won')) {
          dealRevenue += safeFloat(deal.properties?.amount ?? '0');
        }
      }
      dealsUrl = dealBody.paging?.next?.link ?? null;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (newContacts > 0) rows.push({ metricKey: 'new_contacts', value: String(newContacts), recordedAt });
    if (newDeals > 0)    rows.push({ metricKey: 'new_deals',    value: String(newDeals),    recordedAt });
    if (dealRevenue > 0) rows.push({ metricKey: 'deal_revenue', value: dealRevenue.toFixed(2), recordedAt });
    return rows;
  }
}
