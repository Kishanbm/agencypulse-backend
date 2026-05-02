import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Shopify API service — ecommerce order and revenue metrics.
 *
 * API: Shopify Admin REST API 2024-01
 * Docs: https://shopify.dev/docs/api/admin-rest/2024-01/resources/order
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (SHOPIFY in OAUTH_PLATFORM_CONFIGS).
 *   Requires read_orders scope.
 * Base URL: https://{shopDomain}/admin/api/2024-01
 *
 * Storage layout:
 *   accessToken       = OAuth access token
 *   externalAccountId = Shopify store domain (e.g. "mystore.myshopify.com")
 *
 * Approach:
 *   GET /orders.json?status=any&created_at_min={from}T00:00:00Z&created_at_max={to}T23:59:59Z&limit=250
 *   Paginates via Link header. Aggregates as a single snapshot at dateRange.to.
 *   Metrics: total_orders, total_revenue (sum of total_price), avg_order_value.
 */
@Injectable()
export class ShopifyApiService {
  private readonly logger = new Logger(ShopifyApiService.name);

  async fetchCoreMetrics(
    accessToken: string,
    shopDomain: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const BASE = `https://${shopDomain}/admin/api/2024-01`;
    let url: string | null = `${BASE}/orders.json?status=any&created_at_min=${dateRange.from}T00:00:00Z&created_at_max=${dateRange.to}T23:59:59Z&limit=250&fields=id,total_price,financial_status`;

    let totalOrders  = 0;
    let totalRevenue = 0;
    const MAX_PAGES  = 100;
    let pages        = 0;

    while (url) {
      if (++pages > MAX_PAGES) { this.logger.warn('ShopifyApiService: pagination cap (100 pages) reached'); break; }
      const resp = await fetchWithRetry(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          Accept: 'application/json',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new BadRequestException('Shopify OAuth token is invalid or lacks read_orders scope.');
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new BadRequestException(`Shopify orders API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
      }

      const body = await resp.json() as {
        orders?: Array<{ total_price?: string; financial_status?: string }>;
      };

      if (!body.orders) {
        this.logger.warn('ShopifyApiService: unexpected response shape — missing orders');
        break;
      }

      for (const order of body.orders ?? []) {
        if (order.financial_status === 'refunded') continue;
        totalOrders++;
        totalRevenue += safeFloat(order.total_price ?? '0');
      }

      // Shopify paginates via Link header: <url>; rel="next"
      const linkHeader = resp.headers.get('Link') ?? '';
      const nextMatch  = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (totalOrders > 0)  rows.push({ metricKey: 'total_orders',     value: String(totalOrders),              recordedAt });
    if (totalRevenue > 0) rows.push({ metricKey: 'total_revenue',     value: totalRevenue.toFixed(2),          recordedAt });
    if (totalOrders > 0 && totalRevenue > 0) {
      rows.push({ metricKey: 'avg_order_value', value: (totalRevenue / totalOrders).toFixed(2), recordedAt });
    }
    return rows;
  }
}
