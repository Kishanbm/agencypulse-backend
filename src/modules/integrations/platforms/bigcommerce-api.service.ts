import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * BigCommerce API service — ecommerce order and revenue metrics.
 *
 * API: BigCommerce Management API v2
 * Docs: https://developer.bigcommerce.com/docs/rest-management/orders
 *
 * Auth: API token via X-Auth-Token header.
 *   X-Auth-Token: {apiToken}
 *   storeHash stored in externalAccountId as JSON {storeHash}.
 * Base URL: https://api.bigcommerce.com/stores/{storeHash}/v2
 *
 * Storage layout:
 *   accessToken       = BigCommerce API token (X-Auth-Token)
 *   externalAccountId = JSON { "storeHash": "abc123" }
 *
 * Approach:
 *   GET /orders?min_date_created={from}&max_date_created={to}&limit=250&page={n}
 *   Paginates through all pages. Aggregates as snapshot at dateRange.to.
 *   Skips refunded/cancelled orders. Metrics: total_orders, total_revenue, avg_order_value.
 */
@Injectable()
export class BigcommerceApiService {
  private readonly logger = new Logger(BigcommerceApiService.name);

  async fetchCoreMetrics(
    apiToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let storeHash: string;
    try {
      const parsed = JSON.parse(accountJson) as { storeHash?: string };
      storeHash = parsed.storeHash ?? '';
    } catch {
      throw new BadRequestException('BigCommerce: externalAccountId must be JSON {storeHash}.');
    }
    if (!storeHash) {
      throw new BadRequestException('BigCommerce: storeHash is required.');
    }

    const BASE   = `https://api.bigcommerce.com/stores/${storeHash}/v2`;
    const headers = {
      'X-Auth-Token': apiToken,
      Accept: 'application/json',
    };

    let totalOrders  = 0;
    let totalRevenue = 0;
    let page         = 1;
    let hasMore      = true;
    const MAX_PAGES = 100;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        this.logger.warn('BigcommerceApiService: pagination cap (100 pages) reached');
        break;
      }
      const params = new URLSearchParams({
        min_date_created: `${dateRange.from}T00:00:00+00:00`,
        max_date_created: `${dateRange.to}T23:59:59+00:00`,
        limit: '250',
        page: String(page),
      });

      const resp = await fetchWithRetry(`${BASE}/orders?${params.toString()}`, { headers });

      if (resp.status === 401 || resp.status === 403) {
        throw new BadRequestException('BigCommerce API token is invalid or lacks order read access.');
      }
      if (resp.status === 204) break;
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new BadRequestException(`BigCommerce orders API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
      }

      const body = await resp.json() as Array<{
        status_id?:      number;
        total_inc_tax?:  string;
      }>;

      if (!Array.isArray(body) || body.length === 0) break;

      for (const order of body) {
        // Status 4 = Cancelled, 5 = Declined, 6 = Awaiting Payment, 14 = Refunded
        if ([4, 5, 14].includes(order.status_id ?? -1)) continue;
        totalOrders++;
        totalRevenue += safeFloat(order.total_inc_tax ?? '0');
      }

      hasMore = body.length === 250;
      page++;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (totalOrders > 0)  rows.push({ metricKey: 'total_orders',   value: String(totalOrders),     recordedAt });
    if (totalRevenue > 0) rows.push({ metricKey: 'total_revenue',   value: totalRevenue.toFixed(2), recordedAt });
    if (totalOrders > 0 && totalRevenue > 0) {
      rows.push({ metricKey: 'avg_order_value', value: (totalRevenue / totalOrders).toFixed(2), recordedAt });
    }
    return rows;
  }
}
