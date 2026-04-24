import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Goals')
@ApiBearerAuth()
@Controller('clients/:clientId/campaigns/:campaignId/goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a goal for a campaign' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goalsService.create(user, clientId, campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all goals for a campaign' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.goalsService.list(user, clientId, campaignId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get progress for all goals in a campaign' })
  getCampaignProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.goalsService.getCampaignGoalsProgress(user, clientId, campaignId);
  }

  @Get(':goalId/progress')
  @ApiOperation({ summary: 'Get progress for a single goal' })
  getProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('goalId') goalId: string,
  ) {
    return this.goalsService.getProgress(user, clientId, campaignId, goalId);
  }

  @Patch(':goalId')
  @ApiOperation({ summary: 'Update a goal' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(user, clientId, campaignId, goalId, dto);
  }

  @Delete(':goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a goal (soft delete)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('goalId') goalId: string,
  ) {
    return this.goalsService.remove(user, clientId, campaignId, goalId);
  }
}
