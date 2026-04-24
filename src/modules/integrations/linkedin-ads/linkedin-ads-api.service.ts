import { Injectable, BadRequestException } from '@nestjs/common';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

export interface LinkedinAdAccount {
  id: string;          // numeric ID (e.g. "123456789")
  name: string;
  status: string;      // 'ACTIVE' | 'CANCELLED' | 'DRAFT' | 'PENDING_DELETION' | 'REMOVED'
  type: string;        // 'BUSINESS' | 'ENTERPRISE'
}

export interface LinkedinMetricRow {
  date: string;                         // YYYY-MM-DD
  impressions: number;
  clicks: number;
  costInLocalCurrency: number;          // spend (in account's local currency)
  externalWebsiteConversions: number;
  videoViews: number;
}

@Injectable()
export class LinkedinAdsApiService {
  // ─── List accessible ad accounts ─────────────────────────────────────────
  // Returns all LinkedIn Sponsored Ad Accounts accessible to the user.
  // LinkedIn REST API v2 — adAccountsV2 endpoint.

  async listAdAccounts(accessToken: string): Promise<LinkedinAdAccount[]> {
    // LinkedIn uses BUSINESS type for most ad accounts
    const params = new URLSearchParams({
      q: 'search',
      'search.type.values[0]': 'BUSINESS',
      count: '100',
    });

    const response = await fetchWithTimeout(
      `${LINKEDIN_API_BASE}/adAccountsV2?${params.toString()}`,
      { headers: this.authHeaders(accessToken) },
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch LinkedIn Ad Accounts. Check connection status.');
    }

    const data = await response.json() as {
      elements?: Array<{ id: number; name: string; status: string; type: string }>;
    };

    return (data.elements ?? []).map((el) => ({
      id: String(el.id),
      name: el.name,
      status: el.status,
      type: el.type,
    }));
  }

  // ─── Fetch daily ad performance metrics ──────────────────────────────────
  // Uses LinkedIn Analytics API v2 (adAnalyticsV2).
  // accountId: numeric string stored as externalAccountId.
  // Date format: the API accepts YYYY-MM-DD converted to year/month/day params.
  //
  // LinkedIn date range uses dot-notation query params:
  //   dateRange.start.year=2024&dateRange.start.month=1&dateRange.start.day=1
  //
  // Account URN constructed as: urn:li:sponsoredAccount:{accountId}

  async fetchDailyMetrics(
    accessToken: string,
    accountId: string,
    from: string,
    to: string,
  ): Promise<LinkedinMetricRow[]> {
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);

    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;

    const params = new URLSearchParams({
      q: 'analytics',
      pivot: 'ACCOUNT',
      timeGranularity: 'DAILY',
      'dateRange.start.year': String(fromYear),
      'dateRange.start.month': String(fromMonth),
      'dateRange.start.day': String(fromDay),
      'dateRange.end.year': String(toYear),
      'dateRange.end.month': String(toMonth),
      'dateRange.end.day': String(toDay),
      'accounts[0]': accountUrn,
      fields: 'dateRange,impressions,clicks,costInLocalCurrency,externalWebsiteConversions,videoViews',
    });

    const response = await fetchWithTimeout(
      `${LINKEDIN_API_BASE}/adAnalyticsV2?${params.toString()}`,
      { headers: this.authHeaders(accessToken) },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'LinkedIn Ads Analytics request failed. Check the ad account ID and permissions.',
      );
    }

    const data = await response.json() as {
      elements?: Array<{
        dateRange?: { start?: { year: number; month: number; day: number } };
        impressions?: number;
        clicks?: number;
        costInLocalCurrency?: string;
        externalWebsiteConversions?: number;
        videoViews?: number;
      }>;
    };

    return (data.elements ?? []).map((el) => {
      const s = el.dateRange?.start;
      const date = s
        ? `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
        : '';

      return {
        date,
        impressions: el.impressions ?? 0,
        clicks: el.clicks ?? 0,
        costInLocalCurrency: parseFloat(el.costInLocalCurrency ?? '0'),
        externalWebsiteConversions: el.externalWebsiteConversions ?? 0,
        videoViews: el.videoViews ?? 0,
      };
    }).filter((r) => r.date !== '');
  }

  private authHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202401', // LinkedIn API versioning header
    };
  }
}
