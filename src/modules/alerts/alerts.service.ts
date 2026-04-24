import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: CreateAlertDto,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, clientId, campaignId);

    return (this.prisma as any).alert.create({
      data: {
        tenantId: user.tenantId,
        campaignId,
        name: dto.name,
        platform: dto.platform,
        metricKey: dto.metricKey,
        condition: dto.condition,
        threshold: dto.threshold,
        periodType: dto.periodType,
        severity: dto.severity ?? 'WARNING',
        recipientEmails: dto.recipientEmails,
        cooldownHours: dto.cooldownHours ?? 24,
        createdById: user.id,
      },
    });
  }

  async list(user: AuthenticatedUser, clientId: string, campaignId: string) {
    await this.assertCampaignAccess(user, clientId, campaignId);
    return (this.prisma as any).alert.findMany({
      where: { tenantId: user.tenantId, campaignId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    alertId: string,
    dto: UpdateAlertDto,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, clientId, campaignId);
    await this.findAlert(user.tenantId, campaignId, alertId);

    return (this.prisma as any).alert.update({
      where: { id: alertId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.metricKey !== undefined && { metricKey: dto.metricKey }),
        ...(dto.condition !== undefined && { condition: dto.condition }),
        ...(dto.threshold !== undefined && { threshold: dto.threshold }),
        ...(dto.periodType !== undefined && { periodType: dto.periodType }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.recipientEmails !== undefined && { recipientEmails: dto.recipientEmails }),
        ...(dto.cooldownHours !== undefined && { cooldownHours: dto.cooldownHours }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    alertId: string,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, clientId, campaignId);
    await this.findAlert(user.tenantId, campaignId, alertId);

    await (this.prisma as any).alert.update({
      where: { id: alertId },
      data: { deletedAt: new Date() },
    });
  }

  async getEvents(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    alertId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);
    await this.findAlert(user.tenantId, campaignId, alertId);

    return (this.prisma as any).alertEvent.findMany({
      where: { tenantId: user.tenantId, alertId },
      orderBy: { notifiedAt: 'desc' },
      take: 100,
    });
  }

  private async findAlert(tenantId: string, campaignId: string, alertId: string) {
    const alert = await (this.prisma as any).alert.findFirst({
      where: { id: alertId, tenantId, campaignId, deletedAt: null },
    });
    if (!alert) throw new NotFoundException('Alert not found.');
    return alert;
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser, clientId: string, campaignId: string,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, clientId, tenantId: user.tenantId, deletedAt: null },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only admins can manage alerts.');
    }
  }
}
