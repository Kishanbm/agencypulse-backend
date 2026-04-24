import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { YoutubeOAuthService } from './youtube-oauth.service';
import { YoutubeAuthUrlDto } from './dto/youtube-auth-url.dto';
import { YoutubeCallbackDto } from './dto/youtube-callback.dto';
import { YoutubeSelectChannelDto } from './dto/youtube-select-channel.dto';

@ApiTags('integrations / youtube')
@Controller('integrations/youtube')
export class YoutubeController {
  constructor(private readonly youtubeOAuth: YoutubeOAuthService) {}

  @Get('auth-url')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Generate Google OAuth URL to connect YouTube Analytics.' })
  authUrl(@CurrentUser() user: AuthenticatedUser, @Query() dto: YoutubeAuthUrlDto) {
    return this.youtubeOAuth.generateAuthUrl(user, dto.campaignId);
  }

  @Get('callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'YouTube OAuth callback — exchanges tokens, redirects to frontend.' })
  async callback(@Query() dto: YoutubeCallbackDto) {
    const redirectUrl = await this.youtubeOAuth.handleCallback(dto.code, dto.state);
    return { url: redirectUrl, statusCode: 302 };
  }

  @Get('channels')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'List YouTube channels accessible on the connected account.' })
  channels(@CurrentUser() user: AuthenticatedUser, @Query() dto: YoutubeAuthUrlDto) {
    return this.youtubeOAuth.listChannelsForCampaign(user, dto.campaignId);
  }

  @Post('select-channel')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Attach a validated YouTube channel to a campaign integration.' })
  selectChannel(@CurrentUser() user: AuthenticatedUser, @Body() dto: YoutubeSelectChannelDto) {
    return this.youtubeOAuth.selectChannel(user, dto.campaignId, dto.channelId);
  }
}
