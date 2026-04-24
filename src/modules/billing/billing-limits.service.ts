import { Injectable, ForbiddenException } from '@nestjs/common';
import { AgencyPlan } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PLAN_LIMITS, BillableResource, PlanLimits } from './constants/plans';

/**
 * Enforces per-plan usage limits.
 * Injected into ClientsService, TeamService, IntegrationsService to gate resource creation.
 *
 * AGENCY_PRO plans short-circuit (Infinity limits) — no DB query on hot paths.
 * Trial period: honored via subscriptionStatus === 'trialing' → full AGENCY limits granted.
 */
@Injectable()
export class BillingLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWithinLimits(
    tenantId: string,
    resource: BillableResource,
    opts: { campaignId?: string } = {},
  ): Promise<void> {
    const agency = await (this.prisma as any).agency.findUnique({
      where: { id: tenantId },
      select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
    });
    if (!agency) throw new ForbiddenException('Agency not found.');

    const effectivePlan = this.getEffectivePlan(agency);
    const limits = PLAN_LIMITS[effectivePlan];

    // Fast path — unlimited
    const maxVal = limits[this.fieldForResource(resource)] as number;
    if (maxVal === Number.POSITIVE_INFINITY) return;

    const current = await this.currentUsage(tenantId, resource, opts.campaignId);
    const max = maxVal;

    if (current >= max) {
      throw new ForbiddenException(
        `Your ${limits.displayName} plan is limited to ${max} ${resource}. ` +
          `You currently have ${current}. Upgrade to add more.`,
      );
    }
  }

  async getUsage(tenantId: string): Promise<{
    plan: AgencyPlan;
    subscriptionStatus: string;
    trialEndsAt: Date | null;
    limits: PlanLimits;
    usage: { clients: number; staff: number };
  }> {
    const agency = await (this.prisma as any).agency.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionPeriodEnd: true,
      },
    });
    if (!agency) throw new ForbiddenException('Agency not found.');

    const effectivePlan = this.getEffectivePlan(agency);
    const [clients, staff] = await Promise.all([
      this.currentUsage(tenantId, 'clients'),
      this.currentUsage(tenantId, 'staff'),
    ]);

    return {
      plan: effectivePlan,
      subscriptionStatus: agency.subscriptionStatus,
      trialEndsAt: agency.trialEndsAt,
      limits: PLAN_LIMITS[effectivePlan],
      usage: { clients, staff },
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /** Trialing agencies get AGENCY-tier limits until trial ends. */
  private getEffectivePlan(agency: {
    plan: AgencyPlan;
    subscriptionStatus: string;
    trialEndsAt: Date | null;
  }): AgencyPlan {
    const isTrialing =
      agency.subscriptionStatus === 'trialing' &&
      agency.trialEndsAt &&
      agency.trialEndsAt > new Date();
    if (isTrialing && agency.plan === AgencyPlan.FREELANCER) return AgencyPlan.AGENCY;
    return agency.plan;
  }

  private fieldForResource(resource: BillableResource): keyof PlanLimits {
    if (resource === 'clients') return 'maxClients';
    if (resource === 'staff') return 'maxStaff';
    return 'maxIntegrationsPerCampaign';
  }

  private async currentUsage(
    tenantId: string,
    resource: BillableResource,
    campaignId?: string,
  ): Promise<number> {
    if (resource === 'clients') {
      return this.prisma.client.count({
        where: { tenantId, deletedAt: null },
      });
    }
    if (resource === 'staff') {
      return this.prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          role: { in: ['AGENCY_OWNER', 'AGENCY_ADMIN', 'AGENCY_STAFF'] },
        },
      });
    }
    // integrations — counted per campaign
    if (!campaignId) return 0;
    return this.prisma.integrationConnection.count({
      where: { tenantId, campaignId },
    });
  }
}
