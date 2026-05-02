import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Birdeye API service — review ratings and new review counts.
 *
 * API: Birdeye REST API v1
 * Docs: https://docs.birdeye.so/docs/authentication-api-keys
 *       https://docs.birdeye.so/reference/get_reviews-businessid
 *
 * Auth: API key passed as `api-key` query parameter.
 * Base URL: https://api.birdeye.com
 *
 * Storage layout:
 *   accessToken       = Birdeye API key
 *   externalAccountId = Business ID (numeric, from Settings > Integrations > API)
 *
 * Approach:
 *   1. GET /resources/v1/business/{businessId}/reviewsStats?api-key={key}
 *      → avg_rating (averageRating), review_count (totalReviewCount) — current snapshot.
 *   2. GET /resources/v1/business/{businessId}/reviews?api-key={key}&startDate={from}&endDate={to}&count=500
 *      → count reviews in period for new_reviews metric.
 */
@Injectable()
export class BirdeyeApiService {
  private readonly logger = new Logger(BirdeyeApiService.name);
  private readonly BASE = 'https://api.birdeye.com';

  async fetchCoreMetrics(
    apiKey: string,
    businessId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    // Step 1: Aggregate snapshot
    const statsResp = await fetchWithRetry(
      `${this.BASE}/resources/v1/business/${businessId}/reviewsStats?api-key=${encodeURIComponent(apiKey)}`,
    );

    if (statsResp.status === 401 || statsResp.status === 403) {
      throw new BadRequestException('Birdeye API key is invalid.');
    }
    if (!statsResp.ok) {
      const txt = await statsResp.text().catch(() => '');
      throw new BadRequestException(`Birdeye reviewsStats API failed (HTTP ${statsResp.status}): ${txt.slice(0, 200)}`);
    }

    const stats = await statsResp.json() as {
      averageRating?: number;
      totalReviewCount?: number;
    };

    if ((stats.averageRating ?? 0) > 0)     rows.push({ metricKey: 'avg_rating',    value: String(safeFloat(stats.averageRating)),    recordedAt });
    if ((stats.totalReviewCount ?? 0) > 0)  rows.push({ metricKey: 'review_count',  value: String(safeInt(stats.totalReviewCount)),   recordedAt });

    // Step 2: New reviews in the date range
    const newReviews = await this.countNewReviews(businessId, apiKey, dateRange);
    if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });

    return rows;
  }

  private async countNewReviews(
    businessId: string,
    apiKey: string,
    dateRange: { from: string; to: string },
  ): Promise<number> {
    try {
      const params = new URLSearchParams({
        'api-key':   apiKey,
        startDate:   dateRange.from,
        endDate:     dateRange.to,
        count:       '500',
        start:       '0',
      });
      const resp = await fetchWithRetry(
        `${this.BASE}/resources/v1/business/${businessId}/reviews?${params.toString()}`,
      );
      if (!resp.ok) return 0;
      const body = await resp.json() as { totalCount?: number; reviews?: unknown[] };
      return safeInt(body.totalCount ?? body.reviews?.length ?? 0);
    } catch {
      this.logger.warn('Birdeye: failed to count new reviews — returning 0');
      return 0;
    }
  }
}
