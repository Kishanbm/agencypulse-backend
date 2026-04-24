import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, AgencyPlan } from '@prisma/client';
import { PLAN_LIMITS } from '../billing/constants/plans';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { PasswordService } from '../auth/password.service';
import { EmailService } from '../email/email.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ResendInviteDto } from './dto/resend-invite.dto';
import { InviteClientUserDto } from './dto/invite-client-user.dto';
import { ResendClientInviteDto } from './dto/resend-client-invite.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { TokenService } from '../auth/token.service';
import { BillingLimitsService } from '../billing/billing-limits.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const INVITE_TTL_HOURS = 48;

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly tokenService: TokenService,
    private readonly billingLimits: BillingLimitsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── List team members ─────────────────────────────────────────────────────

  async listTeam(tenantId: string) {
    const members = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_STAFF] },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        // Never return passwordHash, invitationTokenHash
      },
      orderBy: { createdAt: 'asc' },
    });

    return members;
  }

  // ─── Invite staff ──────────────────────────────────────────────────────────

  async inviteStaff(
    tenantId: string,
    inviter: AuthenticatedUser,
    dto: InviteStaffDto,
  ) {
    // Fast pre-check — gives a user-friendly error before any DB writes
    await this.billingLimits.assertWithinLimits(tenantId, 'staff');

    // Block duplicate email — globally unique check via systemPrisma (bypasses RLS)
    const existing = await this.systemPrisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException(
          'This email has already been invited but has not accepted yet. Use POST /team/resend-invite to send a new invitation link.',
        );
      }
      throw new ConflictException('A user with this email already exists in the system.');
    }

    const { rawToken, tokenHash, expiresAt } = this.generateInviteToken();

    // Atomic: re-validate the staff limit and create the user in one transaction
    // to prevent a TOCTOU race where two concurrent invites both pass the pre-check.
    const invited = await this.prisma.$transaction(async (tx) => {
      const staffCount = await tx.user.count({
        where: {
          tenantId,
          isActive: true,
          role: { in: [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_STAFF] },
        },
      });
      const agencyRow = await (tx as any).agency.findUnique({
        where: { id: tenantId },
        select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
      });
      const isTrialing =
        agencyRow?.subscriptionStatus === 'trialing' &&
        agencyRow?.trialEndsAt &&
        agencyRow.trialEndsAt > new Date();
      const effectivePlan: AgencyPlan =
        isTrialing && agencyRow?.plan === AgencyPlan.FREELANCER
          ? AgencyPlan.AGENCY
          : (agencyRow?.plan ?? AgencyPlan.FREELANCER);
      const maxStaff = PLAN_LIMITS[effectivePlan].maxStaff;
      if (maxStaff !== Number.POSITIVE_INFINITY && staffCount >= maxStaff) {
        throw new ForbiddenException(
          `Your ${PLAN_LIMITS[effectivePlan].displayName} plan allows ${maxStaff} staff members. Upgrade to add more.`,
        );
      }

      return tx.user.create({
        data: {
          tenantId,
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.AGENCY_STAFF,
          isActive: false,
          invitedById: inviter.id,
          invitationTokenHash: tokenHash,
          invitationExpiresAt: expiresAt,
        },
      });
    });

    // Load agency name for the email
    const agency = await this.prisma.agency.findUnique({ where: { id: tenantId } });

    const acceptUrl = `${this.config.get('app.url')}/accept-invite?token=${rawToken}`;

    await this.emailService.sendInviteStaff(invited.email, {
      agencyName: agency!.name,
      inviterName: `${inviter.firstName} ${inviter.lastName}`,
      inviteeName: `${dto.firstName} ${dto.lastName}`,
      acceptUrl,
      expiresInHours: INVITE_TTL_HOURS,
    });

    this.audit.log({
      tenantId,
      userId: inviter.id,
      userEmail: inviter.email,
      action: 'INVITE',
      resourceType: 'User',
      resourceId: invited.id,
      resourceName: `${dto.firstName} ${dto.lastName}`,
      metadata: { email: dto.email, role: 'AGENCY_STAFF' },
    });

    return {
      message: `Invitation sent to ${invited.email}`,
      userId: invited.id,
    };
  }

  // ─── Accept invitation ─────────────────────────────────────────────────────
  // PUBLIC endpoint — no JWT context, no RLS tenant set.
  // We find the user by token hash (globally unique — no tenant scoping needed).
  // Returns JWT tokens directly so the user is immediately logged in (no extra login step).

  async acceptInvite(
    dto: AcceptInviteDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    const tokenHash = this.hashToken(dto.token);

    // $queryRaw bypasses RLS — no tenant context exists at this point.
    // We strictly select only the fields we need (no wildcards).
    const users = await this.systemPrisma.$queryRaw<
      Array<{
        id: string;
        invitation_expires_at: Date | null;
        email: string;
        first_name: string;
        last_name: string;
        tenant_id: string;
        role: string;
        pending_client_id: string | null;
        invited_by_id: string | null;
      }>
    >`
      SELECT id, invitation_expires_at, email, first_name, last_name, tenant_id, role, pending_client_id, invited_by_id
      FROM users
      WHERE invitation_token_hash = ${tokenHash}
        AND is_active = false
      LIMIT 1
    `;

    if (!users.length) {
      throw new BadRequestException('Invalid or already used invitation token.');
    }

    const user = users[0];

    if (!user.invitation_expires_at || user.invitation_expires_at < new Date()) {
      throw new BadRequestException('This invitation has expired. Ask your admin to resend it.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    // CLIENT_USER: validate the pending client is still active before proceeding.
    // The client could have been soft-deleted between invite and accept.
    // Check this BEFORE activating the user so we can reject cleanly with no partial state.
    if (user.pending_client_id) {
      const clientRows = await this.systemPrisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM clients
        WHERE id = ${user.pending_client_id}::uuid
          AND tenant_id = ${user.tenant_id}::uuid
          AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!clientRows.length) {
        throw new BadRequestException(
          'The client associated with this invitation no longer exists. Contact your agency admin.',
        );
      }
    }

    // Activate user + create assignment atomically in one transaction.
    // Using $transaction ensures no partial state:
    //   - if assignment INSERT fails, user is NOT activated
    //   - if activation fails, no orphaned assignment is created
    await this.systemPrisma.$transaction([
      this.systemPrisma.$executeRaw`
        UPDATE users
        SET
          password_hash           = ${passwordHash},
          is_active               = true,
          email_verified_at       = NOW(),
          invitation_token_hash   = NULL,
          invitation_expires_at   = NULL,
          pending_client_id       = NULL,
          updated_at              = NOW()
        WHERE id = ${user.id}::uuid
      `,
      ...(user.pending_client_id
        ? [
            this.systemPrisma.$executeRaw`
              INSERT INTO client_user_assignments (id, tenant_id, user_id, client_id, assigned_by_id, created_at)
              VALUES (gen_random_uuid(), ${user.tenant_id}::uuid, ${user.id}::uuid, ${user.pending_client_id}::uuid, ${user.id}::uuid, NOW())
              ON CONFLICT (user_id, client_id) DO NOTHING
            `,
          ]
        : []),
    ]);

    // Load agency for welcome email (still RLS-bypass since no tenant context yet)
    const agency = await this.systemPrisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM agencies WHERE id = ${user.tenant_id}::uuid LIMIT 1
    `;

    // Fire welcome email — non-blocking (failure logged, not thrown)
    void this.emailService.sendWelcome(user.email, {
      firstName: user.first_name,
      agencyName: agency[0]?.name ?? '',
      loginUrl: `${this.config.get('app.url')}/login`,
    });

    // Notify the inviter that their invitation was accepted
    if (user.invited_by_id) {
      void this.notifications.create({
        tenantId: user.tenant_id,
        userId: user.invited_by_id,
        type: 'INVITE_ACCEPTED',
        title: `${user.first_name} ${user.last_name} accepted your invitation`,
        message: `${user.email} has joined and set up their account.`,
        resourceType: 'User',
        resourceId: user.id,
      });
    }

    // Auto-login: issue token pair so the user is immediately authenticated.
    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    await this.tokenService.storeRefreshToken(
      user.tenant_id,
      user.id,
      rawRefreshToken,
      userAgent,
      ipAddress,
    );

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role as any,
      email: user.email,
    });

    return { accessToken, rawRefreshToken };
  }

  // ─── Resend invitation ─────────────────────────────────────────────────────

  async resendInvite(tenantId: string, inviter: AuthenticatedUser, dto: ResendInviteDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), tenantId, isActive: false },
    });

    if (!user) {
      throw new NotFoundException('No pending invitation found for this email in your agency.');
    }

    const { rawToken, tokenHash, expiresAt } = this.generateInviteToken();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        invitedById: inviter.id,
        invitationTokenHash: tokenHash,
        invitationExpiresAt: expiresAt,
      },
    });

    const agency = await this.prisma.agency.findUnique({ where: { id: tenantId } });
    const acceptUrl = `${this.config.get('app.url')}/accept-invite?token=${rawToken}`;

    await this.emailService.sendInviteStaff(user.email, {
      agencyName: agency!.name,
      inviterName: `${inviter.firstName} ${inviter.lastName}`,
      inviteeName: `${user.firstName} ${user.lastName}`,
      acceptUrl,
      expiresInHours: INVITE_TTL_HOURS,
    });

    return { message: `Invitation resent to ${user.email}` };
  }

  // ─── Invite client user ────────────────────────────────────────────────────
  // Creates a CLIENT_USER with pendingClientId set.
  // ClientUserAssignment is created at accept time — not here — to avoid orphaned rows.

  async inviteClientUser(
    tenantId: string,
    inviter: AuthenticatedUser,
    dto: InviteClientUserDto,
  ) {
    // Validate client exists, not deleted, belongs to this tenant
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) throw new NotFoundException('Client not found.');

    // Email must be globally unique across all tenants
    const existing = await this.systemPrisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException(
          'This email has already been invited but has not accepted yet. Use POST /team/resend-client-invite to send a new link.',
        );
      }
      throw new ConflictException('A user with this email already exists in the system.');
    }

    const { rawToken, tokenHash, expiresAt } = this.generateInviteToken();

    const invited = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.CLIENT_USER,
        isActive: false,
        invitedById: inviter.id,
        invitationTokenHash: tokenHash,
        invitationExpiresAt: expiresAt,
        pendingClientId: dto.clientId,
      },
    });

    const agency = await this.prisma.agency.findUnique({ where: { id: tenantId } });
    const acceptUrl = `${this.config.get('app.url')}/accept-invite?token=${rawToken}`;

    await this.emailService.sendInviteClientUser(invited.email, {
      agencyName: agency!.name,
      inviteeName: `${dto.firstName} ${dto.lastName}`,
      clientName: client.name,
      acceptUrl,
      expiresInHours: INVITE_TTL_HOURS,
    });

    this.audit.log({
      tenantId,
      userId: inviter.id,
      userEmail: inviter.email,
      action: 'INVITE',
      resourceType: 'User',
      resourceId: invited.id,
      resourceName: `${dto.firstName} ${dto.lastName}`,
      metadata: { email: dto.email, role: 'CLIENT_USER', clientId: dto.clientId },
    });

    return {
      message: `Client portal invitation sent to ${invited.email}`,
      userId: invited.id,
    };
  }

  // ─── Resend client invite ──────────────────────────────────────────────────

  async resendClientInvite(
    tenantId: string,
    inviter: AuthenticatedUser,
    dto: ResendClientInviteDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        tenantId,
        role: UserRole.CLIENT_USER,
        isActive: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        pendingClientId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('No pending client portal invitation found for this email.');
    }

    const { rawToken, tokenHash, expiresAt } = this.generateInviteToken();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        invitedById: inviter.id,
        invitationTokenHash: tokenHash,
        invitationExpiresAt: expiresAt,
      },
    });

    // Fetch client name for email (pendingClientId is always set for CLIENT_USER invites)
    const client = user.pendingClientId
      ? await this.prisma.client.findFirst({
          where: { id: user.pendingClientId, tenantId },
          select: { name: true },
        })
      : null;

    const agency = await this.prisma.agency.findUnique({ where: { id: tenantId } });
    const acceptUrl = `${this.config.get('app.url')}/accept-invite?token=${rawToken}`;

    await this.emailService.sendInviteClientUser(user.email, {
      agencyName: agency!.name,
      inviteeName: `${user.firstName} ${user.lastName}`,
      clientName: client?.name ?? '',
      acceptUrl,
      expiresInHours: INVITE_TTL_HOURS,
    });

    return { message: `Client portal invitation resent to ${user.email}` };
  }

  // ─── Remove team member ────────────────────────────────────────────────────

  async removeTeamMember(tenantId: string, requesterId: string, targetUserId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });

    if (!target) throw new NotFoundException('Team member not found.');

    // Cannot remove yourself
    if (target.id === requesterId) {
      throw new BadRequestException('You cannot remove yourself.');
    }

    // Cannot remove the AGENCY_OWNER — they must transfer ownership first
    if (target.role === UserRole.AGENCY_OWNER) {
      throw new ForbiddenException('Cannot remove the agency owner. Transfer ownership first.');
    }

    await Promise.all([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: false },
      }),
      this.tokenService.revokeAllUserTokens(targetUserId),
    ]);

    this.audit.log({
      tenantId,
      userId: requesterId,
      action: 'DELETE',
      resourceType: 'User',
      resourceId: targetUserId,
      resourceName: `${target.firstName} ${target.lastName}`,
      metadata: { email: target.email, role: target.role },
    });

    return { message: 'Team member removed.' };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private generateInviteToken() {
    const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    return { rawToken, tokenHash, expiresAt };
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
