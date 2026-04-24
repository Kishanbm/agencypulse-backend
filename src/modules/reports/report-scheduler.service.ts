import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { parseExpression } from 'cron-parser';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { REPORT_QUEUE, REPORT_JOB_GENERATE } from './constants/report-queue.constants';
import { ReportGenerationJobPayload } from './processors/report-generation.processor';

// Check for due schedules every 5 minutes
const SCHEDULER_CRON = '*/5 * * * *';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    private readonly systemPrisma: SystemPrismaService,
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
  ) {}

  @Cron(SCHEDULER_CRON)
  async dispatchDueSchedules(): Promise<void> {
    const now = new Date();

    // Query across all tenants (SystemPrismaService bypasses RLS)
    const dueSchedules = await this.systemPrisma.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      select: {
        id: true,
        cronExpression: true,
        reportId: true,
        dateRangeDays: true,
        recipientEmails: true,
        report: {
          select: {
            id: true,
            tenantId: true,
            campaignId: true,
            name: true,
            deletedAt: true,
            tenant: { select: { name: true } },
          },
        },
      },
      take: 200, // cap per cycle
    });

    if (dueSchedules.length === 0) return;

    this.logger.log(`Dispatching ${dueSchedules.length} due report schedules`);

    const to = this.dateStr(now);

    let dispatched = 0;
    for (const schedule of dueSchedules) {
      const { report } = schedule;

      // Skip if report was deleted
      if (!report || report.deletedAt) {
        await this.systemPrisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { isActive: false },
        });
        continue;
      }

      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - schedule.dateRangeDays);
      const from = this.dateStr(fromDate);

      const dateStr = this.dateStr(now);
      // jobId deduplication: same schedule cannot run twice on the same day (AI review fix)
      const jobId = `${report.id}:${schedule.id}:${dateStr}`;

      const payload: ReportGenerationJobPayload = {
        tenantId: report.tenantId,
        reportId: report.id,
        campaignId: report.campaignId,
        scheduleId: schedule.id,
        from,
        to,
        recipientEmails: schedule.recipientEmails,
        agencyName: report.tenant.name,
      };

      try {
        // Advance nextRunAt BEFORE enqueuing — prevents re-dispatch on next 5-min tick
        // even if the worker crashes mid-job. jobId still deduplicates within the same day.
        const nextRunAt = this.nextCronDate(schedule.cronExpression);
        await this.systemPrisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { nextRunAt },
        });

        await this.reportQueue.add(REPORT_JOB_GENERATE, payload, {
          jobId,              // prevents duplicate execution within the same date
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { age: 7 * 24 * 3600 },
        });
        dispatched++;
      } catch (err) {
        this.logger.error(`Failed to enqueue report job ${jobId}: ${String(err)}`);
      }
    }

    this.logger.log(`Enqueued ${dispatched}/${dueSchedules.length} report jobs`);
  }

  private dateStr(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private nextCronDate(cronExpression: string): Date {
    return parseExpression(cronExpression, { utc: true }).next().toDate();
  }
}
