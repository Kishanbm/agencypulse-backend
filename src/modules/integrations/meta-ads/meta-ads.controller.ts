import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MetaAdsOAuthService } from './meta-ads-oauth.service';
import { MetaAdsAuthUrlDto } from './dto/meta-ads-auth-url.dto';
import { MetaAdsCallbackDto } from './dto/meta-ads-callback.dto';
import { MetaAdsAdAccountsQueryDto } from './dto/meta-ads-ad-accounts-query.dto';
import { MetaAdsSelectAccountDto } from './dto/meta-ads-select-account.dto';

@ApiTags('integrations / meta-ads')
@Controller('integrations/meta-ads')
export class MetaAdsController {
  constructor(private readonly metaAdsOAuthService: MetaAdsOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate Facebook OAuth URL to connect Meta Ads.' })
  authUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: MetaAdsAuthUrlDto,
  ) {
    return this.metaAdsOAuthService.generateAuthUrl(user, dto.campaignId);
  }

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'Meta Ads OAuth callback — exchanges tokens, redirects to frontend.' })
  async callback(@Query() dto: MetaAdsCallbackDto) {
    const redirectUrl = await this.metaAdsOAuthService.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  // Lists all Meta Ad Accounts accessible to the connected user.
  // User picks one, then calls select-account to save it.
  @Get('ad-accounts')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List Meta Ad Accounts available on the connected account.' })
  adAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: MetaAdsAdAccountsQueryDto,
  ) {
    return this.metaAdsOAuthService.listAdAccountsForCampaign(user, dto.campaignId);
  }

  // Validates the selected adAccountId belongs to the connected user's Meta account,
  // then saves it as externalAccountId on the IntegrationConnection.
  // Fix (AI review): adAccountId is verified against Meta API — never trusted blindly.
  @Post('select-account')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Attach a validated Meta Ad Account to a campaign integration.' })
  selectAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MetaAdsSelectAccountDto,
  ) {
    return this.metaAdsOAuthService.selectAdAccount(user, dto.campaignId, dto.adAccountId);
  }
}
