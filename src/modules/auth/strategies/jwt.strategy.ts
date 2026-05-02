import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SystemPrismaService } from '../../../database/system-prisma.service';
import { JwtPayload } from '../token.service';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly systemPrisma: SystemPrismaService,
  ) {
    super({
      // Accept token from Authorization header OR ?token= query param (needed for SSE/EventSource)
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.query?.token as string | null ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  // Called by Passport after signature + expiry are verified.
  // Uses systemPrisma (owner role, bypasses RLS) because JWT validation runs
  // before TenantMiddleware sets the tenant context — agencypulse_app would be
  // blocked by RLS here (no current_tenant_id() in AsyncLocalStorage yet).
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.systemPrisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
