import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationPlatform, UserRole, Prisma, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationsService } from '../integrations.service';
import { OAuthStateService } from '../oauth-state/oauth-state.service';
import { TiktokAdsApiService } from './tiktok-ads-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// TikTok access tokens expire in 24 hours. No refresh tokens — user must re-auth.
const TIKTOK_TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';
const TIKTOK_SUCCESS_CODE = 0;

@Injectable()
export class TiktokAdsOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly oauthState: OAuthStateService,
    private readonly tiktokApi: TiktokAdsApiService,
  ) {}

  async generateAuthUrl(
    user: AuthenticatedUser,
    campaignId: string,
  ): Promise<{ authUrl: string }> {
    this.assertConfigured();

    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const state = this.oauthState.signState({
      campaignId,
      tenantId: user.tenantId,
      userId: user.id,
      platform: IntegrationPlatform.TIKTOK_ADS,
    });

    // TikTok uses app_id (not client_id) and redirect_uri must be URL-encoded
    const params = new URLSearchParams({
      app_id: this.config.get<string>('tiktok.appId')!,
      redirect_uri: this.config.get<string>('tiktok.redirectUri')!,
      state,
    });

    return {
      authUrl: `https://business-api.tiktok.com/portal/auth?${params.toString()}`,
    };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // TikTok CRITICAL differences vs other platforms:
  //   1. Callback param is "auth_code" NOT "code"
  //   2. Token exchange uses POST with JSON body (not form-encoded)
  //   3. Body has "app_id", "secret", "auth_code" (not client_id/client_secret/code)
  //   4. Response wrapped: { code: 0, data: { access_token, advertiser_ids: [...], expires_in: 86400 } }
  //   5. expires_in = 86400 seconds (24 hours) — no refresh token

  async handleCallback(authCode: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.oauthState.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.TIKTOK_ADS) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    const tokenData = await this.exchangeAuthCode(authCode);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await this.tenantContext.run(state.tenantId, async () => {
      const campaign = await this.prisma.campaign.findFirst({
        where: {
          id: state.campaignId,
          tenantId: state.tenantId,
          deletedAt: null,
          client: { deletedAt: null },
        },
        select: { id: true },
      });

      if (!campaign) {
        throw new BadRequestException(
          'The campaign is no longer available. The connection could not be saved.',
        );
      }

      // Auto-select first advertiser_id if only one; user can change via select endpoint
      const firstAdvertiserId = tokenData.advertiser_ids?.[0]
        ? String(tokenData.advertiser_ids[0])
        : undefined;

      await this.integrationsService.storeTokens(
        state.tenantId,
        campaign.id,
        IntegrationPlatform.TIKTOK_ADS,
        {
          accessToken: tokenData.access_token,
          // No refresh token — TikTok Business API does not issue them
          tokenExpiresAt,
          ...(firstAdvertiserId && { externalAccountId: firstAdvertiserId }),
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/campaigns/${state.campaignId}?connected=tiktok-ads`;
  }

  // ─── Get valid access token ────────────────────────────────────────────────
  // TikTok has no refresh token. If expired, mark EXPIRED and throw.

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.TIKTOK_ADS,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('TikTok Ads is not connected for this campaign.');
    }

    if (tokens.tokenExpiresAt && tokens.tokenExpiresAt <= new Date()) {
      await this.prisma.integrationConnection.updateMany({
        where: { campaignId, platform: IntegrationPlatform.TIKTOK_ADS, tenantId },
        data: { status: ConnectionStatus.EXPIRED },
      });

      throw new BadRequestException(
        'TikTok Ads token has expired (24h TTL). Re-connect the integration from campaign settings.',
      );
    }

    return tokens.accessToken;
  }

  async listAdvertisersForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.tiktokApi.listAdvertisers(accessToken);
  }

  async selectAdvertiser(
    user: AuthenticatedUser,
    campaignId: string,
    advertiserId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);

    // Validate advertiserId is accessible
    const advertisers = await this.tiktokApi.listAdvertisers(accessToken);
    const advertiserExists = advertisers.some((a) => a.advertiserId === advertiserId);

    if (!advertiserExists) {
      throw new BadRequestException(
        'The selected TikTok advertiser is not accessible with the connected credentials.',
      );
    }

    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.TIKTOK_ADS,
      { accessToken, externalAccountId: advertiserId },
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  // TikTok token exchange: POST with JSON body (NOT form-encoded).
  // Body uses app_id + secret + auth_code (NOT client_id + client_secret + code).
  private async exchangeAuthCode(authCode: string): Promise<{
    access_token: string;
    expires_in: number;
    advertiser_ids: Array<string | number>;
  }> {
    const response = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.config.get<string>('tiktok.appId')!,
        secret: this.config.get<string>('tiktok.secret')!,
        auth_code: authCode,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to exchange TikTok auth_code. Please try again.',
      );
    }

    const result = await response.json() as {
      code: number;
      message: string;
      data?: {
        access_token: string;
        expires_in: number;
        advertiser_ids: Array<string | number>;
      };
    };

    if (result.code !== TIKTOK_SUCCESS_CODE || !result.data) {
      throw new BadRequestException(`TikTok token exchange failed: ${result.message}`);
    }

    return result.data;
  }

  private assertConfigured(): void {
    this.tiktokApi.assertConfigured();
    if (!this.config.get('tiktok.redirectUri')) {
      throw new ServiceUnavailableException(
        'TikTok Ads integration is not configured. Set TIKTOK_ADS_REDIRECT_URI.',
      );
    }
  }

  buildCampaignWhere(
    user: AuthenticatedUser,
    campaignId: string,
  ): Prisma.CampaignWhereInput {
    const role = user.role as UserRole;
    const base: Prisma.CampaignWhereInput = {
      id: campaignId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { deletedAt: null },
    };

    if (
      role === UserRole.PLATFORM_OWNER ||
      role === UserRole.AGENCY_OWNER ||
      role === UserRole.AGENCY_ADMIN
    ) return base;

    if (role === UserRole.AGENCY_STAFF) {
      return {
        ...base,
        client: { is: { deletedAt: null, staffAssignments: { some: { userId: user.id } } } },
      };
    }

    if (role === UserRole.CLIENT_USER) {
      return {
        ...base,
        client: { is: { deletedAt: null, clientUserAssignments: { some: { userId: user.id } } } },
      };
    }

    return { ...base, id: 'no-access' };
  }
}
