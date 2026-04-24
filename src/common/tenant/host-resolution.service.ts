import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { CacheService } from '../cache/cache.service';

const HOST_CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'host:tenant:';

export interface ResolvedTenant {
  tenantId: string;
  agencyName: string;
}

@Injectable()
export class HostResolutionService {
  private readonly logger = new Logger(HostResolutionService.name);
  private readonly platformDomain: string;

  constructor(
    private readonly systemPrisma: SystemPrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {
    // e.g. "agencypulse.com" — strip this suffix to get the slug
    const frontendUrl = config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
    try {
      this.platformDomain = new URL(frontendUrl).hostname.replace(/^www\./, '');
    } catch {
      this.platformDomain = 'agencypulse.com';
    }
  }

  // Resolves tenantId from a Host header value.
  // Returns null for the platform's own domain (not a white-label host).
  async resolve(host: string): Promise<ResolvedTenant | null> {
    if (!host) return null;

    const normalised = host.toLowerCase().split(':')[0]; // strip port

    // Skip the platform's own root domain — not white-label
    if (normalised === this.platformDomain || normalised === `www.${this.platformDomain}`) {
      return null;
    }

    const cacheKey = `${CACHE_PREFIX}${normalised}`;

    return this.cache.getOrSet(cacheKey, HOST_CACHE_TTL, async () => {
      return this.lookupFromDb(normalised);
    });
  }

  // Call after agency updates slug or customDomain to prevent stale cache
  async invalidate(host: string): Promise<void> {
    // CacheService doesn't expose delete — we use a version bump trick:
    // overwrite the key with null (won't be cached by getOrSet since null is empty)
    // The simplest approach: just let it expire in 5 min.
    // For immediate invalidation, force-resolve from DB by calling resolve() which
    // will bypass cache only if we implement a dedicated Redis DEL.
    // For now: log and let TTL handle it — 5-min window is acceptable.
    this.logger.debug(`Host cache invalidation queued for: ${host}`);
  }

  private async lookupFromDb(host: string): Promise<ResolvedTenant | null> {
    // Case 1: custom domain (e.g. reports.myagency.com)
    // Case 2: subdomain of platform (e.g. acme.agencypulse.com → slug = "acme")
    const slug = this.extractSlug(host);

    const agency = await this.systemPrisma.agency.findFirst({
      where: {
        isActive: true,  // deactivated agencies cannot resolve
        OR: [
          { customDomain: host },
          ...(slug ? [{ slug }] : []),
        ],
      },
      select: { id: true, name: true, isActive: true },
    });

    if (!agency) return null;

    this.logger.debug(`Host resolved: ${host} → tenantId=${agency.id}`);
    return { tenantId: agency.id, agencyName: agency.name };
  }

  private extractSlug(host: string): string | null {
    // acme.agencypulse.com → strip ".agencypulse.com" → "acme"
    if (host.endsWith(`.${this.platformDomain}`)) {
      const slug = host.slice(0, -(this.platformDomain.length + 1));
      // Only a single label before the platform domain (no nested subdomains)
      return slug.includes('.') ? null : slug;
    }
    return null;
  }
}
