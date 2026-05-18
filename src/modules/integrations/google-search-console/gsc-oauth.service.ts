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
import { GoogleOAuthService } from '../google/google-oauth.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class GscOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly googleOAuth: GoogleOAuthService,
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
      platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE,
    });

    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId')!,
      redirect_uri: this.config.get<string>('gsc.redirectUri')!,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // Public endpoint — no JWT context. TenantContextService.run() sets RLS tenant.

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.googleOAuth.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.GOOGLE_SEARCH_CONSOLE) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    const tokenResponse = await this.googleOAuth.exchangeCode(
      code,
      this.config.get<string>('gsc.redirectUri')!,
    );
    const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

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
        IntegrationPlatform.GOOGLE_SEARCH_CONSOLE,
        {
          accessToken: tokenResponse.access_token,
          ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
          tokenExpiresAt,
          scopes: tokenResponse.scope,
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=google-search-console`;
  }

  // ─── Get valid (non-expired) access token ─────────────────────────────────
  // Proactively refreshes if token expires within 5 minutes. Called by workers.

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.GOOGLE_SEARCH_CONSOLE,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('Google Search Console is not connected for this campaign.');
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
      (await this.integrationsService.getDecryptedTokens(tenantId, campaignId, IntegrationPlatform.GOOGLE_SEARCH_CONSOLE))?.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException(
        'No refresh token for Google Search Console. Re-connect the integration.',
      );
    }

    const { accessToken, tokenExpiresAt } = await this.googleOAuth.refreshAccessToken(
      refreshToken,
      this.config.get<string>('gsc.redirectUri')!,
    );

    await this.integrationsService.storeTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.GOOGLE_SEARCH_CONSOLE,
      { accessToken, tokenExpiresAt },
    );

    return { accessToken, tokenExpiresAt };
  }

  // ─── List sites for a campaign ────────────────────────────────────────────

  async listSitesForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadRequestException(
        `Failed to fetch Search Console sites (HTTP ${response.status}): ${body.slice(0, 400)}`,
      );
    }

    const data = await response.json() as {
      siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
    };
    return data.siteEntry ?? [];
  }

  // ─── Select and save site ─────────────────────────────────────────────────
  // Validates the siteUrl belongs to the connected user before saving.

  async selectSite(
    user: AuthenticatedUser,
    campaignId: string,
    siteUrl: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);

    // Verify siteUrl belongs to this user's account
    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to validate Search Console site ownership.');
    }

    const data = await response.json() as {
      siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
    };
    const sites = data.siteEntry ?? [];
    const siteExists = sites.some((s) => s.siteUrl === siteUrl);

    if (!siteExists) {
      throw new BadRequestException(
        'The selected site is not accessible with the connected Google credentials.',
      );
    }

    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.GOOGLE_SEARCH_CONSOLE,
      { accessToken, externalAccountId: siteUrl },
    );

    // Seed default widgets and dispatch immediate sync — same as upsertConnection does
    // when externalAccountId is set for the first time on any OAuth platform.
    // Must be awaited (not void) so it runs within the active request/RLS tenant context.
    await this.integrationsService.triggerPostConnection(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.GOOGLE_SEARCH_CONSOLE,
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertConfigured(): void {
    this.googleOAuth.assertCoreConfigured();
    if (!this.config.get('gsc.redirectUri')) {
      throw new ServiceUnavailableException(
        'Google Search Console integration is not configured. Set GOOGLE_SEARCH_CONSOLE_REDIRECT_URI.',
      );
    }
  }

  // Proactive expiry check — called by getValidAccessToken if no refresh token
  async markExpiredIfNeeded(tenantId: string, campaignId: string): Promise<void> {
    await this.prisma.integrationConnection.updateMany({
      where: { campaignId, platform: IntegrationPlatform.GOOGLE_SEARCH_CONSOLE, tenantId },
      data: { status: ConnectionStatus.EXPIRED },
    });
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
