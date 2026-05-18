import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';

/**
 * Google PageSpeed Insights API service — Core Web Vitals and Lighthouse scores.
 *
 * API: PageSpeed Insights API v5
 * Docs: https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed
 *
 * Auth: `key={api_key}` query parameter (Google Cloud API key with PageSpeed API enabled).
 * Base URL: https://www.googleapis.com/pagespeedonline/v5
 *
 * Storage layout:
 *   accessToken       = Google API key (encrypted)
 *   externalAccountId = target URL to audit (e.g. "https://example.com")
 *
 * Approach:
 *   Two calls: strategy=mobile and strategy=desktop.
 *   Returns: performance score, LCP, CLS, FCP, TBT, speed index (mobile + desktop variants).
 *
 * Note: PageSpeed is always current-state. recordedAt = dateRange.to.
 */
@Injectable()
export class GooglePagespeedApiService {
  private readonly logger = new Logger(GooglePagespeedApiService.name);
  private readonly BASE = 'https://www.googleapis.com/pagespeedonline/v5';

  /**
   * @param apiKey     Google API key
   * @param targetUrl  Target URL to audit (stored as externalAccountId)
   * @param dateRange  { from, to } — used for recordedAt only
   */
  async fetchCoreMetrics(
    apiKey: string,
    targetUrl: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    if (!targetUrl || targetUrl === 'default') {
      throw new BadRequestException(
        'Google PageSpeed requires a target URL. Reconnect and supply the URL to audit.',
      );
    }

    // externalAccountId may be stored as JSON {"apiUrl":"..."} by the connect flow
    try {
      const parsed = JSON.parse(targetUrl) as { apiUrl?: string };
      if (parsed.apiUrl) targetUrl = parsed.apiUrl;
    } catch { /* not JSON — use as-is */ }

    const rows: MetricRowInput[] = [];
    const recordedAt = dateRange.to;

    for (const strategy of ['mobile', 'desktop'] as const) {
      try {
        const strategyRows = await this.runAudit(apiKey, targetUrl, strategy, recordedAt);
        rows.push(...strategyRows);
      } catch (err) {
        this.logger.warn(`PageSpeed ${strategy} audit failed for ${targetUrl}: ${(err as Error).message}`);
      }
    }

    return rows;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async runAudit(
    apiKey: string,
    targetUrl: string,
    strategy: 'mobile' | 'desktop',
    recordedAt: string,
  ): Promise<MetricRowInput[]> {
    const params = new URLSearchParams({
      url: targetUrl,
      key: apiKey,
      strategy,
      category: 'performance',
    });

    const resp = await fetchWithRetry(
      `${this.BASE}/runPagespeed?${params.toString()}`,
      { method: 'GET' },
    );

    if (resp.status === 400) {
      throw new BadRequestException(`PageSpeed: invalid URL "${targetUrl}".`);
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Google API key is invalid or PageSpeed API not enabled.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`PageSpeed audit failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      lighthouseResult?: {
        categories?: {
          performance?: { score?: number };
          accessibility?: { score?: number };
          seo?: { score?: number };
          'best-practices'?: { score?: number };
        };
        audits?: {
          'largest-contentful-paint'?: { numericValue?: number };
          'cumulative-layout-shift'?: { numericValue?: number };
          'first-contentful-paint'?: { numericValue?: number };
          'total-blocking-time'?: { numericValue?: number };
          'speed-index'?: { numericValue?: number };
        };
      };
    };

    const lh = body.lighthouseResult;
    if (!lh) return [];

    const suffix = strategy === 'mobile' ? '_mobile' : '_desktop';
    const rows: MetricRowInput[] = [];

    const perf = lh.categories?.performance?.score;
    if (perf != null) rows.push({ metricKey: `performance_score${suffix}`, value: String(Math.round(perf * 100)), recordedAt });

    const seoScore = lh.categories?.seo?.score;
    if (seoScore != null) rows.push({ metricKey: `seo_score${suffix}`, value: String(Math.round(seoScore * 100)), recordedAt });

    const lcp = lh.audits?.['largest-contentful-paint']?.numericValue;
    if (lcp != null) rows.push({ metricKey: `lcp_ms${suffix}`, value: String(Math.round(lcp)), recordedAt });

    const cls = lh.audits?.['cumulative-layout-shift']?.numericValue;
    if (cls != null) rows.push({ metricKey: `cls${suffix}`, value: String(cls), recordedAt });

    const fcp = lh.audits?.['first-contentful-paint']?.numericValue;
    if (fcp != null) rows.push({ metricKey: `fcp_ms${suffix}`, value: String(Math.round(fcp)), recordedAt });

    const tbt = lh.audits?.['total-blocking-time']?.numericValue;
    if (tbt != null) rows.push({ metricKey: `tbt_ms${suffix}`, value: String(Math.round(tbt)), recordedAt });

    return rows;
  }
}
