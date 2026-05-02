import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Twilio API service — call tracking metrics.
 *
 * API: Twilio Voice REST API v2010
 * Docs: https://www.twilio.com/docs/voice/api/call-resource
 *
 * Auth: HTTP Basic — `AccountSID:AuthToken` (base64-encoded).
 * Base URL: https://api.twilio.com/2010-04-01
 *
 * Storage layout:
 *   accessToken       = Auth Token (encrypted)
 *   externalAccountId = Account SID (required, e.g. "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
 *
 * Approach:
 *   GET /Accounts/{SID}/Calls.json?StartTime>={from}&StartTime<={to}&PageSize=100
 *   Aggregate by day: inbound_calls, outbound_calls, total_calls, total_duration_sec.
 */
@Injectable()
export class TwilioApiService {
  private readonly logger = new Logger(TwilioApiService.name);
  private readonly BASE = 'https://api.twilio.com/2010-04-01';

  private headers(accountSid: string, authToken: string): Record<string, string> {
    const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    return {
      Authorization: `Basic ${creds}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param authToken   Twilio Auth Token (stored as accessToken)
   * @param accountSid  Twilio Account SID (stored as externalAccountId)
   * @param dateRange   { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    authToken: string,
    accountSid: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!accountSid || accountSid === 'default') {
      throw new BadRequestException('Twilio requires an Account SID. Reconnect and supply your Twilio Account SID.');
    }

    const params = new URLSearchParams({
      'StartTime>': `${dateRange.from}T00:00:00Z`,
      'StartTime<': `${dateRange.to}T23:59:59Z`,
      PageSize: '100',
    });

    const url = `${this.BASE}/Accounts/${accountSid}/Calls.json?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(accountSid, authToken) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Twilio Account SID or Auth Token is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Twilio calls list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      calls?: Array<{
        start_time: string;       // "Mon, 01 Jan 2024 00:00:00 +0000"
        duration: string;         // seconds as string
        status: string;           // completed | no-answer | busy | failed
        direction: string;        // inbound | outbound-api | outbound-dial
      }>;
    };

    if (!body.calls) {
      this.logger.warn('TwilioApiService: unexpected response shape — missing calls');
      return [];
    }

    const byDay = new Map<string, { total: number; inbound: number; outbound: number; durationSec: number }>();

    for (const call of body.calls ?? []) {
      // Twilio start_time format: "Mon, 01 Jan 2024 00:00:00 +0000"
      const day = new Date(call.start_time).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { total: 0, inbound: 0, outbound: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      if (call.status === 'completed') {
        agg.total++;
        if (call.direction === 'inbound') agg.inbound++;
        else agg.outbound++;
        agg.durationSec += safeInt(call.duration ?? '0');
      }
    }

    const rows: MetricRowInput[] = [];
    for (const [recordedAt, agg] of byDay) {
      if (agg.total > 0)       rows.push({ metricKey: 'total_calls',        value: String(agg.total),       recordedAt });
      if (agg.inbound > 0)     rows.push({ metricKey: 'inbound_calls',      value: String(agg.inbound),     recordedAt });
      if (agg.outbound > 0)    rows.push({ metricKey: 'outbound_calls',     value: String(agg.outbound),    recordedAt });
      if (agg.durationSec > 0) rows.push({ metricKey: 'total_duration_sec', value: String(agg.durationSec), recordedAt });
    }

    return rows;
  }
}
