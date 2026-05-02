import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Keap (Infusionsoft) API service — ecommerce order and revenue metrics.
 *
 * API: Keap REST API v1
 * Docs: https://developer.infusionsoft.com/docs/rest/#tag/E-Commerce/operation/listOrdersUsingGET
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (KEAP in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://api.infusionsoft.com/crm/rest/v1
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = 'default' (account-level endpoint — no separate ID needed)
 *
 * Approach:
 *   GET /orders?since={from}T00:00:00Z&until={to}T23:59:59Z&limit=200&offset={n}
 *   Paginates via offset. Aggregates as snapshot at dateRange.to.
 *   Metrics: total_orders, total_revenue, avg_order_value.
 */
@Injectable()
export class KeapApiService {
  private readonly logger = new Logger(KeapApiService.name);
  private readonly BASE = 'https://api.infusionsoft.com/crm/rest/v1';

  async fetchCoreMetrics(
    accessToken: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let totalOrders  = 0;
    let totalRevenue = 0;
    let offset       = 0;
    let hasMore      = true;
    const MAX_PAGES  = 100;
    let pages        = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) { this.logger.warn('KeapApiService: pagination cap (100 pages) reached'); break; }
      const params = new URLSearchParams({
        since:  `${dateRange.from}T00:00:00Z`,
        until:  `${dateRange.to}T23:59:59Z`,
        limit:  '200',
        offset: String(offset),
      });

      const resp = await fetchWithRetry(`${this.BASE}/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new BadRequestException('Keap OAuth token is invalid or expired.');
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new BadRequestException(`Keap orders API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
      }

      const body = await resp.json() as {
        orders?: Array<{
          order_total?: number;
          status?:      string;
        }>;
        count?: number;
        next?:  string;
      };

      if (!body.orders) {
        this.logger.warn('KeapApiService: unexpected response shape — missing orders');
        break;
      }

      const orders = body.orders ?? [];
      for (const order of orders) {
        if (order.status === 'Cancelled' || order.status === 'Refunded') continue;
        totalOrders++;
        totalRevenue += order.order_total ?? 0;
      }

      hasMore = !!body.next && orders.length === 200;
      offset += 200;
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
