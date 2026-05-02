import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Google Business Profile (GBP) API service — review ratings and counts.
 *
 * API: Google My Business API v4 (Business Profile API)
 * Docs: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
 *       https://developers.google.com/my-business/content/review-data
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — GOOGLE_BUSINESS_PROFILE in OAUTH_PLATFORM_CONFIGS).
 *   Scope: https://www.googleapis.com/auth/business.manage
 * Base URL: https://mybusiness.googleapis.com/v4
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = JSON {"accountId":"accounts/123456789","locationId":"locations/987654321"}
 *
 * Approach:
 *   GET /accounts/{accountId}/locations/{locationId}/reviews?pageSize=50
 *   → averageRating + totalReviewCount from response metadata (snapshot).
 *   Count reviews with createTime in the date range for new_reviews.
 *
 * Note: GBP reviews API does not support server-side date filtering — we
 *   filter client-side from the response. For businesses with many reviews,
 *   only the first page (50) is checked for new_reviews accuracy.
 */
@Injectable()
export class GoogleBusinessProfileApiService {
  private readonly logger = new Logger(GoogleBusinessProfileApiService.name);
  private readonly BASE = 'https://mybusiness.googleapis.com/v4';

  async fetchCoreMetrics(
    accessToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let accountId: string;
    let locationId: string;

    try {
      const parsed = JSON.parse(accountJson) as { accountId?: string; locationId?: string };
      accountId  = parsed.accountId  ?? '';
      locationId = parsed.locationId ?? '';
    } catch {
      throw new BadRequestException('Google Business Profile integration misconfigured. Reconnect.');
    }

    if (!accountId || !locationId) {
      throw new BadRequestException('Google Business Profile requires accountId and locationId. Reconnect.');
    }

    const resp = await fetchWithRetry(
      `${this.BASE}/${accountId}/${locationId}/reviews?pageSize=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Google Business Profile OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Google Business Profile reviews API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      reviews?: Array<{
        starRating?: string; // "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"
        createTime?: string; // ISO 8601
      }>;
      averageRating?:    number;
      totalReviewCount?: number;
    };

    const recordedAt  = dateRange.to;
    const rows: MetricRowInput[] = [];

    if ((body.averageRating ?? 0) > 0)     rows.push({ metricKey: 'avg_rating',   value: safeFloat(body.averageRating).toFixed(2),    recordedAt });
    if ((body.totalReviewCount ?? 0) > 0)  rows.push({ metricKey: 'review_count', value: String(safeInt(body.totalReviewCount)), recordedAt });

    // Count reviews created in the date range
    const starToNum: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    const fromMs = new Date(dateRange.from).getTime();
    const toMs   = new Date(dateRange.to).getTime() + 86_400_000;

    let newReviews = 0;
    for (const review of body.reviews ?? []) {
      if (review.createTime) {
        const ms = new Date(review.createTime).getTime();
        if (ms >= fromMs && ms <= toMs) newReviews++;
      }
    }
    if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });

    // Silence unused import
    void starToNum;

    return rows;
  }
}
