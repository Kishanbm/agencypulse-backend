import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AssignStaffDto } from './dto/assign-staff.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List assignments ──────────────────────────────────────────────────────
  // Returns all active staff assigned to a client, with basic user info.

  async list(user: AuthenticatedUser, clientId: string) {
    await this.assertClientAccess(user.tenantId, clientId);

    const assignments = await this.prisma.staffClientAssignment.findMany({
      where: { clientId, tenantId: user.tenantId },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return assignments;
  }

  // ─── Assign staff ──────────────────────────────────────────────────────────
  // AI Review fixes applied:
  //   - Client validated with deletedAt: null (can't assign to archived clients)
  //   - User validated with isActive: true + role: AGENCY_STAFF
  //   - Duplicate handled via DB unique constraint (P2002 → 409), not pre-check

  async assign(
    user: AuthenticatedUser,
    clientId: string,
    dto: AssignStaffDto,
  ) {
    // Validate client — must be active (not soft-deleted) and belong to tenant
    await this.assertClientAccess(user.tenantId, clientId);

    // Validate target user — must be AGENCY_STAFF, active, and in same tenant
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        tenantId: user.tenantId,
        role: UserRole.AGENCY_STAFF,
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!targetUser) {
      throw new BadRequestException(
        'User not found, is not an active AGENCY_STAFF member, or does not belong to your agency.',
      );
    }

    // Insert — let the DB unique constraint handle duplicates
    try {
      const assignment = await this.prisma.staffClientAssignment.create({
        data: {
          tenantId: user.tenantId,
          clientId,
          userId: dto.userId,
          assignedById: user.id,
        },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return assignment;
    } catch (err: any) {
      // Prisma unique constraint violation — user already assigned to this client
      if (err?.code === 'P2002') {
        throw new ConflictException('This staff member is already assigned to the client.');
      }
      throw err;
    }
  }

  // ─── Unassign staff ────────────────────────────────────────────────────────
  // Hard delete — removing access is intentional and immediate.

  async unassign(
    user: AuthenticatedUser,
    clientId: string,
    targetUserId: string,
  ) {
    const assignment = await this.prisma.staffClientAssignment.findFirst({
      where: { clientId, userId: targetUserId, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found.');
    }

    await this.prisma.staffClientAssignment.delete({
      where: { id: assignment.id },
    });

    return { message: 'Staff member unassigned.' };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Verifies the client exists, belongs to the tenant, and is not soft-deleted.
   * Throws 404 if not found or archived — consistent with the rest of the API.
   */
  private async assertClientAccess(
    tenantId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found.');
  }
}
