import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * StackAdapt API service — campaign performance metrics via GraphQL.
 *
 * API: StackAdapt GraphQL API
 * Docs: https://docs.stackadapt.com/
 *
 * Auth: GraphQL token in X-Authorization header (long-lived API token from StackAdapt).
 *   This is an API key pattern — token stored directly as accessToken.
 * Base URL: https://api.stackadapt.com/graphql
 *
 * Storage layout:
 *   accessToken       = StackAdapt API token (from Settings → API Access)
 *   externalAccountId = account_id or 'default' (token scopes to account)
 *
 * Approach:
 *   POST /graphql with a campaigns query requesting daily performance metrics.
 *   Filter by date range using reportRange parameter.
 */
@Injectable()
export class StackAdaptApiService {
  private readonly logger = new Logger(StackAdaptApiService.name);
  private readonly ENDPOINT = 'https://api.stackadapt.com/graphql';

  async fetchCoreMetrics(
    apiToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const query = `
      query CampaignStats($startDate: String!, $endDate: String!) {
        campaigns(reportRange: { start: $startDate, end: $endDate }) {
          nodes {
            id
            name
            stats {
              date
              impressions
              clicks
              spend
              conversions
              ctr
            }
          }
        }
      }
    `;

    const resp = await fetchWithRetry(
      this.ENDPOINT,
      {
        method: 'POST',
        headers: {
          'X-Authorization': apiToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { startDate: dateRange.from, endDate: dateRange.to },
        }),
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('StackAdapt API token is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`StackAdapt GraphQL API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: {
        campaigns?: {
          nodes?: Array<{
            stats?: Array<{
              date?: string;
              impressions?: number;
              clicks?: number;
              spend?: number;
              conversions?: number;
              ctr?: number;
            }>;
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };

    if (body.errors?.length) {
      throw new BadRequestException(`StackAdapt GraphQL error: ${body.errors[0]?.message}`);
    }

    if (!body.data) {
      this.logger.warn('StackAdaptApiService: unexpected response shape — missing data');
      return [];
    }

    const rows: MetricRowInput[] = [];
    for (const campaign of body.data?.campaigns?.nodes ?? []) {
      for (const stat of campaign.stats ?? []) {
        const recordedAt = stat.date ?? dateRange.to;
        if ((stat.impressions ?? 0) > 0)  rows.push({ metricKey: 'impressions', value: String(safeInt(stat.impressions)),          recordedAt });
        if ((stat.clicks ?? 0) > 0)       rows.push({ metricKey: 'clicks',      value: String(safeInt(stat.clicks)),               recordedAt });
        if ((stat.spend ?? 0) > 0)        rows.push({ metricKey: 'spend',        value: safeFloat(stat.spend).toFixed(2),      recordedAt });
        if ((stat.ctr ?? 0) > 0)          rows.push({ metricKey: 'ctr',          value: safeFloat(stat.ctr).toFixed(4),        recordedAt });
        if ((stat.conversions ?? 0) > 0)  rows.push({ metricKey: 'conversions',  value: String(safeInt(stat.conversions)),          recordedAt });
      }
    }
    return rows;
  }
}
