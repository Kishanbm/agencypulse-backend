import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { DashboardsService } from '../dashboards/dashboards.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardsService: DashboardsService,
    private readonly audit: AuditService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(
    user: AuthenticatedUser,
    clientId: string,
    dto: CreateCampaignDto,
  ) {
    // Verify the client exists and belongs to this tenant (single query).
    // ADMIN/OWNER can create on any tenant client — no assignment check needed.
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found.');

    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId: user.tenantId,
        clientId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        createdById: user.id,
      },
      select: this.campaignSelect(),
    });

    this.dashboardsService
      .createDefaultDashboard(user.tenantId, campaign.id)
      .catch(() => {});

    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      resourceType: 'Campaign',
      resourceId: campaign.id,
      resourceName: campaign.name,
    });

    return campaign;
  }

  // ─── List ──────────────────────────────────────────────────────────────────
  // Access + data scoping in ONE query — no cross-module calls.
  //
  //   AGENCY_OWNER/ADMIN → all campaigns for any client in their tenant
  //   AGENCY_STAFF       → only campaigns for clients they are assigned to
  //   CLIENT_USER        → only campaigns for their assigned clients
  //
  // tenantId is ALWAYS explicit in every query (defense-in-depth alongside RLS).

  async findAll(
    user: AuthenticatedUser,
    clientId: string,
    query: CampaignQueryDto,
  ) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const where = this.buildScopedWhere(user, clientId, {
      ...(status && { status }),
      ...(search && {
        name: { contains: search, mode: Prisma.QueryMode.insensitive },
      }),
    });

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        select: this.campaignSelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      data: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Find one ──────────────────────────────────────────────────────────────

  async findOne(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const where = this.buildScopedWhere(user, clientId, { id: campaignId });

    const campaign = await this.prisma.campaign.findFirst({
      where,
      select: this.campaignSelect(),
    });

    if (!campaign) {
      // 404 for both "not found" and "access denied" —
      // never reveal whether a resource exists to an unauthorized user
      throw new NotFoundException('Campaign not found.');
    }

    return campaign;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ) {
    // Verify campaign exists + belongs to this tenant's client (ADMIN+ only, no assignment check)
    const existing = await this.prisma.campaign.findFirst({
      where: { id: campaignId, clientId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Campaign not found.');

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: this.campaignSelect(),
    });
    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      resourceType: 'Campaign',
      resourceId: campaignId,
      resourceName: updated.name,
      metadata: dto as Record<string, unknown>,
    });
    return updated;
  }

  async softDelete(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const existing = await this.prisma.campaign.findFirst({
      where: { id: campaignId, clientId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!existing) throw new NotFoundException('Campaign not found.');

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { deletedAt: new Date() },
    });
    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      resourceType: 'Campaign',
      resourceId: campaignId,
      resourceName: existing.name,
    });

    return { message: 'Campaign deleted.' };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Builds the Prisma `where` clause that enforces BOTH:
   *   1. tenantId isolation (always explicit — defense-in-depth + RLS)
   *   2. Role-based client access via relational conditions (no extra query)
   *
   * STAFF/CLIENT_USER access is validated inline through the `client` relation,
   * so a missing assignment is indistinguishable from a missing campaign (404).
   */
  private buildScopedWhere(
    user: AuthenticatedUser,
    clientId: string,
    extra: Prisma.CampaignWhereInput = {},
  ): Prisma.CampaignWhereInput {
    const role = user.role as UserRole;

    const base: Prisma.CampaignWhereInput = {
      clientId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { deletedAt: null },
      ...extra,
    };

    if (
      role === UserRole.PLATFORM_OWNER ||
      role === UserRole.AGENCY_OWNER ||
      role === UserRole.AGENCY_ADMIN
    ) {
      // Full tenant access — no assignment condition needed
      return base;
    }

    if (role === UserRole.AGENCY_STAFF) {
      return {
        ...base,
        client: {
          is: {
            deletedAt: null,
            staffAssignments: { some: { userId: user.id } },
          },
        },
      };
    }

    if (role === UserRole.CLIENT_USER) {
      return {
        ...base,
        client: {
          is: {
            deletedAt: null,
            clientUserAssignments: { some: { userId: user.id } },
          },
        },
      };
    }

    // Fallback: no access
    return { ...base, id: 'no-access' };
  }

  private campaignSelect() {
    return {
      id: true,
      clientId: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.CampaignSelect;
  }
}
