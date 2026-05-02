import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * SEMrush API service — SEO domain rankings and traffic estimates.
 *
 * API: SEMrush Analytics API
 * Docs: https://developer.semrush.com/api/v3/analytics/basic-docs/
 *
 * Auth: `key={api_key}` query parameter (no header auth).
 * Base URL: https://api.semrush.com/
 *
 * Storage layout:
 *   accessToken       = API key (encrypted)
 *   externalAccountId = JSON {"domain":"example.com","database":"us"}
 *
 * Approach:
 *   GET /?type=domain_history — returns monthly snapshots for the requested months.
 *   We request the months that fall within the date range.
 *
 * Note: SEMrush returns pipe-delimited text, not JSON. We parse manually.
 * Note: "database" controls the regional index (us, uk, de, au, etc.).
 */
@Injectable()
export class SemrushApiService {
  private readonly logger = new Logger(SemrushApiService.name);
  private readonly BASE = 'https://api.semrush.com';

  /**
   * @param apiKey       SEMrush API key
   * @param accountJson  JSON {"domain":"example.com","database":"us"}
   * @param dateRange    { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let domain: string;
    let database: string;

    try {
      const parsed = JSON.parse(accountJson) as { domain?: string; database?: string };
      domain = parsed.domain ?? '';
      database = parsed.database ?? 'us';
    } catch {
      throw new BadRequestException(
        'SEMrush integration misconfigured. Reconnect and supply the target domain.',
      );
    }

    if (!domain) {
      throw new BadRequestException('SEMrush requires a target domain. Reconnect to reconfigure.');
    }

    // Build a list of YYYYMM15 dates covering the requested range
    const monthDates = this.getMonthDates(dateRange.from, dateRange.to);
    const rows: MetricRowInput[] = [];

    for (const monthDate of monthDates) {
      try {
        const monthRows = await this.fetchMonthSnapshot(apiKey, domain, database, monthDate);
        rows.push(...monthRows);
      } catch (err) {
        this.logger.warn(`SEMrush: failed snapshot for ${monthDate}: ${(err as Error).message}`);
      }
    }

    return rows;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async fetchMonthSnapshot(
    apiKey: string,
    domain: string,
    database: string,
    monthDate: string, // YYYYMM15
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      type: 'domain_history',
      key: apiKey,
      export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At,Ac,Do',
      domain,
      database,
      date: monthDate,
    });

    const resp = await fetchWithRetry(`${this.BASE}/?${params.toString()}`);

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('SEMrush API key is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`SEMrush domain_history failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const text = await resp.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return []; // header-only = no data

    // Parse the second line (data row); columns: Dn,Rk,Or,Ot,Oc,Ad,At,Ac,Do
    const [, dataLine] = lines;
    const parts = dataLine.split(';'); // SEMrush uses semicolons
    // Columns: 0=Dn(domain), 1=Rk(rank), 2=Or(org_kw), 3=Ot(org_traffic), 4=Oc(org_cost)
    //          5=Ad(paid_kw), 6=At(paid_traffic), 7=Ac(paid_cost), 8=Do(date)
    const recordedAt = `${monthDate.slice(0, 4)}-${monthDate.slice(4, 6)}-${monthDate.slice(6, 8)}`;

    const rows: MetricRowInput[] = [];
    const orgKeywords = safeInt(parts[2] ?? '0');
    const orgTraffic  = safeInt(parts[3] ?? '0');
    const paidKeywords = safeInt(parts[5] ?? '0');
    const paidTraffic  = safeInt(parts[6] ?? '0');

    if (!isNaN(orgKeywords) && orgKeywords > 0)   rows.push({ metricKey: 'org_keywords',  value: String(orgKeywords),  recordedAt });
    if (!isNaN(orgTraffic) && orgTraffic > 0)      rows.push({ metricKey: 'org_traffic',   value: String(orgTraffic),   recordedAt });
    if (!isNaN(paidKeywords) && paidKeywords > 0)  rows.push({ metricKey: 'paid_keywords', value: String(paidKeywords), recordedAt });
    if (!isNaN(paidTraffic) && paidTraffic > 0)    rows.push({ metricKey: 'paid_traffic',  value: String(paidTraffic),  recordedAt });

    return rows;
  }

  /** Returns YYYYMM15 strings for all months that overlap the date range */
  private getMonthDates(from: string, to: string): string[] {
    const dates: string[] = [];
    const start = new Date(`${from.slice(0, 7)}-01`);
    const end   = new Date(`${to.slice(0, 7)}-01`);

    while (start <= end) {
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, '0');
      dates.push(`${y}${m}15`);
      start.setMonth(start.getMonth() + 1);
    }

    return dates;
  }
}
