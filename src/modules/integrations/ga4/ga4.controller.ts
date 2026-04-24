import {
  Controller,
  Get,
  Query,
  Redirect,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { Ga4OAuthService } from './ga4-oauth.service';
import { Ga4AuthUrlDto } from './dto/ga4-auth-url.dto';
import { Ga4CallbackDto } from './dto/ga4-callback.dto';
import { Ga4PropertiesQueryDto } from './dto/ga4-properties-query.dto';

@ApiTags('integrations / ga4')
@Controller('integrations/ga4')
export class Ga4Controller {
  constructor(private readonly ga4OAuthService: Ga4OAuthService) {}

  // ─── Step 1: Get the Google OAuth URL ─────────────────────────────────────
  // Frontend calls this, then redirects the browser to the returned authUrl.
  // Fix 3: only campaignId accepted — clientId derived internally from DB.

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate Google OAuth URL to connect GA4.' })
  authUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: Ga4AuthUrlDto,
  ) {
    return this.ga4OAuthService.generateAuthUrl(user, dto.campaignId);
  }

  // ─── Step 2: OAuth callback from Google ───────────────────────────────────
  // Google redirects here after user consents. @Public() — no JWT exists yet.
  // Verifies state JWT, validates campaign, exchanges code, stores tokens,
  // then redirects browser to FRONTEND_URL (Fix 4 — never user-supplied URL).

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'Google OAuth callback — stores tokens, redirects to frontend.' })
  async callback(@Query() dto: Ga4CallbackDto) {
    const redirectUrl = await this.ga4OAuthService.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  // ─── Step 3: List GA4 properties for the connected account ────────────────
  // After OAuth, user picks which GA4 property to attach to this campaign.
  // Then frontend calls PUT /clients/:clientId/campaigns/:campaignId/integrations
  // with { platform: GA4, externalAccountId: selectedPropertyId }.

  @Get('properties')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List GA4 properties available on the connected account.' })
  properties(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: Ga4PropertiesQueryDto,
  ) {
    return this.ga4OAuthService.listPropertiesForCampaign(user, dto.campaignId);
  }
}
