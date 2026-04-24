import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KpiService } from './kpi.service';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { CreateKpiDefinitionDto } from './dto/create-kpi-definition.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('KPI')
@ApiBearerAuth()
@Controller()
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  // ─── KPI query (per campaign) ─────────────────────────────────────────────────

  @Get('clients/:clientId/campaigns/:campaignId/kpi')
  @ApiOperation({ summary: 'Get base + derived + custom KPIs for a campaign' })
  getKpis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Query() query: KpiQueryDto,
  ) {
    return this.kpiService.getKpis(user, clientId, campaignId, query);
  }

  // ─── Custom KPI definitions (tenant-level) ────────────────────────────────────

  @Post('agencies/me/kpi-definitions')
  @ApiOperation({ summary: 'Create a custom KPI formula (admin only)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKpiDefinitionDto,
  ) {
    return this.kpiService.createDefinition(user, dto);
  }

  @Get('agencies/me/kpi-definitions')
  @ApiOperation({ summary: 'List custom KPI definitions' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('platform') platform?: string,
  ) {
    return this.kpiService.listDefinitions(user, platform as any);
  }

  @Patch('agencies/me/kpi-definitions/:defId')
  @ApiOperation({ summary: 'Update a custom KPI definition (admin only)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('defId') defId: string,
    @Body() dto: Partial<CreateKpiDefinitionDto>,
  ) {
    return this.kpiService.updateDefinition(user, defId, dto);
  }

  @Delete('agencies/me/kpi-definitions/:defId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom KPI definition (admin only)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('defId') defId: string,
  ) {
    return this.kpiService.removeDefinition(user, defId);
  }
}
