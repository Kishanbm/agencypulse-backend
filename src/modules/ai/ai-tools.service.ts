import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { ReportsService } from '../reports/reports.service';
import { MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { IntegrationPlatform } from '@prisma/client';

/**
 * Tools the AI assistant can call.
 *
 * Each tool has:
 *   1. A definition (name + description + JSON-Schema input) sent to Claude.
 *   2. A `dispatch()` handler that executes it server-side under the user's tenant.
 *
 * Returned data is a JSON-stringified payload — Claude reads this back as the
 * `tool_result` content block on the next turn and decides what to say.
 *
 * Security: every handler is bound to `user.tenantId` via PrismaService (RLS).
 */

// ─── Tool schemas (sent to Claude) ────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'list_clients',
    description: 'List all clients in the agency (active only). Returns id, name, website, status, and number of active campaigns. Use when the user asks about "clients" or wants to pick one.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Optional case-insensitive substring to filter client names.' },
        limit: { type: 'number', description: 'Max number of clients to return. Default 25, max 100.' },
      },
    },
  },
  {
    name: 'list_campaigns',
    description: 'List campaigns. Optionally filter by client. Returns id, name, clientId, clientName, status, createdAt. Use to find a specific campaign before calling tools that need a campaignId.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'Optional: only campaigns for this client UUID.' },
        search: { type: 'string', description: 'Optional case-insensitive substring on campaign name.' },
        limit: { type: 'number', description: 'Max campaigns to return. Default 25, max 100.' },
      },
    },
  },
  {
    name: 'list_reports',
    description: 'List existing reports for a specific campaign. Returns id, name, lastUpdated, hasPdf. Required before calling generate_report_pdf — the user must have a saved report definition.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign UUID.' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'query_metrics',
    description: 'Fetch metrics summary for a campaign. Returns aggregated values per metric for the given date range and platform. Use this to answer "what were sessions last week" or "compare clicks last 30 days".',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign UUID.' },
        platform:   { type: 'string', description: 'Platform key e.g. GA4, GOOGLE_ADS, META_ADS, GOOGLE_SEARCH_CONSOLE. Omit to aggregate across all platforms.' },
        from:       { type: 'string', description: 'ISO date YYYY-MM-DD (inclusive).' },
        to:         { type: 'string', description: 'ISO date YYYY-MM-DD (inclusive).' },
        metricKeys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: limit to specific metric keys. Empty = all available metrics for that platform.',
        },
      },
      required: ['campaignId', 'from', 'to'],
    },
  },
  {
    name: 'get_recent_alerts',
    description: 'Recent alert events across the agency from the last N days. Use to answer "any issues recently" or "what fired last week".',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'How many days back to look. Default 7, max 30.' },
        clientId: { type: 'string', description: 'Optional: limit to a single client.' },
        campaignId: { type: 'string', description: 'Optional: limit to a single campaign.' },
      },
    },
  },
  {
    name: 'find_underperforming_goals',
    description: 'Find goals where actual is below 70% of target across the agency or for a specific client/campaign. Returns goal name, target, actual, percentComplete.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string' },
        campaignId: { type: 'string' },
        days: { type: 'number', description: 'Window for actual computation. Default 30.' },
      },
    },
  },
  {
    name: 'get_integration_health',
    description: 'List integration connection statuses for a campaign (or all campaigns if no campaignId). Returns platform, status, lastSyncAt, lastErrorMessage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string' },
      },
    },
  },
  {
    name: 'generate_report_pdf',
    description: 'Generate (or fetch the cached) PDF for a saved report. Returns a downloadUrl the user can click to download immediately. Use this when the user asks to "generate", "download", or "send me" a report. You MUST have a valid reportId from list_reports first — never invent one.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign UUID that owns the report.' },
        reportId:   { type: 'string', description: 'Report UUID — get this from list_reports.' },
        days:       { type: 'number', description: 'Date window in days (default 30, last week = 7, last month = 30).' },
      },
      required: ['campaignId', 'reportId'],
    },
  },
  {
    name: 'create_and_generate_report',
    description: 'Create a brand-new report from scratch for a campaign and immediately generate its PDF. Use this when the user asks to "create a new report", "generate a summary report", or "make a report" — i.e. when no existing report fits. Infer a sensible name from their request. Returns the new reportId and a downloadUrl.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign UUID to create the report for.' },
        name:       { type: 'string', description: 'Report name, e.g. "May 2025 Performance Summary" or "Test Client 1 — Quick Summary".' },
        days:       { type: 'number', description: 'Date window in days for the generated PDF (default 30).' },
      },
      required: ['campaignId', 'name'],
    },
  },
];

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly reports: ReportsService,
  ) {}

  /** Dispatch a tool call by name and return a JSON-stringified result. */
  async dispatch(
    user: AuthenticatedUser,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    try {
      switch (toolName) {
        case 'list_clients':            return JSON.stringify(await this.listClients(user, input));
        case 'list_campaigns':          return JSON.stringify(await this.listCampaigns(user, input));
        case 'list_reports':            return JSON.stringify(await this.listReports(user, input));
        case 'query_metrics':           return JSON.stringify(await this.queryMetrics(user, input));
        case 'get_recent_alerts':       return JSON.stringify(await this.getRecentAlerts(user, input));
        case 'find_underperforming_goals': return JSON.stringify(await this.findUnderperformingGoals(user, input));
        case 'get_integration_health':  return JSON.stringify(await this.getIntegrationHealth(user, input));
        case 'generate_report_pdf':          return JSON.stringify(await this.generateReportPdf(user, input));
        case 'create_and_generate_report':   return JSON.stringify(await this.createAndGenerateReport(user, input));
        default:
          return JSON.stringify({ error: `Unknown tool: ${toolName}` });
      }
    } catch (err: unknown) {
      this.logger.error(`Tool ${toolName} failed: ${(err as Error).message}`);
      return JSON.stringify({ error: (err as Error).message ?? 'Tool execution failed' });
    }
  }

  // ─── list_clients ──────────────────────────────────────────────────────────
  private async listClients(user: AuthenticatedUser, input: Record<string, unknown>) {
    const search = typeof input.search === 'string' ? input.search.trim().toLowerCase() : '';
    const limit = Math.min(typeof input.limit === 'number' ? input.limit : 25, 100);

    const clients = await this.prisma.client.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true, name: true, website: true, status: true,
        _count: { select: { campaigns: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return {
      count: clients.length,
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        status: c.status,
        campaignCount: c._count.campaigns,
        url: `/clients/${c.id}`,
      })),
    };
  }

  // ─── list_campaigns ────────────────────────────────────────────────────────
  private async listCampaigns(user: AuthenticatedUser, input: Record<string, unknown>) {
    const clientId = typeof input.clientId === 'string' ? input.clientId : undefined;
    const search = typeof input.search === 'string' ? input.search.trim() : '';
    const limit = Math.min(typeof input.limit === 'number' ? input.limit : 25, 100);

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        ...(clientId ? { clientId } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true, name: true, status: true, createdAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      count: campaigns.length,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        clientId: c.client.id,
        clientName: c.client.name,
        createdAt: c.createdAt.toISOString(),
        url: `/clients/${c.client.id}/campaigns/${c.id}`,
      })),
    };
  }

  // ─── list_reports ──────────────────────────────────────────────────────────
  private async listReports(user: AuthenticatedUser, input: Record<string, unknown>) {
    const campaignId = String(input.campaignId);

    const reports = await this.prisma.report.findMany({
      where: {
        tenantId: user.tenantId,
        campaignId,
        deletedAt: null,
      },
      select: {
        id: true, name: true, updatedAt: true, pdfUrl: true, pdfGeneratedAt: true,
        campaign: { select: { id: true, name: true, clientId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return {
      count: reports.length,
      reports: reports.map((r) => ({
        id: r.id,
        name: r.name,
        lastUpdated: r.updatedAt.toISOString(),
        hasPdf: !!r.pdfUrl,
        lastPdfGeneratedAt: r.pdfGeneratedAt?.toISOString() ?? null,
        url: `/clients/${r.campaign.clientId}/campaigns/${r.campaign.id}/reports/${r.id}`,
      })),
    };
  }

  // ─── query_metrics ─────────────────────────────────────────────────────────
  private async queryMetrics(user: AuthenticatedUser, input: Record<string, unknown>) {
    const campaignId = String(input.campaignId);
    const from = String(input.from);
    const to = String(input.to);
    const platformStr = typeof input.platform === 'string' ? input.platform.toUpperCase() : undefined;
    const metricKeys = Array.isArray(input.metricKeys)
      ? (input.metricKeys as unknown[]).filter((k): k is string => typeof k === 'string')
      : undefined;

    // If no platform specified, return per-platform breakdown across all
    const platforms = platformStr
      ? [platformStr as IntegrationPlatform]
      : await this.activePlatformsForCampaign(user.tenantId, campaignId);

    const results = await Promise.all(
      platforms.map(async (p) => {
        const sum = await this.metrics.getMetricSummary(
          user.tenantId, campaignId, p, from, to,
          metricKeys && metricKeys.length > 0 ? metricKeys : undefined,
          MetricAggregate.SUM,
        );
        return { platform: String(p), metrics: sum.metrics };
      }),
    );

    return {
      campaignId,
      from,
      to,
      platforms: results,
    };
  }

  // ─── get_recent_alerts ─────────────────────────────────────────────────────
  private async getRecentAlerts(user: AuthenticatedUser, input: Record<string, unknown>) {
    const days = Math.min(typeof input.days === 'number' ? input.days : 7, 30);
    const clientId = typeof input.clientId === 'string' ? input.clientId : undefined;
    const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;
    const since = new Date(Date.now() - days * 86_400_000);

    const events = await (this.prisma as any).alertEvent.findMany({
      where: {
        tenantId: user.tenantId,
        notifiedAt: { gte: since },
        ...(campaignId ? { campaignId } : {}),
        ...(clientId && !campaignId ? { campaign: { clientId } } : {}),
      },
      include: {
        alert: { select: { name: true, metricKey: true } },
        campaign: { select: { id: true, name: true, clientId: true, client: { select: { name: true } } } },
      },
      take: 50,
      orderBy: { notifiedAt: 'desc' },
    });

    return {
      windowDays: days,
      count: events.length,
      events: events.map((e: any) => ({
        alertName: e.alert?.name ?? 'Alert',
        metricKey: e.alert?.metricKey ?? 'unknown',
        severity: e.severity,
        triggeredAt: e.notifiedAt.toISOString(),
        triggeredValue: Number(e.triggeredValue),
        campaignName: e.campaign?.name,
        clientName: e.campaign?.client?.name,
        url: e.campaign ? `/clients/${e.campaign.clientId}/campaigns/${e.campaign.id}/alerts` : null,
      })),
    };
  }

  // ─── find_underperforming_goals ────────────────────────────────────────────
  private async findUnderperformingGoals(user: AuthenticatedUser, input: Record<string, unknown>) {
    const days = Math.min(typeof input.days === 'number' ? input.days : 30, 90);
    const clientId = typeof input.clientId === 'string' ? input.clientId : undefined;
    const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;

    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const from = fromDate.toISOString().slice(0, 10);

    const goals = await (this.prisma as any).goal.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        ...(campaignId ? { campaignId } : {}),
        ...(clientId && !campaignId ? { campaign: { clientId } } : {}),
      },
      include: { campaign: { select: { id: true, name: true, clientId: true, client: { select: { name: true } } } } },
      take: 100,
    });

    const enriched = await Promise.all(
      goals.map(async (g: any) => {
        const sum = await this.metrics.getMetricSummary(
          user.tenantId, g.campaignId, g.platform, from, to, [g.metricKey], MetricAggregate.SUM,
        );
        const actual = sum.metrics[g.metricKey] ?? 0;
        const target = Number(g.targetValue);
        const pct = target > 0 ? (actual / target) * 100 : 0;
        return {
          goalName: g.name,
          metricKey: g.metricKey,
          target,
          actual,
          percentComplete: Math.round(pct * 10) / 10,
          campaignName: g.campaign?.name,
          clientName: g.campaign?.client?.name,
          url: `/clients/${g.campaign.clientId}/campaigns/${g.campaign.id}/goals`,
        };
      }),
    );

    const underperforming = enriched.filter((g) => g.percentComplete < 70);

    return {
      windowDays: days,
      totalGoalsConsidered: enriched.length,
      underperformingCount: underperforming.length,
      goals: underperforming.sort((a, b) => a.percentComplete - b.percentComplete).slice(0, 20),
    };
  }

  // ─── get_integration_health ────────────────────────────────────────────────
  private async getIntegrationHealth(user: AuthenticatedUser, input: Record<string, unknown>) {
    const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;

    const conns = await this.prisma.integrationConnection.findMany({
      where: {
        tenantId: user.tenantId,
        ...(campaignId ? { campaignId } : {}),
      },
      select: {
        platform: true, status: true, lastSyncAt: true, lastErrorMessage: true,
        campaign: { select: { id: true, name: true, clientId: true } },
      },
      take: 100,
    });

    return {
      count: conns.length,
      connections: conns.map((c) => ({
        platform: String(c.platform),
        status: String(c.status),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        lastErrorMessage: c.lastErrorMessage,
        campaignName: c.campaign?.name,
        url: c.campaign ? `/clients/${c.campaign.clientId}/campaigns/${c.campaign.id}/integrations` : null,
      })),
    };
  }

  // ─── generate_report_pdf ───────────────────────────────────────────────────
  private async generateReportPdf(user: AuthenticatedUser, input: Record<string, unknown>) {
    const campaignId = String(input.campaignId);
    const reportId = String(input.reportId);
    const days = typeof input.days === 'number' ? input.days : 30;

    const result = await this.reports.generatePdf(user, campaignId, reportId, days);

    return {
      reportId: result.reportId,
      downloadUrl: result.downloadUrl,
      cached: result.cached,
      generatedAt: result.generatedAt instanceof Date
        ? result.generatedAt.toISOString()
        : (result.generatedAt as unknown as string),
      windowDays: days,
      message: result.cached
        ? `Reused existing PDF generated earlier today.`
        : `Fresh PDF generated for the last ${days} days.`,
    };
  }

  // ─── create_and_generate_report ───────────────────────────────────────────
  private async createAndGenerateReport(user: AuthenticatedUser, input: Record<string, unknown>) {
    const campaignId = String(input.campaignId);
    const name = String(input.name);
    const days = typeof input.days === 'number' ? input.days : 30;

    const report = await this.reports.create(user, campaignId, { name, sections: [] });
    const result = await this.reports.generatePdf(user, campaignId, report.id, days);

    return {
      reportId: report.id,
      reportName: report.name,
      downloadUrl: result.downloadUrl,
      generatedAt: result.generatedAt instanceof Date
        ? result.generatedAt.toISOString()
        : (result.generatedAt as unknown as string),
      windowDays: days,
      message: `Created report "${name}" and generated PDF for the last ${days} days.`,
    };
  }

  // ─── helpers ───────────────────────────────────────────────────────────────
  private async activePlatformsForCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<IntegrationPlatform[]> {
    const conns = await this.prisma.integrationConnection.findMany({
      where: { tenantId, campaignId, status: 'CONNECTED' },
      select: { platform: true },
    });
    if (conns.length === 0) {
      // Default to the big three so we still attempt SOMETHING
      return [
        IntegrationPlatform.GA4,
        IntegrationPlatform.GOOGLE_ADS,
        IntegrationPlatform.META_ADS,
      ];
    }
    return Array.from(new Set(conns.map((c) => c.platform)));
  }
}
