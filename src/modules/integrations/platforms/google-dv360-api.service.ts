import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Google DV360 (Display & Video 360) Bid Manager API service.
 *
 * API: Google Bid Manager API v2 (for DV360 reporting)
 * Docs: https://developers.google.com/bid-manager/reference/rest/v2/queries
 *
 * Auth: OAuth 2.0 Bearer token (scope: https://www.googleapis.com/auth/doubleclickbidmanager).
 *   Via StandardTokenService — GOOGLE_DV360 in OAUTH_PLATFORM_CONFIGS.
 * Base URL: https://doubleclickbidmanager.googleapis.com/v2
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = advertiser_id (numeric, from DV360 partner/advertiser)
 *
 * Approach:
 *   1. POST /queries → create a query → queryId
 *   2. POST /queries/{queryId}:run → trigger report run → reportId
 *   3. GET  /queries/{queryId}/reports/{reportId} → poll until state=DONE → reportDataUri
 *   4. Download CSV → parse.
 *
 * Note: DV360 metrics use the Bid Manager API, not the DV360 API (which manages structure only).
 */
@Injectable()
export class GoogleDv360ApiService {
  private readonly logger = new Logger(GoogleDv360ApiService.name);
  private readonly BASE = 'https://doubleclickbidmanager.googleapis.com/v2';

  async fetchCoreMetrics(
    accessToken: string,
    advertiserId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Step 1: Create query
    const queryBody = {
      metadata: {
        title: `AgencyPulse_DV360_${dateRange.from}_${dateRange.to}`,
        dataRange: {
          range: 'CUSTOM_DATES',
          customStartDate: { year: safeInt(dateRange.from.slice(0, 4)), month: safeInt(dateRange.from.slice(5, 7)), day: safeInt(dateRange.from.slice(8, 10)) },
          customEndDate:   { year: safeInt(dateRange.to.slice(0, 4)),   month: safeInt(dateRange.to.slice(5, 7)),   day: safeInt(dateRange.to.slice(8, 10)) },
        },
        format: 'CSV',
      },
      params: {
        type: 'STANDARD',
        groupBys: ['FILTER_DATE'],
        filters: [{ type: 'FILTER_ADVERTISER', value: advertiserId }],
        metrics: ['METRIC_IMPRESSIONS', 'METRIC_CLICKS', 'METRIC_REVENUE_USD', 'METRIC_CTR', 'METRIC_CPM_USD'],
      },
      schedule: { frequency: 'ONE_TIME' },
    };

    const createResp = await fetchWithRetry(
      `${this.BASE}/queries`,
      { method: 'POST', headers, body: JSON.stringify(queryBody) },
    );

    if (createResp.status === 401 || createResp.status === 403) {
      throw new BadRequestException('Google DV360 OAuth token is invalid or expired.');
    }
    if (!createResp.ok) {
      const txt = await createResp.text().catch(() => '');
      throw new BadRequestException(`Google DV360 query creation failed (HTTP ${createResp.status}): ${txt.slice(0, 200)}`);
    }

    const createBody = await createResp.json() as { queryId?: string };
    const queryId = createBody.queryId;
    if (!queryId) throw new BadRequestException('Google DV360: no queryId returned.');

    // Step 2: Run the query
    const runResp = await fetchWithRetry(
      `${this.BASE}/queries/${queryId}:run`,
      { method: 'POST', headers, body: '{}' },
    );
    if (!runResp.ok) throw new BadRequestException(`Google DV360: failed to run query (HTTP ${runResp.status})`);

    const runBody = await runResp.json() as { key?: { reportId?: string } };
    const reportId = runBody.key?.reportId;
    if (!reportId) throw new BadRequestException('Google DV360: no reportId returned from run.');

    // Step 3: Poll for completion
    let downloadUrl: string | null = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3_000));
      const pollResp = await fetchWithRetry(`${this.BASE}/queries/${queryId}/reports/${reportId}`, { headers });
      if (!pollResp.ok) continue;
      const pollBody = await pollResp.json() as {
        metadata?: { status?: { state?: string }; reportDataUri?: string };
      };
      if (pollBody.metadata?.status?.state === 'DONE' && pollBody.metadata.reportDataUri) {
        downloadUrl = pollBody.metadata.reportDataUri;
        break;
      }
    }

    if (!downloadUrl) throw new BadRequestException('Google DV360 report timed out.');

    const csvResp = await fetchWithRetry(downloadUrl, { headers });
    if (!csvResp.ok) throw new BadRequestException('Google DV360: failed to download report CSV.');

    return this.parseCsv(await csvResp.text(), dateRange.to);
  }

  private parseCsv(csv: string, fallbackDate: string): MetricRowInput[] {
    const rows: MetricRowInput[] = [];
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return rows;

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').toLowerCase().trim());
    const dateCol  = headers.findIndex(h => h.includes('date'));
    const impCol   = headers.findIndex(h => h.includes('impression'));
    const clkCol   = headers.findIndex(h => h.includes('click'));
    const revCol   = headers.findIndex(h => h.includes('revenue'));
    const ctrCol   = headers.findIndex(h => h.includes('ctr'));
    const cpmCol   = headers.findIndex(h => h.includes('cpm'));

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/"/g, '').trim());
      const recordedAt  = (dateCol >= 0 ? parts[dateCol] : null) ?? fallbackDate;
      const impressions = safeInt(parts[impCol] ?? '0');
      const clicks      = safeInt(parts[clkCol] ?? '0');
      const revenue     = safeFloat(parts[revCol] ?? '0');
      const ctr         = safeFloat(parts[ctrCol] ?? '0');
      const cpm         = safeFloat(parts[cpmCol] ?? '0');

      if (impressions > 0) rows.push({ metricKey: 'impressions', value: String(impressions), recordedAt });
      if (clicks > 0)      rows.push({ metricKey: 'clicks',      value: String(clicks),       recordedAt });
      if (revenue > 0)     rows.push({ metricKey: 'spend',        value: revenue.toFixed(2),   recordedAt });
      if (ctr > 0)         rows.push({ metricKey: 'ctr',          value: ctr.toFixed(4),        recordedAt });
      if (cpm > 0)         rows.push({ metricKey: 'cpm',          value: cpm.toFixed(2),        recordedAt });
    }
    return rows;
  }
}
