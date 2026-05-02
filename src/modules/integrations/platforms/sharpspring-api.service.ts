import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * SharpSpring API service — CRM and marketing automation metrics.
 *
 * API: SharpSpring REST API v1
 * Docs: https://help.sharpspring.com/hc/en-us/articles/115001069228
 *
 * Auth: accountID + secretKey passed as query params in every request.
 * Base URL: https://api.sharpspring.com/pubapi/v1/
 *
 * Storage layout:
 *   accessToken       = SharpSpring secretKey
 *   externalAccountId = JSON { "accountID": "abc123" }
 *
 * Approach:
 *   POST /pubapi/v1/?accountID={id}&secretKey={key}
 *   Body: JSON-RPC { method: 'getLeads', params: {where: {createTimestamp: ...}}, id: 1 }
 *   Returns: result.lead[] — count new leads in date range.
 *   Also queries getOpportunities for deal metrics.
 *   Stored as snapshot at dateRange.to.
 */
@Injectable()
export class SharpspringApiService {
  private readonly logger = new Logger(SharpspringApiService.name);
  private readonly BASE = 'https://api.sharpspring.com/pubapi/v1/';

  async fetchCoreMetrics(
    secretKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let accountID: string;
    try {
      const parsed = JSON.parse(accountJson) as { accountID?: string };
      accountID = parsed.accountID ?? '';
    } catch {
      throw new BadRequestException('SharpSpring: externalAccountId must be JSON {accountID}.');
    }
    if (!accountID) {
      throw new BadRequestException('SharpSpring: accountID is required.');
    }

    const url     = `${this.BASE}?accountID=${accountID}&secretKey=${secretKey}`;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };

    // Get new leads
    const leadsPayload = {
      method: 'getLeads',
      params: {
        where: {
          createTimestamp: { op: 'BETWEEN', value: dateRange.from, valueTo: dateRange.to },
        },
        limit: 500,
        offset: 0,
      },
      id: '1',
    };
    const leadsResp = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(leadsPayload),
    });

    if (leadsResp.status === 401 || leadsResp.status === 403) {
      throw new BadRequestException('SharpSpring API credentials are invalid.');
    }
    if (!leadsResp.ok) {
      const txt = await leadsResp.text().catch(() => '');
      throw new BadRequestException(`SharpSpring getLeads failed (HTTP ${leadsResp.status}): ${txt.slice(0, 200)}`);
    }
    const leadsBody = await leadsResp.json() as {
      result?: { lead?: unknown[] };
      error?:  { message?: string };
    };
    if (leadsBody.error?.message) {
      throw new BadRequestException(`SharpSpring API error: ${leadsBody.error.message}`);
    }
    const newLeads = (leadsBody.result?.lead ?? []).length;

    // Get opportunities created in range
    const oppPayload = {
      method: 'getOpportunities',
      params: {
        where: {
          createTimestamp: { op: 'BETWEEN', value: dateRange.from, valueTo: dateRange.to },
        },
        limit: 500,
        offset: 0,
      },
      id: '2',
    };
    const oppResp = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(oppPayload),
    });
    const oppBody = oppResp.ok
      ? await oppResp.json() as { result?: { opportunity?: Array<{ dealValue?: number; pipeline?: string }> } }
      : { result: { opportunity: [] } };

    let newDeals    = 0;
    let dealRevenue = 0;
    for (const opp of oppBody.result?.opportunity ?? []) {
      newDeals++;
      dealRevenue += opp.dealValue ?? 0;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (newLeads > 0)    rows.push({ metricKey: 'new_leads',    value: String(newLeads),       recordedAt });
    if (newDeals > 0)    rows.push({ metricKey: 'new_deals',    value: String(newDeals),       recordedAt });
    if (dealRevenue > 0) rows.push({ metricKey: 'deal_revenue', value: dealRevenue.toFixed(2), recordedAt });
    return rows;
  }
}
