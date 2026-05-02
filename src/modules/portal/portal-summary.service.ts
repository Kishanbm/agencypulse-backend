import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// ─── Priority order for portal KPI display ────────────────────────────────────
const PORTAL_METRIC_META: Array<{
  key: string;
  label: string;
  format: 'number' | 'currency' | 'percent';
}> = [
  { key: 'sessions',    label: 'Sessions',     format: 'number'   },
  { key: 'users',       label: 'Users',        format: 'number'   },
  { key: 'clicks',      label: 'Clicks',       format: 'number'   },
  { key: 'impressions', label: 'Impressions',  format: 'number'   },
  { key: 'conversions', label: 'Conversions',  format: 'number'   },
  { key: 'cost',        label: 'Ad Spend',     format: 'currency' },
  { key: 'revenue',     label: 'Revenue',      format: 'currency' },
  { key: 'leads',       label: 'Leads',        format: 'number'   },
];

@Injectable()
export class PortalSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser, campaignId: string) {
    await this.assertCampaignAccess(user, campaignId);

    // Last 30 days vs prior 30 days for delta calculation
    const now     = new Date();
    const from    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const priorTo = new Date(from.getTime() - 1);
    const priorFrom = new Date(priorTo.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [currentTotals, priorTotals, nextReport, aiNarrative, lastSyncAt] =
      await Promise.all([
        this.queryMetricTotals(user.tenantId, campaignId, from, now),
        this.queryMetricTotals(user.tenantId, campaignId, priorFrom, priorTo),
        this.getNextReport(user.tenantId, campaignId),
        this.getAiNarrative(user.tenantId, campaignId),
        this.getLastSync(user.tenantId, campaignId),
      ]);

    return {
      kpi:        this.buildKpiCards(currentTotals, priorTotals),
      nextReport,
      aiNarrative,
      lastSyncAt,
    };
  }

  // ─── KPI aggregation ──────────────────────────────────────────────────────

  private buildKpiCards(
    current: Record<string, number>,
    prior: Record<string, number>,
  ) {
    const cards = [];
    for (const meta of PORTAL_METRIC_META) {
      const curr = current[meta.key];
      if (curr === undefined || curr === 0) continue;

      const prev  = prior[meta.key];
      const delta =
        prev && prev > 0
          ? Math.round(((curr - prev) / prev) * 1000) / 10   // 1dp
          : null;

      cards.push({ ...meta, current: curr, delta });
      if (cards.length >= 4) break;
    }
    return cards;
  }

  private async queryMetricTotals(
    tenantId: string,
    campaignId: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, number>> {
    // Raw SQL inside a transaction so SET LOCAL fires on the same connection
    // and RLS is correctly applied — same pattern as agency-overview module.
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant = '${tenantId}'`,
      );
      return tx.$queryRawUnsafe<{ metric_key: string; total: number }[]>(
        `SELECT metric_key, SUM(value)::float AS total
         FROM metric_values
         WHERE tenant_id   = $1::uuid
           AND campaign_id = $2::uuid
           AND recorded_at >= $3
           AND recorded_at <= $4
           AND dimension_key IS NULL
         GROUP BY metric_key`,
        tenantId,
        campaignId,
        from,
        to,
      );
    });

    return Object.fromEntries(rows.map((r) => [r.metric_key, Number(r.total)]));
  }

  // ─── Next scheduled report ────────────────────────────────────────────────

  private async getNextReport(tenantId: string, campaignId: string) {
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: {
        tenantId,
        isActive: true,
        report: { tenantId, campaignId, deletedAt: null },
      },
      select: {
        nextRunAt:      true,
        cronExpression: true,
        report: { select: { name: true } },
      },
      orderBy: { nextRunAt: 'asc' },
    });

    if (!schedule) return null;

    return {
      reportName:     schedule.report.name,
      nextRunAt:      schedule.nextRunAt,
      cronExpression: schedule.cronExpression,
    };
  }

  // ─── AI narrative snippet ─────────────────────────────────────────────────

  private async getAiNarrative(tenantId: string, campaignId: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId,
        campaignId,
        deletedAt:  null,
        aiSummary: { not: null },
      },
      select: { aiSummary: true, aiSummaryGeneratedAt: true },
      orderBy: { aiSummaryGeneratedAt: 'desc' },
    });

    if (!report?.aiSummary) return null;

    // Trim to first 280 chars ending at a word boundary
    let snippet = report.aiSummary;
    if (snippet.length > 280) {
      snippet = snippet.substring(0, 280);
      const lastSpace = snippet.lastIndexOf(' ');
      if (lastSpace > 200) snippet = snippet.substring(0, lastSpace);
      snippet += '…';
    }

    return { snippet, generatedAt: report.aiSummaryGeneratedAt };
  }

  // ─── Last sync timestamp ──────────────────────────────────────────────────

  private async getLastSync(tenantId: string, campaignId: string) {
    const conn = await this.prisma.integrationConnection.findFirst({
      where: { tenantId, campaignId, lastSyncAt: { not: null } },
      select: { lastSyncAt: true },
      orderBy: { lastSyncAt: 'desc' },
    });

    return conn?.lastSyncAt ?? null;
  }

  // ─── Campaign access guard (all 5 roles) ─────────────────────────────────
  // Mirrors the pattern used in DashboardsService and ScorecardService.

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    campaignId: string,
  ): Promise<void> {
    const clientFilter: Record<string, unknown> = { deletedAt: null };

    if (user.role === UserRole.AGENCY_STAFF) {
      clientFilter['staffAssignments'] = { some: { userId: user.id } };
    } else if (user.role === UserRole.CLIENT_USER) {
      clientFilter['clientUserAssignments'] = { some: { userId: user.id } };
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id:        campaignId,
        tenantId:  user.tenantId,
        deletedAt: null,
        client:    clientFilter,
      },
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found or access denied.');
  }
}
