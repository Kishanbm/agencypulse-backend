import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingLimitsService } from './billing-limits.service';
import { BillingWebhookService } from './billing-webhook.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingLimitsService, BillingWebhookService],
  // BillingLimitsService exported so ClientsModule / TeamModule / IntegrationsModule can inject it
  exports: [BillingLimitsService],
})
export class BillingModule {}
