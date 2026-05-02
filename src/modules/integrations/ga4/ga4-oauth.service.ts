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
import { Ga4ApiService } from './ga4-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class Ga4OAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly ga4ApiService: Ga4ApiService,
  ) {}

  // ─── Generate auth URL ─────────────────────────────────────────────────────
  // Fix 3: Only campaignId accepted — clientId is derived from DB, not user input.
  // Fix 6: platform is included in the state JWT (via GoogleOAuthService.signState).

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
      platform: IntegrationPlatform.GA4,
    });

    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId')!,
      redirect_uri: this.config.get<string>('google.redirectUri')!,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/analytics.edit',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // Public endpoint — no JWT context. Uses TenantContextService.run() to set
  // tenant context for DB operations.
  //
  // Fix 2: Re-validates campaign + client are still active before storing tokens.
  // Fix 4: Redirect URL comes from FRONTEND_URL config — never from user input.
  // Fix 5: refreshToken only stored if Google returned one.
  // Fix 6: Verifies platform in state === GA4.

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.googleOAuth.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.GA4) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    // Exchange code before setting tenant context — no DB needed for this step
    const tokenResponse = await this.googleOAuth.exchangeCode(
      code,
      this.config.get<string>('google.redirectUri')!,
    );
    const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await this.tenantContext.run(state.tenantId, async () => {
      // Fix 2: Re-validate campaign AND client are still active
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

      // Fix 5: Only include refreshToken if Google returned one
      await this.integrationsService.storeTokens(
        state.tenantId,
        campaign.id,
        IntegrationPlatform.GA4,
        {
          accessToken: tokenResponse.access_token,
          ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
          tokenExpiresAt,
          scopes: tokenResponse.scope,
        },
      );
    });

    // Fix 4: Redirect to FRONTEND_URL from config — never a user-supplied URL
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=ga4`;
  }

  // ─── List GA4 properties for a campaign ──────────────────────────────────
  // Validates campaign access, gets a fresh token, then calls the GA4 Admin API.

  async listPropertiesForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.ga4ApiService.listProperties(accessToken);
  }

  // ─── Get valid (non-expired) access token ──────────────────────────────────
  // Proactively refreshes if token expires within 5 minutes.
  // Called by workers (Phase 3.5) before making API calls.

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.GA4,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('GA4 is not connected for this campaign.');
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (!tokens.tokenExpiresAt || tokens.tokenExpiresAt < fiveMinutesFromNow) {
      const refreshed = await this.refreshAccessToken(tenantId, campaignId, tokens.refreshToken);
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  // ─── Refresh access token ──────────────────────────────────────────────────
  // Fix 5: only updates accessToken + tokenExpiresAt — refresh token preserved.

  async refreshAccessToken(
    tenantId: string,
    campaignId: string,
    existingRefreshToken?: string | null,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
    this.assertConfigured();

    const refreshToken =
      existingRefreshToken ??
      (await this.integrationsService.getDecryptedTokens(tenantId, campaignId, IntegrationPlatform.GA4))?.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException('No refresh token stored for GA4. Re-connect the integration.');
    }

    const { accessToken, tokenExpiresAt } = await this.googleOAuth.refreshAccessToken(
      refreshToken,
      this.config.get<string>('google.redirectUri')!,
    );

    await this.integrationsService.storeTokens(tenantId, campaignId, IntegrationPlatform.GA4, {
      accessToken,
      tokenExpiresAt,
    });

    return { accessToken, tokenExpiresAt };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertConfigured(): void {
    this.googleOAuth.assertCoreConfigured();
    if (!this.config.get('google.redirectUri')) {
      throw new ServiceUnavailableException(
        'GA4 integration is not configured. Set GOOGLE_REDIRECT_URI.',
      );
    }
  }

  /**
   * Role-based campaign access — same relational scoping pattern as CampaignsService.
   * Public so Ga4Controller can use it if needed.
   */
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
