import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Yext Knowledge API service — review ratings and counts.
 *
 * API: Yext Knowledge API v2
 * Docs: https://hitchhikers.yext.com/docs/managementapis/reviews/reviewmanagement/
 *       https://hitchhikers.yext.com/guides/working-with-reviews/01-fetch-reviews/
 *
 * Auth: OAuth 2.0 Bearer token (via StandardTokenService — YEXT in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://api.yextapis.com/v2
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = JSON {"accountId":"me","entityId":"123456"}
 *                       accountId defaults to "me" (caller's account).
 *
 * Approach:
 *   GET /accounts/{accountId}/reviews?v=20230301&entityId={entityId}&limit=50
 *   → count new reviews in date range + compute avg_rating from period reviews.
 *   Also push total review count + overall avg from the response pagination.
 *
 * Note: Yext API date format is YYYY-MM-DD.
 *   Response: reviews[].rating (1–5), reviews[].publisherDate (ISO string).
 */
@Injectable()
export class YextApiService {
  private readonly logger = new Logger(YextApiService.name);
  private readonly BASE = 'https://api.yextapis.com/v2';
  private readonly API_VERSION = '20230301';

  async fetchCoreMetrics(
    accessToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let accountId: string;
    let entityId: string;

    try {
      const parsed = JSON.parse(accountJson) as { accountId?: string; entityId?: string };
      accountId = parsed.accountId ?? 'me';
      entityId  = parsed.entityId  ?? '';
    } catch {
      throw new BadRequestException('Yext integration misconfigured. Reconnect.');
    }

    if (!entityId) {
      throw new BadRequestException('Yext requires an entityId in the integration setup. Reconnect.');
    }

    const params = new URLSearchParams({
      v:        this.API_VERSION,
      entityId,
      limit:    '50',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/accounts/${accountId}/reviews?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Yext OAuth token is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Yext reviews API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      response?: {
        reviews?: Array<{
          rating?: number;
          publisherDate?: string;
          firstPartyDate?: string;
        }>;
        averageRating?: number;
        count?: number;
      };
    };

    if (!body.response) {
      this.logger.warn('YextApiService: unexpected response shape — missing response');
      return [];
    }

    const reviews        = body.response?.reviews ?? [];
    const totalCount     = body.response?.count ?? 0;
    const overallAvgRating = body.response?.averageRating ?? 0;
    const recordedAt     = dateRange.to;
    const rows: MetricRowInput[] = [];

    if (overallAvgRating > 0) rows.push({ metricKey: 'avg_rating',   value: safeFloat(overallAvgRating).toFixed(2), recordedAt });
    if (totalCount > 0)       rows.push({ metricKey: 'review_count', value: String(safeInt(totalCount)),             recordedAt });

    // Count reviews in the date range
    const fromMs = new Date(dateRange.from).getTime();
    const toMs   = new Date(dateRange.to).getTime() + 86_400_000; // end of day
    let newReviews = 0;
    for (const r of reviews) {
      const dateStr = r.publisherDate ?? r.firstPartyDate;
      if (dateStr) {
        const ms = new Date(dateStr).getTime();
        if (ms >= fromMs && ms <= toMs) newReviews++;
      }
    }
    if (newReviews > 0) rows.push({ metricKey: 'new_reviews', value: String(newReviews), recordedAt });

    return rows;
  }
}
