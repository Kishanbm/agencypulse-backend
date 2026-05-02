import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Delacon API service — call tracking metrics (Australian/APAC platform).
 *
 * API: Delacon Request API (XML)
 * Docs: https://support.delaconcorp.com/hc/en-us/articles/360035651453
 *       https://support.delaconcorp.com/hc/en-us/articles/360039481533
 *
 * Auth: API key in `Auth` header, obtained from Delacon portal.
 * Base URL: https://pla.delaconcorp.com
 *
 * Storage layout:
 *   accessToken       = API key (encrypted)
 *   externalAccountId = 'default' (API key scopes to account automatically)
 *
 * Approach:
 *   GET /site/report/report.jsp?reportoption=xml&datefrom={from}&dateto={to}
 *   Returns XML with call records — parsed to aggregate by day.
 *
 * Note: Delacon returns XML, not JSON. We parse with basic regex-based extraction
 * since the Node.js built-in DOMParser is not available in server contexts.
 */
@Injectable()
export class DelaconApiService {
  private readonly logger = new Logger(DelaconApiService.name);
  private readonly BASE = 'https://pla.delaconcorp.com';

  private headers(apiKey: string): Record<string, string> {
    return {
      Auth: apiKey,
      Accept: 'application/xml, text/xml',
    };
  }

  /**
   * @param apiKey    Delacon API key
   * @param _accountId Not needed — token scopes to account. Pass 'default'.
   * @param dateRange  { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      reportoption: 'xml',
      datefrom: dateRange.from,
      dateto: dateRange.to,
    });

    const url = `${this.BASE}/site/report/report.jsp?${params.toString()}`;
    const resp = await fetchWithRetry(url, { headers: this.headers(apiKey) });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Delacon API key is invalid or expired.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Delacon report API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const xml = await resp.text();

    // Parse XML response — aggregate call records by date
    // Each <call> element has <date>, <answered>, <duration> fields
    const byDay = new Map<string, { total: number; answered: number; missed: number; durationSec: number }>();

    // Match all <call>...</call> blocks
    const callBlocks = xml.match(/<call>[\s\S]*?<\/call>/g) ?? [];

    for (const block of callBlocks) {
      const date     = this.extractTag(block, 'date')     ?? dateRange.to;
      const answered = this.extractTag(block, 'answered') ?? '0';
      const duration = safeInt(this.extractTag(block, 'duration') ?? '0');

      const day = date.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { total: 0, answered: 0, missed: 0, durationSec: 0 });
      const agg = byDay.get(day)!;
      agg.total++;
      const isAnswered = answered === '1' || answered.toLowerCase() === 'yes' || answered.toLowerCase() === 'true';
      if (isAnswered) agg.answered++;
      else agg.missed++;
      agg.durationSec += isNaN(duration) ? 0 : duration;
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
