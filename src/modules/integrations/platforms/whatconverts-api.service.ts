import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * WhatConverts API service — lead tracking and conversion metrics.
 *
 * API: WhatConverts API v1
 * Docs: https://docs.whatconverts.com/api/
 *
 * Auth: HTTP Basic — `account_token:account_secret` (base64-encoded).
 * Base URL: https://app.whatconverts.com/api/v1
 *
 * Storage layout:
 *   accessToken       = account_token (encrypted)
 *   externalAccountId = JSON {"secretKey":"account_secret","profileId":"optional"}
 *
 * Approach:
 *   GET /leads?date_range=custom&start_date={from}&end_date={to}&per_page=250
 *   Count leads by type per day: calls, web_forms, chats, transactions.
 */
@Injectable()
export class WhatConvertsApiService {
  private readonly logger = new Logger(WhatConvertsApiService.name);
  private readonly BASE = 'https://app.whatconverts.com/api/v1';

  private headers(token: string, secret: string): Record<string, string> {
    const creds = Buffer.from(`${token}:${secret}`).toString('base64');
    return {
      Authorization: `Basic ${creds}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param token       WhatConverts account_token (stored as accessToken)
   * @param accountJson JSON {"secretKey":"account_secret"} (stored as externalAccountId)
   * @param dateRange   { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    token: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let secretKey: string;

    try {
      const parsed = JSON.parse(accountJson) as { secretKey?: string };
      secretKey = parsed.secretKey ?? '';
    } catch {
      throw new BadRequestException('WhatConverts integration misconfigured. Reconnect.');
    }

    if (!secretKey) {
      throw new BadRequestException('WhatConverts requires account token and secret. Reconnect.');
    }

    const params = new URLSearchParams({
      date_range: 'custom',
      start_date: dateRange.from,
      end_date: dateRange.to,
      per_page: '250',
    });

    const url = `${this.BASE}/leads?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(token, secretKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('WhatConverts credentials are invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`WhatConverts leads list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      leads?: Array<{
        date_created: string;   // YYYY-MM-DD HH:MM:SS
        lead_type: string;      // phone_call | web_form | chat | transaction | etc.
      }>;
    };

    if (!body.leads) {
      this.logger.warn('WhatConvertsApiService: unexpected response shape — missing leads');
      return [];
    }

    const byDay = new Map<string, { calls: number; forms: number; chats: number; total: number }>();

    for (const lead of body.leads ?? []) {
      const day = lead.date_created?.slice(0, 10) ?? dateRange.to;
      if (!byDay.has(day)) byDay.set(day, { calls: 0, forms: 0, chats: 0, total: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      if (lead.lead_type === 'phone_call') agg.calls++;
      else if (lead.lead_type === 'web_form') agg.forms++;
      else if (lead.lead_type === 'chat') agg.chats++;
    }

    const rows: MetricRowInput[] = [];
    for (const [recordedAt, agg] of byDay) {
      if (agg.total > 0)  rows.push({ metricKey: 'total_leads', value: String(agg.total), recordedAt });
      if (agg.calls > 0)  rows.push({ metricKey: 'call_leads',  value: String(agg.calls), recordedAt });
      if (agg.forms > 0)  rows.push({ metricKey: 'form_leads',  value: String(agg.forms), recordedAt });
      if (agg.chats > 0)  rows.push({ metricKey: 'chat_leads',  value: String(agg.chats), recordedAt });
    }

    return rows;
  }
}
