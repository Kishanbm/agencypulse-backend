import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { HostResolutionService } from './host-resolution.service';

interface JwtPayloadMinimal {
  sub: string;
  tenantId: string;
}

/**
 * Sets tenantId in AsyncLocalStorage for every request.
 *
 * Resolution order:
 *   1. JWT payload `tenantId` — authenticated requests (primary source of truth)
 *   2. Host header → slug/customDomain lookup — public/unauthenticated requests
 *      on white-labeled subdomains (e.g. acme.agencypulse.com, reports.myagency.com)
 *
 * Security: host-based resolution is READ-ONLY context for public routes.
 * All write operations still require a valid JWT (which embeds tenantId).
 * A forged Host header cannot escalate privileges because authenticated routes
 * always use the JWT-embedded tenantId, not the host.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly hostResolution: HostResolutionService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    this.resolveAndRun(req, next);
  }

  private async resolveAndRun(req: Request, next: NextFunction): Promise<void> {
    const tenantId = this.extractFromJwt(req);

    if (tenantId) {
      this.tenantContext.run(tenantId, () => next());
      return;
    }

    // No JWT — try host-based resolution for white-labeled public routes
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '') as string;
    try {
      const resolved = await this.hostResolution.resolve(host);
      if (resolved) {
        this.tenantContext.run(resolved.tenantId, () => next());
        return;
      }
    } catch (err) {
      this.logger.error(`Host resolution failed for ${host}: ${String(err)}`);
    }

    next();
  }

  private extractFromJwt(req: Request): string | undefined {
    // Try Authorization header first, fall back to ?token query param (needed for SSE/EventSource)
    const authHeader = req.headers.authorization;
    const rawToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query?.token as string | undefined);

    if (!rawToken) return undefined;

    try {
      const payload = this.jwtService.verify<JwtPayloadMinimal>(rawToken, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      return payload?.tenantId;
    } catch {
      // Invalid/expired token — JwtAuthGuard will handle the 401
      return undefined;
    }
  }
}
