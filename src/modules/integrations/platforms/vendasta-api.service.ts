import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Vendasta Reputation Intelligence API service — review ratings and counts.
 *
 * API: Vendasta Reputation REST API v1
 * Docs: https://developers.vendasta.com/platform/7480131f6051d-reputation-rest-ap-is
 *       https://developers.vendasta.com/vendor/ZG9jOjIxNzM0NjA4-api-authentication
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — VENDASTA in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://prod.api.vendasta.com/reputation/v1
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = accountId (Vendasta Business Partner ID, e.g. "AG-XXXXXXXX")
 *
 * Approach:
 *   GET /reviews?accountId={id}&pageSize=100&startDate={from}T00:00:00Z&endDate={to}T23:59:59Z
 *   → count new reviews in period + compute avg_rating of period reviews.
 *   GET /reviews/summary?accountId={id} → overall avg_rating + review_count snapshot.
 */
@Injectable()
export class VendastaApiService {
  private readonly logger = new Logger(VendastaApiService.name);
  private readonly BASE = 'https://prod.api.vendasta.com/reputation/v1';

  async fetchCoreMetrics(
    accessToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    // Summary snapshot
    const summaryResp = await fetchWithRetry(
      `${this.BASE}/reviews/summary?accountId=${encodeURIComponent(accountId)}`,
      { headers },
    );

    if (summaryResp.status === 401 || summaryResp.status === 403) {
      throw new BadRequestException('Vendasta OAuth token is invalid or expired.');
    }
    if (!summaryResp.ok) {
      const txt = await summaryResp.text().catch(() => '');
      throw new BadRequestException(`Vendasta reviews summary API failed (HTTP ${summaryResp.status}): ${txt.slice(0, 200)}`);
    }

    const summary = await summaryResp.json() as {
      averageRating?: number;
      totalReviews?:  number;
    };

    if ((summary.averageRating ?? 0) > 0) rows.push({ metricKey: 'avg_rating',   value: safeFloat(summary.averageRating).toFixed(2), recordedAt });
    if ((summary.totalReviews  ?? 0) > 0) rows.push({ metricKey: 'review_count', value: String(safeInt(summary.totalReviews)),  recordedAt });

    // New reviews in period
    const params = new URLSearchParams({
      accountId,
      pageSize:  '100',
      startDate: `${dateRange.from}T00:00:00Z`,
      endDate:   `${dateRange.to}T23:59:59Z`,
    });

    try {
      const reviewsResp = await fetchWithRetry(`${this.BASE}/reviews?${params.toString()}`, { headers });
      if (reviewsResp.ok) {
        const reviewsBody = await reviewsResp.json() as {
          reviews?: unknown[];
          total?:   number;
        };
        const newReviews = reviewsBody.total ?? reviewsBody.reviews?.length ?? 0;
        if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });
      }
    } catch {
      this.logger.warn('Vendasta: failed to count new reviews — skipping');
    }

    return rows;
  }
}
