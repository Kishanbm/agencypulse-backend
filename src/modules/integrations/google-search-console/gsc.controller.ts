import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { GscOAuthService } from './gsc-oauth.service';
import { GscAuthUrlDto } from './dto/gsc-auth-url.dto';
import { GscCallbackDto } from './dto/gsc-callback.dto';
import { GscSelectSiteDto } from './dto/gsc-select-site.dto';

@ApiTags('integrations / google-search-console')
@Controller('integrations/google-search-console')
export class GscController {
  constructor(private readonly gscOAuth: GscOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate Google OAuth URL to connect Search Console.' })
  authUrl(@CurrentUser() user: AuthenticatedUser, @Query() dto: GscAuthUrlDto) {
    return this.gscOAuth.generateAuthUrl(user, dto.campaignId);
  }

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'GSC OAuth callback — exchanges tokens, redirects to frontend.' })
  async callback(@Query() dto: GscCallbackDto) {
    const redirectUrl = await this.gscOAuth.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  @Get('sites')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List Search Console sites accessible on the connected account.' })
  sites(@CurrentUser() user: AuthenticatedUser, @Query() dto: GscAuthUrlDto) {
    return this.gscOAuth.listSitesForCampaign(user, dto.campaignId);
  }

  @Post('select-site')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Save a verified GSC site URL as the active property for a campaign.' })
  selectSite(@CurrentUser() user: AuthenticatedUser, @Body() dto: GscSelectSiteDto) {
    return this.gscOAuth.selectSite(user, dto.campaignId, dto.siteUrl);
  }
}
