import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { PasswordService } from './password.service';
import { TokenService, JwtPayload } from './token.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthResponseDto, RefreshResponseDto } from './dto/auth-response.dto';
import { AgencyPlan, UserRole } from '@prisma/client';
import * as crypto from 'crypto';

const VERIFY_TTL_HOURS = 48;
const RESET_TTL_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ─── Register ──────────────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ response: AuthResponseDto; rawRefreshToken: string }> {
    const slug = await this.generateUniqueSlug(dto.agencyName);
    const passwordHash = await this.passwordService.hash(dto.password);

    type RegisterRow = { agency_id: string; user_id: string; agency_slug: string; agency_plan: AgencyPlan };
    let row: RegisterRow;

    try {
      const rows = await this.systemPrisma.$queryRaw<RegisterRow[]>`
        SELECT * FROM register_agency(
          ${dto.agencyName},
          ${slug},
          ${dto.email.toLowerCase()},
          ${passwordHash},
          ${dto.firstName},
          ${dto.lastName}
        )
      `;
      row = rows[0];
    } catch (err: unknown) {
      const prismaErr = err as { code?: string; meta?: { code?: string } };
      if (prismaErr.code === 'P2010' && prismaErr.meta?.code === '23505') {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }

    // ─── Persist optional Step 2 / Step 3 fields ────────────────────────────
    // The register_agency() function takes only the core 6 args. Anything
    // else from the multi-step signup (website/size/timezone/interests/...)
    // is written via separate UPDATEs. systemPrisma bypasses RLS — required
    // here since no tenant context exists yet at registration time.
    if (
      dto.website || dto.size || dto.country || dto.timezone ||
      dto.interests?.length || dto.clientCountEstimate || dto.referralSource
    ) {
      await this.systemPrisma.agency.update({
        where: { id: row.agency_id },
        data: {
          website: dto.website ?? null,
          size: dto.size ?? null,
          country: dto.country?.toUpperCase() ?? null,
          timezone: dto.timezone ?? null,
          interests: dto.interests ?? [],
          clientCountEstimate: dto.clientCountEstimate ?? null,
          referralSource: dto.referralSource ?? null,
        },
      });
    }
    if (dto.phone) {
      await this.systemPrisma.user.update({
        where: { id: row.user_id },
        data: { phone: dto.phone },
      });
    }

    // ─── Send verification email (best-effort) ──────────────────────────────
    void this.issueVerificationEmail(row.user_id, dto.email.toLowerCase(), dto.firstName, dto.agencyName)
      .catch((err) => this.logger.error(`Failed to send verification email on register: ${String(err)}`));

    // Issue token pair
    const payload: JwtPayload = {
      sub: row.user_id,
      tenantId: row.agency_id,
      role: UserRole.AGENCY_OWNER,
      email: dto.email.toLowerCase(),
    };

    const accessToken = this.tokenService.signAccessToken(payload);
    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    await this.tokenService.storeRefreshToken(
      row.agency_id,
      row.user_id,
      rawRefreshToken,
      userAgent,
      ipAddress,
    );

    return {
      rawRefreshToken,
      response: {
        accessToken,
        user: {
          id: row.user_id,
          tenantId: row.agency_id,
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatarUrl: null,
          role: UserRole.AGENCY_OWNER,
          emailVerifiedAt: null,
        },
        agency: {
          id: row.agency_id,
          name: dto.agencyName,
          slug: row.agency_slug,
          logoUrl: null,
          primaryColor: null,
          plan: row.agency_plan,
        },
      },
    };
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ response: AuthResponseDto; rawRefreshToken: string }> {
    const rows = await this.systemPrisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        email: string;
        password_hash: string | null;
        role: UserRole;
        is_active: boolean;
      }>
    >`SELECT * FROM find_user_for_login(${dto.email.toLowerCase()})`;

    const userRow = rows[0];

    const dummyHash = '$2b$12$invalidhashfortimingnormalizationpurposesonly00000000000';
    const passwordMatch = await this.passwordService.compare(
      dto.password,
      userRow?.password_hash ?? dummyHash,
    );

    if (!userRow || !passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!userRow.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }
    if (!userRow.password_hash) {
      throw new BadRequestException('Please accept your invitation and set a password first');
    }

    const fullUser = await this.systemPrisma.user.findUnique({
      where: { id: userRow.id },
      select: { firstName: true, lastName: true, avatarUrl: true, emailVerifiedAt: true },
    });

    await this.systemPrisma.$executeRaw`
      UPDATE users SET last_login_at = NOW() WHERE id = ${userRow.id}::uuid
    `;

    const agencyRows = await this.systemPrisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        primary_color: string | null;
        plan: string;
      }>
    >`SELECT id, name, slug, logo_url, primary_color, plan FROM agencies WHERE id = ${userRow.tenant_id}::uuid LIMIT 1`;

    const agency = agencyRows[0];
    if (!agency) {
      throw new UnauthorizedException('Agency not found');
    }

    const payload: JwtPayload = {
      sub: userRow.id,
      tenantId: userRow.tenant_id,
      role: userRow.role,
      email: userRow.email,
    };

    const accessToken = this.tokenService.signAccessToken(payload);
    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    await this.tokenService.storeRefreshToken(
      userRow.tenant_id,
      userRow.id,
      rawRefreshToken,
      userAgent,
      ipAddress,
    );

    return {
      rawRefreshToken,
      response: {
        accessToken,
        user: {
          id: userRow.id,
          tenantId: userRow.tenant_id,
          email: userRow.email,
          firstName: fullUser?.firstName ?? '',
          lastName: fullUser?.lastName ?? '',
          avatarUrl: fullUser?.avatarUrl ?? null,
          role: userRow.role,
          emailVerifiedAt: fullUser?.emailVerifiedAt ? fullUser.emailVerifiedAt.toISOString() : null,
        },
        agency: {
          id: agency.id,
          name: agency.name,
          slug: agency.slug,
          logoUrl: agency.logo_url,
          primaryColor: agency.primary_color,
          plan: agency.plan as AgencyPlan,
        },
      },
    };
  }

  // ─── Refresh ───────────────────────────────────────────────────────────────

  async refresh(
    rawRefreshToken: string | undefined,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ response: RefreshResponseDto; rawRefreshToken: string }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { newTokenPair } =
      await this.tokenService.validateAndRotateRefreshToken(
        rawRefreshToken,
        userAgent,
        ipAddress,
      );

    return {
      rawRefreshToken: newTokenPair.rawRefreshToken,
      response: { accessToken: newTokenPair.accessToken },
    };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      await this.tokenService.revokeToken(rawRefreshToken);
    }
  }

  // ─── Me ────────────────────────────────────────────────────────────────────

  async getMe(userId: string): Promise<{
    id: string;
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    role: UserRole;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
  }> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
      },
    });
  }

  // ─── Forgot password ───────────────────────────────────────────────────────
  // Always returns success to prevent email enumeration. Token only sent
  // when an active account is found.

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const rows = await this.systemPrisma.$queryRaw<
      Array<{ id: string; tenant_id: string; email: string; first_name: string; is_active: boolean }>
    >`SELECT * FROM find_user_for_password_reset(${dto.email.toLowerCase()})`;

    const user = rows[0];

    if (user && user.is_active) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = this.tokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3600_000);

      await this.systemPrisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      });

      const frontendUrl = this.config.get<string>('app.frontendUrl') ?? this.config.get<string>('FRONTEND_URL') ?? '';
      const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;

      void this.emailService.sendForgotPassword(user.email, {
        firstName: user.first_name,
        email: user.email,
        resetUrl,
        expiresInHours: RESET_TTL_HOURS,
      }).catch((err) => this.logger.error(`Forgot-password email failed: ${String(err)}`));
    }

    // Always succeed to prevent enumeration
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  // ─── Reset password ────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const rows = await this.systemPrisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        email: string;
        password_reset_expires_at: Date | null;
        is_active: boolean;
      }>
    >`SELECT * FROM find_user_by_password_reset_token(${tokenHash})`;

    const user = rows[0];

    if (!user) {
      throw new BadRequestException('Reset link is invalid or has already been used');
    }
    if (!user.is_active) {
      throw new BadRequestException('Account is inactive');
    }
    if (!user.password_reset_expires_at || user.password_reset_expires_at < new Date()) {
      throw new BadRequestException('Reset link has expired — please request a new one');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.systemPrisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    // Revoke all existing sessions — force re-login with new password
    await this.tokenService.revokeAllUserTokens(user.id);

    return { message: 'Password reset successfully. Please sign in with your new password.' };
  }

  // ─── Verify email ──────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const rows = await this.systemPrisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        email: string;
        email_verification_expires_at: Date | null;
        email_verified_at: Date | null;
      }>
    >`SELECT * FROM find_user_by_email_verification_token(${tokenHash})`;

    const user = rows[0];

    if (!user) {
      throw new BadRequestException('Verification link is invalid or has already been used');
    }
    if (user.email_verified_at) {
      // Idempotent — already verified, just return success
      return { message: 'Email already verified.' };
    }
    if (!user.email_verification_expires_at || user.email_verification_expires_at < new Date()) {
      throw new BadRequestException('Verification link has expired — please request a new one');
    }

    await this.systemPrisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully.' };
  }

  // ─── Resend verification ────────────────────────────────────────────────────

  async resendVerification(userId: string): Promise<{ message: string }> {
    const user = await this.systemPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        emailVerifiedAt: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.emailVerifiedAt) {
      return { message: 'Email is already verified.' };
    }

    await this.issueVerificationEmail(user.id, user.email, user.firstName, user.tenant.name);

    return { message: 'Verification email sent.' };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async issueVerificationEmail(
    userId: string,
    email: string,
    firstName: string,
    agencyName: string,
  ): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000);

    await this.systemPrisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl') ?? this.config.get<string>('FRONTEND_URL') ?? '';
    const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(rawToken)}`;

    await this.emailService.sendVerifyEmail(email, {
      firstName,
      agencyName,
      verifyUrl,
      expiresInHours: VERIFY_TTL_HOURS,
    });
  }

  private async generateUniqueSlug(agencyName: string): Promise<string> {
    const base = agencyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    let slug = base;
    let suffix = 1;

    while (true) {
      const existing = await this.systemPrisma.agency.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${base}-${suffix++}`;
    }
  }
}
