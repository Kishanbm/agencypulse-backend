import {
  Controller, Get, Post, Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { BrowseTemplatesDto } from './dto/browse-templates.dto';
import { CloneTemplateDto } from './dto/clone-template.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // ─── Browse system templates (Tier 1) ───────────────────────────────────────

  @Get('templates/dashboards')
  @ApiOperation({ summary: 'Browse public dashboard templates' })
  browseDashboards(@Query() query: BrowseTemplatesDto) {
    return this.templatesService.browseDashboardTemplates(query);
  }

  @Get('templates/reports')
  @ApiOperation({ summary: 'Browse public report templates' })
  browseReports(@Query() query: BrowseTemplatesDto) {
    return this.templatesService.browseReportTemplates(query);
  }

  @Get('templates/dashboards/:id')
  @ApiOperation({ summary: 'Get a single dashboard template with widget snapshot' })
  getDashboard(@Param('id') id: string) {
    return this.templatesService.getDashboardTemplate(id);
  }

  @Get('templates/reports/:id')
  @ApiOperation({ summary: 'Get a single report template with sections snapshot' })
  getReport(@Param('id') id: string) {
    return this.templatesService.getReportTemplate(id);
  }

  // ─── Clone (creates real dashboard/report on caller's campaign) ─────────────

  @Post('templates/dashboards/:id/clone')
  @ApiOperation({ summary: 'Clone a dashboard template into one of your campaigns' })
  cloneDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloneTemplateDto,
  ) {
    return this.templatesService.cloneDashboardTemplate(user, id, dto);
  }

  @Post('templates/reports/:id/clone')
  @ApiOperation({ summary: 'Clone a report template into one of your campaigns' })
  cloneReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloneTemplateDto,
  ) {
    return this.templatesService.cloneReportTemplate(user, id, dto);
  }

  // ─── Save existing as template (Tier 2 — private to agency) ────────────────

  @Post('clients/:clientId/campaigns/:campaignId/dashboards/:dashboardId/save-as-template')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a dashboard as a reusable template (admin only)' })
  saveDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() dto: SaveAsTemplateDto,
  ) {
    return this.templatesService.saveDashboardAsTemplate(user, clientId, campaignId, dashboardId, dto);
  }

  @Post('clients/:clientId/campaigns/:campaignId/reports/:reportId/save-as-template')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a report as a reusable template (admin only)' })
  saveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('reportId') reportId: string,
    @Body() dto: SaveAsTemplateDto,
  ) {
    return this.templatesService.saveReportAsTemplate(user, clientId, campaignId, reportId, dto);
  }

  // ─── List agency's private templates ────────────────────────────────────────

  @Get('agencies/me/templates/dashboards')
  @ApiOperation({ summary: 'List your agency private dashboard templates' })
  listAgencyDashboards(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.listAgencyDashboardTemplates(user);
  }

  @Get('agencies/me/templates/reports')
  @ApiOperation({ summary: 'List your agency private report templates' })
  listAgencyReports(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.listAgencyReportTemplates(user);
  }
}
