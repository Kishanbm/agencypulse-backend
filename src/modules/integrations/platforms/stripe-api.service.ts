import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Stripe API service — payment and revenue metrics.
 *
 * API: Stripe API v1
 * Docs: https://stripe.com/docs/api/charges/list
 *
 * Auth: HTTP Basic with secret key as username (no password).
 *   Authorization: Basic base64(sk_live_xxx:)
 * Base URL: https://api.stripe.com/v1
 *
 * Storage layout:
 *   accessToken       = Stripe secret key (sk_live_... or sk_test_...)
 *   externalAccountId = 'default' (key is account-level — no separate ID needed)
 *
 * Approach:
 *   GET /charges?created[gte]={fromUnix}&created[lte]={toUnix}&limit=100
 *   Paginates via `has_more` + `starting_after` cursor. Skips uncaptured/refunded charges.
 *   Amounts in smallest currency unit (cents) → divided by 100 for USD.
 *   Metrics: total_charges (count), total_revenue, avg_charge_value.
 */
@Injectable()
export class StripeApiService {
  private readonly logger = new Logger(StripeApiService.name);
  private readonly BASE = 'https://api.stripe.com/v1';

  async fetchCoreMetrics(
    secretKey: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const credentials = Buffer.from(`${secretKey}:`).toString('base64');
    const fromUnix    = Math.floor(new Date(dateRange.from).getTime() / 1000);
    const toUnix      = Math.floor(new Date(dateRange.to + 'T23:59:59Z').getTime() / 1000);

    let totalCharges = 0;
    let totalAmount  = 0;
    let startingAfter: string | null = null;
    let hasMore = true;
    const MAX_PAGES = 100;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) { this.logger.warn('StripeApiService: pagination cap (100 pages) reached'); break; }
      const params = new URLSearchParams({
        'created[gte]': String(fromUnix),
        'created[lte]': String(toUnix),
        limit: '100',
      });
      if (startingAfter) params.set('starting_after', startingAfter);

      const resp = await fetchWithRetry(`${this.BASE}/charges?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new BadRequestException('Stripe API key is invalid or lacks charges:read permission.');
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new BadRequestException(`Stripe charges API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
      }

      const body = await resp.json() as {
        has_more?: boolean;
        data?: Array<{
          id?:         string;
          captured?:   boolean;
          refunded?:   boolean;
          amount?:     number;
          currency?:   string;
          status?:     string;
        }>;
      };

      if (!body.data) {
        this.logger.warn('StripeApiService: unexpected response shape — missing data');
        break;
      }

      for (const charge of body.data ?? []) {
        if (!charge.captured || charge.refunded) continue;
        if (charge.status !== 'succeeded') continue;
        totalCharges++;
        totalAmount += charge.amount ?? 0;
      }

      hasMore       = body.has_more ?? false;
      startingAfter = hasMore ? (body.data?.at(-1)?.id ?? null) : null;
    }

    // Convert cents → dollars (assumes USD; most agencies report in USD)
    const totalRevenue = totalAmount / 100;
    const recordedAt   = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (totalCharges > 0) rows.push({ metricKey: 'total_charges',   value: String(totalCharges),     recordedAt });
    if (totalRevenue > 0) rows.push({ metricKey: 'total_revenue',   value: totalRevenue.toFixed(2),  recordedAt });
    if (totalCharges > 0 && totalRevenue > 0) {
      rows.push({ metricKey: 'avg_charge_value', value: (totalRevenue / totalCharges).toFixed(2), recordedAt });
    }
    return rows;
  }
}
