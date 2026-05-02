import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalSummaryService } from './portal-summary.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Portal')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/portal-summary')
export class PortalSummaryController {
  constructor(private readonly service: PortalSummaryService) {}

  // No @Roles guard — JwtAuthGuard protects it; service assertCampaignAccess
  // handles all 5 roles (OWNER, ADMIN, STAFF, CLIENT_USER, SUPER_ADMIN).
  @Get()
  @ApiOperation({ summary: 'Portal KPI summary for a campaign (all roles)' })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.service.getSummary(user, campaignId);
  }
}
