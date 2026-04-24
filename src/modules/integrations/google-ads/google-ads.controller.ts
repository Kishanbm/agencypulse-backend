import { Controller, Get, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { GoogleAdsAuthUrlDto } from './dto/google-ads-auth-url.dto';
import { GoogleAdsCallbackDto } from './dto/google-ads-callback.dto';
import { GoogleAdsCustomersQueryDto } from './dto/google-ads-customers-query.dto';

@ApiTags('integrations / google-ads')
@Controller('integrations/google-ads')
export class GoogleAdsController {
  constructor(private readonly googleAdsOAuthService: GoogleAdsOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate Google OAuth URL to connect Google Ads.' })
  authUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GoogleAdsAuthUrlDto,
  ) {
    return this.googleAdsOAuthService.generateAuthUrl(user, dto.campaignId);
  }

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'Google Ads OAuth callback — stores tokens, redirects to frontend.' })
  async callback(@Query() dto: GoogleAdsCallbackDto) {
    const redirectUrl = await this.googleAdsOAuthService.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  @Get('customers')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List Google Ads customer accounts for the connected integration.' })
  customers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: GoogleAdsCustomersQueryDto,
  ) {
    return this.googleAdsOAuthService.listCustomersForCampaign(user, dto.campaignId);
  }
}
