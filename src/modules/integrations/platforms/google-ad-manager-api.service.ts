import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Google Ad Manager (GAM) API service — network performance metrics.
 *
 * API: Google Ad Manager API v202405 (REST beta)
 * Docs: https://developers.google.com/ad-manager/api/rest
 *       https://developers.google.com/ad-manager/api/reference/rest/v202405/reports
 *
 * Auth: OAuth 2.0 Bearer token (scope: https://www.googleapis.com/auth/admanager).
 *   Via StandardTokenService — GOOGLE_AD_MANAGER in OAUTH_PLATFORM_CONFIGS.
 * Base URL: https://admanager.googleapis.com/v202405
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = GAM network code (e.g. "12345678")
 *
 * Approach:
 *   POST /networks/{networkCode}/reports:run → operation name
 *   GET  /{operationName} → poll until done → downloadUrl
 *   Download CSV → parse impressions, clicks, revenue.
 *
 * Note: GAM reports are async. We poll up to 10 times with 3s intervals.
 *   Revenue is in micro-currency (÷ 1_000_000 → USD).
 */
@Injectable()
export class GoogleAdManagerApiService {
  private readonly logger = new Logger(GoogleAdManagerApiService.name);
  private readonly BASE = 'https://admanager.googleapis.com/v202405';

  async fetchCoreMetrics(
    accessToken: string,
    networkCode: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Step 1: Submit report
    const reportBody = {
      reportQuery: {
        dimensions: ['DATE'],
        columns: ['AD_SERVER_IMPRESSIONS', 'AD_SERVER_CLICKS', 'AD_SERVER_CPM_AND_CPC_REVENUE', 'AD_SERVER_CTR'],
        dateRangeType: 'CUSTOM_DATE',
        startDate: { year: safeInt(dateRange.from.slice(0, 4)), month: safeInt(dateRange.from.slice(5, 7)), day: safeInt(dateRange.from.slice(8, 10)) },
        endDate:   { year: safeInt(dateRange.to.slice(0, 4)),   month: safeInt(dateRange.to.slice(5, 7)),   day: safeInt(dateRange.to.slice(8, 10)) },
      },
    };

    const submitResp = await fetchWithRetry(
      `${this.BASE}/networks/${networkCode}/reports:run`,
      { method: 'POST', headers, body: JSON.stringify(reportBody) },
    );

    if (submitResp.status === 401 || submitResp.status === 403) {
      throw new BadRequestException('Google Ad Manager OAuth token is invalid or expired.');
    }
    if (!submitResp.ok) {
      const txt = await submitResp.text().catch(() => '');
      throw new BadRequestException(`Google Ad Manager report submission failed (HTTP ${submitResp.status}): ${txt.slice(0, 200)}`);
    }

    const submitBody = await submitResp.json() as { name?: string };
    const opName = submitBody.name;
    if (!opName) throw new BadRequestException('Google Ad Manager: no operation name returned.');

    // Step 2: Poll for completion
    let downloadUrl: string | null = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3_000));
      const pollResp = await fetchWithRetry(
        `https://admanager.googleapis.com/${opName}`,
        { headers },
      );
      if (!pollResp.ok) continue;
      const pollBody = await pollResp.json() as { done?: boolean; response?: { reportDataUri?: string } };
      if (pollBody.done && pollBody.response?.reportDataUri) {
        downloadUrl = pollBody.response.reportDataUri;
        break;
      }
    }

    if (!downloadUrl) throw new BadRequestException('Google Ad Manager report timed out.');

    // Step 3: Download and parse CSV
    const csvResp = await fetchWithRetry(downloadUrl, { headers });
    if (!csvResp.ok) throw new BadRequestException('Google Ad Manager: failed to download report.');

    const csv = await csvResp.text();
    return this.parseCsv(csv, dateRange.to);
  }

  private parseCsv(csv: string, fallbackDate: string): MetricRowInput[] {
    const rows: MetricRowInput[] = [];
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return rows;

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').toLowerCase().trim());
    const dateCol  = headers.indexOf('date') >= 0 ? headers.indexOf('date') : 0;
    const impCol   = headers.findIndex(h => h.includes('impression'));
    const clkCol   = headers.findIndex(h => h.includes('click'));
    const revCol   = headers.findIndex(h => h.includes('revenue'));
    const ctrCol   = headers.findIndex(h => h.includes('ctr'));

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/"/g, '').trim());
      const recordedAt = parts[dateCol] ?? fallbackDate;
      const impressions = safeInt(parts[impCol] ?? '0');
      const clicks      = safeInt(parts[clkCol] ?? '0');
      const revMicro    = safeFloat(parts[revCol] ?? '0');
      const ctr         = safeFloat(parts[ctrCol] ?? '0');
      const revenue     = revMicro / 1_000_000;

      if (impressions > 0) rows.push({ metricKey: 'impressions', value: String(impressions),  recordedAt });
      if (clicks > 0)      rows.push({ metricKey: 'clicks',      value: String(clicks),        recordedAt });
      if (revenue > 0)     rows.push({ metricKey: 'revenue',     value: revenue.toFixed(2),    recordedAt });
      if (ctr > 0)         rows.push({ metricKey: 'ctr',         value: ctr.toFixed(4),        recordedAt });
    }
    return rows;
  }
}
