import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * WooCommerce API service — ecommerce sales report metrics.
 *
 * API: WooCommerce REST API v3
 * Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#reports-sales
 *
 * Auth: HTTP Basic — consumer_key:consumer_secret (WooCommerce API keys).
 *   consumer_key  = accessToken
 *   consumer_secret = stored in externalAccountId as JSON {siteUrl, consumerSecret}
 * Base URL: https://{siteUrl}/wp-json/wc/v3
 *
 * Storage layout:
 *   accessToken       = WooCommerce consumer_key
 *   externalAccountId = JSON { "siteUrl": "https://...", "consumerSecret": "cs_..." }
 *
 * Approach:
 *   GET /reports/sales?date_min={from}&date_max={to}
 *   Returns a single aggregated sales object for the date range.
 *   Metrics: total_orders, total_sales (gross), net_revenue, avg_order_value.
 */
@Injectable()
export class WoocommerceApiService {
  private readonly logger = new Logger(WoocommerceApiService.name);

  async fetchCoreMetrics(
    consumerKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let siteUrl: string;
    let consumerSecret: string;
    try {
      const parsed = JSON.parse(accountJson) as { siteUrl?: string; consumerSecret?: string };
      siteUrl        = parsed.siteUrl       ?? '';
      consumerSecret = parsed.consumerSecret ?? '';
    } catch {
      throw new BadRequestException('WooCommerce: externalAccountId must be JSON {siteUrl, consumerSecret}.');
    }
    if (!siteUrl || !consumerSecret) {
      throw new BadRequestException('WooCommerce: siteUrl and consumerSecret are required.');
    }

    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const params      = new URLSearchParams({ date_min: dateRange.from, date_max: dateRange.to });

    const resp = await fetchWithRetry(
      `${siteUrl.replace(/\/$/, '')}/wp-json/wc/v3/reports/sales?${params.toString()}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('WooCommerce API keys are invalid or lack read access.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`WooCommerce sales report API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as Array<{
      total_orders?: number;
      total_sales?:  string;
      net_revenue?:  string;
      average_sales?: string;
    }>;

    const data       = body[0] ?? {};
    const orders     = data.total_orders ?? 0;
    const gross      = safeFloat(data.total_sales  ?? '0');
    const net        = safeFloat(data.net_revenue   ?? '0');
    const avg        = safeFloat(data.average_sales ?? '0');
    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (orders > 0) rows.push({ metricKey: 'total_orders',     value: String(orders), recordedAt });
    if (gross > 0)  rows.push({ metricKey: 'total_revenue',     value: gross.toFixed(2), recordedAt });
    if (net > 0)    rows.push({ metricKey: 'net_revenue',       value: net.toFixed(2),   recordedAt });
    if (avg > 0)    rows.push({ metricKey: 'avg_order_value',   value: avg.toFixed(2),   recordedAt });
    return rows;
  }
}
