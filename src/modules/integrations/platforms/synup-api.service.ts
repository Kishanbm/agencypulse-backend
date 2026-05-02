import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Synup API service — review ratings and new review counts.
 *
 * API: Synup API v4
 * Docs: https://synup.dev/
 *       https://www.synup.com/en/reputation-management-api
 *
 * Auth: API key in Authorization header.
 *   `Authorization: API {api_key}`
 *   `Content-Type: application/json`
 * Base URL: https://api.synup.com/api/v4
 *
 * Storage layout:
 *   accessToken       = Synup API key
 *   externalAccountId = location ID (numeric, from Synup dashboard)
 *
 * Approach:
 *   GET /locations/{locationId} → current avg_rating, review_count snapshot.
 *   GET /locations/{locationId}/reviews?start_date={from}&end_date={to}&page_size=500
 *   → count new reviews in period.
 */
@Injectable()
export class SynupApiService {
  private readonly logger = new Logger(SynupApiService.name);
  private readonly BASE = 'https://api.synup.com/api/v4';

  async fetchCoreMetrics(
    apiKey: string,
    locationId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `API ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    // Snapshot: current avg_rating + review_count
    const locResp = await fetchWithRetry(`${this.BASE}/locations/${locationId}`, { headers });

    if (locResp.status === 401 || locResp.status === 403) {
      throw new BadRequestException('Synup API key is invalid.');
    }
    if (!locResp.ok) {
      const txt = await locResp.text().catch(() => '');
      throw new BadRequestException(`Synup location API failed (HTTP ${locResp.status}): ${txt.slice(0, 200)}`);
    }

    const loc = await locResp.json() as {
      average_rating?: number;
      review_count?:   number;
      data?: {
        average_rating?: number;
        review_count?:   number;
      };
    };

    // Synup may nest under 'data'
    const avgRating   = loc.average_rating   ?? loc.data?.average_rating   ?? 0;
    const reviewCount = loc.review_count     ?? loc.data?.review_count     ?? 0;

    if (avgRating > 0)    rows.push({ metricKey: 'avg_rating',   value: safeFloat(avgRating).toFixed(2),   recordedAt });
    if (reviewCount > 0)  rows.push({ metricKey: 'review_count', value: String(safeInt(reviewCount)), recordedAt });

    // New reviews in date range
    const newReviews = await this.countNewReviews(locationId, headers, dateRange);
    if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });

    return rows;
  }

  private async countNewReviews(
    locationId: string,
    headers: Record<string, string>,
    dateRange: { from: string; to: string },
  ): Promise<number> {
    try {
      const params = new URLSearchParams({
        start_date: dateRange.from,
        end_date:   dateRange.to,
        page_size:  '1',
        page:       '1',
      });
      const resp = await fetchWithRetry(
        `${this.BASE}/locations/${locationId}/reviews?${params.toString()}`,
        { headers },
      );
      if (!resp.ok) return 0;
      const body = await resp.json() as {
        meta?: { total?: number };
        total?: number;
        count?: number;
      };
      return body.meta?.total ?? body.total ?? body.count ?? 0;
    } catch {
      this.logger.warn('Synup: failed to count new reviews — returning 0');
      return 0;
    }
  }
}
