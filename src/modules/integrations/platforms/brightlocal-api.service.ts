import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * BrightLocal API service — local SEO rankings and reputation data.
 *
 * API: BrightLocal API v4
 * Docs: https://developer.brightlocal.com/
 *
 * Auth: `api-key={api_key}` query parameter.
 * Base URL: https://tools.brightlocal.com/seo-tools/api/v4
 *
 * Storage layout:
 *   accessToken       = API key (encrypted)
 *   externalAccountId = BrightLocal campaign ID (numeric string)
 *
 * Approach:
 *   GET /ranking/get-campaign-info — verifies access and gets campaign details.
 *   GET /ranking/get-overview-report — returns ranking snapshots (avg rank, top-3/10 counts).
 *
 * Note: BrightLocal ranking reports run on a schedule. We request the most recent snapshot
 * within the date range. recordedAt = the snapshot's report date.
 */
@Injectable()
export class BrightLocalApiService {
  private readonly logger = new Logger(BrightLocalApiService.name);
  private readonly BASE = 'https://tools.brightlocal.com/seo-tools/api/v4';

  /**
   * @param apiKey     BrightLocal API key
   * @param campaignId BrightLocal campaign ID (stored as externalAccountId)
   * @param dateRange  { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    campaignId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!campaignId || campaignId === 'default') {
      throw new BadRequestException(
        'BrightLocal requires a campaign ID. Reconnect and supply your BrightLocal campaign ID.',
      );
    }

    // Fetch all reports in range; the API returns results for the campaign
    const params = new URLSearchParams({
      'api-key': apiKey,
      'campaign-id': campaignId,
      date: dateRange.to, // snapshot closest to end of range
    });

    const url = `${this.BASE}/ranking/get-overview-report?${params.toString()}`;
    const resp = await fetchWithRetry(url);

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('BrightLocal API key is invalid or lacks access to this campaign.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`BrightLocal ranking report failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      response: {
        'average-rank'?: number;
        'keywords-in-top-3'?: number;
        'keywords-in-top-10'?: number;
        'keywords-in-top-20'?: number;
        'keywords-in-top-50'?: number;
        'date': string;
      } | null;
    };

    if (!body.response) return [];

    const r = body.response;
    const recordedAt = r['date'] ? r['date'].slice(0, 10) : dateRange.to;
    const rows: MetricRowInput[] = [];

    if (r['average-rank'] != null)       rows.push({ metricKey: 'avg_rank',        value: String(safeFloat(r['average-rank'])),       recordedAt });
    if (r['keywords-in-top-3'] != null)  rows.push({ metricKey: 'keywords_top3',   value: String(safeInt(r['keywords-in-top-3'])),    recordedAt });
    if (r['keywords-in-top-10'] != null) rows.push({ metricKey: 'keywords_top10',  value: String(safeInt(r['keywords-in-top-10'])),   recordedAt });
    if (r['keywords-in-top-20'] != null) rows.push({ metricKey: 'keywords_top20',  value: String(safeInt(r['keywords-in-top-20'])),   recordedAt });

    return rows;
  }
}
