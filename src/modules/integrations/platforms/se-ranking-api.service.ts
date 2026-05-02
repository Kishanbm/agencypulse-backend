import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * SE Ranking API service — keyword position tracking and visibility.
 *
 * API: SE Ranking Project API
 * Docs: https://seranking.com/api/project/
 *
 * Auth: `Authorization: Token {api_key}` header.
 * Base URL: https://api4.seranking.com  (Project API — separate key from Data API)
 *
 * Storage layout:
 *   accessToken       = API key (encrypted)
 *   externalAccountId = site ID (numeric string from SE Ranking dashboard)
 *
 * Two-step approach:
 *   1. GET /sites/{siteId}/ — returns current summary: visibility, top5/10/30, avg_rank.
 *      Snapshot-based, stored with recordedAt = dateRange.to.
 *   2. GET /sites/{siteId}/positions?date_from=...&date_to=... — returns per-keyword
 *      position data. We aggregate to count keywords in top-10/top-30 per day.
 *
 * Note: SE Ranking site IDs are obtained from the user's site list in the dashboard.
 */
@Injectable()
export class SeRankingApiService {
  private readonly logger = new Logger(SeRankingApiService.name);
  private readonly BASE = 'https://api4.seranking.com';

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Token ${apiKey}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey   SE Ranking API key (Project API key)
   * @param siteId   SE Ranking site ID (stored as externalAccountId)
   * @param dateRange { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    siteId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!siteId || siteId === 'default') {
      throw new BadRequestException(
        'SE Ranking requires a site ID. Reconnect and supply your SE Ranking site ID.',
      );
    }

    const rows: MetricRowInput[] = [];

    // Step 1: Site summary snapshot (visibility, top5/10/30, avg rank)
    try {
      const summaryRows = await this.fetchSiteSummary(apiKey, siteId, dateRange.to);
      rows.push(...summaryRows);
    } catch (err) {
      this.logger.warn(`SE Ranking: site summary failed for ${siteId}: ${(err as Error).message}`);
    }

    // Step 2: Positions over the date range — aggregate keyword counts per day
    try {
      const positionRows = await this.fetchPositions(apiKey, siteId, dateRange);
      rows.push(...positionRows);
    } catch (err) {
      this.logger.warn(`SE Ranking: positions fetch failed for ${siteId}: ${(err as Error).message}`);
    }

    return rows;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async fetchSiteSummary(apiKey: string, siteId: string, recordedAt: string): Promise<MetricRowInput[]> {
    const resp = await fetchWithRetry(
      `${this.BASE}/sites/${siteId}/`,
      { headers: this.headers(apiKey) },
    );

    if (resp.status === 401 || resp.status === 403) throw new BadRequestException('SE Ranking API key invalid.');
    if (resp.status === 404) throw new BadRequestException(`SE Ranking site ID "${siteId}" not found.`);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`SE Ranking site summary failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      visibility?: number;
      visibility_percent?: number;
      today_avg?: number;
      top5?: number;
      top10?: number;
      top30?: number;
    };

    const rows: MetricRowInput[] = [];
    if (body.visibility != null)         rows.push({ metricKey: 'visibility',        value: String(safeInt(body.visibility)),         recordedAt });
    if (body.today_avg != null)          rows.push({ metricKey: 'avg_rank',          value: safeFloat(body.today_avg).toFixed(2),          recordedAt });
    if (body.top5 != null)               rows.push({ metricKey: 'keywords_top5',     value: String(safeInt(body.top5)),               recordedAt });
    if (body.top10 != null)              rows.push({ metricKey: 'keywords_top10',     value: String(safeInt(body.top10)),              recordedAt });
    if (body.top30 != null)              rows.push({ metricKey: 'keywords_top30',     value: String(safeInt(body.top30)),              recordedAt });
    return rows;
  }

  private async fetchPositions(
    apiKey: string,
    siteId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      date_from: dateRange.from,
      date_to: dateRange.to,
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/sites/${siteId}/positions?${params.toString()}`,
      { headers: this.headers(apiKey) },
    );

    if (!resp.ok) return []; // positions are supplementary; summary is the primary data

    const body = await resp.json() as Array<{
      date: string;
      keywords?: Array<{ pos?: number | null }>;
    }>;

    if (!Array.isArray(body)) return [];

    const rows: MetricRowInput[] = [];
    for (const day of body) {
      const recordedAt = day.date;
      const kws = day.keywords ?? [];
      const inTop10  = kws.filter((k) => k.pos != null && k.pos <= 10).length;
      const inTop30  = kws.filter((k) => k.pos != null && k.pos <= 30).length;
      if (inTop10 > 0)  rows.push({ metricKey: 'keywords_top10',  value: String(inTop10),  recordedAt });
      if (inTop30 > 0)  rows.push({ metricKey: 'keywords_top30',  value: String(inTop30),  recordedAt });
    }
    return rows;
  }
}
