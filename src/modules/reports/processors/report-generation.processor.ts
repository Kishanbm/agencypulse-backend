import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ReportRenderService } from '../report-render.service';
import { StorageService } from '../../../common/storage/storage.service';
import { EmailService } from '../../email/email.service';
import { REPORT_QUEUE, REPORT_JOB_GENERATE } from '../constants/report-queue.constants';
import { NotificationsService } from '../../notifications/notifications.service';
import { ReportSectionDto } from '../dto/section.dto';

export interface ReportGenerationJobPayload {
  tenantId: string;
  reportId: string;
  campaignId: string;
  scheduleId: string;
  from: string;
  to: string;
  recipientEmails: string[];
  agencyName: string;
}

@Processor(REPORT_QUEUE, { concurrency: 2 })
export class ReportGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly renderService: ReportRenderService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ReportGenerationJobPayload>): Promise<void> {
    const { tenantId } = job.data;
    this.logger.log(`Processing report job ${job.id} — reportId=${job.data.reportId}`);
    // Wrap in tenant context so all Prisma queries are RLS-scoped to this tenant
    await this.tenantContext.run(tenantId, () => this.runJob(job));
  }

  private async runJob(job: Job<ReportGenerationJobPayload>): Promise<void> {
    const { tenantId, reportId, campaignId, scheduleId, from, to, recipientEmails, agencyName } =
      job.data;

    // Track delivery record
    const delivery = await this.prisma.reportDelivery.create({
      data: {
        tenantId,
        reportId,
        scheduleId,
        status: 'PROCESSING',
      },
      select: { id: true },
    });

    try {
      const report = await this.prisma.report.findFirst({
        where: { id: reportId, tenantId, deletedAt: null },
        select: { id: true, name: true, sections: true },
      });

      if (!report) {
        this.logger.warn(`Report ${reportId} not found — skipping job ${job.id}`);
        await this.markDeliveryFailed(delivery.id, 'Report not found');
        return;
      }

      const sections = (report.sections as unknown as ReportSectionDto[]) ?? [];

      // Render PDF + upload to object storage
      const rendered = await this.renderService.renderAndStore(
        tenantId,
        reportId,
        campaignId,
        report.name,
        sections,
        from,
        to,
      );

      // Determine email strategy based on PDF size (AI review fix: no large attachments)
      const tooLarge = this.renderService.isTooLargeForAttachment(rendered.fileSizeBytes);
      const downloadUrl = await this.storageService.getSignedDownloadUrl(rendered.pdfUrl);

      const subject = `Report: ${report.name} (${from} — ${to})`;

      await this.emailService.sendReportDelivery(
        recipientEmails,
        subject,
        {
          agencyName,
          reportName: report.name,
          from,
          to,
          hasAttachment: !tooLarge,
          downloadUrl: tooLarge ? downloadUrl : undefined,
        },
        !tooLarge
          ? { filename: `${report.name.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: rendered.pdfBuffer }
          : undefined,
      );

      await this.prisma.reportDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', pdfUrl: rendered.pdfUrl, sentAt: new Date() },
      });

      this.logger.log(`Report ${reportId} delivered to ${recipientEmails.length} recipients`);

      void this.notifications.notifyAdmins(tenantId, {
        type: 'REPORT_READY',
        title: `Report delivered: ${report.name}`,
        message: `Scheduled report "${report.name}" for ${from} – ${to} was sent to ${recipientEmails.length} recipient(s).`,
        resourceType: 'Report',
        resourceId: reportId,
      });
    } catch (err) {
      this.logger.error(`Report job ${job.id} failed: ${String(err)}`);
      await this.markDeliveryFailed(delivery.id, String(err));
      throw err; // re-throw so BullMQ retries
    }
  }

  private async markDeliveryFailed(deliveryId: string, errorMsg: string) {
    await this.prisma.reportDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', errorMsg },
    }).catch(() => {});
  }

}
