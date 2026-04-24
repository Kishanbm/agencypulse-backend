import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [BillingModule, AuditModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService], // exported for use in TeamModule (client user invites — Phase 2.3)
})
export class ClientsModule {}
