import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { LinkedinAdsOAuthService } from './linkedin-ads-oauth.service';
import { LinkedinAdsAuthUrlDto } from './dto/linkedin-ads-auth-url.dto';
import { LinkedinAdsCallbackDto } from './dto/linkedin-ads-callback.dto';
import { LinkedinAdsSelectAccountDto } from './dto/linkedin-ads-select-account.dto';

@ApiTags('integrations / linkedin-ads')
@Controller('integrations/linkedin-ads')
export class LinkedinAdsController {
  constructor(private readonly linkedinOAuth: LinkedinAdsOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate LinkedIn OAuth URL to connect LinkedIn Ads.' })
  authUrl(@CurrentUser() user: AuthenticatedUser, @Query() dto: LinkedinAdsAuthUrlDto) {
    return this.linkedinOAuth.generateAuthUrl(user, dto.campaignId);
  }

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'LinkedIn Ads OAuth callback — exchanges tokens, redirects to frontend.' })
  async callback(@Query() dto: LinkedinAdsCallbackDto) {
    const redirectUrl = await this.linkedinOAuth.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  @Get('ad-accounts')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List LinkedIn Ad Accounts accessible on the connected account.' })
  adAccounts(@CurrentUser() user: AuthenticatedUser, @Query() dto: LinkedinAdsAuthUrlDto) {
    return this.linkedinOAuth.listAdAccountsForCampaign(user, dto.campaignId);
  }

  @Post('select-account')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Attach a validated LinkedIn Ad Account to a campaign integration.' })
  selectAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: LinkedinAdsSelectAccountDto) {
    return this.linkedinOAuth.selectAdAccount(user, dto.campaignId, dto.accountId);
  }
}
