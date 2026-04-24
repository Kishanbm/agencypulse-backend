import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── Reports ───────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a report for a campaign' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(user, campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all reports for a campaign' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.reportsService.findAll(user, campaignId);
  }

  @Get(':reportId')
  @ApiOperation({ summary: 'Get a single report with its schedules' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.reportsService.findOne(user, campaignId, reportId);
  }

  @Patch(':reportId')
  @ApiOperation({ summary: 'Update report name, sections, or status' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.update(user, campaignId, reportId, dto);
  }

  @Delete(':reportId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a report' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.reportsService.softDelete(user, campaignId, reportId);
  }

  // ─── Schedules ─────────────────────────────────────────────────────────────

  @Post(':reportId/schedules')
  @ApiOperation({ summary: 'Create a delivery schedule for a report' })
  createSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.reportsService.createSchedule(user, campaignId, reportId, dto);
  }

  @Get(':reportId/schedules')
  @ApiOperation({ summary: 'List all schedules for a report' })
  findSchedules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.reportsService.findSchedules(user, campaignId, reportId);
  }

  @Patch(':reportId/schedules/:scheduleId')
  @ApiOperation({ summary: 'Update a schedule (change cron, recipients, or pause/resume)' })
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.reportsService.updateSchedule(user, campaignId, reportId, scheduleId, dto);
  }

  @Delete(':reportId/schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule' })
  deleteSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.reportsService.deleteSchedule(user, campaignId, reportId, scheduleId);
  }

  // ─── PDF generation ────────────────────────────────────────────────────────

  @Post(':reportId/generate')
  @ApiOperation({ summary: 'Generate PDF for a report and store in object storage' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Date range in days (default 30)' })
  generatePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Query('days') days?: string,
  ) {
    return this.reportsService.generatePdf(user, campaignId, reportId, days ? parseInt(days, 10) : 30);
  }

  // ─── Share links ────────────────────────────────────────────────────────────

  @Post(':reportId/share-links')
  @ApiOperation({ summary: 'Create a shareable link for a report' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Link expiry in days (default 7)' })
  createShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Query('days') days?: string,
  ) {
    return this.reportsService.createShareLink(user, campaignId, reportId, days ? parseInt(days, 10) : 7);
  }

  @Get(':reportId/share-links')
  @ApiOperation({ summary: 'List active share links for a report' })
  findShareLinks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.reportsService.findShareLinks(user, campaignId, reportId);
  }

  @Delete(':reportId/share-links/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a share link' })
  revokeShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.reportsService.revokeShareLink(user, campaignId, reportId, linkId);
  }

  // ─── Delivery history ──────────────────────────────────────────────────────

  @Get(':reportId/deliveries')
  @ApiOperation({ summary: 'List delivery history for a report (last 50)' })
  findDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.reportsService.findDeliveries(user, campaignId, reportId);
  }
}
