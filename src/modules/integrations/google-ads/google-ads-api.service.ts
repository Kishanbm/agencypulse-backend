import { Injectable, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v18';

export interface GoogleAdsCustomer {
  customerId: string;   // Normalized — no dashes (e.g. "1234567890")
  descriptiveName: string;
  resourceName: string; // e.g. "customers/1234567890"
}

export interface GoogleAdsDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface GoogleAdsRow {
  [field: string]: string | number | null;
}

export interface GoogleAdsReportResult {
  rows: GoogleAdsRow[];
}

@Injectable()
export class GoogleAdsApiService {
  constructor(private readonly config: ConfigService) {}

  // ─── List accessible customers ────────────────────────────────────────────
  // Returns all Google Ads customer accounts the connected user can access.
  // Agencies typically have a Manager account (MCC) with multiple sub-clients.
  //
  // Fix (AI review): GOOGLE_ADS_DEVELOPER_TOKEN validated at runtime — never
  // at startup so unconfigured environments can still boot.
  // Fix (AI review): developer token never logged.

  async listAccessibleCustomers(accessToken: string): Promise<GoogleAdsCustomer[]> {
    const devToken = this.requireDeveloperToken();

    const response = await fetchWithTimeout(
      `${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`,
      { headers: this.buildHeaders(accessToken, devToken) },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to list Google Ads customers. Check connection status.',
      );
    }

    const data = await response.json() as {
      resourceNames?: string[]; // e.g. ["customers/1234567890", ...]
    };

    if (!data.resourceNames?.length) return [];

    // Fetch descriptive names for each customer in parallel
    const customers = await Promise.all(
      data.resourceNames.map((resourceName) =>
        this.fetchCustomerDetails(accessToken, devToken, resourceName),
      ),
    );

    return customers.filter((c): c is GoogleAdsCustomer => c !== null);
  }

  // ─── Run GAQL query ───────────────────────────────────────────────────────
  // Executes a Google Ads Query Language (GAQL) query against a customer account.
  // customerId must be normalized (no dashes).
  //
  // Fix (AI review): GOOGLE_ADS_DEVELOPER_TOKEN validated at runtime.
  // Fix (AI review): normalizeCustomerId applied before API call as defense-in-depth.

  async runQuery(
    accessToken: string,
    customerId: string,
    query: string,
  ): Promise<GoogleAdsReportResult> {
    const devToken = this.requireDeveloperToken();
    const normalizedId = normalizeCustomerId(customerId);

    const response = await fetchWithTimeout(
      `${GOOGLE_ADS_API_BASE}/customers/${normalizedId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          ...this.buildHeaders(accessToken, devToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Google Ads query failed. Check that the customer ID is correct.',
      );
    }

    const data = await response.json() as { results?: GoogleAdsRow[] };
    return { rows: data.results ?? [] };
  }

  // ─── Campaign performance — standard AgencyPulse metrics ─────────────────
  // Called by Phase 3.5 workers to fetch daily campaign performance data.
  // Returns clicks, impressions, CTR, avg CPC, cost (micros), conversions.

  async fetchCampaignPerformance(
    accessToken: string,
    customerId: string,
    dateRange: GoogleAdsDateRange,
  ): Promise<GoogleAdsReportResult> {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC
    `.trim();

    return this.runQuery(accessToken, customerId, query);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async fetchCustomerDetails(
    accessToken: string,
    devToken: string,
    resourceName: string,
  ): Promise<GoogleAdsCustomer | null> {
    const customerId = resourceName.replace('customers/', '');

    const query = `
      SELECT customer.id, customer.descriptive_name
      FROM customer
      LIMIT 1
    `.trim();

    try {
      const response = await fetchWithTimeout(
        `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            ...this.buildHeaders(accessToken, devToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        },
      );

      if (!response.ok) return null;

      const data = await response.json() as {
        results?: Array<{ customer?: { id?: string; descriptiveName?: string } }>;
      };

      const row = data.results?.[0]?.customer;
      if (!row?.id) return null;

      return {
        customerId: normalizeCustomerId(row.id),
        descriptiveName: row.descriptiveName ?? `Customer ${row.id}`,
        resourceName,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fix (AI review): GOOGLE_ADS_DEVELOPER_TOKEN required at call time.
   * Not required at startup so the app boots without it.
   * Never logged — thrown errors do not include the token value.
   */
  private requireDeveloperToken(): string {
    const token = this.config.get<string>('google.ads.developerToken');
    if (!token) {
      throw new ServiceUnavailableException(
        'Google Ads integration is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN.',
      );
    }
    return token;
  }

  private buildHeaders(
    accessToken: string,
    developerToken: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    };

    // If a manager (MCC) customer ID is set, include it for cross-account access
    const managerCustomerId = this.config.get<string>('google.ads.managerCustomerId');
    if (managerCustomerId) {
      headers['login-customer-id'] = normalizeCustomerId(managerCustomerId);
    }

    return headers;
  }
}

/**
 * Fix (AI review): Google Ads UI shows "123-456-7890" but the API requires "1234567890".
 * Applied before storing in DB and before every API call.
 */
export function normalizeCustomerId(id: string): string {
  return id.replace(/-/g, '');
}
