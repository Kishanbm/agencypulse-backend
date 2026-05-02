import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Salesforce API service — CRM pipeline and lead metrics.
 *
 * API: Salesforce REST API v58.0 (SOQL Query)
 * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (SALESFORCE in OAUTH_PLATFORM_CONFIGS).
 *   Requires api scope.
 * Base URL: https://{instanceUrl} (returned by OAuth token endpoint in instance_url field)
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = Salesforce instance URL (e.g. "https://mycompany.my.salesforce.com")
 *
 * Approach:
 *   SOQL via GET /services/data/v58.0/query?q=SELECT+...
 *   1. New Leads: SELECT COUNT(Id) FROM Lead WHERE CreatedDate >= {from} AND CreatedDate <= {to}
 *   2. Closed Won Opportunities: SELECT COUNT(Id), SUM(Amount) FROM Opportunity
 *      WHERE CloseDate >= {from} AND CloseDate <= {to} AND StageName = 'Closed Won'
 *   Stored as snapshot at dateRange.to.
 */
@Injectable()
export class SalesforceApiService {
  private readonly logger = new Logger(SalesforceApiService.name);

  async fetchCoreMetrics(
    accessToken: string,
    instanceUrl: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const BASE    = `${instanceUrl.replace(/\/$/, '')}/services/data/v58.0`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    const leadsQ = encodeURIComponent(
      `SELECT COUNT(Id) cnt FROM Lead WHERE CreatedDate >= ${dateRange.from}T00:00:00Z AND CreatedDate <= ${dateRange.to}T23:59:59Z`,
    );
    const leadsResp = await fetchWithRetry(`${BASE}/query?q=${leadsQ}`, { headers });
    if (leadsResp.status === 401 || leadsResp.status === 403) {
      throw new BadRequestException('Salesforce OAuth token is invalid or expired.');
    }
    if (!leadsResp.ok) {
      const txt = await leadsResp.text().catch(() => '');
      throw new BadRequestException(`Salesforce leads query failed (HTTP ${leadsResp.status}): ${txt.slice(0, 200)}`);
    }
    const leadsBody = await leadsResp.json() as { records?: Array<{ cnt?: number }> };
    const newLeads  = leadsBody.records?.[0]?.cnt ?? 0;

    const oppQ = encodeURIComponent(
      `SELECT COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE CloseDate >= ${dateRange.from} AND CloseDate <= ${dateRange.to} AND StageName = 'Closed Won'`,
    );
    const oppResp = await fetchWithRetry(`${BASE}/query?q=${oppQ}`, { headers });
    if (!oppResp.ok) {
      const txt = await oppResp.text().catch(() => '');
      throw new BadRequestException(`Salesforce opportunities query failed (HTTP ${oppResp.status}): ${txt.slice(0, 200)}`);
    }
    const oppBody  = await oppResp.json() as { records?: Array<{ cnt?: number; total?: number }> };
    const closedDeals  = oppBody.records?.[0]?.cnt   ?? 0;
    const dealRevenue  = oppBody.records?.[0]?.total ?? 0;

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (newLeads > 0)    rows.push({ metricKey: 'new_leads',    value: String(safeInt(newLeads)),           recordedAt });
    if (closedDeals > 0) rows.push({ metricKey: 'closed_deals', value: String(safeInt(closedDeals)),        recordedAt });
    if (dealRevenue > 0) rows.push({ metricKey: 'deal_revenue', value: safeFloat(dealRevenue).toFixed(2),     recordedAt });
    return rows;
  }
}
