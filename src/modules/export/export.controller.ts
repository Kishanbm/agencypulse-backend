import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ExportService } from './export.service';
import { ExportQueryDto } from './dto/export-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('clients/:clientId/campaigns/:campaignId/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Export time-series metric data as CSV or XLSX' })
  exportTimeSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.exportService.export(user, clientId, campaignId, query, res);
  }

  @Get('summary')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Export KPI summary totals as CSV or XLSX' })
  exportSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.exportService.exportSummary(user, clientId, campaignId, query, res);
  }
}
