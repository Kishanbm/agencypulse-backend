import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationPlatform, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IntegrationsService } from '../integrations.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

/**
 * Generic API-key connect service for all unimplemented API-key platforms.
 *
 * Stores the encrypted API key (and optional auxiliary fields) via IntegrationsService.
 * The sync worker retrieves the decrypted key when it runs.
 *
 * Works immediately once the user submits their API key — no credentials
 * need to be added to .env for API-key platforms.
 */
@Injectable()
export class StandardApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async connect(
    platform: IntegrationPlatform,
    user: AuthenticatedUser,
    campaignId: string,
    apiKey: string,
    options?: { apiUrl?: string; accessId?: string; externalAccountId?: string },
  ): Promise<{ message: string }> {
    if (!apiKey?.trim()) {
      throw new BadRequestException('apiKey must not be empty.');
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');

    // Store apiKey as the accessToken (encrypted). Auxiliary fields go in externalAccountId
    // as a JSON string so we don't need schema changes.
    // For platforms that don't need an account ID, store 'default' so the sync processor's
    // getActiveConnection() null-check doesn't skip the job.
    const auxiliary = options?.externalAccountId
      ?? (options?.apiUrl || options?.accessId
        ? JSON.stringify({
            ...(options.apiUrl ? { apiUrl: options.apiUrl } : {}),
            ...(options.accessId ? { accessId: options.accessId } : {}),
          })
        : 'default');

    await this.integrationsService.storeTokens(
      user.tenantId,
      campaign.id,
      platform,
      {
        accessToken: apiKey.trim(),
        externalAccountId: auxiliary,
      },
    );

    const platformName = platform.replace(/_/g, ' ').toLowerCase();
    return { message: `${platformName} connected successfully.` };
  }

  // ─── Private: campaign where clause (role-aware) ──────────────────────────

  private buildCampaignWhere(
    user: AuthenticatedUser,
    campaignId: string,
  ): Prisma.CampaignWhereInput {
    const base: Prisma.CampaignWhereInput = {
      id: campaignId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { deletedAt: null },
    };
    const role = user.role as UserRole;
    if (
      role === UserRole.PLATFORM_OWNER ||
      role === UserRole.AGENCY_OWNER ||
      role === UserRole.AGENCY_ADMIN
    ) {
      return base;
    }
    if (role === UserRole.AGENCY_STAFF) {
      return {
        ...base,
        client: { is: { deletedAt: null, staffAssignments: { some: { userId: user.id } } } },
      };
    }
    return { ...base, id: 'no-access' };
  }
}
