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
import { YoutubeApiService } from './youtube-api.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// YouTube scopes:
//   yt-analytics.readonly — read channel analytics
//   youtube.readonly      — list channels (needed to discover channelId)
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

@Injectable()
export class YoutubeOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly youtubeApi: YoutubeApiService,
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

    const state = this.googleOAuth.signState({
      campaignId,
      clientId: campaign.clientId,
      tenantId: user.tenantId,
      userId: user.id,
      platform: IntegrationPlatform.YOUTUBE_ANALYTICS,
    });

    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId')!,
      redirect_uri: this.config.get<string>('youtube.redirectUri')!,
      response_type: 'code',
      scope: YOUTUBE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  async handleCallback(code: string, rawState: string): Promise<string> {
    this.assertConfigured();

    const state = this.googleOAuth.verifyState(rawState);

    if (state.platform !== IntegrationPlatform.YOUTUBE_ANALYTICS) {
      throw new BadRequestException('Invalid OAuth state: platform mismatch.');
    }

    const tokenResponse = await this.googleOAuth.exchangeCode(
      code,
      this.config.get<string>('youtube.redirectUri')!,
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
        IntegrationPlatform.YOUTUBE_ANALYTICS,
        {
          accessToken: tokenResponse.access_token,
          ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
          tokenExpiresAt,
          scopes: tokenResponse.scope,
        },
      );
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=youtube`;
  }

  async getValidAccessToken(tenantId: string, campaignId: string): Promise<string> {
    const tokens = await this.integrationsService.getDecryptedTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.YOUTUBE_ANALYTICS,
    );

    if (!tokens?.accessToken) {
      throw new BadRequestException('YouTube Analytics is not connected for this campaign.');
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
      (await this.integrationsService.getDecryptedTokens(tenantId, campaignId, IntegrationPlatform.YOUTUBE_ANALYTICS))?.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException(
        'No refresh token for YouTube Analytics. Re-connect the integration.',
      );
    }

    const { accessToken, tokenExpiresAt } = await this.googleOAuth.refreshAccessToken(
      refreshToken,
      this.config.get<string>('youtube.redirectUri')!,
    );

    await this.integrationsService.storeTokens(
      tenantId,
      campaignId,
      IntegrationPlatform.YOUTUBE_ANALYTICS,
      { accessToken, tokenExpiresAt },
    );

    return { accessToken, tokenExpiresAt };
  }

  async listChannelsForCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);
    return this.youtubeApi.listChannels(accessToken);
  }

  async selectChannel(
    user: AuthenticatedUser,
    campaignId: string,
    channelId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const accessToken = await this.getValidAccessToken(user.tenantId, campaign.id);

    // Verify the channelId belongs to this user
    const channels = await this.youtubeApi.listChannels(accessToken);
    const channelExists = channels.some((c) => c.id === channelId);

    if (!channelExists) {
      throw new BadRequestException(
        'The selected channel is not accessible with the connected Google credentials.',
      );
    }

    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      IntegrationPlatform.YOUTUBE_ANALYTICS,
      { accessToken, externalAccountId: channelId },
    );
  }

  private assertConfigured(): void {
    this.googleOAuth.assertCoreConfigured();
    if (!this.config.get('youtube.redirectUri')) {
      throw new ServiceUnavailableException(
        'YouTube Analytics integration is not configured. Set YOUTUBE_REDIRECT_URI.',
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
