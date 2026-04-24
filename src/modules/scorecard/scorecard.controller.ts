import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ScorecardService } from './scorecard.service';
import { ScorecardQueryDto } from './dto/scorecard-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Scorecard')
@ApiBearerAuth()
@Controller('clients/:clientId/campaigns/:campaignId/scorecard')
export class ScorecardController {
  constructor(private readonly scorecardService: ScorecardService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get period-over-period scorecard for a campaign' })
  getScorecard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Query() query: ScorecardQueryDto,
  ) {
    return this.scorecardService.getScorecard(user, clientId, campaignId, query);
  }
}
