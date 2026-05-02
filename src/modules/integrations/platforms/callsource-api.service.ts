import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * CallSource API service — call tracking and performance analytics.
 *
 * API: CallSource XML Report Service
 * Docs: https://gist.github.com/anonymous/9196799 (community implementation)
 *
 * Auth: Time-based MD5 token: md5("{username}-{password}-{currentUTCHour}-xmlservice")
 *   where currentUTCHour is formatted as YYYYMMDDHH (UTC).
 * Endpoint: POST http://xml.callsource.com/services/Report
 * Request body: XML with StartDate, EndDate, CustomerCode
 * Response: XML with call records per customer.
 *
 * Storage layout:
 *   accessToken       = password (encrypted)
 *   externalAccountId = JSON {"username":"xxx","customerCode":"*"}
 *                       customerCode defaults to "*" (all customers)
 *
 * Note: The MD5 token is recomputed each sync — valid for the current UTC hour only.
 */
@Injectable()
export class CallsourceApiService {
  private readonly logger = new Logger(CallsourceApiService.name);
  private readonly ENDPOINT = 'http://xml.callsource.com/services/Report';

  /**
   * @param password    CallSource password (stored as accessToken)
   * @param accountJson JSON {"username":"xxx","customerCode":"*"} (stored as externalAccountId)
   * @param dateRange   { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    password: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let username: string;
    let customerCode: string;

    try {
      const parsed = JSON.parse(accountJson) as { username?: string; customerCode?: string };
      username = parsed.username ?? '';
      customerCode = parsed.customerCode ?? '*';
    } catch {
      throw new BadRequestException('CallSource integration misconfigured. Reconnect.');
    }

    if (!username) {
      throw new BadRequestException('CallSource requires username and password. Reconnect.');
    }

    // Compute time-based MD5 token — valid for current UTC hour
    const nowUtc = new Date();
    const hour = [
      nowUtc.getUTCFullYear(),
      String(nowUtc.getUTCMonth() + 1).padStart(2, '0'),
      String(nowUtc.getUTCDate()).padStart(2, '0'),
      String(nowUtc.getUTCHours()).padStart(2, '0'),
    ].join('');

    const token = crypto.createHash('md5')
      .update(`${username}-${password}-${hour}-xmlservice`)
      .digest('hex');

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<Report>
  <Username>${username}</Username>
  <Token>${token}</Token>
  <StartDate>${dateRange.from}</StartDate>
  <EndDate>${dateRange.to}</EndDate>
  <CustomerCode>${customerCode}</CustomerCode>
  <returnCustName>true</returnCustName>
  <returnAdSource>true</returnAdSource>
</Report>`;

    const resp = await fetchWithRetry(this.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'text/xml',
      },
      body: xmlBody,
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('CallSource credentials are invalid or token expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`CallSource report request failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const xml = await resp.text();

    // Parse XML response — aggregate call records by date
    const byDay = new Map<string, { total: number; answered: number; missed: number; durationSec: number }>();

    // Match all <Call>...</Call> blocks (case-insensitive)
    const callBlocks = xml.match(/<Call>[\s\S]*?<\/Call>/gi) ?? [];

    for (const block of callBlocks) {
      const startTime = this.extractTag(block, 'StartTime') ?? dateRange.to;
      const result    = this.extractTag(block, 'Result')    ?? '';
      const duration  = safeInt(this.extractTag(block, 'Duration') ?? '0');

      const day = startTime.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      // CallSource Result values: "Answered", "NoAnswer", "Busy", etc.
      if (result.toLowerCase().includes('answer') && !result.toLowerCase().includes('no')) agg.answered++;
      else agg.missed++;
      agg.durationSec += duration;
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

  // ─── Private: minimal XML tag extractor ────────────────────────────────────

  private extractTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'));
    return match ? match[1].trim() : null;
  }
}
