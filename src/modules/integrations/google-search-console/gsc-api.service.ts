import { Injectable, BadRequestException } from '@nestjs/common';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

const GSC_BASE = 'https://www.googleapis.com/webmasters/v3';

export interface GscSite {
  siteUrl: string;
  permissionLevel: string; // 'siteOwner' | 'siteFullUser' | 'siteRestrictedUser' | 'siteUnverifiedUser'
}

export interface GscAnalyticsRow {
  date: string;       // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number;        // 0–1 decimal (e.g. 0.045 = 4.5%)
  position: number;   // average position (1 = top)
}

@Injectable()
export class GscApiService {
  // ─── List verified sites ──────────────────────────────────────────────────
  // Returns all Search Console properties the user has access to.
  // Used after OAuth to let the user pick their site.

  async listSites(accessToken: string): Promise<GscSite[]> {
    const response = await fetchWithTimeout(`${GSC_BASE}/sites`, {
      headers: this.authHeader(accessToken),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch Search Console sites. Check connection status.');
    }

    const data = await response.json() as {
      siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
    };

    return (data.siteEntry ?? []).map((s) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
  }

  // ─── Query search analytics ───────────────────────────────────────────────
  // Returns daily breakdown: clicks, impressions, CTR, avg position.
  // siteUrl must match exactly what was returned by listSites.
  // Called by Phase 3.5 workers after token refresh.

  async queryAnalytics(
    accessToken: string,
    siteUrl: string,
    from: string,
    to: string,
  ): Promise<GscAnalyticsRow[]> {
    // siteUrl must be URL-encoded in the path (e.g. "sc-domain:example.com" → "sc-domain%3Aexample.com")
    const encodedSiteUrl = encodeURIComponent(siteUrl);

    const body = {
      startDate: from,
      endDate: to,
      dimensions: ['date'],
      rowLimit: 25000,
    };

    const response = await fetchWithTimeout(
      `${GSC_BASE}/sites/${encodedSiteUrl}/searchAnalytics/query`,
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
      throw new BadRequestException(
        'Search Console analytics query failed. Check the site URL and permissions.',
      );
    }

    const data = await response.json() as {
      rows?: Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    };

    return (data.rows ?? []).map((row) => ({
      date: row.keys[0],       // YYYY-MM-DD (dimension = date)
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  }

  private authHeader(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}` };
  }
}
