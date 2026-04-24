import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { BrowseTemplatesDto } from './dto/browse-templates.dto';
import { CloneTemplateDto } from './dto/clone-template.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];

/**
 * Template marketplace.
 *
 * Two-tier design:
 *   Tier 1 — Global system templates (dashboard_templates / report_templates tables)
 *            No tenant, no RLS, seeded by platform, visible to everyone.
 *   Tier 2 — Agency private templates (isTemplate flag on dashboards/reports)
 *            Tenant-scoped, private to the agency.
 *
 * Clone operation is transactional (deep copy of widgets/sections).
 */
@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Browse (public — Tier 1 system templates) ──────────────────────────────

  async browseDashboardTemplates(dto: BrowseTemplatesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (dto.category) where.category = dto.category;
    if (dto.platform) where.platform = dto.platform;

    const [items, total] = await Promise.all([
      (this.prisma as any).dashboardTemplate.findMany({
        where,
        orderBy: [{ cloneCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      (this.prisma as any).dashboardTemplate.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async browseReportTemplates(dto: BrowseTemplatesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (dto.category) where.category = dto.category;
    if (dto.platform) where.platform = dto.platform;

    const [items, total] = await Promise.all([
      (this.prisma as any).reportTemplate.findMany({
        where,
        orderBy: [{ cloneCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      (this.prisma as any).reportTemplate.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getDashboardTemplate(id: string) {
    const tpl = await (this.prisma as any).dashboardTemplate.findFirst({
      where: { id, isActive: true },
    });
    if (!tpl) throw new NotFoundException('Dashboard template not found.');
    return tpl;
  }

  async getReportTemplate(id: string) {
    const tpl = await (this.prisma as any).reportTemplate.findFirst({
      where: { id, isActive: true },
    });
    if (!tpl) throw new NotFoundException('Report template not found.');
    return tpl;
  }

  // ─── Clone ──────────────────────────────────────────────────────────────────

  async cloneDashboardTemplate(
    user: AuthenticatedUser,
    templateId: string,
    dto: CloneTemplateDto,
  ): Promise<{ dashboardId: string }> {
    const tpl = await this.getDashboardTemplate(templateId);
    await this.assertCampaignAccess(user, dto.campaignId);

    const dashboardId = await this.prisma.$transaction(async (tx) => {
      // Create new dashboard
      const dashboard = await tx.dashboard.create({
        data: {
          tenantId: user.tenantId,
          campaignId: dto.campaignId,
          name: dto.name ?? tpl.name,
        },
        select: { id: true },
      });

      // Copy widgets
      const widgets = (tpl.widgets ?? []) as any[];
      for (const w of widgets) {
        await tx.dashboardWidget.create({
          data: {
            tenantId: user.tenantId,
            dashboardId: dashboard.id,
            campaignId: dto.campaignId,
            widgetType: w.widgetType,
            platform: w.platform ?? null,
            metricKeys: w.metricKeys ?? [],
            config: w.config ?? {},
            position: w.position ?? {},
          },
        });
      }

      // Bump clone count
      await (tx as any).dashboardTemplate.update({
        where: { id: templateId },
        data: { cloneCount: { increment: 1 } },
      });

      return dashboard.id;
    });

    return { dashboardId };
  }

  async cloneReportTemplate(
    user: AuthenticatedUser,
    templateId: string,
    dto: CloneTemplateDto,
  ): Promise<{ reportId: string }> {
    const tpl = await this.getReportTemplate(templateId);
    await this.assertCampaignAccess(user, dto.campaignId);

    const reportId = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          tenantId: user.tenantId,
          campaignId: dto.campaignId,
          name: dto.name ?? tpl.name,
          sections: tpl.sections ?? [],
          createdById: user.id,
        },
        select: { id: true },
      });

      await (tx as any).reportTemplate.update({
        where: { id: templateId },
        data: { cloneCount: { increment: 1 } },
      });

      return report.id;
    });

    return { reportId };
  }

  // ─── Save existing as template (Tier 2 — agency private) ───────────────────

  async saveDashboardAsTemplate(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dashboardId: string,
    dto: SaveAsTemplateDto,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, campaignId, clientId);

    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId: user.tenantId, campaignId, deletedAt: null },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found.');

    return (this.prisma as any).dashboard.update({
      where: { id: dashboardId },
      data: {
        isTemplate: true,
        templateName: dto.templateName,
        templateDescription: dto.templateDescription,
      },
    });
  }

  async saveReportAsTemplate(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    reportId: string,
    dto: SaveAsTemplateDto,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, campaignId, clientId);

    const report = await this.prisma.report.findFirst({
      where: { id: reportId, tenantId: user.tenantId, campaignId, deletedAt: null },
    });
    if (!report) throw new NotFoundException('Report not found.');

    return (this.prisma as any).report.update({
      where: { id: reportId },
      data: {
        isTemplate: true,
        templateName: dto.templateName,
        templateDescription: dto.templateDescription,
      },
    });
  }

  async listAgencyDashboardTemplates(user: AuthenticatedUser) {
    return (this.prisma as any).dashboard.findMany({
      where: { tenantId: user.tenantId, isTemplate: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        templateName: true,
        templateDescription: true,
        campaignId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAgencyReportTemplates(user: AuthenticatedUser) {
    return (this.prisma as any).report.findMany({
      where: { tenantId: user.tenantId, isTemplate: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        templateName: true,
        templateDescription: true,
        campaignId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    campaignId: string,
    clientId?: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId: user.tenantId,
        deletedAt: null,
        ...(clientId && { clientId }),
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only agency admins can save templates.');
    }
  }
}
