import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationPlatform, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationsService } from '../integrations.service';
import { OAuthStateService } from '../oauth-state/oauth-state.service';
import { AmazonAdsApiService } from './amazon-ads-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// Login with Amazon (LWA) endpoints
const LWA_AUTH_URL = 'https://www.amazon.com/ap/oa';
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

@Injectable()
export class AmazonAdsOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly oauthState: OAuthStateService,
    private readonly amazonApi: AmazonAdsApiService,
  ) {}

  async generateAuthUrl(
    user: AuthenticatedUser,
    campaignId: string,
  ): Promise<{ authUrl: string }> {
    this.assertConfigured();

    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true, clientId: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const state = this.oauthState.signState({
      campaignId,
      clientId: campaign.clientId,
      tenantId: user.tenantId,
      userId: user.id,
      platform: IntegrationPlatform.AMAZON_ADS,
    });

    const params = new URLSearchParams({
      client_id: this.config.get<string>('amazon.clientId')!,
      scope: 'advertising::campaign_management',
      response_type: 'code',
      redirect_uri: this.config.get<string>('amazon.redirectUri')!,
      state,
    });

    return { authUrl: `${LWA_AUTH_URL}?${params.toString()}` };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // Login with Amazon returns standard OAuth code (not auth_code like TikTok).
  // Amazon issues: access_token (1h) + refresh_token (long-lived, Amazon doesn't specify TTL).

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.oauthState.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.AMAZON_ADS) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    const tokenData = await this.exchangeCode(code);
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

      await this.integrationsService.storeTokens(
        state.tenantId,
        campaign.id,
        IntegrationPlatform.AMAZON_ADS,
        {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt,
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=amazon-ads`;
  }

  // ─── Get valid access token ────────────────────────────────────────────────
  // Proactively refreshes if token expires within 5 minutes. Amazon refresh tokens
  // are long-lived so refresh almost always succeeds.

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.AMAZON_ADS,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('Amazon Ads is not connected for this campaign.');
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (!tokens.tokenExpiresAt || tokens.tokenExpiresAt < fiveMinutesFromNow) {
      const refreshed = await this.refreshAccessToken(tenantId, campaignId, tokens.refreshToken);
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  async refreshAccessToken(
    tenantId: string,
    campaignId: string,
    existingRefreshToken?: string | null,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
    this.assertConfigured();

    const refreshToken =
      existingRefreshToken ??
      (await this.integrationsService.getDecryptedTokens(tenantId, campaignId, IntegrationPlatform.AMAZON_ADS))?.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException(
        'No refresh token for Amazon Ads. Re-connect the integration.',
      );
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.get<string>('amazon.clientId')!,
      client_secret: this.config.get<string>('amazon.clientSecret')!,
    });

    const response = await fetch(LWA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException('Amazon Ads token refresh failed. Re-connect the integration.');
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await this.integrationsService.storeTokens(tenantId, campaignId, IntegrationPlatform.AMAZON_ADS, {
      accessToken: data.access_token,
      tokenExpiresAt,
    });

    return { accessToken: data.access_token, tokenExpiresAt };
  }

  // ─── Profile listing and selection ────────────────────────────────────────

  async listProfilesForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.amazonApi.listProfiles(accessToken);
  }

  async selectProfile(
    user: AuthenticatedUser,
    campaignId: string,
    profileId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);

    // Validate profileId belongs to this user
    const profiles = await this.amazonApi.listProfiles(accessToken);
    const profileExists = profiles.some((p) => p.profileId === profileId);

    if (!profileExists) {
      throw new BadRequestException(
        'The selected Amazon Advertising profile is not accessible with the connected credentials.',
      );
    }

    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.AMAZON_ADS,
      { accessToken, externalAccountId: profileId },
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async exchangeCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.get<string>('amazon.redirectUri')!,
      client_id: this.config.get<string>('amazon.clientId')!,
      client_secret: this.config.get<string>('amazon.clientSecret')!,
    });

    const response = await fetch(LWA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to exchange authorization code with Amazon. Please try again.',
      );
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
    }>;
  }

  private assertConfigured(): void {
    if (
      !this.config.get('amazon.clientId') ||
      !this.config.get('amazon.clientSecret') ||
      !this.config.get('amazon.redirectUri')
    ) {
      throw new ServiceUnavailableException(
        'Amazon Ads integration is not configured. Set IntegrationPlatform.AMAZON_ADS_CLIENT_ID, IntegrationPlatform.AMAZON_ADS_CLIENT_SECRET, and IntegrationPlatform.AMAZON_ADS_REDIRECT_URI.',
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
