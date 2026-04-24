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
import { MetaAdsApiService, normalizeAdAccountId } from './meta-ads-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// Long-lived Meta tokens last ~60 days
const META_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;

@Injectable()
export class MetaAdsOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly oauthState: OAuthStateService,
    private readonly metaAdsApiService: MetaAdsApiService,
  ) {}

  // ─── Generate auth URL ─────────────────────────────────────────────────────

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
      platform: IntegrationPlatform.META_ADS,
    });

    const params = new URLSearchParams({
      client_id: this.config.get<string>('meta.appId')!,
      redirect_uri: this.config.get<string>('meta.redirectUri')!,
      scope: 'ads_read,ads_management',
      state,
      response_type: 'code',
    });

    return {
      authUrl: `https://www.facebook.com/dialog/oauth?${params.toString()}`,
    };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // Public endpoint — no JWT context. TenantContextService.run() sets tenant
  // context for all DB operations.
  //
  // Meta token flow:
  //   1. Exchange code → short-lived user token (~1 hour)
  //   2. Immediately exchange → long-lived user token (~60 days)
  //   3. Store long-lived token with tokenExpiresAt = now + 60 days
  //   4. NO refresh token — user must re-connect when expired
  //
  // Fix (AI review): Re-validates campaign + client (deletedAt=null) before storing.
  // Fix (AI review): Redirect to FRONTEND_URL from config only.

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.oauthState.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.META_ADS) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    // Step 1: Exchange code for short-lived token
    const shortLivedToken = await this.exchangeCode(code);

    // Step 2: Exchange short-lived → long-lived (~60 days)
    const longLivedTokenResponse =
      await this.metaAdsApiService.exchangeForLongLivedToken(shortLivedToken);

    // Use expires_in from Meta response if available, otherwise default to 60 days
    const tokenExpiresAt = longLivedTokenResponse.expires_in
      ? new Date(Date.now() + longLivedTokenResponse.expires_in * 1000)
      : new Date(Date.now() + META_TOKEN_TTL_MS);

    await this.tenantContext.run(state.tenantId, async () => {
      // Fix (AI review): Re-validate campaign AND client are still active
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

      // Meta has no refresh token — only accessToken stored
      await this.integrationsService.storeTokens(
        state.tenantId,
        campaign.id,
        IntegrationPlatform.META_ADS,
        {
          accessToken: longLivedTokenResponse.access_token,
          // No refreshToken — Meta does not issue one
          tokenExpiresAt,
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/campaigns/${state.campaignId}?connected=meta-ads`;
  }

  // ─── List ad accounts ─────────────────────────────────────────────────────

  async listAdAccountsForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.metaAdsApiService.listAdAccounts(accessToken);
  }

  // ─── Select and save ad account ───────────────────────────────────────────
  // Fix (AI review): Validates adAccountId exists in Meta's API response
  // before saving — prevents spoofing another user's ad account.

  async selectAdAccount(
    user: AuthenticatedUser,
    campaignId: string,
    adAccountId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    const normalizedId = normalizeAdAccountId(adAccountId);

    // Fix (AI review): Verify adAccountId belongs to the connected user's account
    const accounts = await this.metaAdsApiService.listAdAccounts(accessToken);
    const accountExists = accounts.some((a) => a.id === normalizedId);

    if (!accountExists) {
      throw new BadRequestException(
        'The selected ad account is not accessible with the connected Meta credentials.',
      );
    }

    // Update externalAccountId on the existing connection
    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.META_ADS,
      {
        // No new tokens — only updating externalAccountId
        accessToken: accessToken,
        externalAccountId: normalizedId,
      },
    );
  }

  // ─── Get valid access token ───────────────────────────────────────────────
  // Fix 5 (AI review): Proactive expiry check — throws BEFORE making any API
  // call with an expired token. Meta has no silent refresh — user must re-connect.

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.META_ADS,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('Meta Ads is not connected for this campaign.');
    }

    // Fix 5: Proactive expiry check — fail fast with a clear message
    if (tokens.tokenExpiresAt && tokens.tokenExpiresAt <= new Date()) {
      // Mark as expired in DB so the UI can show the correct status
      await this.prisma.integrationConnection.updateMany({
        where: {
          campaignId,
          platform: IntegrationPlatform.META_ADS,
          tenantId,
        },
        data: { status: ConnectionStatus.EXPIRED },
      });

      throw new BadRequestException(
        'Meta Ads token has expired. Re-connect the integration from the campaign settings.',
      );
    }

    return tokens.accessToken;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async exchangeCode(code: string): Promise<string> {
    this.assertConfigured();

    const params = new URLSearchParams({
      client_id: this.config.get<string>('meta.appId')!,
      client_secret: this.config.get<string>('meta.appSecret')!,
      redirect_uri: this.config.get<string>('meta.redirectUri')!,
      code,
    });

    const response = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to exchange authorization code with Meta. Please try again.',
      );
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  private assertConfigured(): void {
    if (
      !this.config.get('meta.appId') ||
      !this.config.get('meta.appSecret') ||
      !this.config.get('meta.redirectUri')
    ) {
      throw new ServiceUnavailableException(
        'Meta Ads integration is not configured. Set META_APP_ID, META_APP_SECRET, and META_ADS_REDIRECT_URI.',
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
