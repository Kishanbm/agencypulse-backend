import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * AVANSER API service — call tracking metrics (Australian/APAC platform).
 *
 * API: AVANSER Legacy JSON API
 * Docs: https://github.com/wheredidgogogo/avanser (reverse-engineered from PHP client)
 *       https://avanserwebapi.docs.apiary.io/
 *
 * Auth: Three-step session token flow:
 *   1. GET /JSON?action=getTokenKey&account_id={id}&api_key={key}  → tokenKey
 *   2. GET /JSON?action=signIn&account_id={id}&signature=md5(secret+tokenKey) → token
 *   3. Use token in subsequent requests
 * Base URL: http://api.avanser.com/JSON
 *
 * Storage layout:
 *   accessToken       = api_key (encrypted)
 *   externalAccountId = JSON {"accountId":"xxx","secret":"yyy"}
 *
 * Approach:
 *   Authenticate → GET ?action=getCDR&date_from={from}&date_to={to}&limit=500
 *   Aggregate by day: total_calls, answered_calls, missed_calls, total_duration_sec.
 */
@Injectable()
export class AvanserApiService {
  private readonly logger = new Logger(AvanserApiService.name);
  private readonly BASE = 'http://api.avanser.com/JSON';

  /**
   * @param apiKey      AVANSER api_key (stored as accessToken)
   * @param accountJson JSON {"accountId":"xxx","secret":"yyy"} (stored as externalAccountId)
   * @param dateRange   { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let accountId: string;
    let secret: string;

    try {
      const parsed = JSON.parse(accountJson) as { accountId?: string; secret?: string };
      accountId = parsed.accountId ?? '';
      secret = parsed.secret ?? '';
    } catch {
      throw new BadRequestException('AVANSER integration misconfigured. Reconnect.');
    }

    if (!accountId || !secret) {
      throw new BadRequestException('AVANSER requires account ID, API key, and account secret. Reconnect.');
    }

    // Step 1: Get token key
    const tokenKey = await this.getTokenKey(accountId, apiKey);

    // Step 2: Sign in — compute MD5(secret + tokenKey)
    const signature = crypto.createHash('md5').update(`${secret}${tokenKey}`).digest('hex');
    const sessionToken = await this.signIn(accountId, signature);

    // Step 3: Fetch CDR (call detail records)
    const params = new URLSearchParams({
      account_id: accountId,
      token: sessionToken,
      action: 'getCDR',
      date_from: dateRange.from,
      date_to: dateRange.to,
      limit: '500',
      detailed: 'yes',
      evaluations: 'no',
      features: 'no',
      wav: 'no',
      web: 'no',
      localtime: 'no',
      last_id: '0',
    });

    const resp = await fetchWithRetry(`${this.BASE}?${params.toString()}`);

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('AVANSER session token rejected. Check credentials.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`AVANSER getCDR failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      data?: Array<{
        date?: string;          // YYYY-MM-DD or datetime
        duration?: number;      // seconds
        answered?: string | number; // '1'/'0' or true/false
        call_result?: string;
      }>;
    };

    if (!body.data) {
      this.logger.warn('AvanserApiService: unexpected response shape — missing data');
      return [];
    }

    const byDay = new Map<string, { total: number; answered: number; missed: number; durationSec: number }>();

    for (const call of body.data ?? []) {
      const day = (call.date ?? dateRange.to).slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      const isAnswered = call.answered === 1 || call.answered === '1' || call.answered === true as unknown as string;
      if (isAnswered) agg.answered++;
      else agg.missed++;
      agg.durationSec += typeof call.duration === 'number' ? call.duration : 0;
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

  // ─── Private: auth flow ────────────────────────────────────────────────────

  private async getTokenKey(accountId: string, apiKey: string): Promise<string> {
    const params = new URLSearchParams({ action: 'getTokenKey', account_id: accountId, api_key: apiKey });
    const resp = await fetchWithRetry(`${this.BASE}?${params.toString()}`);
    if (!resp.ok) throw new BadRequestException(`AVANSER getTokenKey failed (HTTP ${resp.status})`);
    const body = await resp.json() as { tokenKey?: string; error?: string };
    if (!body.tokenKey) throw new BadRequestException(`AVANSER getTokenKey error: ${body.error ?? 'no tokenKey returned'}`);
    return body.tokenKey;
  }

  private async signIn(accountId: string, signature: string): Promise<string> {
    const params = new URLSearchParams({ action: 'signIn', account_id: accountId, signature });
    const resp = await fetchWithRetry(`${this.BASE}?${params.toString()}`);
    if (!resp.ok) throw new BadRequestException(`AVANSER signIn failed (HTTP ${resp.status})`);
    const body = await resp.json() as { token?: string; error?: string };
    if (!body.token) throw new BadRequestException(`AVANSER signIn error: ${body.error ?? 'no token returned'}`);
    return body.token;
  }
}
