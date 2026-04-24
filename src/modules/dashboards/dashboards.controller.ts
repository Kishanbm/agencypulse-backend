import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DashboardsService } from './dashboards.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { BatchWidgetDataDto } from './dto/batch-widget-data.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  // ─── Dashboard CRUD ────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Create a dashboard for a campaign' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateDashboardDto,
  ) {
    return this.dashboardsService.create(user, campaignId, dto);
  }

  @Get()
  @Roles(UserRole.CLIENT_USER)
  @ApiOperation({ summary: 'List all dashboards for a campaign' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.dashboardsService.findAll(user, campaignId);
  }

  @Get(':dashboardId')
  @Roles(UserRole.CLIENT_USER)
  @ApiOperation({ summary: 'Get a single dashboard with all its widgets' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
  ) {
    return this.dashboardsService.findOne(user, campaignId, dashboardId);
  }

  @Patch(':dashboardId')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Update dashboard name or default status' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    return this.dashboardsService.update(user, campaignId, dashboardId, dto);
  }

  @Delete(':dashboardId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.AGENCY_OWNER)
  @ApiOperation({ summary: 'Soft-delete a dashboard' })
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
  ) {
    return this.dashboardsService.softDelete(user, campaignId, dashboardId);
  }

  // ─── Widget CRUD ───────────────────────────────────────────────────────────

  @Post(':dashboardId/widgets')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Add a widget to a dashboard' })
  addWidget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.dashboardsService.addWidget(user, campaignId, dashboardId, dto);
  }

  @Patch(':dashboardId/widgets/:widgetId')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Update a widget config, position, or metrics' })
  updateWidget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('widgetId', ParseUUIDPipe) widgetId: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.dashboardsService.updateWidget(user, campaignId, dashboardId, widgetId, dto);
  }

  @Delete(':dashboardId/widgets/:widgetId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Remove a widget from a dashboard (soft delete)' })
  removeWidget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('widgetId', ParseUUIDPipe) widgetId: string,
  ) {
    return this.dashboardsService.removeWidget(user, campaignId, dashboardId, widgetId);
  }

  // ─── Batch widget data ─────────────────────────────────────────────────────
  // Returns all widget data in one call — avoids N requests for N widgets.

  @Post(':dashboardId/widgets/data')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLIENT_USER)
  @ApiOperation({ summary: 'Fetch data for multiple widgets in a single request' })
  getBatchWidgetData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: BatchWidgetDataDto,
  ) {
    return this.dashboardsService.getBatchWidgetData(user, campaignId, dashboardId, dto);
  }
}
