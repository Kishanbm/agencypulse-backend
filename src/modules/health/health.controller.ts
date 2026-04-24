import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Health')
@ApiBearerAuth()
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('clients/:clientId/campaigns/:campaignId/health')
  @ApiOperation({ summary: 'Get integration health for a single campaign' })
  getCampaignHealth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.healthService.getCampaignHealth(user, clientId, campaignId);
  }

  @Get('agencies/health')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get integration health summary across all campaigns' })
  getAgencyHealth(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.getAgencyHealth(user);
  }
}
