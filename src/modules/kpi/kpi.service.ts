import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { BUILT_IN_KPIS } from './constants/built-in-kpis';
import { validateFormula, evaluateFormula } from './utils/formula-evaluator';
import { CreateKpiDefinitionDto } from './dto/create-kpi-definition.dto';
import { KpiQueryDto } from './dto/kpi-query.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];
const KPI_CACHE_TTL = 300; // 5 minutes — matches MetricsService TTL

@Injectable()
export class KpiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
  ) {}

  // ─── KPI Query ────────────────────────────────────────────────────────────────

  async getKpis(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: KpiQueryDto,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    // FIX: consistent cache key format
    const cacheKey = `kpi:${user.tenantId}:${campaignId}:${dto.platform}:${dto.from}:${dto.to}`;

    return this.cache.getOrSet(cacheKey, KPI_CACHE_TTL, async () => {
      const summary = await this.metrics.getMetricSummary(
        user.tenantId, campaignId, dto.platform,
        dto.from, dto.to, undefined, MetricAggregate.SUM,
      );
      const base = summary.metrics;

      // Built-in derived metrics
      const builtIns = BUILT_IN_KPIS[dto.platform] ?? [];
      const derived: Record<string, number | null> = {};
      for (const kpi of builtIns) {
        derived[kpi.key] = kpi.compute(base);
      }

      // Custom tenant-defined metrics for this platform
      const customDefs = await (this.prisma as any).customMetricDefinition.findMany({
        where: { tenantId: user.tenantId, platform: dto.platform, isActive: true, deletedAt: null },
      });

      const custom: Record<string, number | null> = {};
      for (const def of customDefs) {
        const vars: Record<string, number> = {};
        for (const key of def.variableKeys as string[]) {
          vars[key] = base[key] ?? 0;
        }
        custom[def.name] = evaluateFormula(def.formula, vars);
      }

      return { base, derived, custom };
    });
  }

  // ─── Custom metric CRUD ───────────────────────────────────────────────────────

  async createDefinition(user: AuthenticatedUser, dto: CreateKpiDefinitionDto) {
    this.assertAdmin(user);

    const variableKeys = validateFormula(dto.formula);
    await this.assertVariablesExist(dto.platform, variableKeys);
    // Prevent a custom metric from referencing another custom metric as a variable,
    // which would silently resolve to 0 at query time instead of the expected value.
    await this.assertNoCustomMetricReference(user.tenantId, dto.platform, variableKeys);

    return (this.prisma as any).customMetricDefinition.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        formula: dto.formula,
        variableKeys,
        platform: dto.platform,
        createdById: user.id,
      },
    });
  }

  async listDefinitions(user: AuthenticatedUser, platform?: IntegrationPlatform) {
    return (this.prisma as any).customMetricDefinition.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        ...(platform && { platform }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateDefinition(user: AuthenticatedUser, defId: string, dto: Partial<CreateKpiDefinitionDto>) {
    this.assertAdmin(user);
    const existing = await this.findDefinition(user.tenantId, defId);

    let variableKeys: string[] | undefined;
    if (dto.formula !== undefined) {
      variableKeys = validateFormula(dto.formula);
      const platform = dto.platform ?? existing.platform;
      await this.assertVariablesExist(platform, variableKeys);
      await this.assertNoCustomMetricReference(user.tenantId, platform, variableKeys);
    }

    return (this.prisma as any).customMetricDefinition.update({
      where: { id: defId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.formula !== undefined && { formula: dto.formula, variableKeys }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
      },
    });
  }

  async removeDefinition(user: AuthenticatedUser, defId: string) {
    this.assertAdmin(user);
    await this.findDefinition(user.tenantId, defId);
    await (this.prisma as any).customMetricDefinition.update({
      where: { id: defId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async findDefinition(tenantId: string, defId: string) {
    const def = await (this.prisma as any).customMetricDefinition.findFirst({
      where: { id: defId, tenantId, deletedAt: null },
    });
    if (!def) throw new NotFoundException('KPI definition not found.');
    return def;
  }

  private async assertNoCustomMetricReference(
    tenantId: string,
    platform: IntegrationPlatform,
    variableKeys: string[],
  ): Promise<void> {
    if (variableKeys.length === 0) return;

    // Custom metric names are stored in the `name` field, not metricKey.
    // A variable that matches another custom metric's name would resolve to 0 at
    // query time (base metrics don't include custom metric names), causing silent errors.
    const conflicting = await (this.prisma as any).customMetricDefinition.findMany({
      where: { tenantId, platform, deletedAt: null, name: { in: variableKeys } },
      select: { name: true },
    });

    if (conflicting.length > 0) {
      const names = conflicting.map((c: { name: string }) => c.name).join(', ');
      throw new BadRequestException(
        `Formula variables must reference base metric keys, not custom metric names: ${names}`,
      );
    }
  }

  private async assertVariablesExist(
    platform: IntegrationPlatform,
    variableKeys: string[],
  ): Promise<void> {
    if (variableKeys.length === 0) return;

    const existing = await this.prisma.metricDefinition.findMany({
      where: { platform, metricKey: { in: variableKeys } },
      select: { metricKey: true },
    });

    const found = new Set(existing.map(m => m.metricKey));
    const missing = variableKeys.filter(k => !found.has(k));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Formula references unknown metric keys for platform ${platform}: ${missing.join(', ')}`,
      );
    }
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser, clientId: string, campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId, clientId, tenantId: user.tenantId, deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only admins can manage KPI definitions.');
    }
  }
}
