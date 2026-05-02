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
import { LinkedinAdsApiService } from './linkedin-ads-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// LinkedIn access tokens: 60 days (5184000s). Refresh tokens: 365 days (if app has rotation enabled).
const LINKEDIN_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

@Injectable()
export class LinkedinAdsOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly oauthState: OAuthStateService,
    private readonly linkedinApi: LinkedinAdsApiService,
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
      platform: IntegrationPlatform.LINKEDIN_ADS,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.get<string>('linkedin.clientId')!,
      redirect_uri: this.config.get<string>('linkedin.redirectUri')!,
      // r_ads: access to ad performance data; r_ads_reporting: detailed analytics
      scope: 'r_ads r_ads_reporting',
      state,
    });

    return { authUrl: `${LINKEDIN_AUTH_URL}?${params.toString()}` };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // LinkedIn issues:
  //   - access_token: 60-day expiry
  //   - refresh_token: 365-day expiry (only if LinkedIn app has token rotation enabled)
  //
  // We store the access token + optional refresh token. If LinkedIn does not return
  // a refresh token (some apps), the user must re-connect when expired.

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.oauthState.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.LINKEDIN_ADS) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    const tokenData = await this.exchangeCode(code);

    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : new Date(Date.now() + LINKEDIN_TOKEN_TTL_MS);

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
        IntegrationPlatform.LINKEDIN_ADS,
        {
          accessToken: tokenData.access_token,
          ...(tokenData.refresh_token && { refreshToken: tokenData.refresh_token }),
          tokenExpiresAt,
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=linkedin-ads`;
  }

  // ─── Get valid access token ────────────────────────────────────────────────
  // Tries refresh if token near expiry. If no refresh token, marks EXPIRED.

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.LINKEDIN_ADS,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('LinkedIn Ads is not connected for this campaign.');
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (tokens.tokenExpiresAt && tokens.tokenExpiresAt <= fiveMinutesFromNow) {
      if (tokens.refreshToken) {
        const refreshed = await this.refreshAccessToken(tenantId, campaignId, tokens.refreshToken);
        return refreshed.accessToken;
      }

      // No refresh token — mark expired
      await this.prisma.integrationConnection.updateMany({
        where: { campaignId, platform: IntegrationPlatform.LINKEDIN_ADS, tenantId },
        data: { status: ConnectionStatus.EXPIRED },
      });

      throw new BadRequestException(
        'LinkedIn Ads token has expired. Re-connect the integration from campaign settings.',
      );
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
      (await this.integrationsService.getDecryptedTokens(tenantId, campaignId, IntegrationPlatform.LINKEDIN_ADS))?.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException(
        'No refresh token for LinkedIn Ads. Re-connect the integration.',
      );
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.get<string>('linkedin.clientId')!,
      client_secret: this.config.get<string>('linkedin.clientSecret')!,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException('LinkedIn token refresh failed. Re-connect the integration.');
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await this.integrationsService.storeTokens(tenantId, campaignId, IntegrationPlatform.LINKEDIN_ADS, {
      accessToken: data.access_token,
      tokenExpiresAt,
    });

    return { accessToken: data.access_token, tokenExpiresAt };
  }

  // ─── List ad accounts ─────────────────────────────────────────────────────

  async listAdAccountsForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.linkedinApi.listAdAccounts(accessToken);
  }

  async selectAdAccount(
    user: AuthenticatedUser,
    campaignId: string,
    accountId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);

    // Validate accountId belongs to this user
    const accounts = await this.linkedinApi.listAdAccounts(accessToken);
    const accountExists = accounts.some((a) => a.id === accountId);

    if (!accountExists) {
      throw new BadRequestException(
        'The selected LinkedIn ad account is not accessible with the connected credentials.',
      );
    }

    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.LINKEDIN_ADS,
      { accessToken, externalAccountId: accountId },
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async exchangeCode(code: string): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.get<string>('linkedin.redirectUri')!,
      client_id: this.config.get<string>('linkedin.clientId')!,
      client_secret: this.config.get<string>('linkedin.clientSecret')!,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to exchange authorization code with LinkedIn. Please try again.',
      );
    }

    return response.json() as Promise<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
    }>;
  }

  private assertConfigured(): void {
    if (
      !this.config.get('linkedin.clientId') ||
      !this.config.get('linkedin.clientSecret') ||
      !this.config.get('linkedin.redirectUri')
    ) {
      throw new ServiceUnavailableException(
        'LinkedIn Ads integration is not configured. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_ADS_REDIRECT_URI.',
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
