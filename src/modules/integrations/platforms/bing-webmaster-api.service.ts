import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Bing Webmaster Tools API service — Bing organic search impressions, clicks, position.
 *
 * API: Bing Webmaster Tools API v3
 * Docs: https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster
 *
 * Auth: Microsoft OAuth access token (`Authorization: Bearer {token}`).
 * Base URL: https://ssl.bing.com/webmaster/api.svc/json
 *
 * Storage layout:
 *   accessToken       = OAuth access token (rotated via StandardTokenService / MSAL)
 *   externalAccountId = site URL registered in Bing Webmaster Tools (e.g. "https://example.com/")
 *
 * Approach:
 *   GET /GetRankAndTrafficStats?siteUrl={url}&startDate={YYYYMMdd}&endDate={YYYYMMdd}
 *   Returns daily: impressions, clicks, avgClickPosition, avgImpressionPosition.
 */
@Injectable()
export class BingWebmasterApiService {
  private readonly logger = new Logger(BingWebmasterApiService.name);
  private readonly BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param accessToken  Microsoft OAuth access token
   * @param siteUrl      Site URL registered in Bing Webmaster Tools (externalAccountId)
   * @param dateRange    { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    accessToken: string,
    siteUrl: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!siteUrl || siteUrl === 'default') {
      throw new BadRequestException(
        'Bing Webmaster Tools requires a verified site URL. Reconnect and select your site.',
      );
    }

    const startDate = dateRange.from.replace(/-/g, '');
    const endDate   = dateRange.to.replace(/-/g, '');

    const params = new URLSearchParams({
      siteUrl,
      startDate,
      endDate,
      apikey: accessToken, // Bing API key can be passed here
    });

    const url = `${this.BASE}/GetRankAndTrafficStats?${params.toString()}`;
    const resp = await fetchWithRetry(url);

    if (resp.status === 401) {
      throw new BadRequestException('Bing Webmaster Tools access token expired. Please reconnect.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Bing Webmaster GetRankAndTrafficStats failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      d?: Array<{
        Date: string;              // "/Date(timestamp)/" format
        Impressions?: number;
        Clicks?: number;
        AvgClickPosition?: number;
        AvgImpressionPosition?: number;
      }>;
    };

    if (!body.d) {
      this.logger.warn('BingWebmasterApiService: unexpected response shape — missing d');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const day of body.d ?? []) {
      // Bing returns dates as "/Date(1714003200000)/" — parse the timestamp
      const tsMatch = day.Date.match(/\d+/);
      if (!tsMatch) continue;
      const recordedAt = new Date(safeInt(tsMatch[0])).toISOString().slice(0, 10);

      if (day.Impressions != null && day.Impressions > 0)       rows.push({ metricKey: 'impressions',  value: String(safeInt(day.Impressions)),          recordedAt });
      if (day.Clicks != null && day.Clicks > 0)                 rows.push({ metricKey: 'clicks',       value: String(safeInt(day.Clicks)),               recordedAt });
      if (day.AvgClickPosition != null)                         rows.push({ metricKey: 'avg_position', value: String(safeFloat(day.AvgClickPosition)),    recordedAt });
    }

    return rows;
  }
}
