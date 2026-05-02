import { Module } from '@nestjs/common';
import { PortalSummaryController } from './portal-summary.controller';
import { PortalSummaryService } from './portal-summary.service';

@Module({
  controllers: [PortalSummaryController],
  providers:   [PortalSummaryService],
})
export class PortalModule {}
