import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { AmazonAdsOAuthService } from './amazon-ads-oauth.service';
import { AmazonAdsAuthUrlDto } from './dto/amazon-ads-auth-url.dto';
import { AmazonAdsCallbackDto } from './dto/amazon-ads-callback.dto';
import { AmazonAdsSelectProfileDto } from './dto/amazon-ads-select-profile.dto';

@ApiTags('integrations / amazon-ads')
@Controller('integrations/amazon-ads')
export class AmazonAdsController {
  constructor(private readonly amazonOAuth: AmazonAdsOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate Login with Amazon OAuth URL to connect Amazon Ads.' })
  authUrl(@CurrentUser() user: AuthenticatedUser, @Query() dto: AmazonAdsAuthUrlDto) {
    return this.amazonOAuth.generateAuthUrl(user, dto.campaignId);
  }

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'Amazon Ads OAuth callback — exchanges tokens, redirects to frontend.' })
  async callback(@Query() dto: AmazonAdsCallbackDto) {
    const redirectUrl = await this.amazonOAuth.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  @Get('profiles')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List Amazon Advertising profiles accessible on the connected account.' })
  profiles(@CurrentUser() user: AuthenticatedUser, @Query() dto: AmazonAdsAuthUrlDto) {
    return this.amazonOAuth.listProfilesForCampaign(user, dto.campaignId);
  }

  @Post('select-profile')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Attach a validated Amazon Advertising profile to a campaign integration.' })
  selectProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: AmazonAdsSelectProfileDto) {
    return this.amazonOAuth.selectProfile(user, dto.campaignId, dto.profileId);
  }
}
