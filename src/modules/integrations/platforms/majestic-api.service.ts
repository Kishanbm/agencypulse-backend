import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Majestic SEO API service — Trust Flow, Citation Flow, and backlink data.
 *
 * API: Majestic Developer API
 * Docs: https://developer.majestic.com/
 *
 * Auth: `app_api_key={api_key}` query parameter.
 * Base URL: https://api.majestic.com/api/json
 *
 * Storage layout:
 *   accessToken       = API key (encrypted)
 *   externalAccountId = target domain (e.g. "example.com")
 *
 * Approach:
 *   GET /api/json?app_api_key=...&cmd=GetIndexItemInfo&items=1&item0={domain}&datasource=fresh
 *   Returns: ExtBackLinks, RefDomains, CitationFlow, TrustFlow, RefIPs
 *
 * Note: Majestic metrics are snapshot-based (Fresh Index updated weekly). recordedAt = dateRange.to.
 */
@Injectable()
export class MajesticApiService {
  private readonly logger = new Logger(MajesticApiService.name);
  private readonly BASE = 'https://api.majestic.com/api/json';

  /**
   * @param apiKey   Majestic API key
   * @param domain   Target domain (stored as externalAccountId)
   * @param dateRange { from, to } — used for recordedAt only (Majestic is snapshot-based)
   */
  async fetchCoreMetrics(
    apiKey: string,
    domain: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!domain || domain === 'default') {
      throw new BadRequestException(
        'Majestic SEO requires a target domain. Reconnect and supply the domain (e.g. example.com).',
      );
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const params = new URLSearchParams({
      app_api_key: apiKey,
      cmd: 'GetIndexItemInfo',
      items: '1',
      item0: cleanDomain,
      datasource: 'fresh',
    });

    const resp = await fetchWithRetry(`${this.BASE}?${params.toString()}`);

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Majestic API key is invalid or lacks access.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Majestic GetIndexItemInfo failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      Code: string;
      ErrorMessage?: string;
      DataTables?: {
        Results?: {
          Data?: Array<{
            ExtBackLinks?: number;
            RefDomains?: number;
            CitationFlow?: number;
            TrustFlow?: number;
            RefIPs?: number;
          }>;
        };
      };
    };

    if (body.Code !== 'OK') {
      throw new BadRequestException(`Majestic API error: ${body.ErrorMessage ?? body.Code}`);
    }

    const item = body.DataTables?.Results?.Data?.[0];
    if (!item) return [];

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    if (item.ExtBackLinks != null)  rows.push({ metricKey: 'backlinks',       value: String(safeInt(item.ExtBackLinks)),  recordedAt });
    if (item.RefDomains != null)    rows.push({ metricKey: 'ref_domains',      value: String(safeInt(item.RefDomains)),    recordedAt });
    if (item.CitationFlow != null)  rows.push({ metricKey: 'citation_flow',    value: String(safeInt(item.CitationFlow)),  recordedAt });
    if (item.TrustFlow != null)     rows.push({ metricKey: 'trust_flow',       value: String(safeInt(item.TrustFlow)),     recordedAt });
    if (item.RefIPs != null)        rows.push({ metricKey: 'ref_ips',          value: String(safeInt(item.RefIPs)),        recordedAt });

    return rows;
  }
}
