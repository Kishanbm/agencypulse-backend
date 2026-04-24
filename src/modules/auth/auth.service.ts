import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { PasswordService } from './password.service';
import { TokenService, JwtPayload } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, RefreshResponseDto } from './dto/auth-response.dto';
import { AgencyPlan, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,           // tenant-scoped, RLS enforced
    private readonly systemPrisma: SystemPrismaService, // owner role, bypasses RLS — auth ops only
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  // ─── Register ──────────────────────────────────────────────────────────────
  // Delegates to the `register_agency` SECURITY DEFINER function which creates
  // the agency + owner user atomically, running as the DB owner (bypasses RLS).
  // No ORM inserts — the function is the only path that writes without tenant context.
  //
  // Race condition on duplicate email: the DB UNIQUE constraint on users.email
  // is the authoritative guard. On violation (SQLSTATE 23505) we surface a 409.

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
      // Prisma wraps raw query errors as PrismaClientKnownRequestError (P2010).
      // The actual PostgreSQL error code is in err.meta.code.
      // SQLSTATE 23505 = unique_violation (duplicate email or slug).
      const prismaErr = err as { code?: string; meta?: { code?: string } };
      if (
        prismaErr.code === 'P2010' &&
        prismaErr.meta?.code === '23505'
      ) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }

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
  // Uses SECURITY DEFINER function `find_user_for_login` to bypass RLS for the
  // initial email lookup (tenant unknown at this point).

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ response: AuthResponseDto; rawRefreshToken: string }> {
    // SECURITY DEFINER function — use systemPrisma (owner role) since agencypulse_app
    // does not have EXECUTE grant on find_user_for_login
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

    // Always run password compare even if user not found — prevents timing
    // attacks that could reveal whether an email exists in the system
    const dummyHash =
      '$2b$12$invalidhashfortimingnormalizationpurposesonly00000000000';
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
      // Invited user who hasn't set their password yet
      throw new BadRequestException(
        'Please accept your invitation and set a password first',
      );
    }

    // Fetch full user fields not returned by the SECURITY DEFINER function
    const fullUser = await this.systemPrisma.user.findUnique({
      where: { id: userRow.id },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });

    // Update lastLoginAt — use systemPrisma (no tenant context established yet)
    await this.systemPrisma.$executeRaw`
      UPDATE users SET last_login_at = NOW() WHERE id = ${userRow.id}::uuid
    `;

    // Fetch agency for response payload — systemPrisma bypasses RLS since no
    // tenant context is set yet at login time
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
        lastLoginAt: true,
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async generateUniqueSlug(agencyName: string): Promise<string> {
    const base = agencyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, '')     // trim leading/trailing dashes
      .slice(0, 80);               // max 80 chars for base

    let slug = base;
    let suffix = 1;

    // Keep trying until we find a unique slug — uses systemPrisma (no tenant context yet)
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
