import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

export interface TiktokAdvertiser {
  advertiserId: string;
  advertiserName: string;
  currency: string;
}

export interface TiktokMetricRow {
  date: string;         // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;          // decimal, e.g. 0.045 = 4.5%
  cpc: number;
  conversion: number;   // total conversions
}

// TikTok API success code
const TIKTOK_SUCCESS_CODE = 0;

@Injectable()
export class TiktokAdsApiService {
  constructor(private readonly config: ConfigService) {}

  // ─── List authorized advertisers ─────────────────────────────────────────
  // Returns all advertiser accounts accessible with the given access token.
  // app_id and secret are required query params — this endpoint is an LWA-style
  // endpoint that authorizes with app credentials + user access token.

  async listAdvertisers(accessToken: string): Promise<TiktokAdvertiser[]> {
    const params = new URLSearchParams({
      app_id: this.config.get<string>('tiktok.appId')!,
      secret: this.config.get<string>('tiktok.secret')!,
      access_token: accessToken,
    });

    const response = await fetchWithTimeout(
      `${TIKTOK_API_BASE}/oauth2/advertiser/get/?${params.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch TikTok advertisers. Check connection status.');
    }

    const data = await response.json() as {
      code: number;
      data?: {
        list?: Array<{
          advertiser_id: string;
          advertiser_name: string;
          currency: string;
        }>;
      };
    };

    if (data.code !== TIKTOK_SUCCESS_CODE) {
      throw new BadRequestException('TikTok advertisers API returned an error.');
    }

    return (data.data?.list ?? []).map((a) => ({
      advertiserId: String(a.advertiser_id),
      advertiserName: a.advertiser_name,
      currency: a.currency,
    }));
  }

  // ─── Fetch campaign metrics ───────────────────────────────────────────────
  // TikTok Integrated Report API.
  // advertiserId: stored as externalAccountId.
  // Date breakdown: dimensions = ["stat_time_day"], format: "YYYY-MM-DD 00:00:00"
  //
  // TikTok uses Access-Token header (NOT Bearer prefix).

  async fetchCampaignMetrics(
    accessToken: string,
    advertiserId: string,
    from: string,
    to: string,
  ): Promise<TiktokMetricRow[]> {
    const body = {
      advertiser_id: advertiserId,
      service_type: 'AUCTION',
      report_type: 'BASIC',
      data_level: 'AUCTION_ADVERTISER',
      dimensions: ['stat_time_day'],
      metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversion'],
      start_date: from,
      end_date: to,
      page_size: 1000,
    };

    const response = await fetchWithTimeout(`${TIKTOK_API_BASE}/report/integrated/get/`, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,      // TikTok uses Access-Token header, not Authorization: Bearer
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new BadRequestException(
        'TikTok Ads report request failed. Check the advertiser ID.',
      );
    }

    const data = await response.json() as {
      code: number;
      message?: string;
      data?: {
        list?: Array<{
          dimensions: { stat_time_day: string };
          metrics: {
            spend: string;
            impressions: string;
            clicks: string;
            ctr: string;
            cpc: string;
            conversion: string;
          };
        }>;
      };
    };

    if (data.code !== TIKTOK_SUCCESS_CODE) {
      throw new BadRequestException(`TikTok API error: ${data.message ?? 'unknown error'}`);
    }

    return (data.data?.list ?? []).map((row) => ({
      // stat_time_day is "YYYY-MM-DD 00:00:00" — extract date part only
      date: row.dimensions.stat_time_day.slice(0, 10),
      spend: parseFloat(row.metrics.spend ?? '0'),
      impressions: parseInt(row.metrics.impressions ?? '0', 10),
      clicks: parseInt(row.metrics.clicks ?? '0', 10),
      ctr: parseFloat(row.metrics.ctr ?? '0'),
      cpc: parseFloat(row.metrics.cpc ?? '0'),
      conversion: parseInt(row.metrics.conversion ?? '0', 10),
    })).filter((r) => r.date !== '');
  }

  assertConfigured(): void {
    if (!this.config.get('tiktok.appId') || !this.config.get('tiktok.secret')) {
      throw new ServiceUnavailableException(
        'TikTok Ads integration is not configured. Set TIKTOK_APP_ID and TIKTOK_APP_SECRET.',
      );
    }
  }
}
