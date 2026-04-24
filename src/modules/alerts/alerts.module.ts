import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertCheckProcessor } from './processors/alert-check.processor';
import { MetricsModule } from '../metrics/metrics.module';
import { EmailModule } from '../email/email.module';
import { ALERT_CHECK_QUEUE } from './constants/alert-queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ALERT_CHECK_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 30_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { age: 3 * 24 * 3600 },
      },
    }),
    MetricsModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertCheckProcessor],
  exports: [AlertsService],
})
export class AlertsModule {}
