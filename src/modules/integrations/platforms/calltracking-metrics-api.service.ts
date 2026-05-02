import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * CallTrackingMetrics API service — call tracking and analytics.
 *
 * API: CallTrackingMetrics API v1
 * Docs: https://developer.calltrackingmetrics.com/
 *
 * Auth: HTTP Basic — `access_key:secret_key` (base64-encoded).
 * Base URL: https://api.calltrackingmetrics.com/api/v1
 *
 * Storage layout:
 *   accessToken       = access_key (encrypted)
 *   externalAccountId = JSON {"accountId":"xxx","secretKey":"yyy"}
 *
 * Approach:
 *   GET /accounts/{accountId}/calls?start_date=...&end_date=...&page_size=250
 *   Aggregate by day: total_calls, answered_calls, missed_calls, total_duration_sec.
 */
@Injectable()
export class CalltrackingMetricsApiService {
  private readonly logger = new Logger(CalltrackingMetricsApiService.name);
  private readonly BASE = 'https://api.calltrackingmetrics.com/api/v1';

  private headers(accessKey: string, secretKey: string): Record<string, string> {
    const creds = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
    return {
      Authorization: `Basic ${creds}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param accessKey    CTM access_key (stored as accessToken)
   * @param accountJson  JSON {"accountId":"xxx","secretKey":"yyy"} (stored as externalAccountId)
   * @param dateRange    { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    accessKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let accountId: string;
    let secretKey: string;

    try {
      const parsed = JSON.parse(accountJson) as { accountId?: string; secretKey?: string };
      accountId = parsed.accountId ?? '';
      secretKey = parsed.secretKey ?? '';
    } catch {
      throw new BadRequestException('CallTrackingMetrics integration misconfigured. Reconnect.');
    }

    if (!accountId || !secretKey) {
      throw new BadRequestException('CallTrackingMetrics requires account ID and secret key. Reconnect.');
    }

    const params = new URLSearchParams({
      start_date: `${dateRange.from}T00:00:00`,
      end_date: `${dateRange.to}T23:59:59`,
      page_size: '250',
    });

    const url = `${this.BASE}/accounts/${accountId}/calls?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(accessKey, secretKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('CallTrackingMetrics credentials are invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`CTM calls list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      calls: Array<{
        called_at: string;         // ISO datetime
        duration: number;          // seconds
        status: string;            // answered | missed | abandoned
      }>;
    };

    if (!body.calls) {
      this.logger.warn('CalltrackingMetricsApiService: unexpected response shape — missing calls');
      return [];
    }

    const byDay = new Map<string, { total: number; answered: number; missed: number; durationSec: number }>();

    for (const call of body.calls ?? []) {
      const day = call.called_at?.slice(0, 10) ?? dateRange.to;
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      if (call.status === 'answered') agg.answered++;
      else agg.missed++;
      agg.durationSec += call.duration ?? 0;
    }

    const rows: MetricRowInput[] = [];
    for (const [recordedAt, agg] of byDay) {
      if (agg.total > 0)       rows.push({ metricKey: 'total_calls',    value: String(agg.total),       recordedAt });
      if (agg.answered > 0)    rows.push({ metricKey: 'answered_calls', value: String(agg.answered),    recordedAt });
      if (agg.missed > 0)      rows.push({ metricKey: 'missed_calls',   value: String(agg.missed),      recordedAt });
      if (agg.durationSec > 0) rows.push({ metricKey: 'total_duration_sec', value: String(agg.durationSec), recordedAt });
    }

    return rows;
  }
}
