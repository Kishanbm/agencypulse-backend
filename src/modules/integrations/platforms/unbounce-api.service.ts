import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Unbounce API service — landing page lead and conversion metrics.
 *
 * API: Unbounce API v0.4
 * Docs: https://developer.unbounce.com/api_reference/
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (UNBOUNCE in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://api.unbounce.com
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = Unbounce account ID (sub-account or main account)
 *
 * Approach:
 *   GET /accounts/{accountId}/pages?include_stats=true&sort_by=created_at&sort_order=desc&limit=50
 *   Aggregates across all active pages in the account:
 *     - total_visits (sum of page stats.visits in date range)
 *     - total_conversions (sum of page stats.conversions in date range)
 *   Uses GET /accounts/{accountId}/leads?limit=200 filtered by created_at for direct lead count.
 *   Stored as snapshot at dateRange.to.
 */
@Injectable()
export class UnbounceApiService {
  private readonly logger = new Logger(UnbounceApiService.name);
  private readonly BASE = 'https://api.unbounce.com';

  async fetchCoreMetrics(
    accessToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // Get pages with stats
    const pagesResp = await fetchWithRetry(
      `${this.BASE}/accounts/${accountId}/pages?include_stats=true&sort_by=created_at&sort_order=desc&limit=50`,
      { headers },
    );

    if (pagesResp.status === 401 || pagesResp.status === 403) {
      throw new BadRequestException('Unbounce OAuth token is invalid.');
    }
    if (!pagesResp.ok) {
      const txt = await pagesResp.text().catch(() => '');
      throw new BadRequestException(`Unbounce pages API failed (HTTP ${pagesResp.status}): ${txt.slice(0, 200)}`);
    }

    const pagesBodyRaw = await pagesResp.json() as {
      pages?: Array<{
        id?: string;
        stats?: { visits?: number; conversions?: number };
      }>;
    };

    const pagesBody = pagesBodyRaw;
    if (!pagesBody.pages) {
      this.logger.warn('UnbounceApiService: unexpected response shape — missing pages');
      return [];
    }

    // Stats are lifetime — use lead count for date-ranged metric
    const pageIds = (pagesBody.pages ?? []).map(p => p.id ?? '').filter(Boolean);

    // Get leads in date range across all pages
    let totalLeads = 0;
    for (const pageId of pageIds.slice(0, 10)) {
      const leadsParams = new URLSearchParams({
        sort_by:    'created_at',
        sort_order: 'desc',
        limit:      '200',
        from:       `${dateRange.from}T00:00:00.000Z`,
        to:         `${dateRange.to}T23:59:59.999Z`,
      });
      const leadsResp = await fetchWithRetry(
        `${this.BASE}/pages/${pageId}/leads?${leadsParams}`,
        { headers },
      );
      if (!leadsResp.ok) continue;
      const leadsBody = await leadsResp.json() as { leads?: unknown[] };
      totalLeads += (leadsBody.leads ?? []).length;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (pageIds.length > 0) rows.push({ metricKey: 'active_pages', value: String(pageIds.length), recordedAt });
    if (totalLeads > 0)     rows.push({ metricKey: 'total_leads',  value: String(totalLeads),     recordedAt });
    return rows;
  }
}
