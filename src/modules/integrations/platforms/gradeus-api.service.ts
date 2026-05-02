import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Grade.us API service — review ratings and counts.
 *
 * API: Grade.us V4 API
 * Docs: https://api.grade.us/ (V4 swagger)
 *       https://help.grade.us/s/article/API-Basics
 *
 * Auth: API key as Bearer token.
 *   `Authorization: Bearer {api_key}`
 * Base URL: https://api.grade.us/v4
 *
 * Storage layout:
 *   accessToken       = Grade.us API key
 *   externalAccountId = location ID (numeric or UUID)
 *
 * Approach:
 *   GET /locations/{locationId}/reviews?start_date={from}&end_date={to}&per_page=500
 *   → count new reviews + aggregate avg_rating.
 *   GET /locations/{locationId} → current avg_rating, total review_count (snapshot).
 *
 * Note: Grade.us is a review generation platform; snapshots stored at recordedAt = dateRange.to.
 */
@Injectable()
export class GradeUsApiService {
  private readonly logger = new Logger(GradeUsApiService.name);
  private readonly BASE = 'https://api.grade.us/v4';

  async fetchCoreMetrics(
    apiKey: string,
    locationId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    // Snapshot: current avg_rating + review_count
    const locResp = await fetchWithRetry(`${this.BASE}/locations/${locationId}`, { headers });

    if (locResp.status === 401 || locResp.status === 403) {
      throw new BadRequestException('Grade.us API key is invalid.');
    }
    if (!locResp.ok) {
      const txt = await locResp.text().catch(() => '');
      throw new BadRequestException(`Grade.us location API failed (HTTP ${locResp.status}): ${txt.slice(0, 200)}`);
    }

    const loc = await locResp.json() as {
      average_rating?: number;
      review_count?:   number;
    };

    if ((loc.average_rating ?? 0) > 0) rows.push({ metricKey: 'avg_rating',   value: safeFloat(loc.average_rating).toFixed(2), recordedAt });
    if ((loc.review_count ?? 0) > 0)   rows.push({ metricKey: 'review_count', value: String(safeInt(loc.review_count)),   recordedAt });

    // New reviews in date range
    const newReviews = await this.countNewReviews(locationId, apiKey, headers, dateRange);
    if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });

    return rows;
  }

  private async countNewReviews(
    locationId: string,
    _apiKey: string,
    headers: Record<string, string>,
    dateRange: { from: string; to: string },
  ): Promise<number> {
    try {
      const params = new URLSearchParams({
        start_date: dateRange.from,
        end_date:   dateRange.to,
        per_page:   '1',
        page:       '1',
      });
      const resp = await fetchWithRetry(
        `${this.BASE}/locations/${locationId}/reviews?${params.toString()}`,
        { headers },
      );
      if (!resp.ok) return 0;
      const body = await resp.json() as { meta?: { total?: number }; total?: number };
      return body.meta?.total ?? body.total ?? 0;
    } catch {
      this.logger.warn('Grade.us: failed to count new reviews — returning 0');
      return 0;
    }
  }
}
