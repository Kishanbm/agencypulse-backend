import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { goalProgressStatus } from '../../common/metrics-utils';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];
const GOAL_PROGRESS_CACHE_TTL = 60; // 60 seconds

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async create(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: CreateGoalDto,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, clientId, campaignId);
    this.assertDateRange(dto.periodStart, dto.periodEnd);

    return (this.prisma as any).goal.create({
      data: {
        tenantId: user.tenantId,
        campaignId,
        name: dto.name,
        platform: dto.platform,
        metricKey: dto.metricKey,
        targetValue: dto.targetValue,
        periodType: dto.periodType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        createdById: user.id,
      },
    });
  }

  async list(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    return (this.prisma as any).goal.findMany({
      where: { tenantId: user.tenantId, campaignId, deletedAt: null },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async update(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, clientId, campaignId);

    const goal = await this.findGoal(user.tenantId, campaignId, goalId);

    const startDate = dto.periodStart ?? goal.periodStart.toISOString().slice(0, 10);
    const endDate = dto.periodEnd ?? goal.periodEnd.toISOString().slice(0, 10);
    if (dto.periodStart || dto.periodEnd) {
      this.assertDateRange(startDate, endDate);
    }

    return (this.prisma as any).goal.update({
      where: { id: goalId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.metricKey !== undefined && { metricKey: dto.metricKey }),
        ...(dto.targetValue !== undefined && { targetValue: dto.targetValue }),
        ...(dto.periodType !== undefined && { periodType: dto.periodType }),
        ...(dto.periodStart !== undefined && { periodStart: new Date(dto.periodStart) }),
        ...(dto.periodEnd !== undefined && { periodEnd: new Date(dto.periodEnd) }),
      },
    });
  }

  async remove(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    goalId: string,
  ) {
    this.assertAdmin(user);
    await this.assertCampaignAccess(user, clientId, campaignId);
    await this.findGoal(user.tenantId, campaignId, goalId);

    await (this.prisma as any).goal.update({
      where: { id: goalId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Progress ────────────────────────────────────────────────────────────────

  async getProgress(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    goalId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);
    const goal = await this.findGoal(user.tenantId, campaignId, goalId);

    const from = goal.periodStart.toISOString().slice(0, 10);
    const to = goal.periodEnd.toISOString().slice(0, 10);
    const cacheKey = `goal-progress:${user.tenantId}:${goalId}:${from}:${to}`;

    return this.cache.getOrSet(cacheKey, GOAL_PROGRESS_CACHE_TTL, async () => {
      const summary = await this.metrics.getMetricSummary(
        user.tenantId,
        campaignId,
        goal.platform as IntegrationPlatform,
        from,
        to,
        [goal.metricKey],
        MetricAggregate.SUM,
      );

      const actualValue = summary.metrics[goal.metricKey] ?? 0;
      const targetValue = Number(goal.targetValue);
      const progressFraction = targetValue > 0 ? actualValue / targetValue : 0;
      const status = goalProgressStatus(progressFraction);

      return {
        goal,
        actualValue,
        targetValue,
        progressPct: Math.round(progressFraction * 10000) / 100, // e.g. 72.35
        status,
        daysRemaining: this.daysRemaining(goal.periodEnd),
      };
    });
  }

  async getCampaignGoalsProgress(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const goals = await this.list(user, clientId, campaignId);

    return Promise.all(
      (goals as Array<{ id: string }>).map(goal => this.getProgress(user, clientId, campaignId, goal.id)),
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async findGoal(tenantId: string, campaignId: string, goalId: string) {
    const goal = await (this.prisma as any).goal.findFirst({
      where: { id: goalId, tenantId, campaignId, deletedAt: null },
    });
    if (!goal) throw new NotFoundException('Goal not found.');
    return goal;
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        clientId,
        tenantId: user.tenantId,
        deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only admins can manage goals.');
    }
  }

  private assertDateRange(start: string, end: string) {
    if (new Date(start) >= new Date(end)) {
      throw new BadRequestException('periodStart must be before periodEnd.');
    }
  }

  private daysRemaining(periodEnd: Date): number {
    const diff = periodEnd.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  }
}
