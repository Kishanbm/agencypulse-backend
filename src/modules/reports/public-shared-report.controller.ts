import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports (Public)')
@Controller('reports/shared')
export class PublicSharedReportController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':token')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 req/min per IP on public endpoint
  @ApiOperation({
    summary: 'View a shared report (no auth required)',
    description: 'Validates the share token — checks it is not revoked or expired, then returns the report data and a signed PDF download URL.',
  })
  getSharedReport(@Param('token') token: string) {
    return this.reportsService.getSharedReport(token);
  }
}
