import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// Meta token exchange response
export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // Present on long-lived tokens (~5184000 = 60 days)
}

export interface MetaAdAccount {
  id: string;         // e.g. "act_123456789"
  name: string;
  accountStatus: number; // 1 = ACTIVE, 2 = DISABLED, etc.
}

export interface MetaDateRange {
  since: string; // YYYY-MM-DD
  until: string;
}

export interface MetaInsightRow {
  campaign_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  conversions?: string;
  date_start?: string;
  date_stop?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class MetaAdsApiService {
  constructor(private readonly config: ConfigService) {}

  // ─── Short-lived → Long-lived token exchange ──────────────────────────────
  // Meta does not issue refresh tokens. Initial OAuth returns a short-lived
  // user token (~1 hour). This must be immediately exchanged for a long-lived
  // token (~60 days). Called from MetaOAuthService.handleCallback().
  //
  // Security: META_APP_SECRET never logged.

  async exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    this.assertConfigured();

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.get<string>('meta.appId')!,
      client_secret: this.config.get<string>('meta.appSecret')!,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetchWithTimeout(
      `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to exchange Meta token. Please try connecting again.',
      );
    }

    return response.json() as Promise<MetaTokenResponse>;
  }

  // ─── List ad accounts ─────────────────────────────────────────────────────
  // Returns all Meta Ad Accounts accessible to the connected user.
  // Used in two places:
  //   1. GET /integrations/meta-ads/ad-accounts — user picks their account
  //   2. POST /integrations/meta-ads/select-account — validates the chosen ID
  //
  // Fix (AI review): adAccountId is always validated against this list before saving.

  async listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    const params = new URLSearchParams({
      fields: 'id,name,account_status',
      limit: '100',
      access_token: accessToken,
    });

    const response = await fetchWithTimeout(
      `${META_GRAPH_BASE}/me/adaccounts?${params.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to fetch Meta ad accounts. Check connection status.',
      );
    }

    const data = await response.json() as {
      data?: Array<{ id: string; name: string; account_status: number }>;
    };

    return (data.data ?? []).map((a) => ({
      id: a.id,                       // "act_123456789"
      name: a.name,
      accountStatus: a.account_status,
    }));
  }

  // ─── Fetch campaign insights ──────────────────────────────────────────────
  // Calls the Meta Ads Insights API for campaign-level performance data.
  // adAccountId must include the "act_" prefix (e.g. "act_123456789").
  // Called by Phase 3.5 workers.

  async fetchCampaignInsights(
    accessToken: string,
    adAccountId: string,
    dateRange: MetaDateRange,
  ): Promise<MetaInsightRow[]> {
    const params = new URLSearchParams({
      fields: [
        'campaign_name',
        'impressions',
        'clicks',
        'spend',
        'ctr',
        'cpc',
        'conversions',
      ].join(','),
      time_range: JSON.stringify({ since: dateRange.since, until: dateRange.until }),
      level: 'campaign',
      time_increment: '1', // Daily breakdown
      access_token: accessToken,
      limit: '500',
    });

    const response = await fetchWithTimeout(
      `${META_GRAPH_BASE}/${adAccountId}/insights?${params.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Meta Ads Insights API request failed. Check the ad account ID.',
      );
    }

    const data = await response.json() as { data?: MetaInsightRow[] };
    return data.data ?? [];
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertConfigured(): void {
    if (!this.config.get('meta.appId') || !this.config.get('meta.appSecret')) {
      throw new ServiceUnavailableException(
        'Meta Ads integration is not configured. Set META_APP_ID and META_APP_SECRET.',
      );
    }
  }
}

/**
 * Normalize Meta ad account ID — always stored and used with "act_" prefix.
 * Meta API returns "act_123456789"; some SDKs strip the prefix.
 */
export function normalizeAdAccountId(id: string): string {
  if (id.startsWith('act_')) return id;
  return `act_${id}`;
}
