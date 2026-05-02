import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Google Local Services Ads (LSA) API service — lead and impression metrics.
 *
 * API: Google Local Services Ads API v1
 * Docs: https://developers.google.com/local-services-ads/docs/reference/rest/v1/accountReports
 *
 * Auth: OAuth 2.0 Bearer token (scope: https://www.googleapis.com/auth/adwords).
 *   Via StandardTokenService — GOOGLE_LOCAL_SERVICES_ADS in OAUTH_PLATFORM_CONFIGS.
 * Base URL: https://localservices.googleapis.com/v1
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = manager customer ID (Google Ads MCC account ID, numeric)
 *
 * Approach:
 *   GET /accountReports:search?query=SELECT+account_id,impressions_last_day,leads,...
 *        &start_date={from}&end_date={to}
 *   Returns account-level summary of impressions, leads, and cost.
 *
 * Note: LSA reports are at account level (not campaign level). Aggregated by period.
 *   Spend stored at recordedAt = dateRange.to (no daily breakdown in LSA API).
 */
@Injectable()
export class GoogleLsaApiService {
  private readonly logger = new Logger(GoogleLsaApiService.name);
  private readonly BASE = 'https://localservices.googleapis.com/v1';

  async fetchCoreMetrics(
    accessToken: string,
    managerCustomerId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      query:      `SELECT account_id,aggregated_info.num_impressions,aggregated_info.num_leads,aggregated_info.phone_leads,aggregated_info.message_leads,aggregated_info.total_cost`,
      start_date: dateRange.from,
      end_date:   dateRange.to,
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/accountReports:search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Google LSA OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Google LSA account reports API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      accountReports?: Array<{
        aggregatedInfo?: {
          numImpressions?: number;
          numLeads?: number;
          phoneLeads?: number;
          messageLeads?: number;
          totalCost?: string; // micros as string
        };
      }>;
    };

    if (!body.accountReports) {
      this.logger.warn('GoogleLsaApiService: unexpected response shape — missing accountReports');
      return [];
    }

    const rows: MetricRowInput[] = [];
    const recordedAt = dateRange.to;

    // Aggregate across all accounts (usually one per integration)
    let totalImpressions = 0;
    let totalLeads = 0;
    let totalPhone = 0;
    let totalMessage = 0;
    let totalCostMicros = 0;

    for (const report of body.accountReports ?? []) {
      const info = report.aggregatedInfo ?? {};
      totalImpressions += info.numImpressions ?? 0;
      totalLeads       += info.numLeads ?? 0;
      totalPhone       += info.phoneLeads ?? 0;
      totalMessage     += info.messageLeads ?? 0;
      totalCostMicros  += safeInt(info.totalCost ?? '0');
    }

    const totalCostUsd = totalCostMicros / 1_000_000;

    if (totalImpressions > 0) rows.push({ metricKey: 'impressions',     value: String(totalImpressions), recordedAt });
    if (totalLeads > 0)       rows.push({ metricKey: 'leads',           value: String(totalLeads),       recordedAt });
    if (totalPhone > 0)       rows.push({ metricKey: 'phone_leads',     value: String(totalPhone),       recordedAt });
    if (totalMessage > 0)     rows.push({ metricKey: 'message_leads',   value: String(totalMessage),     recordedAt });
    if (totalCostUsd > 0)     rows.push({ metricKey: 'spend',           value: totalCostUsd.toFixed(2),  recordedAt });

    return rows;
  }
}
