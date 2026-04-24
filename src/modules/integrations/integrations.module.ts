import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [BillingModule, AuditModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  // Export IntegrationsService so BullMQ workers (Phase 3.5) can inject it
  // to call getDecryptedTokens() during data sync jobs.
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
