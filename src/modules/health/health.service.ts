import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const HEALTH_CACHE_TTL = 30; // 30 seconds — fast data, tolerable staleness

export interface IntegrationHealthItem {
  platform: string;
  status: ConnectionStatus;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  externalAccountId: string | null;
}

export interface CampaignHealthResponse {
  campaignId: string;
  campaignName: string;
  integrations: IntegrationHealthItem[];
  summary: {
    total: number;
    connected: number;
    expired: number;
    error: number;
    disconnected: number;
  };
}

export interface AgencyHealthResponse {
  summary: {
    totalCampaigns: number;
    totalIntegrations: number;
    connected: number;
    expired: number;
    error: number;
    disconnected: number;
  };
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    clientName: string;
    connectedCount: number;
    expiredCount: number;
    errorCount: number;
  }>;
}

const isClientRole = (role: string) => role === UserRole.CLIENT_USER;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getCampaignHealth(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ): Promise<CampaignHealthResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: this.campaignWhere(user, clientId, campaignId),
      select: { id: true, name: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    const cacheKey = `health:campaign:${user.tenantId}:${campaignId}`;
    return this.cache.getOrSet(cacheKey, HEALTH_CACHE_TTL, async () => {
      const connections = await this.prisma.integrationConnection.findMany({
        where: { tenantId: user.tenantId, campaignId },
        select: {
          platform: true,
          status: true,
          lastSyncAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          externalAccountId: true,
        },
        orderBy: { platform: 'asc' },
      });

      const summary = { total: 0, connected: 0, expired: 0, error: 0, disconnected: 0 };
      for (const c of connections) {
        summary.total++;
        switch (c.status) {
          case ConnectionStatus.CONNECTED: summary.connected++; break;
          case ConnectionStatus.EXPIRED: summary.expired++; break;
          case ConnectionStatus.ERROR: summary.error++; break;
          case ConnectionStatus.DISCONNECTED: summary.disconnected++; break;
        }
      }

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        integrations: connections,
        summary,
      };
    });
  }

  async getAgencyHealth(user: AuthenticatedUser): Promise<AgencyHealthResponse> {
    const isClient = isClientRole(user.role);
    const cacheKey = `health:agency:${user.tenantId}:${isClient ? user.id : 'all'}`;

    return this.cache.getOrSet(cacheKey, HEALTH_CACHE_TTL, async () => {
    const connections = await this.prisma.integrationConnection.findMany({
      where: {
        tenantId: user.tenantId,
        ...(isClient && {
          campaign: {
            client: {
              clientUserAssignments: { some: { userId: user.id } },
            },
          },
        }),
      },
      select: {
        status: true,
        campaignId: true,
        campaign: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true } },
            deletedAt: true,
          },
        },
      },
    });

    // Exclude soft-deleted campaigns
    const live = connections.filter(c => !c.campaign.deletedAt);

    // Build per-campaign map
    const campaignMap = new Map<string, {
      campaignId: string;
      campaignName: string;
      clientName: string;
      connectedCount: number;
      expiredCount: number;
      errorCount: number;
    }>();

    const agencySummary = { totalIntegrations: 0, connected: 0, expired: 0, error: 0, disconnected: 0 };

    for (const c of live) {
      agencySummary.totalIntegrations++;
      switch (c.status) {
        case ConnectionStatus.CONNECTED: agencySummary.connected++; break;
        case ConnectionStatus.EXPIRED: agencySummary.expired++; break;
        case ConnectionStatus.ERROR: agencySummary.error++; break;
        case ConnectionStatus.DISCONNECTED: agencySummary.disconnected++; break;
      }

      if (!campaignMap.has(c.campaignId)) {
        campaignMap.set(c.campaignId, {
          campaignId: c.campaignId,
          campaignName: c.campaign.name,
          clientName: c.campaign.client.name,
          connectedCount: 0,
          expiredCount: 0,
          errorCount: 0,
        });
      }
      const row = campaignMap.get(c.campaignId)!;
      if (c.status === ConnectionStatus.CONNECTED) row.connectedCount++;
      else if (c.status === ConnectionStatus.EXPIRED) row.expiredCount++;
      else if (c.status === ConnectionStatus.ERROR) row.errorCount++;
    }

    return {
      summary: {
        totalCampaigns: campaignMap.size,
        ...agencySummary,
      },
      campaigns: Array.from(campaignMap.values()),
    };
    }); // end cache.getOrSet
  }

  private campaignWhere(user: AuthenticatedUser, clientId: string, campaignId: string) {
    const isClient = isClientRole(user.role);
    return {
      id: campaignId,
      clientId,
      tenantId: user.tenantId,
      deletedAt: null,
      ...(isClient && {
        client: {
          clientUserAssignments: { some: { userId: user.id } },
        },
      }),
    };
  }
}
