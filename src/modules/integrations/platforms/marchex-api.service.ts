import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Marchex Marketing Edge API service — call analytics.
 *
 * API: Marchex Marketing Edge v5
 * Docs: https://developer.marchex.io/docs/retrieving-phone-call-details
 *
 * Auth: Two required headers:
 *   x-organization-token: {authorization_token}
 *   subscription-key: {subscription_key}
 * Base URL: https://edgeapi.marchex.io/marketingedge/v5
 *
 * Storage layout:
 *   accessToken       = organization_token (encrypted)
 *   externalAccountId = JSON {"subscriptionKey":"xxx"}
 *
 * Approach:
 *   GET /api/calls?startdateutc={from}T00:00&enddateutc={to}T23:59&pagesize=10000
 *   Aggregate by day: total_calls, answered_calls, missed_calls, total_duration_sec.
 */
@Injectable()
export class MarchexApiService {
  private readonly logger = new Logger(MarchexApiService.name);
  private readonly BASE = 'https://edgeapi.marchex.io/marketingedge/v5';

  private headers(orgToken: string, subscriptionKey: string): Record<string, string> {
    return {
      'x-organization-token': orgToken,
      'subscription-key': subscriptionKey,
      Accept: 'application/json',
    };
  }

  /**
   * @param orgToken       Marchex organization token (stored as accessToken)
   * @param accountJson    JSON {"subscriptionKey":"xxx"} (stored as externalAccountId)
   * @param dateRange      { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    orgToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let subscriptionKey: string;

    try {
      const parsed = JSON.parse(accountJson) as { subscriptionKey?: string };
      subscriptionKey = parsed.subscriptionKey ?? '';
    } catch {
      throw new BadRequestException('Marchex integration misconfigured. Reconnect and supply both token and subscription key.');
    }

    if (!subscriptionKey) {
      throw new BadRequestException('Marchex requires both an organization token and a subscription key. Reconnect.');
    }

    const params = new URLSearchParams({
      startdateutc: `${dateRange.from}T00:00`,
      enddateutc: `${dateRange.to}T23:59`,
      pagesize: '10000',
    });

    const url = `${this.BASE}/api/calls?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(orgToken, subscriptionKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Marchex organization token or subscription key is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Marchex calls API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      calls?: Array<{
        callStartUtc?: string;   // ISO datetime
        duration?: number;       // seconds
        callResult?: string;     // Answered | Missed | etc.
      }>;
    };

    if (!body.calls) {
      this.logger.warn('MarchexApiService: unexpected response shape — missing calls');
      return [];
    }

    const byDay = new Map<string, { total: number; answered: number; missed: number; durationSec: number }>();

    for (const call of body.calls ?? []) {
      const day = call.callStartUtc?.slice(0, 10) ?? dateRange.to;
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      if (call.callResult === 'Answered') agg.answered++;
      else agg.missed++;
      agg.durationSec += call.duration ?? 0;
    }

    const rows: MetricRowInput[] = [];
    for (const [recordedAt, agg] of byDay) {
      if (agg.total > 0)       rows.push({ metricKey: 'total_calls',        value: String(agg.total),       recordedAt });
      if (agg.answered > 0)    rows.push({ metricKey: 'answered_calls',     value: String(agg.answered),    recordedAt });
      if (agg.missed > 0)      rows.push({ metricKey: 'missed_calls',       value: String(agg.missed),      recordedAt });
      if (agg.durationSec > 0) rows.push({ metricKey: 'total_duration_sec', value: String(agg.durationSec), recordedAt });
    }

    return rows;
  }
}
