import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsModule } from '../metrics/metrics.module';
import { EmailModule } from '../email/email.module';
import { DatabaseModule } from '../../database/database.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PublicSharedReportController } from './public-shared-report.controller';
import { ReportRenderService } from './report-render.service';
import { ReportSchedulerService } from './report-scheduler.service';
import { ReportGenerationProcessor } from './processors/report-generation.processor';
import { REPORT_QUEUE } from './constants/report-queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: REPORT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
    MetricsModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [ReportsController, PublicSharedReportController],
  providers: [
    ReportsService,
    ReportRenderService,
    ReportSchedulerService,
    ReportGenerationProcessor,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
