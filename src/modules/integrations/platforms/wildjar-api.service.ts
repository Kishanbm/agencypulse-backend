import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * WildJar API service — call tracking metrics.
 *
 * API: WildJar REST API v2
 * Docs: https://support.wildjar.com/hc/en-au/articles/360001485296
 *       https://documenter.getpostman.com/view/7393567/SVSLp8Rb
 *
 * Auth: OAuth 2.0 client_credentials.
 *   Token endpoint: POST https://api.trkcall.com/v2/token/
 *   Header: Authorization: Basic base64(username:password)
 *   Body: grant_type=client_credentials
 *
 * Storage layout:
 *   accessToken       = username (encrypted) — WildJar dashboard login
 *   externalAccountId = JSON {"password":"xxx"} — WildJar dashboard password
 *
 * Approach:
 *   1. POST /v2/token/ to exchange username:password for a Bearer token.
 *   2. GET /v2/calls/?date_from={from}&date_to={to} with the Bearer token.
 *   Aggregate by day: total_calls, answered_calls, missed_calls, total_duration_sec.
 *
 * Note: WildJar tokens are short-lived; we fetch a fresh one each sync.
 */
@Injectable()
export class WildJarApiService {
  private readonly logger = new Logger(WildJarApiService.name);
  private readonly BASE = 'https://api.trkcall.com/v2';

  /**
   * @param username    WildJar dashboard username (stored as accessToken)
   * @param accountJson JSON {"password":"xxx"} (stored as externalAccountId)
   * @param dateRange   { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    username: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let password: string;

    try {
      const parsed = JSON.parse(accountJson) as { password?: string };
      password = parsed.password ?? '';
    } catch {
      throw new BadRequestException('WildJar integration misconfigured. Reconnect.');
    }

    if (!password) {
      throw new BadRequestException('WildJar requires username and password. Reconnect.');
    }

    // Step 1: Obtain a fresh access token via client_credentials
    const bearerToken = await this.getAccessToken(username, password);

    // Step 2: Fetch calls with date range
    const params = new URLSearchParams({
      date_from: dateRange.from,
      date_to: dateRange.to,
      page_size: '500',
    });

    const resp = await fetchWithRetry(`${this.BASE}/calls/?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
      },
    });

    if (resp.status === 401) {
      throw new BadRequestException('WildJar access token is invalid. Please reconnect.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`WildJar calls list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      results?: Array<{
        answered: boolean;
        duration?: number;      // seconds
        timestamp?: string;     // ISO datetime
      }>;
    };

    if (!body.results) {
      this.logger.warn('WildJarApiService: unexpected response shape — missing results');
      return [];
    }

    const byDay = new Map<string, { total: number; answered: number; missed: number; durationSec: number }>();

    for (const call of body.results ?? []) {
      const day = call.timestamp?.slice(0, 10) ?? dateRange.to;
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      if (call.answered) agg.answered++;
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

  // ─── Private: token exchange ───────────────────────────────────────────────

  private async getAccessToken(username: string, password: string): Promise<string> {
    const creds = Buffer.from(`${username}:${password}`).toString('base64');

    const resp = await fetchWithRetry(`${this.BASE}/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (resp.status === 401 || resp.status === 400) {
      throw new BadRequestException('WildJar username or password is invalid.');
    }
    if (!resp.ok) {
      throw new BadRequestException(`WildJar token exchange failed (HTTP ${resp.status})`);
    }

    const body = await resp.json() as { access_token?: string };
    if (!body.access_token) {
      throw new BadRequestException('WildJar token response missing access_token.');
    }

    return body.access_token;
  }
}
