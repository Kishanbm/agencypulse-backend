import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * CallRail API service — call tracking metrics.
 *
 * API: CallRail API v3
 * Docs: https://apidocs.callrail.com/
 *
 * Auth: `Authorization: Token token={api_key}` header.
 * Base URL: https://api.callrail.com/v3
 *
 * Storage layout:
 *   accessToken       = API key (encrypted)
 *   externalAccountId = CallRail account ID (numeric string)
 *
 * Approach:
 *   GET /v3/a/{accountId}/calls.json?start_date=...&end_date=...&per_page=250
 *   Aggregate: total_calls, answered_calls, missed_calls, first_time_callers, total_duration_seconds.
 *   Emit one row per metric per day (grouped by call date).
 */
@Injectable()
export class CallrailApiService {
  private readonly logger = new Logger(CallrailApiService.name);
  private readonly BASE = 'https://api.callrail.com/v3';

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Token token=${apiKey}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey    CallRail API key
   * @param accountId CallRail account ID (stored as externalAccountId)
   * @param dateRange { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!accountId || accountId === 'default') {
      throw new BadRequestException('CallRail requires an account ID. Reconnect and supply your CallRail account ID.');
    }

    const params = new URLSearchParams({
      start_date: dateRange.from,
      end_date: dateRange.to,
      per_page: '250',
      fields: 'start_time,duration,answered,first_time_caller',
    });

    const url = `${this.BASE}/a/${accountId}/calls.json?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('CallRail API key is invalid or lacks access to this account.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`CallRail calls list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      calls: Array<{
        start_time: string;        // ISO datetime
        duration: number;          // seconds
        answered: boolean;
        first_time_caller: boolean;
      }>;
    };

    if (!body.calls) {
      this.logger.warn('CallrailApiService: unexpected response shape — missing calls');
      return [];
    }

    // Aggregate by day
    const byDay = new Map<string, { total: number; answered: number; missed: number; firstTime: number; durationSec: number }>();

    for (const call of body.calls ?? []) {
      const day = call.start_time?.slice(0, 10) ?? dateRange.to;
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, firstTime: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      if (call.answered) agg.answered++;
      else agg.missed++;
      if (call.first_time_caller) agg.firstTime++;
      agg.durationSec += call.duration ?? 0;
    }

    const rows: MetricRowInput[] = [];
    for (const [recordedAt, agg] of byDay) {
      if (agg.total > 0)      rows.push({ metricKey: 'total_calls',        value: String(agg.total),       recordedAt });
      if (agg.answered > 0)   rows.push({ metricKey: 'answered_calls',     value: String(agg.answered),    recordedAt });
      if (agg.missed > 0)     rows.push({ metricKey: 'missed_calls',       value: String(agg.missed),      recordedAt });
      if (agg.firstTime > 0)  rows.push({ metricKey: 'first_time_callers', value: String(agg.firstTime),   recordedAt });
      if (agg.durationSec > 0) rows.push({ metricKey: 'total_duration_sec', value: String(agg.durationSec), recordedAt });
    }

    return rows;
  }
}
