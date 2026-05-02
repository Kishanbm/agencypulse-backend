import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Ahrefs API service — SEO metrics (organic traffic, keywords, backlinks).
 *
 * API version: v3 (Data API)
 * Docs: https://developer.ahrefs.com/api/v3
 *
 * Auth: `Authorization: Bearer {api_key}` header.
 * Base URL: https://api.ahrefs.com/v3
 *
 * The target domain is stored as `externalAccountId` (e.g. "example.com").
 *
 * Approach:
 *   1. `GET /v3/site-explorer/metrics-history` — returns daily snapshots of org_traffic,
 *      org_keywords, paid_traffic, paid_keywords for the target domain over the date range.
 *   2. Each daily snapshot is emitted as individual MetricRowInput rows.
 *
 * Note: Ahrefs metrics are crawl-based snapshots (updated ~weekly), not daily counters.
 * We store each snapshot point as-is; the metrics service handles aggregation.
 */
@Injectable()
export class AhrefsApiService {
  private readonly logger = new Logger(AhrefsApiService.name);
  private readonly BASE = 'https://api.ahrefs.com/v3';

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey    Ahrefs API key
   * @param domain    Target domain (stored as externalAccountId), e.g. "example.com"
   * @param dateRange { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    domain: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!domain || domain === 'default') {
      throw new BadRequestException(
        'Ahrefs requires a target domain. Reconnect and supply the domain (e.g. example.com).',
      );
    }

    const params = new URLSearchParams({
      target: domain,
      date_from: dateRange.from,
      date_to: dateRange.to,
      mode: 'domain',
      select: 'org_traffic,org_keywords,paid_traffic,paid_keywords,refdomains,dofollow_refdomains',
    });

    const url = `${this.BASE}/site-explorer/metrics-history?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Ahrefs API key is invalid or lacks permission.');
    }
    if (resp.status === 402) {
      throw new BadRequestException('Ahrefs API subscription does not include this endpoint.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Ahrefs metrics-history failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`,
      );
    }

    const body = await resp.json() as {
      metrics: Array<{
        date: string;               // YYYY-MM-DD
        org_traffic?: number;       // estimated organic visits
        org_keywords?: number;      // keywords ranking
        paid_traffic?: number;
        paid_keywords?: number;
        refdomains?: number;        // referring domains
        dofollow_refdomains?: number;
      }>;
    };

    if (!body.metrics) {
      this.logger.warn('AhrefsApiService: unexpected response shape — missing metrics');
      return [];
    }

    const rows: MetricRowInput[] = [];

    for (const snap of body.metrics ?? []) {
      const recordedAt = snap.date;

      if (snap.org_traffic != null)           rows.push({ metricKey: 'org_traffic',   value: String(safeInt(snap.org_traffic)),           recordedAt });
      if (snap.org_keywords != null)          rows.push({ metricKey: 'org_keywords',  value: String(safeInt(snap.org_keywords)),          recordedAt });
      if (snap.paid_traffic != null && snap.paid_traffic > 0) rows.push({ metricKey: 'paid_traffic',  value: String(safeInt(snap.paid_traffic)),  recordedAt });
      if (snap.paid_keywords != null && snap.paid_keywords > 0) rows.push({ metricKey: 'paid_keywords', value: String(safeInt(snap.paid_keywords)), recordedAt });
      if (snap.refdomains != null)            rows.push({ metricKey: 'refdomains',    value: String(safeInt(snap.refdomains)),            recordedAt });
      if (snap.dofollow_refdomains != null)   rows.push({ metricKey: 'dofollow_refdomains', value: String(safeInt(snap.dofollow_refdomains)), recordedAt });
    }

    return rows;
  }
}
