import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('clients/:clientId/campaigns/:campaignId/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an alert for a campaign (admin only)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAlertDto,
  ) {
    return this.alertsService.create(user, clientId, campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List alerts for a campaign' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.alertsService.list(user, clientId, campaignId);
  }

  @Patch(':alertId')
  @ApiOperation({ summary: 'Update an alert (admin only)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(user, clientId, campaignId, alertId, dto);
  }

  @Delete(':alertId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert (admin only, soft delete)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertsService.remove(user, clientId, campaignId, alertId);
  }

  @Get(':alertId/events')
  @ApiOperation({ summary: 'Get alert fire history (last 100 events)' })
  getEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertsService.getEvents(user, clientId, campaignId, alertId);
  }
}
