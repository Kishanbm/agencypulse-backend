import { Injectable, NotFoundException } from '@nestjs/common';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { HostResolutionService } from '../../common/tenant/host-resolution.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;   // 2 MB
const FAVICON_MAX_BYTES = 512 * 1024;      // 512 KB
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']);

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
    private readonly storageService: StorageService,
    private readonly hostResolution: HostResolutionService,
  ) {}

  // ─── Public branding endpoint ───────────────────────────────────────────────

  async getPublicBranding(host: string) {
    // Try host-based resolution first (white-label subdomain or custom domain)
    const resolved = await this.hostResolution.resolve(host);

    let agency: any;

    if (resolved) {
      agency = await this.systemPrisma.agency.findFirst({
        where: { id: resolved.tenantId, isActive: true },
        select: this.brandingSelect(),
      });
    }

    if (!agency) {
      // Fall back to platform default branding (no agency found for this host)
      return this.platformDefaultBranding();
    }

    return this.formatBranding(agency);
  }

  // Used by authenticated endpoints (GET /agencies/me/branding)
  async getMyBranding(tenantId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: tenantId },
      select: this.brandingSelect(),
    });
    if (!agency) throw new NotFoundException('Agency not found.');
    return this.formatBranding(agency);
  }

  // ─── Logo / favicon upload ──────────────────────────────────────────────────

  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ logoUrl: string }> {
    this.validateImageFile(file, LOGO_MAX_BYTES);

    const ext = this.mimeToExt(file.mimetype);
    const key = `${tenantId}/branding/logo.${ext}`;
    await this.storageService.upload(key, file.buffer, file.mimetype);
    const logoUrl = this.storageService.getPublicUrl(key);

    await this.prisma.agency.update({
      where: { id: tenantId },
      data: { logoUrl },
    });

    return { logoUrl };
  }

  async uploadFavicon(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ faviconUrl: string }> {
    this.validateImageFile(file, FAVICON_MAX_BYTES);

    const ext = this.mimeToExt(file.mimetype);
    const key = `${tenantId}/branding/favicon.${ext}`;
    await this.storageService.upload(key, file.buffer, file.mimetype);
    const faviconUrl = this.storageService.getPublicUrl(key);

    await (this.prisma.agency.update as any)({
      where: { id: tenantId },
      data: { faviconUrl },
    });

    return { faviconUrl };
  }

  // ─── Update branding settings ───────────────────────────────────────────────

  async updateBranding(tenantId: string, dto: UpdateBrandingDto) {
    // Invalidate host cache if custom domain changes
    if (dto.customDomain !== undefined) {
      const current = await this.prisma.agency.findUnique({
        where: { id: tenantId },
        select: { slug: true, customDomain: true },
      });
      if (current && dto.customDomain !== current.customDomain && current.customDomain) {
        await this.hostResolution.invalidate(current.customDomain);
      }
    }

    const updated = await this.prisma.agency.update({
      where: { id: tenantId },
      data: {
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.emailFromName !== undefined && { emailFromName: dto.emailFromName }),
        ...(dto.emailFromAddress !== undefined && { emailFromAddress: dto.emailFromAddress }),
        ...(dto.customDomain !== undefined && { customDomain: dto.customDomain || null }),
      },
      select: this.brandingSelect(),
    });

    return this.formatBranding(updated);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private brandingSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      faviconUrl: true,
      primaryColor: true,
      secondaryColor: true,
      customDomain: true,
      emailFromName: true,
      emailFromAddress: true,
    } as const;
  }

  private formatBranding(agency: any) {
    return {
      agencyName: agency.name,
      slug: agency.slug,
      logoUrl: agency.logoUrl ?? null,
      faviconUrl: agency.faviconUrl ?? null,
      primaryColor: agency.primaryColor ?? '#3B82F6',
      secondaryColor: agency.secondaryColor ?? '#1E40AF',
      customDomain: agency.customDomain ?? null,
      emailFromName: agency.emailFromName ?? agency.name,
      emailFromAddress: agency.emailFromAddress ?? null,
    };
  }

  private platformDefaultBranding() {
    return {
      agencyName: 'AgencyPulse',
      slug: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      customDomain: null,
      emailFromName: 'AgencyPulse',
      emailFromAddress: null,
    };
  }

  private validateImageFile(file: Express.Multer.File, maxBytes: number): void {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new Error(`File type not allowed: ${file.mimetype}. Allowed: PNG, JPEG, SVG, WebP, ICO`);
    }
    if (file.size > maxBytes) {
      throw new Error(`File too large: ${file.size} bytes. Max: ${maxBytes} bytes`);
    }
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/x-icon': 'ico',
      'image/vnd.microsoft.icon': 'ico',
    };
    return map[mime] ?? 'bin';
  }
}
