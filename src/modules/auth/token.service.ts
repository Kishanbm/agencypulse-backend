import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;      // userId
  tenantId: string; // agencyId — injected into RLS context by TenantMiddleware
  role: UserRole;   // for RBAC in Phase 1.5
  email: string;    // for logging/debugging
}

export interface TokenPair {
  accessToken: string;
  rawRefreshToken: string; // sent as httpOnly cookie — never returned in JSON body
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
  ) {}

  // ─── Access token ──────────────────────────────────────────────────────────

  signAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>('jwt.accessExpiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.get<string>('jwt.accessSecret'),
    });
  }

  // ─── Refresh token ─────────────────────────────────────────────────────────
  //
  // The refresh token is a cryptographically random opaque string (not a JWT).
  // Why not a JWT? Refresh tokens need to be revocable — we store a hash in
  // the DB. If we used a JWT, we'd need to store the full token anyway (to
  // revoke), so there's no benefit to signing it.

  generateRawRefreshToken(): string {
    // 48 bytes = 64-char base64url string — URL-safe, fits in a cookie
    return crypto.randomBytes(48).toString('base64url');
  }

  hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async storeRefreshToken(
    tenantId: string,
    userId: string,
    rawToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    const expiresInMs =
      this.parseExpiry(this.config.get<string>('jwt.refreshExpiresIn') ?? '7d');

    // systemPrisma: refresh tokens are stored at login time before tenant context
    // is established — agencypulse_app would be blocked by RLS here.
    await this.systemPrisma.refreshToken.create({
      data: {
        tenantId,
        userId,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + expiresInMs),
        userAgent,
        ipAddress,
      },
    });
  }

  // ─── Refresh token validation ──────────────────────────────────────────────
  //
  // Uses the SECURITY DEFINER SQL function `find_refresh_token` from Phase 1.3
  // migration 00003. This bypasses RLS because we don't yet know the tenant
  // when the client sends only the raw token.
  //
  // After finding the token record we get tenantId, then all subsequent
  // operations (revoke old, create new) run under normal RLS.

  async validateAndRotateRefreshToken(
    rawToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ tenantId: string; userId: string; newTokenPair: TokenPair }> {
    const tokenHash = this.hashToken(rawToken);

    // SECURITY DEFINER function — use systemPrisma (owner role) since agencypulse_app
    // does not have EXECUTE grant on find_refresh_token
    const rows = await this.systemPrisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        user_id: string;
        expires_at: Date;
        revoked_at: Date | null;
      }>
    >`SELECT * FROM find_refresh_token(${tokenHash})`;

    const tokenRecord = rows[0];

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (tokenRecord.revoked_at !== null) {
      // Token already used — possible token theft. Revoke ALL tokens for this user.
      await this.revokeAllUserTokens(tokenRecord.user_id);
      throw new UnauthorizedException(
        'Refresh token already used — all sessions revoked',
      );
    }
    if (tokenRecord.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the used token — systemPrisma because no tenant context at refresh time
    await this.systemPrisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Fetch the user to build the new access token payload — systemPrisma for same reason
    const user = await this.systemPrisma.user.findUniqueOrThrow({
      where: { id: tokenRecord.user_id },
      select: { id: true, tenantId: true, email: true, role: true, isActive: true },
    });

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Issue new token pair (rotation)
    const rawRefreshToken = this.generateRawRefreshToken();
    await this.storeRefreshToken(
      tokenRecord.tenant_id,
      tokenRecord.user_id,
      rawRefreshToken,
      userAgent,
      ipAddress,
    );

    const accessToken = this.signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return {
      tenantId: tokenRecord.tenant_id,
      userId: tokenRecord.user_id,
      newTokenPair: { accessToken, rawRefreshToken },
    };
  }

  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    // systemPrisma: logout runs before tenant context is established
    await this.systemPrisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    // systemPrisma: theft detection path — no tenant context available
    await this.systemPrisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Token cleanup ─────────────────────────────────────────────────────────
  // Deletes expired and revoked tokens older than the retention period.
  // Called by AuthCleanupTask on a daily cron schedule.
  //
  // Why keep revoked tokens for 30 days instead of deleting immediately?
  //   Revoked tokens are the audit trail for theft detection. If an attacker
  //   steals a token and uses it after the legitimate user logged out, we need
  //   the revoked record to detect the reuse. Deleting immediately would lose
  //   that signal.
  //
  // Note: this runs without tenant context (no RLS) because it's a system
  // maintenance operation. It uses $executeRaw directly to bypass the
  // Prisma middleware tenant hook.

  async deleteExpiredTokens(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.systemPrisma.$executeRaw`
      DELETE FROM refresh_tokens
      WHERE
        (expires_at < NOW() AND revoked_at IS NULL)
        OR (revoked_at IS NOT NULL AND revoked_at < ${thirtyDaysAgo})
    `;

    return result;
  }

  // ─── Cookie helpers ────────────────────────────────────────────────────────

  refreshCookieOptions(clear = false): Record<string, unknown> {
    const expiresInMs = clear
      ? 0
      : this.parseExpiry(
          this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
        );

    return {
      httpOnly: true,   // XSS: JS cannot read this cookie
      secure: this.config.get<string>('app.nodeEnv') === 'production', // HTTPS only in prod
      sameSite: 'strict' as const, // CSRF: cookie not sent on cross-site requests
      path: '/api/v1/auth', // Scope cookie to auth endpoints only
      maxAge: clear ? 0 : expiresInMs,
    };
  }

  // ─── Expiry parser ─────────────────────────────────────────────────────────
  // Converts "15m", "7d", "1h" etc. to milliseconds

  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    const multiplier = multipliers[unit];
    if (!multiplier || isNaN(value)) {
      throw new Error(`Invalid expiry format: "${expiry}"`);
    }
    return value * multiplier;
  }
}
