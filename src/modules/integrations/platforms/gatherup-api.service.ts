import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * GatherUp API service — review ratings and new review counts.
 *
 * API: GatherUp REST API v2
 * Docs: https://help.gatherup.com/s/article/GatherUp-REST-API
 *       https://help.gatherup.com/s/article/GatherUp-API-Client-ID-Private-Key-and-Bearer-Token
 *
 * Auth: Bearer token in Authorization header + clientId query param.
 *   Token generated in GatherUp settings → API Credentials.
 * Base URL: https://app.gatherup.com/api/v2
 *
 * Storage layout:
 *   accessToken       = Bearer token (API token from GatherUp)
 *   externalAccountId = clientId (numeric account identifier)
 *
 * Approach:
 *   GET /reviews?clientId={id}&start={from}&end={to}&limit=500 → list and count new reviews
 *   GET /statistics?clientId={id}&start={from}&end={to} → avg_rating, review_count
 */
@Injectable()
export class GatherUpApiService {
  private readonly logger = new Logger(GatherUpApiService.name);
  private readonly BASE = 'https://app.gatherup.com/api/v2';

  async fetchCoreMetrics(
    bearerToken: string,
    clientId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    };

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    // Statistics endpoint — avg rating + review counts
    const statsParams = new URLSearchParams({
      clientId,
      start: dateRange.from,
      end:   dateRange.to,
    });

    const statsResp = await fetchWithRetry(
      `${this.BASE}/statistics?${statsParams.toString()}`,
      { headers },
    );

    if (statsResp.status === 401 || statsResp.status === 403) {
      throw new BadRequestException('GatherUp Bearer token is invalid or expired.');
    }
    if (!statsResp.ok) {
      const txt = await statsResp.text().catch(() => '');
      throw new BadRequestException(`GatherUp statistics API failed (HTTP ${statsResp.status}): ${txt.slice(0, 200)}`);
    }

    const stats = await statsResp.json() as {
      averageRating?: number;
      totalReviews?:  number;
      newReviews?:    number;
    };

    if ((stats.averageRating ?? 0) > 0)  rows.push({ metricKey: 'avg_rating',   value: safeFloat(stats.averageRating).toFixed(2), recordedAt });
    if ((stats.totalReviews ?? 0) > 0)   rows.push({ metricKey: 'review_count', value: String(safeInt(stats.totalReviews)),  recordedAt });
    if ((stats.newReviews ?? 0) > 0)     rows.push({ metricKey: 'new_reviews',  value: String(safeInt(stats.newReviews)),    recordedAt });

    return rows;
  }
}
