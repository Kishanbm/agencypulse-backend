import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Moz API service — SEO authority metrics.
 *
 * API: Moz Links API v2
 * Docs: https://moz.com/help/links-api/making-calls
 *
 * Auth: HTTP Basic auth — `accessId:secretKey` (base64-encoded).
 * Both credentials plus the target domain are required. Storage layout:
 *   accessToken       = secretKey (encrypted)
 *   externalAccountId = JSON {"accessId":"mozscape-xxxxx","domain":"example.com"}
 *
 * Approach:
 *   POST /v2/url_metrics with target domain → returns current-state domain authority,
 *   page authority, spam score, and link counts.
 *
 * Note: Moz metrics are point-in-time snapshots. recordedAt = dateRange.to.
 */
@Injectable()
export class MozApiService {
  private readonly logger = new Logger(MozApiService.name);
  private readonly BASE = 'https://lsapi.seomoz.com/v2';

  private headers(accessId: string, secretKey: string): Record<string, string> {
    const creds = Buffer.from(`${accessId}:${secretKey}`).toString('base64');
    return {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * @param secretKey        Moz secret key (stored as accessToken)
   * @param accountIdJson    JSON string {"accessId":"mozscape-xxx","domain":"example.com"}
   * @param dateRange        { from, to } — used for recordedAt only (Moz is snapshot-based)
   */
  async fetchCoreMetrics(
    secretKey: string,
    accountIdJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let accessId: string;
    let domain: string;

    try {
      const parsed = JSON.parse(accountIdJson) as { accessId?: string; domain?: string };
      accessId = parsed.accessId ?? '';
      domain = parsed.domain ?? '';
    } catch {
      throw new BadRequestException(
        'Moz integration misconfigured. Reconnect and supply Access ID and target domain.',
      );
    }

    if (!accessId || !domain) {
      throw new BadRequestException(
        'Moz requires both an Access ID and a target domain. Reconnect to reconfigure.',
      );
    }

    const resp = await fetchWithRetry(`${this.BASE}/url_metrics`, {
      method: 'POST',
      headers: this.headers(accessId, secretKey),
      body: JSON.stringify({
        targets: [domain.replace(/^https?:\/\//, '').replace(/\/$/, '') + '/'],
        select: 'domain_authority,page_authority,spam_score,external_links_to_root_domain,root_domains_to_root_domain',
      }),
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Moz Access ID or Secret Key is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Moz url_metrics failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      results?: Array<{
        domain_authority?: number;
        page_authority?: number;
        spam_score?: number;
        external_links_to_root_domain?: number;
        root_domains_to_root_domain?: number;
      }>;
    };

    if (!body.results) {
      this.logger.warn('MozApiService: unexpected response shape — missing results');
      return [];
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];

    for (const r of body.results ?? []) {
      if (r.domain_authority != null)              rows.push({ metricKey: 'domain_authority',  value: String(safeInt(r.domain_authority)),              recordedAt });
      if (r.page_authority != null)                rows.push({ metricKey: 'page_authority',     value: String(safeInt(r.page_authority)),                recordedAt });
      if (r.spam_score != null)                    rows.push({ metricKey: 'spam_score',         value: String(safeInt(r.spam_score)),                    recordedAt });
      if (r.external_links_to_root_domain != null) rows.push({ metricKey: 'external_links',     value: String(safeInt(r.external_links_to_root_domain)), recordedAt });
      if (r.root_domains_to_root_domain != null)   rows.push({ metricKey: 'linking_root_domains', value: String(safeInt(r.root_domains_to_root_domain)), recordedAt });
    }

    return rows;
  }
}
