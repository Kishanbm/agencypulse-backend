import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

const gunzipAsync = promisify(gunzip);
const AMAZON_ADS_API_BASE = 'https://advertising-api.amazon.com';
const REPORT_POLL_INTERVAL_MS = 5_000;   // poll every 5 seconds
const REPORT_MAX_WAIT_MS = 90_000;        // give up after 90 seconds

export interface AmazonProfile {
  profileId: string;
  countryCode: string;
  timezone: string;
  accountName: string;
  accountType: string;   // 'seller' | 'vendor' | 'agency'
}

export interface AmazonMetricRow {
  date: string;         // YYYY-MM-DD
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;        // attributed sales (14-day)
  orders: number;
}

@Injectable()
export class AmazonAdsApiService {
  constructor(private readonly config: ConfigService) {}

  // ─── List advertising profiles ────────────────────────────────────────────
  // Returns all Amazon Advertising profiles accessible with the access token.
  // Required headers: Authorization, Amazon-Advertising-API-ClientId.
  // No Amazon-Advertising-API-Scope for this endpoint.

  async listProfiles(accessToken: string): Promise<AmazonProfile[]> {
    const response = await fetchWithTimeout(`${AMAZON_ADS_API_BASE}/v2/profiles`, {
      headers: this.baseHeaders(accessToken),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch Amazon Ads profiles. Check connection status.');
    }

    const data = await response.json() as Array<{
      profileId: number;
      countryCode: string;
      timezone: string;
      accountInfo: { id: string; name: string; type: string };
    }>;

    return (data ?? []).map((p) => ({
      profileId: String(p.profileId),
      countryCode: p.countryCode,
      timezone: p.timezone,
      accountName: p.accountInfo?.name ?? '',
      accountType: p.accountInfo?.type ?? '',
    }));
  }

  // ─── Fetch daily metrics (async report with polling) ─────────────────────
  // Amazon Advertising API v3 async report flow:
  //   1. POST /reporting/reports → { reportId, status: "PENDING" }
  //   2. Poll GET /reporting/reports/{reportId} until status="COMPLETED"
  //   3. Download from pre-signed URL → gzip-compressed JSON
  //
  // profileId stored as externalAccountId. Passed as Amazon-Advertising-API-Scope header.

  async fetchDailyMetrics(
    accessToken: string,
    profileId: string,
    from: string,
    to: string,
  ): Promise<AmazonMetricRow[]> {
    const reportId = await this.createReport(accessToken, profileId, from, to);
    const downloadUrl = await this.pollReportUntilReady(accessToken, profileId, reportId);
    return this.downloadAndParseReport(downloadUrl);
  }

  // ─── Private: create report ───────────────────────────────────────────────

  private async createReport(
    accessToken: string,
    profileId: string,
    from: string,
    to: string,
  ): Promise<string> {
    const body = {
      name: `AgencyPulse SP Report ${from} to ${to}`,
      startDate: from,
      endDate: to,
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        groupBy: ['campaign'],
        columns: ['impressions', 'clicks', 'spend', 'sales7d', 'orders7d'],
        reportTypeId: 'spCampaigns',
        timeUnit: 'DAILY',
        format: 'GZIP_JSON',
      },
    };

    const response = await fetchWithTimeout(`${AMAZON_ADS_API_BASE}/reporting/reports`, {
      method: 'POST',
      headers: {
        ...this.baseHeaders(accessToken),
        ...this.scopeHeader(profileId),
        'Content-Type': 'application/vnd.createasyncreportrequest.v3+json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to create Amazon Ads report. Check profile ID and permissions.');
    }

    const data = await response.json() as { reportId: string };
    return data.reportId;
  }

  // ─── Private: poll until report is ready ─────────────────────────────────

  private async pollReportUntilReady(
    accessToken: string,
    profileId: string,
    reportId: string,
  ): Promise<string> {
    const deadline = Date.now() + REPORT_MAX_WAIT_MS;

    while (Date.now() < deadline) {
      await this.sleep(REPORT_POLL_INTERVAL_MS);

      const response = await fetchWithTimeout(`${AMAZON_ADS_API_BASE}/reporting/reports/${reportId}`, {
        headers: {
          ...this.baseHeaders(accessToken),
          ...this.scopeHeader(profileId),
        },
      });

      if (!response.ok) {
        throw new BadRequestException('Failed to poll Amazon Ads report status.');
      }

      const data = await response.json() as {
        reportId: string;
        status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
        url?: string;
        failureReason?: string;
      };

      if (data.status === 'COMPLETED' && data.url) {
        return data.url;
      }

      if (data.status === 'FAILED') {
        throw new BadRequestException(
          `Amazon Ads report generation failed: ${data.failureReason ?? 'unknown reason'}`,
        );
      }

      // Still PENDING or PROCESSING — continue polling
    }

    throw new BadRequestException(
      `Amazon Ads report timed out after ${REPORT_MAX_WAIT_MS / 1000}s. Will retry.`,
    );
  }

  // ─── Private: download and parse gzip JSON report ─────────────────────────

  private async downloadAndParseReport(downloadUrl: string): Promise<AmazonMetricRow[]> {
    const response = await fetchWithTimeout(downloadUrl, {}, 60_000);

    if (!response.ok) {
      throw new BadRequestException('Failed to download Amazon Ads report.');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const decompressed = await gunzipAsync(buffer);
    const rows = JSON.parse(decompressed.toString()) as Array<{
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales7d?: number;
      orders7d?: number;
    }>;

    return (rows ?? []).map((row) => ({
      date: row.date,                        // YYYY-MM-DD
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      spend: row.spend ?? 0,
      sales: row.sales7d ?? 0,
      orders: row.orders7d ?? 0,
    }));
  }

  // ─── Headers ───────────────────────────────────────────────────────────────

  private baseHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Amazon-Advertising-API-ClientId': this.config.get<string>('amazon.clientId')!,
    };
  }

  private scopeHeader(profileId: string): Record<string, string> {
    return { 'Amazon-Advertising-API-Scope': profileId };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
