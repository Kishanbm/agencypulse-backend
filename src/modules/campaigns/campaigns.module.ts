import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DashboardsModule, AuditModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
