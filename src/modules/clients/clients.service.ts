import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UserRole, ClientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { BillingLimitsService } from '../billing/billing-limits.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingLimits: BillingLimitsService,
    private readonly audit: AuditService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(tenantId: string, createdById: string, dto: CreateClientDto) {
    await this.billingLimits.assertWithinLimits(tenantId, 'clients');
    const client = await this.prisma.client.create({
      data: {
        tenantId,
        name: dto.name,
        website: dto.website,
        logoUrl: dto.logoUrl,
        color: dto.color,
        createdById,
      },
      select: this.clientSelect(),
    });
    this.audit.log({
      tenantId,
      userId: createdById,
      action: 'CREATE',
      resourceType: 'Client',
      resourceId: client.id,
      resourceName: client.name,
    });
    return client;
  }

  // ─── List ──────────────────────────────────────────────────────────────────
  // Data scoping by role — enforced here in the service layer (NOT in guards).
  //
  //   AGENCY_OWNER/ADMIN → all non-deleted clients for their tenant
  //   AGENCY_STAFF       → only clients they are assigned to (staff_client_assignments)
  //   CLIENT_USER        → only clients they are assigned to (client_user_assignments)
  //
  // Role check (who can call the endpoint) is done in the controller via @Roles().
  // This method only handles WHAT they can see.

  async findAll(user: AuthenticatedUser, query: ClientQueryDto) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const baseWhere: Prisma.ClientWhereInput = {
      tenantId: user.tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        name: { contains: search, mode: Prisma.QueryMode.insensitive },
      }),
    };

    // Build role-based scope filter
    const where = this.applyScopeFilter(user, baseWhere);

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: this.clientSelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Find one ──────────────────────────────────────────────────────────────

  async findOne(user: AuthenticatedUser, clientId: string) {
    const where: Prisma.ClientWhereInput = {
      id: clientId,
      tenantId: user.tenantId,
      deletedAt: null,
    };

    const scoped = this.applyScopeFilter(user, where);
    const client = await this.prisma.client.findFirst({
      where: scoped,
      select: this.clientSelect(),
    });

    if (!client) {
      // Return 404 for both "not found" and "access denied" —
      // never reveal whether a resource exists to an unauthorized user
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(user: AuthenticatedUser, clientId: string, dto: UpdateClientDto) {
    await this.assertClientAccess(user, clientId, [
      UserRole.AGENCY_OWNER,
      UserRole.AGENCY_ADMIN,
    ]);

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: this.clientSelect(),
    });
    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      resourceType: 'Client',
      resourceId: clientId,
      resourceName: updated.name,
      metadata: dto as Record<string, unknown>,
    });
    return updated;
  }

  // ─── Soft delete ───────────────────────────────────────────────────────────

  async softDelete(user: AuthenticatedUser, clientId: string) {
    await this.assertClientAccess(user, clientId, [UserRole.AGENCY_OWNER]);

    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date(), status: ClientStatus.ARCHIVED },
      select: { name: true },
    });
    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      resourceType: 'Client',
      resourceId: clientId,
      resourceName: client.name,
    });

    return { message: 'Client archived.' };
  }

  async restore(user: AuthenticatedUser, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId },
    });

    if (!client) throw new NotFoundException('Client not found.');
    if (!client.deletedAt) throw new ConflictException('Client is not archived.');

    await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: null, status: ClientStatus.ACTIVE },
    });
    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'RESTORE',
      resourceType: 'Client',
      resourceId: clientId,
      resourceName: client.name,
    });

    return { message: 'Client restored.' };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private applyScopeFilter(
    user: AuthenticatedUser,
    base: Prisma.ClientWhereInput,
  ): Prisma.ClientWhereInput {
    const role = user.role as UserRole;

    if (
      role === UserRole.PLATFORM_OWNER ||
      role === UserRole.AGENCY_OWNER ||
      role === UserRole.AGENCY_ADMIN
    ) {
      // Admins see all clients in their tenant — no extra filter
      return base;
    }

    if (role === UserRole.AGENCY_STAFF) {
      // Staff see only their assigned clients
      return {
        ...base,
        staffAssignments: {
          some: { userId: user.id },
        },
      };
    }

    if (role === UserRole.CLIENT_USER) {
      // Client users see only their assigned clients
      return {
        ...base,
        clientUserAssignments: {
          some: { userId: user.id },
        },
      };
    }

    // Fallback: no access
    return { ...base, id: 'no-access' };
  }

  private async assertClientAccess(
    user: AuthenticatedUser,
    clientId: string,
    allowedRoles: UserRole[],
  ): Promise<void> {
    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found.');
  }

  private clientSelect() {
    return {
      id: true,
      name: true,
      website: true,
      logoUrl: true,
      color: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      // Include counts for admin views
      _count: {
        select: {
          campaigns: { where: { deletedAt: null } },
          staffAssignments: true,
          clientUserAssignments: true,
        },
      },
    } satisfies Prisma.ClientSelect;
  }
}
