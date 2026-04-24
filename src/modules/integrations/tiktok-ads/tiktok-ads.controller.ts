import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { TiktokAdsOAuthService } from './tiktok-ads-oauth.service';
import { TiktokAdsAuthUrlDto } from './dto/tiktok-ads-auth-url.dto';
import { TiktokAdsCallbackDto } from './dto/tiktok-ads-callback.dto';
import { TiktokAdsSelectAccountDto } from './dto/tiktok-ads-select-account.dto';

@ApiTags('integrations / tiktok-ads')
@Controller('integrations/tiktok-ads')
export class TiktokAdsController {
  constructor(private readonly tiktokOAuth: TiktokAdsOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate TikTok OAuth URL to connect TikTok Ads.' })
  authUrl(@CurrentUser() user: AuthenticatedUser, @Query() dto: TiktokAdsAuthUrlDto) {
    return this.tiktokOAuth.generateAuthUrl(user, dto.campaignId);
  }

  // TikTok callback uses "auth_code" query param (not "code") — handled by TiktokAdsCallbackDto.
  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'TikTok Ads OAuth callback — exchanges auth_code, redirects to frontend.' })
  async callback(@Query() dto: TiktokAdsCallbackDto) {
    const redirectUrl = await this.tiktokOAuth.handleCallback(dto.auth_code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  @Get('advertisers')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List TikTok advertiser accounts accessible on the connected token.' })
  advertisers(@CurrentUser() user: AuthenticatedUser, @Query() dto: TiktokAdsAuthUrlDto) {
    return this.tiktokOAuth.listAdvertisersForCampaign(user, dto.campaignId);
  }

  @Post('select-advertiser')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Attach a validated TikTok advertiser account to a campaign integration.' })
  selectAdvertiser(@CurrentUser() user: AuthenticatedUser, @Body() dto: TiktokAdsSelectAccountDto) {
    return this.tiktokOAuth.selectAdvertiser(user, dto.campaignId, dto.advertiserId);
  }
}
