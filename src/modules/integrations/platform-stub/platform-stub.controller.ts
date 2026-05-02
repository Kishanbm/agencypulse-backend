import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Redirect,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { PLATFORM_CATALOG } from '../platform-catalog.constants';
import { OAUTH_PLATFORM_CONFIGS } from './platform-oauth-configs.constants';
import { StandardOAuthService } from './standard-oauth.service';
import { StandardApiKeyService } from './standard-api-key.service';
import { PlatformAuthUrlDto } from './dto/auth-url-query.dto';
import { OAuthCallbackDto } from './dto/oauth-callback-query.dto';
import { ApiKeyConnectDto } from './dto/api-key-connect.dto';

/**
 * Catch-all integration controller for all platforms not yet implemented in
 * dedicated modules.
 *
 * Registered LAST in app.module.ts — NestJS matches specific platform routes
 * (e.g. /integrations/ga4/auth-url) before reaching these wildcard handlers.
 *
 * OAuth platforms: full auth-url → callback flow works as soon as credentials
 * are added to .env.
 * API-key platforms: POST /connect stores the encrypted key immediately.
 *
 * When a platform gets a dedicated module, remove it from OAUTH_PLATFORM_CONFIGS
 * and its route is handled there instead.
 */
@ApiTags('integrations')
@Controller('integrations')
export class PlatformStubController {
  constructor(
    private readonly oauthService: StandardOAuthService,
    private readonly apiKeyService: StandardApiKeyService,
  ) {}

  // ─── OAuth: generate auth URL ─────────────────────────────────────────────

  @Get(':platform/auth-url')
  @Roles(UserRole.AGENCY_ADMIN, UserRole.AGENCY_OWNER, UserRole.PLATFORM_OWNER)
  @ApiOperation({ summary: 'Generate OAuth authorization URL for the given platform.' })
  @ApiParam({ name: 'platform', type: String })
  async authUrl(
    @Param('platform') platformSlug: string,
    @Query() dto: PlatformAuthUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const platform = this.resolvePlatform(platformSlug);
    return this.oauthService.generateAuthUrl(platform, user, dto.campaignId, dto.shopDomain);
  }

  // ─── OAuth: callback ──────────────────────────────────────────────────────

  @Get(':platform/callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'OAuth callback — exchanges code and stores tokens.' })
  @ApiParam({ name: 'platform', type: String })
  async callback(
    @Param('platform') platformSlug: string,
    @Query() dto: OAuthCallbackDto,
  ) {
    if (dto.error) {
      throw new BadRequestException(
        `OAuth denied by user or provider: ${dto.error} — ${dto.error_description ?? ''}`,
      );
    }

    const platform = this.resolvePlatform(platformSlug);
    const redirectUrl = await this.oauthService.handleCallback(
      platform,
      dto.code,
      dto.auth_code,
      dto.state,
      { context: dto.context, shopDomain: dto.shop },
    );
    return { url: redirectUrl };
  }

  // ─── API key: connect ─────────────────────────────────────────────────────

  @Post(':platform/connect')
  @Roles(UserRole.AGENCY_ADMIN, UserRole.AGENCY_OWNER, UserRole.PLATFORM_OWNER)
  @ApiOperation({ summary: 'Connect an API-key platform.' })
  @ApiParam({ name: 'platform', type: String })
  async connect(
    @Param('platform') platformSlug: string,
    @Body() dto: ApiKeyConnectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const platform = this.resolvePlatform(platformSlug);
    return this.apiKeyService.connect(platform, user, dto.campaignId, dto.apiKey, {
      apiUrl: dto.apiUrl,
      accessId: dto.accessId,
      externalAccountId: dto.externalAccountId,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private resolvePlatform(slug: string): IntegrationPlatform {
    // Accept either lowercase-hyphenated slug (e.g. 'microsoft-ads') or
    // the raw enum key (e.g. 'MICROSOFT_ADS') for flexibility.
    const normalized = slug.toUpperCase().replace(/-/g, '_');
    const meta = PLATFORM_CATALOG.find((p) => p.key === normalized);
    if (!meta) {
      throw new BadRequestException(`Unknown integration platform: ${slug}`);
    }

    // Verify the platform is actually handled by this stub (not a dedicated module)
    // OAuth platforms must have a config entry; API-key platforms are always accepted.
    if (meta.authType === 'OAUTH' || meta.authType === 'BOTH') {
      if (!OAUTH_PLATFORM_CONFIGS.has(meta.key)) {
        throw new BadRequestException(
          `${meta.name} uses a dedicated integration module — this endpoint should not be reached.`,
        );
      }
    }

    return meta.key;
  }
}
