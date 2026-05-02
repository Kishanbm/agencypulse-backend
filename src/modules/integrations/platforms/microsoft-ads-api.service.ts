import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Microsoft Ads (Bing Ads) API service — campaign performance metrics.
 *
 * API: Microsoft Advertising Reporting Service v13
 * Docs: https://learn.microsoft.com/en-us/advertising/reporting-service/reportrequest
 *
 * Auth: OAuth 2.0 Bearer token (Azure AD, via StandardTokenService — MICROSOFT_ADS in OAUTH_PLATFORM_CONFIGS).
 * Base URL: https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = JSON {"customerId":"123","accountId":"456","developerToken":"xxx"}
 *
 * Approach:
 *   Microsoft Ads uses an async report submission model:
 *   1. POST /ReportingService.svc/Json/SubmitGenerateReport → pollUrl
 *   2. Poll until status = "Success" → downloadUrl
 *   3. Download ZIP containing CSV → parse metrics
 *
 *   We use the CampaignPerformanceReport with daily aggregation.
 *   Required headers: AuthenticationToken, DeveloperToken, CustomerId, AccountId.
 *
 * Note: The report download is a ZIP file containing a tab-separated CSV.
 *   We fetch and parse it inline. Report generation typically takes 1-30s.
 */
@Injectable()
export class MicrosoftAdsApiService {
  private readonly logger = new Logger(MicrosoftAdsApiService.name);
  private readonly BASE = 'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13';

  async fetchCoreMetrics(
    accessToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let customerId: string;
    let accountId: string;
    let developerToken: string;

    try {
      const parsed = JSON.parse(accountJson) as {
        customerId?: string;
        accountId?: string;
        developerToken?: string;
      };
      customerId      = parsed.customerId      ?? '';
      accountId       = parsed.accountId       ?? '';
      developerToken  = parsed.developerToken  ?? '';
    } catch {
      throw new BadRequestException('Microsoft Ads integration misconfigured. Reconnect.');
    }

    if (!customerId || !accountId || !developerToken) {
      throw new BadRequestException('Microsoft Ads requires customerId, accountId, and developerToken. Reconnect.');
    }

    const headers = {
      AuthenticationToken: accessToken,
      DeveloperToken:      developerToken,
      CustomerId:          customerId,
      AccountId:           accountId,
      'Content-Type':      'application/json',
      Accept:              'application/json',
    };

    // Step 1: Submit report request
    const [fromYear, fromMonth, fromDay] = dateRange.from.split('-');
    const [toYear,   toMonth,   toDay  ] = dateRange.to.split('-');

    const reportRequest = {
      ReportRequest: {
        Format: 'Csv',
        ReportName: 'AgencyPulse_Campaign_Performance',
        ReturnOnlyCompleteData: false,
        Aggregation: 'Daily',
        Columns: ['TimePeriod', 'Impressions', 'Clicks', 'Spend', 'Ctr', 'AverageCpc', 'Conversions'],
        Scope: { AccountIds: [safeInt(accountId)] },
        Time: {
          CustomDateRangeStart: { Day: safeInt(fromDay), Month: safeInt(fromMonth), Year: safeInt(fromYear) },
          CustomDateRangeEnd:   { Day: safeInt(toDay),   Month: safeInt(toMonth),   Year: safeInt(toYear) },
        },
        Type: 'CampaignPerformanceReport',
      },
    };

    const submitResp = await fetchWithRetry(
      `${this.BASE}/ReportingService.svc/Json/SubmitGenerateReport`,
      { method: 'POST', headers, body: JSON.stringify(reportRequest) },
    );

    if (submitResp.status === 401 || submitResp.status === 403) {
      throw new BadRequestException('Microsoft Ads OAuth token is invalid or expired.');
    }
    if (!submitResp.ok) {
      const txt = await submitResp.text().catch(() => '');
      throw new BadRequestException(`Microsoft Ads report submission failed (HTTP ${submitResp.status}): ${txt.slice(0, 200)}`);
    }

    const submitBody = await submitResp.json() as { ReportRequestId?: string };
    const reportId = submitBody.ReportRequestId;
    if (!reportId) throw new BadRequestException('Microsoft Ads: no report ID returned from submission.');

    // Step 2: Poll for completion (max 10 attempts, 3s apart)
    let downloadUrl: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(r => setTimeout(r, 3_000));

      const pollResp = await fetchWithRetry(
        `${this.BASE}/ReportingService.svc/Json/PollGenerateReport`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ ReportRequestId: reportId }),
        },
      );
      if (!pollResp.ok) continue;

      const pollBody = await pollResp.json() as {
        ReportRequestStatus?: { Status?: string; ReportDownloadUrl?: string };
      };

      const status = pollBody.ReportRequestStatus?.Status;
      if (status === 'Success') {
        downloadUrl = pollBody.ReportRequestStatus?.ReportDownloadUrl ?? null;
        break;
      }
      if (status === 'Error' || status === 'Expired') {
        throw new BadRequestException(`Microsoft Ads report generation failed: status=${status}`);
      }
    }

    if (!downloadUrl) {
      throw new BadRequestException('Microsoft Ads report timed out after 30s polling.');
    }

    // Step 3: Download and parse the CSV (tab-separated, no auth header needed for download URL)
    const csvResp = await fetchWithRetry(downloadUrl);
    if (!csvResp.ok) throw new BadRequestException('Microsoft Ads: failed to download report CSV.');

    const csvText = await csvResp.text();
    return this.parseCsv(csvText);
  }

  private parseCsv(csv: string): MetricRowInput[] {
    const rows: MetricRowInput[] = [];
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

    // Find header row (contains 'TimePeriod' or 'Gregorian date')
    let headerIdx = lines.findIndex(l => l.includes('TimePeriod') || l.includes('Gregorian date'));
    if (headerIdx < 0) return rows;

    const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const colOf = (name: string) => headers.indexOf(name);

    const dateCol   = colOf('timeperiod') >= 0 ? colOf('timeperiod') : colOf('gregorian date');
    const impCol    = colOf('impressions');
    const clickCol  = colOf('clicks');
    const spendCol  = colOf('spend');
    const ctrCol    = colOf('ctr');
    const cpcCol    = colOf('averagecpc');
    const convCol   = colOf('conversions');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/"/g, '').trim());
      if (parts.length < 3) continue;

      // Date is formatted as M/D/YYYY or YYYY-MM-DD depending on locale
      const rawDate   = parts[dateCol] ?? '';
      const recordedAt = this.normalizeDate(rawDate);
      if (!recordedAt) continue;

      const impressions  = safeInt(parts[impCol]  ?? '0');
      const clicks       = safeInt(parts[clickCol] ?? '0');
      const spend        = safeFloat(parts[spendCol] ?? '0');
      const ctr          = safeFloat(parts[ctrCol]   ?? '0');
      const cpc          = safeFloat(parts[cpcCol]   ?? '0');
      const conversions  = safeFloat(parts[convCol]  ?? '0');

      if (impressions > 0) rows.push({ metricKey: 'impressions',  value: String(impressions),             recordedAt });
      if (clicks > 0)      rows.push({ metricKey: 'clicks',       value: String(clicks),                  recordedAt });
      if (spend > 0)       rows.push({ metricKey: 'spend',        value: spend.toFixed(2),                recordedAt });
      if (ctr > 0)         rows.push({ metricKey: 'ctr',          value: ctr.toFixed(4),                  recordedAt });
      if (cpc > 0)         rows.push({ metricKey: 'avg_cpc',      value: cpc.toFixed(2),                  recordedAt });
      if (conversions > 0) rows.push({ metricKey: 'conversions',  value: conversions.toFixed(2),          recordedAt });
    }
    return rows;
  }

  private normalizeDate(raw: string): string | null {
    // Handles "M/D/YYYY" → "YYYY-MM-DD" and pass-through for "YYYY-MM-DD"
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
  }
}
