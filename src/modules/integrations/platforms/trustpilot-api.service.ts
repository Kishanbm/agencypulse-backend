import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Trustpilot API service — review ratings and counts.
 *
 * API: Trustpilot Consumer API v1
 * Docs: https://developers.trustpilot.com/business-units-api
 *       https://developers.trustpilot.com/service-reviews-api
 *
 * Auth: OAuth 2.0 Bearer token.
 *   Token endpoint: POST https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken
 *   Stored as accessToken via StandardTokenService (TRUSTPILOT in OAUTH_PLATFORM_CONFIGS).
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = businessUnitId (e.g. "4bfa4d5a0000640005006b09")
 *
 * Approach:
 *   1. GET /business-units/{id}/web → current averageScore + numberOfReviews (snapshot)
 *   2. GET /business-units/{id}/reviews?startDate=...&endDate=... → count new reviews in period
 *   Snapshot metrics stored at recordedAt = dateRange.to.
 */
@Injectable()
export class TrustpilotApiService {
  private readonly logger = new Logger(TrustpilotApiService.name);
  private readonly BASE = 'https://api.trustpilot.com/v1';

  async fetchCoreMetrics(
    accessToken: string,
    businessUnitId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // Step 1: Snapshot — avg rating + total review count
    const profileResp = await fetchWithRetry(
      `${this.BASE}/business-units/${businessUnitId}/web`,
      { headers },
    );

    if (profileResp.status === 401 || profileResp.status === 403) {
      throw new BadRequestException('Trustpilot OAuth token is invalid or expired.');
    }
    if (!profileResp.ok) {
      const txt = await profileResp.text().catch(() => '');
      throw new BadRequestException(`Trustpilot business unit API failed (HTTP ${profileResp.status}): ${txt.slice(0, 200)}`);
    }

    const profile = await profileResp.json() as {
      score?: { trustScore?: number };
      numberOfReviews?: { total?: number };
    };

    const avgRating   = profile.score?.trustScore ?? 0;
    const reviewCount = profile.numberOfReviews?.total ?? 0;
    const recordedAt  = dateRange.to;

    const rows: MetricRowInput[] = [];
    if (avgRating > 0)    rows.push({ metricKey: 'avg_rating',     value: safeFloat(avgRating).toFixed(2),   recordedAt });
    if (reviewCount > 0)  rows.push({ metricKey: 'review_count',   value: String(safeInt(reviewCount)), recordedAt });

    // Step 2: New reviews in the date range
    const newReviews = await this.countNewReviews(businessUnitId, accessToken, dateRange);
    if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });

    return rows;
  }

  private async countNewReviews(
    businessUnitId: string,
    accessToken: string,
    dateRange: { from: string; to: string },
  ): Promise<number> {
    try {
      const params = new URLSearchParams({
        startDate: `${dateRange.from}T00:00:00`,
        endDate:   `${dateRange.to}T23:59:59`,
        perPage:   '1',
      });
      const resp = await fetchWithRetry(
        `${this.BASE}/business-units/${businessUnitId}/reviews?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
      );
      if (!resp.ok) return 0;
      const body = await resp.json() as { pagination?: { total?: number } };
      return body.pagination?.total ?? 0;
    } catch {
      this.logger.warn('Trustpilot: failed to count new reviews — returning 0');
      return 0;
    }
  }
}
