import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { SYNC_QUEUE } from '../sync/constants/sync-queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: SYNC_QUEUE }), BillingModule, AuditModule, DashboardsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  // Export IntegrationsService so BullMQ workers (Phase 3.5) can inject it
  // to call getDecryptedTokens() during data sync jobs.
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
