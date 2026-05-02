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
import { GoogleOAuthService } from '../google/google-oauth.service';
import { GoogleAdsApiService } from './google-ads-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class GoogleAdsOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly googleAdsApiService: GoogleAdsApiService,
  ) {}

  // ─── Generate auth URL ─────────────────────────────────────────────────────

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

    const state = this.googleOAuth.signState({
      campaignId,
      clientId: campaign.clientId,
      tenantId: user.tenantId,
      userId: user.id,
      platform: IntegrationPlatform.GOOGLE_ADS,
    });

    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId')!,
      redirect_uri: this.config.get<string>('google.ads.redirectUri')!,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // Public endpoint — no JWT context. TenantContextService.run() sets tenant
  // context for all DB operations (same pattern as GA4 callback).
  //
  // Fix (AI review): Re-validates campaign + client (tenantId + deletedAt=null) before storing.
  // Fix (AI review): Redirect to FRONTEND_URL from config only.
  // Fix 5: refreshToken only stored if Google returned one.

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.googleOAuth.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.GOOGLE_ADS) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    const tokenResponse = await this.googleOAuth.exchangeCode(
      code,
      this.config.get<string>('google.ads.redirectUri')!,
    );
    const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await this.tenantContext.run(state.tenantId, async () => {
      // Re-validate campaign AND client are still active (AI fix)
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
        IntegrationPlatform.GOOGLE_ADS,
        {
          accessToken: tokenResponse.access_token,
          ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
          tokenExpiresAt,
          scopes: tokenResponse.scope,
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=google-ads`;
  }

  // ─── List accessible customers for a campaign ─────────────────────────────
  // After OAuth, user picks which Google Ads customer account to attach.

  async listCustomersForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.googleAdsApiService.listAccessibleCustomers(accessToken);
  }

  // ─── Get valid (non-expired) access token ──────────────────────────────────

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.GOOGLE_ADS,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('Google Ads is not connected for this campaign.');
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (!tokens.tokenExpiresAt || tokens.tokenExpiresAt < fiveMinutesFromNow) {
      const refreshed = await this.refreshAccessToken(tenantId, campaignId, tokens.refreshToken);
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  // ─── Refresh access token ──────────────────────────────────────────────────

  async refreshAccessToken(
    tenantId: string,
    campaignId: string,
    existingRefreshToken?: string | null,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
    this.assertConfigured();

    const refreshToken =
      existingRefreshToken ??
      (await this.integrationsService.getDecryptedTokens(tenantId, campaignId, IntegrationPlatform.GOOGLE_ADS))?.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException(
        'No refresh token stored for Google Ads. Re-connect the integration.',
      );
    }

    const { accessToken, tokenExpiresAt } = await this.googleOAuth.refreshAccessToken(
      refreshToken,
      this.config.get<string>('google.ads.redirectUri')!,
    );

    // Fix 5: only update accessToken + tokenExpiresAt — preserve existing refresh token
    await this.integrationsService.storeTokens(tenantId, campaignId, IntegrationPlatform.GOOGLE_ADS, {
      accessToken,
      tokenExpiresAt,
    });

    return { accessToken, tokenExpiresAt };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertConfigured(): void {
    this.googleOAuth.assertCoreConfigured();
    if (!this.config.get('google.ads.redirectUri')) {
      throw new ServiceUnavailableException(
        'Google Ads integration is not configured. Set GOOGLE_ADS_REDIRECT_URI.',
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
    ) {
      return base;
    }

    if (role === UserRole.AGENCY_STAFF) {
      return {
        ...base,
        client: {
          is: { deletedAt: null, staffAssignments: { some: { userId: user.id } } },
        },
      };
    }

    if (role === UserRole.CLIENT_USER) {
      return {
        ...base,
        client: {
          is: { deletedAt: null, clientUserAssignments: { some: { userId: user.id } } },
        },
      };
    }

    return { ...base, id: 'no-access' };
  }
}
