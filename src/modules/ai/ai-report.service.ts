import {
  Injectable, NotFoundException, ForbiddenException, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { UserRole, IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { computePriorPeriod, computeChangePct } from '../../common/metrics-utils';
import { AnthropicClient } from './anthropic.client';
import {
  REPORT_SUMMARY_SYSTEM_PROMPT,
  buildReportSummaryUserPrompt,
  ReportSummaryContext,
} from './prompts/report-summary.prompt';

const CACHE_WINDOW_HOURS = 24;
const MAX_OUTPUT_TOKENS = 1500;

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];

/**
 * Phase 8.4 — AI Report Explanation.
 *
 * Generates a plain-English executive summary for a report using Claude.
 * Caches the result on the report row — re-generation only runs if:
 *   - force=true (admin override)
 *   - report version has changed since last generation
 *   - last generation was > 24 hours ago
 */
@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly anthropic: AnthropicClient,
  ) {}

  async generateSummary(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    reportId: string,
    force = false,
  ): Promise<{ summary: string; model: string; generatedAt: Date; cached: boolean }> {
    this.assertAdmin(user);

    const report = await (this.prisma as any).report.findFirst({
      where: { id: reportId, tenantId: user.tenantId, campaignId, deletedAt: null },
      include: {
        campaign: {
          include: {
            client: { select: { name: true } },
            tenant: { select: { name: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found.');

    // Cache check
    const cacheValid =
      !force &&
      report.aiSummary &&
      report.aiSummaryGeneratedAt &&
      report.aiSummaryVersion === report.version &&
      Date.now() - report.aiSummaryGeneratedAt.getTime() < CACHE_WINDOW_HOURS * 3_600_000;

    if (cacheValid) {
      return {
        summary: report.aiSummary!,
        model: report.aiSummaryModel ?? 'unknown',
        generatedAt: report.aiSummaryGeneratedAt!,
        cached: true,
      };
    }

    // Build context from report sections (date range + platforms)
    const ctx = await this.buildContext(report);

    // Call Claude
    const client = this.anthropic.getClient();
    const model = this.anthropic.getReportSummaryModel();

    let summary = '';
    try {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: REPORT_SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildReportSummaryUserPrompt(ctx) }],
      });
      const block = response.content[0];
      summary = block?.type === 'text' ? block.text.trim() : '';
    } catch (err: unknown) {
      this.logger.error(`Claude API call failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'AI summary generation temporarily unavailable. Please try again later.',
      );
    }

    if (!summary || summary.length < 50) {
      throw new ServiceUnavailableException('AI returned an empty summary. Please retry.');
    }

    const now = new Date();
    await (this.prisma as any).report.update({
      where: { id: reportId },
      data: {
        aiSummary: summary,
        aiSummaryGeneratedAt: now,
        aiSummaryModel: model,
        aiSummaryVersion: report.version,
      },
    });

    return { summary, model, generatedAt: now, cached: false };
  }

  // ─── Context building ───────────────────────────────────────────────────────

  private async buildContext(report: any): Promise<ReportSummaryContext> {
    // Derive date range from report sections (fall back to last 30 days)
    const sections = (report.sections ?? []) as any[];
    const inferredRange = this.inferDateRange(sections);
    const from = inferredRange.from;
    const to = inferredRange.to;
    const prior = computePriorPeriod(from, to);

    // Discover platforms referenced in this report
    const platforms = this.inferPlatforms(sections);

    const platformContexts: ReportSummaryContext['platforms'] = [];
    for (const platform of platforms) {
      const [curSummary, priorSummary] = await Promise.all([
        this.metrics.getMetricSummary(
          report.tenantId, report.campaignId, platform as IntegrationPlatform,
          from, to, undefined, MetricAggregate.SUM,
        ),
        this.metrics.getMetricSummary(
          report.tenantId, report.campaignId, platform as IntegrationPlatform,
          prior.from, prior.to, undefined, MetricAggregate.SUM,
        ),
      ]);

      const changePct: Record<string, number | null> = {};
      for (const key of Object.keys(curSummary.metrics)) {
        changePct[key] = computeChangePct(
          curSummary.metrics[key] ?? 0,
          priorSummary.metrics[key] ?? 0,
        );
      }

      platformContexts.push({
        platform,
        current: curSummary.metrics,
        prior: priorSummary.metrics,
        changePct,
      });
    }

    // Goals for this campaign
    const goalsRaw = await (this.prisma as any).goal.findMany({
      where: { tenantId: report.tenantId, campaignId: report.campaignId, deletedAt: null },
      take: 10,
    });

    const goals: ReportSummaryContext['goals'] = [];
    for (const g of goalsRaw) {
      const sum = await this.metrics.getMetricSummary(
        report.tenantId, report.campaignId, g.platform,
        from, to, [g.metricKey], MetricAggregate.SUM,
      );
      const actual = sum.metrics[g.metricKey] ?? 0;
      const target = Number(g.targetValue);
      const pct = target > 0 ? (actual / target) * 100 : 0;
      const status = pct >= 100 ? 'ACHIEVED' : pct >= 70 ? 'ON_TRACK' : pct >= 40 ? 'AT_RISK' : 'BEHIND';
      goals.push({ name: g.name, targetValue: target, currentValue: actual, progressPct: pct, status });
    }

    // Health status
    const connections = await this.prisma.integrationConnection.findMany({
      where: { tenantId: report.tenantId, campaignId: report.campaignId },
      select: { platform: true, status: true, lastSyncAt: true },
    });
    const healthStatus = connections.map(c => ({
      platform: c.platform,
      status: c.status,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    }));

    return {
      campaignName: report.campaign.name,
      clientName: report.campaign.client.name,
      agencyName: report.campaign.tenant.name,
      periodFrom: from,
      periodTo: to,
      priorPeriodFrom: prior.from,
      priorPeriodTo: prior.to,
      platforms: platformContexts,
      goals,
      healthStatus,
    };
  }

  private inferDateRange(sections: any[]): { from: string; to: string } {
    for (const s of sections) {
      if (s.from && s.to) return { from: s.from, to: s.to };
    }
    // Default: last 30 days (UTC)
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }

  private inferPlatforms(sections: any[]): string[] {
    const set = new Set<string>();
    for (const s of sections) {
      if (s.platform && typeof s.platform === 'string') set.add(s.platform);
    }
    if (set.size === 0) return ['GA4', 'GOOGLE_ADS', 'META_ADS'];
    return Array.from(set);
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only agency admins can generate AI summaries.');
    }
  }
}
