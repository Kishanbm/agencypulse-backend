import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Simpli.fi API service — campaign performance metrics.
 *
 * API: Simpli.fi REST API v1
 * Docs: https://app.simpli.fi/api/docs
 *
 * Auth: API key in Authorization header.
 *   `Authorization: {api_key}`
 *   `X-App-Key: {app_key}` — organization-level app key
 * Base URL: https://app.simpli.fi/api
 *
 * Storage layout:
 *   accessToken       = API key (user-level)
 *   externalAccountId = JSON {"orgId":"123","appKey":"xxx"}
 *
 * Approach:
 *   GET /organizations/{orgId}/campaigns?start_date={from}&end_date={to}&include[]=stats
 *   Returns campaign list with embedded stats; aggregate by date via the stats endpoint.
 *
 *   For daily breakdown: GET /organizations/{orgId}/campaigns/{campaignId}/stats
 *     ?start_date={from}&end_date={to}&granularity=day
 */
@Injectable()
export class SimplifiApiService {
  private readonly logger = new Logger(SimplifiApiService.name);
  private readonly BASE = 'https://app.simpli.fi/api';

  async fetchCoreMetrics(
    apiKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let orgId: string;
    let appKey: string;

    try {
      const parsed = JSON.parse(accountJson) as { orgId?: string; appKey?: string };
      orgId  = parsed.orgId  ?? '';
      appKey = parsed.appKey ?? '';
    } catch {
      throw new BadRequestException('Simpli.fi integration misconfigured. Reconnect.');
    }

    if (!orgId || !appKey) {
      throw new BadRequestException('Simpli.fi requires orgId and appKey. Reconnect.');
    }

    const headers = {
      Authorization: apiKey,
      'X-App-Key':   appKey,
      Accept: 'application/json',
    };

    const params = new URLSearchParams({
      start_date:  dateRange.from,
      end_date:    dateRange.to,
      'include[]': 'stats',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/organizations/${orgId}/campaigns?${params.toString()}`,
      { headers },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Simpli.fi API key is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Simpli.fi campaigns API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      campaigns?: Array<{
        stats?: {
          impressions?: number;
          clicks?: number;
          spend?: number;
          conversions?: number;
          ctr?: number;
          cpc?: number;
        };
      }>;
    };

    // Aggregate across all campaigns (total for the period)
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalConversions = 0;

    for (const c of body.campaigns ?? []) {
      totalImpressions += c.stats?.impressions ?? 0;
      totalClicks      += c.stats?.clicks ?? 0;
      totalSpend       += c.stats?.spend ?? 0;
      totalConversions += c.stats?.conversions ?? 0;
    }

    if (!body.campaigns) {
      this.logger.warn('SimplifiApiService: unexpected response shape — missing campaigns');
      return [];
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (totalImpressions > 0) rows.push({ metricKey: 'impressions', value: String(safeInt(totalImpressions)), recordedAt });
    if (totalClicks > 0)      rows.push({ metricKey: 'clicks',      value: String(safeInt(totalClicks)),      recordedAt });
    if (totalSpend > 0)       rows.push({ metricKey: 'spend',        value: safeFloat(totalSpend).toFixed(2),    recordedAt });
    if (totalConversions > 0) rows.push({ metricKey: 'conversions',  value: String(safeInt(totalConversions)), recordedAt });
    return rows;
  }
}
