import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Yelp Fusion API service — business rating snapshot.
 *
 * API: Yelp Fusion API v3
 * Docs: https://docs.developer.yelp.com/reference/v3_business_details
 *
 * Auth: Bearer API key.
 *   `Authorization: Bearer {api_key}`
 *
 * Storage layout:
 *   accessToken       = Yelp API key
 *   externalAccountId = Yelp business ID (alias or encoded string, e.g. "gary-danko-san-francisco")
 *
 * Approach:
 *   GET /businesses/{id} → rating (float), review_count (int).
 *   Yelp does not expose historical review data via the public API — the endpoint
 *   returns the current aggregate snapshot. Stored at recordedAt = dateRange.to.
 *
 * Note: Enhanced or Premium Yelp plan is required for the reviews detail endpoint.
 *   We use the business details endpoint which is available on all tiers.
 */
@Injectable()
export class YelpApiService {
  private readonly logger = new Logger(YelpApiService.name);
  private readonly BASE = 'https://api.yelp.com/v3';

  async fetchCoreMetrics(
    apiKey: string,
    businessId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const resp = await fetchWithRetry(`${this.BASE}/businesses/${encodeURIComponent(businessId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Yelp API key is invalid or lacks required permissions.');
    }
    if (resp.status === 404) {
      throw new BadRequestException(`Yelp business ID "${businessId}" not found.`);
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Yelp business details API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      rating?: number;        // float 1.0–5.0
      review_count?: number;
    };

    const recordedAt  = dateRange.to;
    const rows: MetricRowInput[] = [];

    if (body.rating !== undefined && body.rating > 0) {
      rows.push({ metricKey: 'avg_rating',   value: safeFloat(body.rating).toFixed(2),        recordedAt });
    }
    if (body.review_count !== undefined && body.review_count > 0) {
      rows.push({ metricKey: 'review_count', value: String(safeInt(body.review_count)),  recordedAt });
    }

    return rows;
  }
}
