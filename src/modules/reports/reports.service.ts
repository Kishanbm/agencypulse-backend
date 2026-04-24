import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { parseExpression } from 'cron-parser';
import { PrismaService } from '../../database/prisma.service';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { ReportRenderService } from './report-render.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '@prisma/client';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ReportSectionDto } from './dto/section.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
    private readonly renderService: ReportRenderService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Reports CRUD ──────────────────────────────────────────────────────────

  async create(user: AuthenticatedUser, campaignId: string, dto: CreateReportDto) {
    await this.assertCampaignAccess(user, campaignId);
    this.assertAdminRole(user);

    return this.prisma.report.create({
      data: {
        tenantId: user.tenantId,
        campaignId,
        name: dto.name,
        sections: (dto.sections as any) ?? [],
        createdById: user.id,
      },
      select: this.reportSelect(),
    });
  }

  async findAll(user: AuthenticatedUser, campaignId: string) {
    await this.assertCampaignAccess(user, campaignId);

    return this.prisma.report.findMany({
      where: { tenantId: user.tenantId, campaignId, deletedAt: null },
      select: {
        ...this.reportSelect(),
        _count: { select: { schedules: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, campaignId: string, reportId: string) {
    await this.assertCampaignAccess(user, campaignId);

    const report = await this.prisma.report.findFirst({
      where: { id: reportId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: {
        ...this.reportSelect(),
        schedules: {
          where: { isActive: true },
          select: this.scheduleSelect(),
        },
      },
    });

    if (!report) throw new NotFoundException('Report not found.');
    return report;
  }

  async update(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    dto: UpdateReportDto,
  ) {
    await this.assertCampaignAccess(user, campaignId);
    this.assertAdminRole(user);

    const existing = await this.prisma.report.findFirst({
      where: { id: reportId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, version: true },
    });
    if (!existing) throw new NotFoundException('Report not found.');

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sections !== undefined && { sections: dto.sections as any }),
        ...(dto.status !== undefined && { status: dto.status }),
        // Bump version whenever sections change
        ...(dto.sections !== undefined && { version: existing.version + 1 }),
        // Clear stale PDF when sections change — it needs re-generation
        ...(dto.sections !== undefined && { pdfUrl: null, pdfGeneratedAt: null }),
      },
      select: this.reportSelect(),
    });
  }

  async softDelete(user: AuthenticatedUser, campaignId: string, reportId: string) {
    await this.assertCampaignAccess(user, campaignId);
    this.assertAdminRole(user);

    const existing = await this.prisma.report.findFirst({
      where: { id: reportId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Report not found.');

    await this.prisma.report.update({
      where: { id: reportId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Schedules ─────────────────────────────────────────────────────────────

  async createSchedule(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    dto: CreateScheduleDto,
  ) {
    await this.assertReportAccess(user, campaignId, reportId);
    this.assertAdminRole(user);

    const nextRunAt = this.nextCronDate(dto.cronExpression);

    return this.prisma.reportSchedule.create({
      data: {
        tenantId: user.tenantId,
        reportId,
        cronExpression: dto.cronExpression,
        nextRunAt,
        recipientEmails: dto.recipientEmails,
        dateRangeDays: dto.dateRangeDays ?? 30,
      },
      select: this.scheduleSelect(),
    });
  }

  async findSchedules(user: AuthenticatedUser, campaignId: string, reportId: string) {
    await this.assertReportAccess(user, campaignId, reportId);

    return this.prisma.reportSchedule.findMany({
      where: { reportId, tenantId: user.tenantId },
      select: this.scheduleSelect(),
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateSchedule(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ) {
    await this.assertReportAccess(user, campaignId, reportId);
    this.assertAdminRole(user);

    const existing = await this.prisma.reportSchedule.findFirst({
      where: { id: scheduleId, reportId, tenantId: user.tenantId },
      select: { id: true, cronExpression: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found.');

    const cronChanged = dto.cronExpression && dto.cronExpression !== existing.cronExpression;
    const nextRunAt = cronChanged
      ? this.nextCronDate(dto.cronExpression!)
      : undefined;

    return this.prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.cronExpression && { cronExpression: dto.cronExpression }),
        ...(nextRunAt && { nextRunAt }),
        ...(dto.recipientEmails && { recipientEmails: dto.recipientEmails }),
        ...(dto.dateRangeDays !== undefined && { dateRangeDays: dto.dateRangeDays }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.scheduleSelect(),
    });
  }

  async deleteSchedule(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    scheduleId: string,
  ) {
    await this.assertReportAccess(user, campaignId, reportId);
    this.assertAdminRole(user);

    const existing = await this.prisma.reportSchedule.findFirst({
      where: { id: scheduleId, reportId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found.');

    await this.prisma.reportSchedule.delete({ where: { id: scheduleId } });
  }

  // ─── PDF generation ────────────────────────────────────────────────────────

  async generatePdf(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    dateRangeDays = 30,
  ) {
    await this.assertCampaignAccess(user, campaignId);
    this.assertAdminRole(user);

    const report = await this.prisma.report.findFirst({
      where: { id: reportId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, name: true, sections: true, version: true, pdfUrl: true, pdfGeneratedAt: true, updatedAt: true },
    });
    if (!report) throw new NotFoundException('Report not found.');

    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - dateRangeDays);
    const from = fromDate.toISOString().split('T')[0];

    // Cache check: reuse existing PDF only when:
    //   1. Generated today (same date range window)
    //   2. Report has not been updated since PDF was generated (version/sections still current)
    if (report.pdfUrl && report.pdfGeneratedAt) {
      const generatedDate = report.pdfGeneratedAt.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      const isCurrentVersion = report.pdfGeneratedAt >= report.updatedAt;
      if (generatedDate === todayStr && isCurrentVersion) {
        const downloadUrl = await this.storageService.getSignedDownloadUrl(report.pdfUrl);
        return {
          reportId,
          pdfUrl: report.pdfUrl,
          downloadUrl,
          cached: true,
          generatedAt: report.pdfGeneratedAt,
        };
      }
    }

    const sections = (report.sections as unknown as ReportSectionDto[]) ?? [];

    const rendered = await this.renderService.renderAndStore(
      user.tenantId,
      reportId,
      campaignId,
      report.name,
      sections,
      from,
      to,
    );

    const downloadUrl = await this.storageService.getSignedDownloadUrl(rendered.pdfUrl);

    return {
      reportId,
      pdfUrl: rendered.pdfUrl,
      downloadUrl,
      cached: false,
      fileSizeBytes: rendered.fileSizeBytes,
      generatedAt: new Date(),
    };
  }

  // ─── Share links ───────────────────────────────────────────────────────────

  async createShareLink(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    expiresInDays = 7,
  ) {
    await this.assertReportAccess(user, campaignId, reportId);
    this.assertAdminRole(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // token is a random UUID — stored in DB and used as the lookup key
    const token = require('crypto').randomUUID() as string;

    const link = await this.prisma.reportShareLink.create({
      data: {
        tenantId: user.tenantId,
        reportId,
        token,
        expiresAt,
      },
      select: { id: true, token: true, expiresAt: true, createdAt: true },
    });

    return link;
  }

  async findShareLinks(user: AuthenticatedUser, campaignId: string, reportId: string) {
    await this.assertReportAccess(user, campaignId, reportId);

    return this.prisma.reportShareLink.findMany({
      where: { reportId, tenantId: user.tenantId, revokedAt: null },
      select: { id: true, token: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeShareLink(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
    linkId: string,
  ) {
    await this.assertReportAccess(user, campaignId, reportId);
    this.assertAdminRole(user);

    const link = await this.prisma.reportShareLink.findFirst({
      where: { id: linkId, reportId, tenantId: user.tenantId, revokedAt: null },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Share link not found or already revoked.');

    await this.prisma.reportShareLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() },
    });
  }

  // Public — used by the share endpoint (no auth required)
  async getSharedReport(token: string) {
    const link = await this.systemPrisma.reportShareLink.findFirst({
      where: { token, revokedAt: null },
      select: {
        id: true,
        expiresAt: true,
        reportId: true,
        tenantId: true,
        report: {
          select: {
            id: true,
            name: true,
            sections: true,
            status: true,
            pdfUrl: true,
            pdfGeneratedAt: true,
            campaignId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!link) throw new NotFoundException('Share link not found or has been revoked.');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new NotFoundException('Share link has expired.');
    }
    if (!link.report || link.report.deletedAt) {
      throw new NotFoundException('Report no longer exists.');
    }

    let downloadUrl: string | null = null;
    if (link.report.pdfUrl) {
      downloadUrl = await this.storageService.getSignedDownloadUrl(link.report.pdfUrl);
    }

    return {
      report: {
        id: link.report.id,
        name: link.report.name,
        sections: link.report.sections,
        status: link.report.status,
        pdfGeneratedAt: link.report.pdfGeneratedAt,
        campaignId: link.report.campaignId,
      },
      downloadUrl,
      linkExpiresAt: link.expiresAt,
    };
  }

  // ─── Delivery history ──────────────────────────────────────────────────────

  async findDeliveries(user: AuthenticatedUser, campaignId: string, reportId: string) {
    await this.assertReportAccess(user, campaignId, reportId);

    return this.prisma.reportDelivery.findMany({
      where: { reportId, tenantId: user.tenantId },
      select: {
        id: true,
        status: true,
        pdfUrl: true,
        errorMsg: true,
        sentAt: true,
        createdAt: true,
        schedule: { select: { id: true, cronExpression: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Selects ───────────────────────────────────────────────────────────────

  private reportSelect() {
    return {
      id: true,
      name: true,
      sections: true,
      version: true,
      status: true,
      pdfUrl: true,
      pdfGeneratedAt: true,
      createdAt: true,
      updatedAt: true,
      campaignId: true,
    } as const;
  }

  private scheduleSelect() {
    return {
      id: true,
      cronExpression: true,
      nextRunAt: true,
      isActive: true,
      recipientEmails: true,
      dateRangeDays: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  // ─── Guards ────────────────────────────────────────────────────────────────

  private assertAdminRole(user: AuthenticatedUser) {
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only agency admins can manage reports.');
    }
  }

  private async assertCampaignAccess(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  private async assertReportAccess(
    user: AuthenticatedUser,
    campaignId: string,
    reportId: string,
  ) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, campaignId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Report not found.');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private nextCronDate(cronExpression: string): Date {
    try {
      const interval = parseExpression(cronExpression, { utc: true });
      return interval.next().toDate();
    } catch {
      throw new BadRequestException(`Invalid cron expression: ${cronExpression}`);
    }
  }
}
