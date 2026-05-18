import { Injectable, BadRequestException } from '@nestjs/common';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

// GA4 Admin API — account/property discovery
const GA4_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
// GA4 Data API — report execution
const GA4_DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';

export interface Ga4Property {
  propertyId: string;     // e.g. "properties/123456789"
  displayName: string;    // e.g. "My Website"
  accountDisplayName: string;
}

export interface Ga4DateRange {
  startDate: string; // YYYY-MM-DD or NdaysAgo
  endDate: string;
}

export interface Ga4ReportRow {
  dimensions: Record<string, string>; // { date: '20240101', ... }
  metrics: Record<string, string>;    // { sessions: '1234', totalUsers: '800', ... }
}

export interface Ga4ReportResult {
  rows: Ga4ReportRow[];
  rowCount: number;
}

@Injectable()
export class Ga4ApiService {
  // ─── List GA4 properties ──────────────────────────────────────────────────
  // Calls GA4 Admin API accountSummaries — returns all accounts + properties
  // the user has access to. Used on the frontend to let users pick their property.

  async listProperties(accessToken: string): Promise<Ga4Property[]> {
    const response = await fetchWithTimeout(
      `${GA4_ADMIN_BASE}/accountSummaries?pageSize=200`,
      { headers: this.authHeader(accessToken) },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadRequestException(`GA4 Admin API error (HTTP ${response.status}): ${body.slice(0, 300)}`);
    }

    const data = await response.json() as {
      accountSummaries?: Array<{
        displayName: string;
        propertySummaries?: Array<{ property: string; displayName: string }>;
      }>;
    };

    const properties: Ga4Property[] = [];

    for (const account of data.accountSummaries ?? []) {
      for (const prop of account.propertySummaries ?? []) {
        properties.push({
          propertyId: prop.property,           // e.g. "properties/123456789"
          displayName: prop.displayName,
          accountDisplayName: account.displayName,
        });
      }
    }

    return properties;
  }

  // ─── Run report ──────────────────────────────────────────────────────────
  // Calls GA4 Data API v1beta runReport.
  // propertyId must include the "properties/" prefix (e.g. "properties/123456789").
  //
  // Common metrics: sessions, totalUsers, newUsers, screenPageViews,
  //                 bounceRate, averageSessionDuration, engagementRate
  // Common dimensions: date, country, deviceCategory, sessionSource

  async runReport(
    accessToken: string,
    propertyId: string,
    dateRange: Ga4DateRange,
    metrics: string[],
    dimensions: string[] = [],
  ): Promise<Ga4ReportResult> {
    const body = {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      metrics: metrics.map((name) => ({ name })),
      ...(dimensions.length > 0 && {
        dimensions: dimensions.map((name) => ({ name })),
      }),
    };

    const response = await fetchWithTimeout(
      `${GA4_DATA_BASE}/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          ...this.authHeader(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadRequestException(
        `GA4 Data API error (HTTP ${response.status}): ${body.slice(0, 400)}`,
      );
    }

    const data = await response.json() as {
      dimensionHeaders?: Array<{ name: string }>;
      metricHeaders?: Array<{ name: string }>;
      rows?: Array<{
        dimensionValues?: Array<{ value: string }>;
        metricValues?: Array<{ value: string }>;
      }>;
      rowCount?: number;
    };

    const dimensionHeaders = data.dimensionHeaders?.map((h) => h.name) ?? [];
    const metricHeaders = data.metricHeaders?.map((h) => h.name) ?? [];

    const rows: Ga4ReportRow[] = (data.rows ?? []).map((row) => {
      const dims: Record<string, string> = {};
      const mets: Record<string, string> = {};

      (row.dimensionValues ?? []).forEach((v, i) => {
        dims[dimensionHeaders[i]] = v.value;
      });
      (row.metricValues ?? []).forEach((v, i) => {
        mets[metricHeaders[i]] = v.value;
      });

      return { dimensions: dims, metrics: mets };
    });

    return { rows, rowCount: data.rowCount ?? rows.length };
  }

  // ─── Core metrics helper ──────────────────────────────────────────────────
  // Convenience method for workers — fetches the standard AgencyPulse GA4 metrics
  // for a given date range. Workers (Phase 3.5) call this directly.

  async fetchCoreMetrics(
    accessToken: string,
    propertyId: string,
    dateRange: Ga4DateRange,
  ): Promise<Ga4ReportResult> {
    return this.runReport(
      accessToken,
      propertyId,
      dateRange,
      ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration'],
      ['date'],
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private authHeader(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}` };
  }
}
