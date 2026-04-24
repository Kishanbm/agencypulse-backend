import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    EmailModule,
    AuthModule,
    BillingModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService], // exported so Phase 2 (client invites) can reuse patterns
})
export class TeamModule {}
