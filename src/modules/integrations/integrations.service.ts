import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, Prisma, IntegrationPlatform, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { BillingLimitsService } from '../billing/billing-limits.service';
import { AuditService } from '../audit/audit.service';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly billingLimits: BillingLimitsService,
    private readonly audit: AuditService,
  ) {}

  // ─── Upsert ────────────────────────────────────────────────────────────────
  // Creates the connection if it does not exist; updates it if it does.
  //
  // Token safety rule: existing encrypted tokens are NEVER overwritten unless
  // new plaintext tokens are explicitly provided in the DTO.
  // This prevents accidental token loss during status-only updates.

  async upsert(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: UpsertIntegrationDto,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    // Plan gate: only count NEW connections (not token refreshes on existing ones)
    const existingConnection = await this.prisma.integrationConnection.findUnique({
      where: { campaignId_platform: { campaignId, platform: dto.platform } },
      select: { id: true },
    });
    if (!existingConnection) {
      await this.billingLimits.assertWithinLimits(user.tenantId, 'integrations', { campaignId });
    }

    // Encrypt new tokens only if provided
    const accessTokenEnc = dto.accessToken
      ? this.encryption.encrypt(dto.accessToken)
      : undefined;
    const refreshTokenEnc = dto.refreshToken
      ? this.encryption.encrypt(dto.refreshToken)
      : undefined;

    // Determine status: if new tokens are provided, mark CONNECTED; otherwise keep existing
    const statusOnCreate: ConnectionStatus = dto.accessToken
      ? ConnectionStatus.CONNECTED
      : ConnectionStatus.DISCONNECTED;

    const connection = await this.prisma.integrationConnection.upsert({
      where: {
        campaignId_platform: { campaignId, platform: dto.platform },
      },

      create: {
        tenantId: user.tenantId,
        campaignId,
        platform: dto.platform,
        status: statusOnCreate,
        ...(accessTokenEnc !== undefined && { accessTokenEnc }),
        ...(refreshTokenEnc !== undefined && { refreshTokenEnc }),
        ...(dto.tokenExpiresAt && { tokenExpiresAt: new Date(dto.tokenExpiresAt) }),
        ...(dto.refreshTokenExpiresAt && { refreshTokenExpiresAt: new Date(dto.refreshTokenExpiresAt) }),
        ...(dto.scopes !== undefined && { scopes: dto.scopes }),
        ...(dto.externalAccountId !== undefined && { externalAccountId: dto.externalAccountId }),
        ...(dto.platformAccountType !== undefined && { platformAccountType: dto.platformAccountType }),
      },

      update: {
        // Only overwrite tokens if new ones are explicitly provided
        ...(accessTokenEnc !== undefined && { accessTokenEnc }),
        ...(refreshTokenEnc !== undefined && { refreshTokenEnc }),
        // If new access token provided, mark CONNECTED and clear any previous error
        ...(dto.accessToken && {
          status: ConnectionStatus.CONNECTED,
          lastErrorAt: null,
          lastErrorMessage: null,
        }),
        ...(dto.tokenExpiresAt && { tokenExpiresAt: new Date(dto.tokenExpiresAt) }),
        ...(dto.refreshTokenExpiresAt && { refreshTokenExpiresAt: new Date(dto.refreshTokenExpiresAt) }),
        ...(dto.scopes !== undefined && { scopes: dto.scopes }),
        ...(dto.externalAccountId !== undefined && { externalAccountId: dto.externalAccountId }),
        ...(dto.platformAccountType !== undefined && { platformAccountType: dto.platformAccountType }),
      },

      select: this.publicSelect(),
    });

    return connection;
  }

  // ─── List for campaign ─────────────────────────────────────────────────────

  async listForCampaign(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    return this.prisma.integrationConnection.findMany({
      where: { campaignId, tenantId: user.tenantId },
      select: this.publicSelect(),
      orderBy: { platform: 'asc' },
    });
  }

  // ─── Find one ──────────────────────────────────────────────────────────────

  async findOne(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    platform: IntegrationPlatform,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    const connection = await this.prisma.integrationConnection.findUnique({
      where: { campaignId_platform: { campaignId, platform } },
      select: this.publicSelect(),
    });

    if (!connection) {
      throw new NotFoundException(`No ${platform} integration found for this campaign.`);
    }

    return connection;
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────
  // Sets status = DISCONNECTED and clears all stored tokens.
  // The connection row is kept (not deleted) to preserve audit history.

  async disconnect(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    platform: IntegrationPlatform,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    const existing = await this.prisma.integrationConnection.findUnique({
      where: { campaignId_platform: { campaignId, platform } },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`No ${platform} integration found for this campaign.`);
    }

    await this.prisma.integrationConnection.update({
      where: { campaignId_platform: { campaignId, platform } },
      data: {
        status: ConnectionStatus.DISCONNECTED,
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scopes: null,
      },
    });

    this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'DISCONNECT',
      resourceType: 'Integration',
      resourceId: campaignId,
      resourceName: platform,
      metadata: { platform, campaignId },
    });

    return { message: `${platform} integration disconnected.` };
  }

  // ─── storeTokens — INTERNAL USE ONLY ──────────────────────────────────────
  // Called from OAuth callback handlers and token-refresh flows.
  // Does NOT validate campaign access — caller is responsible for that.
  // Caller must ensure tenant context is set (via TenantContextService.run())
  // since this method uses PrismaService (RLS enforced).
  //
  // Fix 5 applied: refreshTokenEnc is NEVER overwritten unless a new
  // refreshToken is explicitly provided (Google omits refresh_token on
  // subsequent OAuth flows if one was already issued).

  async storeTokens(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      scopes?: string;
      externalAccountId?: string;
    },
  ): Promise<void> {
    const accessTokenEnc = this.encryption.encrypt(tokens.accessToken);
    const refreshTokenEnc = tokens.refreshToken
      ? this.encryption.encrypt(tokens.refreshToken)
      : undefined;

    await this.prisma.integrationConnection.upsert({
      where: { campaignId_platform: { campaignId, platform } },
      create: {
        tenantId,
        campaignId,
        platform,
        status: ConnectionStatus.CONNECTED,
        accessTokenEnc,
        ...(refreshTokenEnc && { refreshTokenEnc }),
        ...(tokens.tokenExpiresAt && { tokenExpiresAt: tokens.tokenExpiresAt }),
        ...(tokens.scopes && { scopes: tokens.scopes }),
        ...(tokens.externalAccountId && { externalAccountId: tokens.externalAccountId }),
      },
      update: {
        status: ConnectionStatus.CONNECTED,
        accessTokenEnc,
        ...(refreshTokenEnc && { refreshTokenEnc }),
        ...(tokens.tokenExpiresAt && { tokenExpiresAt: tokens.tokenExpiresAt }),
        ...(tokens.scopes !== undefined && { scopes: tokens.scopes }),
        ...(tokens.externalAccountId !== undefined && { externalAccountId: tokens.externalAccountId }),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
  }

  // ─── getDecryptedTokens — INTERNAL USE ONLY ────────────────────────────────
  // Called by the worker/sync layer to retrieve plaintext tokens for API calls.
  // NEVER called from any controller or returned in any HTTP response.
  //
  // Returns null if the connection does not exist or has no stored tokens.

  async getDecryptedTokens(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
  ): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
  } | null> {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { campaignId_platform: { campaignId, platform } },
      select: {
        tenantId: true,
        accessTokenEnc: true,
        refreshTokenEnc: true,
        tokenExpiresAt: true,
        refreshTokenExpiresAt: true,
      },
    });

    if (!connection || connection.tenantId !== tenantId) return null;

    return {
      accessToken: connection.accessTokenEnc
        ? this.encryption.decrypt(connection.accessTokenEnc)
        : null,
      refreshToken: connection.refreshTokenEnc
        ? this.encryption.decrypt(connection.refreshTokenEnc)
        : null,
      tokenExpiresAt: connection.tokenExpiresAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    };
  }

  // ─── Worker status updates — INTERNAL USE ONLY ────────────────────────────
  // Called from sync processors after each job completes or fails.
  // Uses updateMany (no throw if connection was deleted between dispatch and processing).
  // Sharp edge 2: precise EXPIRED / ERROR / SYNCED semantics enforced here.

  async markSynced(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
  ): Promise<void> {
    await this.prisma.integrationConnection.updateMany({
      where: { tenantId, campaignId, platform },
      data: {
        lastSyncAt: new Date(),
        status: ConnectionStatus.CONNECTED,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
  }

  // 401 / invalid_grant → EXPIRED — user must re-authenticate, no retry
  async markExpired(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    message: string,
  ): Promise<void> {
    await this.prisma.integrationConnection.updateMany({
      where: { tenantId, campaignId, platform },
      data: {
        status: ConnectionStatus.EXPIRED,
        lastErrorAt: new Date(),
        lastErrorMessage: message.slice(0, 500),
      },
    });
  }

  // All retries exhausted (5xx / network) → ERROR
  async markError(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    message: string,
  ): Promise<void> {
    await this.prisma.integrationConnection.updateMany({
      where: { tenantId, campaignId, platform },
      data: {
        status: ConnectionStatus.ERROR,
        lastErrorAt: new Date(),
        lastErrorMessage: message.slice(0, 500),
      },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Validates that the user has access to the campaign using the same
   * tenant + assignment + deletedAt relational scoping pattern as CampaignsService.
   * Throws NotFoundException (not ForbiddenException) so we never leak whether
   * a resource exists to an unauthorized user.
   */
  private async assertCampaignAccess(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ): Promise<void> {
    const where = this.buildCampaignAccessWhere(user, clientId, campaignId);

    const campaign = await this.prisma.campaign.findFirst({
      where,
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  /**
   * Replicates CampaignsService.buildScopedWhere() for a specific campaign.
   * Enforces:
   *   1. tenantId isolation (explicit — defense-in-depth + RLS)
   *   2. client deletedAt: null (soft-deleted clients block all child access)
   *   3. Role-based assignment check via relational conditions (single query)
   */
  private buildCampaignAccessWhere(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ): Prisma.CampaignWhereInput {
    const role = user.role as UserRole;

    const base: Prisma.CampaignWhereInput = {
      id: campaignId,
      clientId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { deletedAt: null },
    };

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
        client: {
          is: {
            deletedAt: null,
            staffAssignments: { some: { userId: user.id } },
          },
        },
      };
    }

    if (role === UserRole.CLIENT_USER) {
      return {
        ...base,
        client: {
          is: {
            deletedAt: null,
            clientUserAssignments: { some: { userId: user.id } },
          },
        },
      };
    }

    // Fallback: no access
    return { ...base, id: 'no-access' };
  }

  /**
   * Safe select — explicitly excludes accessTokenEnc and refreshTokenEnc.
   * ALL public-facing methods use this select; encrypted fields are NEVER returned.
   */
  private publicSelect() {
    return {
      id: true,
      campaignId: true,
      platform: true,
      status: true,
      tokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      scopes: true,
      externalAccountId: true,
      platformAccountType: true,
      lastSyncAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
      createdAt: true,
      updatedAt: true,
      // accessTokenEnc: NEVER — encrypted value must not reach HTTP layer
      // refreshTokenEnc: NEVER — encrypted value must not reach HTTP layer
    } satisfies Prisma.IntegrationConnectionSelect;
  }
}
