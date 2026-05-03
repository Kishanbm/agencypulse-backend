import {
  Injectable, NotFoundException, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { IntegrationPlatform } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate, MetricGranularity } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { computePriorPeriod } from '../../common/metrics-utils';
import { AnthropicClient } from './anthropic.client';
import { AiConversationService } from './ai-conversation.service';
import { AiToolsService, TOOL_DEFINITIONS } from './ai-tools.service';
import { parseIntent } from './intent-parser';
import { buildChatSystemPrompt, ChatContextPayload } from './prompts/campaign-analyst.prompt';
import type Anthropic from '@anthropic-ai/sdk';

const MAX_OUTPUT_TOKENS = 1500;
const MAX_TOOL_ROUNDS = 5;
const ALL_PLATFORMS: IntegrationPlatform[] = [
  IntegrationPlatform.GA4,
  IntegrationPlatform.GOOGLE_ADS,
  IntegrationPlatform.META_ADS,
];

/**
 * Phase 8.5 — AI Assistant chat engine.
 *
 * Per message:
 *   1. Parse intent (time range, metrics, platforms, trend/comparison signals)
 *   2. Structured RAG: fetch only the data the question needs
 *   3. Build fresh system prompt with the retrieved context
 *   4. Load last 20 messages from the conversation for multi-turn memory
 *   5. Stream Claude response via SSE
 *   6. Persist both user + assistant messages
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly anthropic: AnthropicClient,
    private readonly conversations: AiConversationService,
    private readonly tools: AiToolsService,
  ) {}

  /**
   * Process a user message and return an SSE observable that streams the assistant's reply.
   */
  streamMessage(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
    userMessage: string,
  ): Observable<{ data: { type: string; content?: string; tokenCount?: number; error?: string } }> {
    const subject = new Subject<{ data: { type: string; content?: string; tokenCount?: number; error?: string } }>();

    // Run async work, push to subject as events arrive
    void this.runChat(user, clientId, campaignId, conversationId, userMessage, subject);
    return subject.asObservable();
  }

  /**
   * Non-streaming alternative — returns the full response once complete.
   */
  async sendMessage(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<{ content: string; tokenCount: number; toolCalls: string[] }> {
    // Verify ownership (throws 404 if user doesn't own conversation)
    await this.conversations.getConversation(user, clientId, campaignId, conversationId);

    const { systemPrompt, history } = await this.buildRequest(
      user, clientId, campaignId, conversationId, userMessage,
    );

    const client = this.anthropic.getClient();
    const model = this.anthropic.getChatModel();

    const messages: Anthropic.Messages.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const toolCallsLog: string[] = [];
    let totalOutputTokens = 0;
    let finalText = '';

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const resp: Anthropic.Messages.Message = await client.messages.create({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS as Anthropic.Messages.Tool[],
          messages,
        });
        totalOutputTokens += resp.usage.output_tokens;

        messages.push({ role: 'assistant', content: resp.content });

        if (resp.stop_reason === 'tool_use') {
          const toolUses = resp.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
          );
          const toolResults = await Promise.all(
            toolUses.map(async (tu) => {
              toolCallsLog.push(tu.name);
              const result = await this.tools.dispatch(user, tu.name, tu.input as Record<string, unknown>);
              return { type: 'tool_result' as const, tool_use_id: tu.id, content: result };
            }),
          );
          messages.push({ role: 'user', content: toolResults });
          continue;
        }

        const textBlocks = resp.content.filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === 'text',
        );
        finalText = textBlocks.map((b) => b.text).join('\n').trim();
        break;
      }

      if (!finalText) {
        finalText = "I had to stop after several tool rounds without a final answer. Try rephrasing.";
      }
    } catch (err: unknown) {
      this.logger.error(`Claude API failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('AI assistant temporarily unavailable.');
    }

    await this.conversations.appendMessage(user.tenantId, conversationId, 'user', userMessage);
    await this.conversations.appendMessage(user.tenantId, conversationId, 'assistant', finalText, totalOutputTokens);

    return { content: finalText, tokenCount: totalOutputTokens, toolCalls: toolCallsLog };
  }

  // ─── Private: streaming runner ─────────────────────────────────────────────

  private async runChat(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
    userMessage: string,
    subject: Subject<{ data: { type: string; content?: string; tokenCount?: number; error?: string } }>,
  ): Promise<void> {
    try {
      // Ownership check (throws 404 if not owner)
      await this.conversations.getConversation(user, clientId, campaignId, conversationId);

      const { systemPrompt, history } = await this.buildRequest(
        user, clientId, campaignId, conversationId, userMessage,
      );

      // Persist user message immediately
      await this.conversations.appendMessage(user.tenantId, conversationId, 'user', userMessage);

      const client = this.anthropic.getClient();
      const model = this.anthropic.getChatModel();

      let fullText = '';
      const stream = client.messages.stream({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        messages: [...history, { role: 'user', content: userMessage }],
      });

      stream.on('text', (delta) => {
        fullText += delta;
        subject.next({ data: { type: 'delta', content: delta } });
      });

      const final = await stream.finalMessage();
      const outTokens = final.usage.output_tokens;

      // Persist assistant message
      await this.conversations.appendMessage(user.tenantId, conversationId, 'assistant', fullText, outTokens);

      subject.next({ data: { type: 'done', tokenCount: outTokens } });
      subject.complete();
    } catch (err: unknown) {
      this.logger.error(`Chat stream failed: ${(err as Error).message}`);
      subject.next({ data: { type: 'error', error: (err as Error).message } });
      subject.complete();
    }
  }

  // ─── Context building (Structured RAG) ─────────────────────────────────────

  private async buildRequest(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<{
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const intent = parseIntent(userMessage, today);

    // Load campaign + client + agency for display names
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId: user.tenantId, deletedAt: null },
      include: {
        client: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');

    // Decide platforms to fetch
    const platforms: IntegrationPlatform[] =
      intent.platformHints.length > 0
        ? (intent.platformHints as IntegrationPlatform[])
        : ALL_PLATFORMS;

    const prior = computePriorPeriod(intent.range.from, intent.range.to);

    // Fetch summaries concurrently
    const summaries = await Promise.all(
      platforms.map(async (platform) => {
        const [cur, prev] = await Promise.all([
          this.metrics.getMetricSummary(
            user.tenantId, campaignId, platform,
            intent.range.from, intent.range.to,
            intent.metricHints.length > 0 ? intent.metricHints : undefined,
            MetricAggregate.SUM,
          ),
          intent.wantsComparison
            ? this.metrics.getMetricSummary(
                user.tenantId, campaignId, platform,
                prior.from, prior.to,
                intent.metricHints.length > 0 ? intent.metricHints : undefined,
                MetricAggregate.SUM,
              )
            : Promise.resolve({ metrics: {} as Record<string, number> }),
        ]);
        return { platform: String(platform), metrics: cur.metrics, priorMetrics: prev.metrics };
      }),
    );

    // Timeseries — only if user asked about a trend
    const timeseries: ChatContextPayload['timeseries'] = [];
    if (intent.wantsTimeseries && intent.metricHints.length > 0) {
      for (const platform of platforms) {
        for (const metricKey of intent.metricHints.slice(0, 3)) {
          const series = await this.metrics.getMetrics(
            user.tenantId, campaignId, platform,
            intent.range.from, intent.range.to,
            [metricKey], MetricGranularity.DAY, MetricAggregate.SUM,
          );
          if (series.length > 0) {
            timeseries.push({
              platform: String(platform),
              metricKey,
              points: series.map(r => ({ date: r.period, value: r.metrics[metricKey] ?? 0 })),
            });
          }
        }
      }
    }

    // Goals
    const goalsRaw = await (this.prisma as any).goal.findMany({
      where: { tenantId: user.tenantId, campaignId, deletedAt: null },
      take: 5,
    });
    const goals: ChatContextPayload['goals'] = [];
    for (const g of goalsRaw) {
      const sum = await this.metrics.getMetricSummary(
        user.tenantId, campaignId, g.platform,
        intent.range.from, intent.range.to, [g.metricKey], MetricAggregate.SUM,
      );
      const actual = sum.metrics[g.metricKey] ?? 0;
      const target = Number(g.targetValue);
      const pct = target > 0 ? (actual / target) * 100 : 0;
      const status = pct >= 100 ? 'ACHIEVED' : pct >= 70 ? 'ON_TRACK' : pct >= 40 ? 'AT_RISK' : 'BEHIND';
      goals.push({ name: g.name, target, actual, pct, status });
    }

    // Health
    const connections = await this.prisma.integrationConnection.findMany({
      where: { tenantId: user.tenantId, campaignId },
      select: { platform: true, status: true, lastSyncAt: true },
    });
    const health = connections.map(c => ({
      platform: String(c.platform),
      status: String(c.status),
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    }));

    // Recent alerts (last 7 days)
    const sinceMs = Date.now() - 7 * 86_400_000;
    const recentAlertsRaw = await (this.prisma as any).alertEvent.findMany({
      where: {
        tenantId: user.tenantId,
        campaignId,
        notifiedAt: { gte: new Date(sinceMs) },
      },
      include: { alert: { select: { name: true, metricKey: true } } },
      take: 5,
      orderBy: { notifiedAt: 'desc' },
    });
    const recentAlerts = recentAlertsRaw.map((a: any) => ({
      name: a.alert?.name ?? 'Alert',
      triggeredAt: a.notifiedAt.toISOString(),
      severity: a.severity,
      metricKey: a.alert?.metricKey ?? 'unknown',
      value: Number(a.triggeredValue),
    }));

    const ctxPayload: ChatContextPayload = {
      agencyName: campaign.tenant.name,
      campaignName: campaign.name,
      clientName: campaign.client.name,
      today,
      dataRangeFrom: intent.range.from,
      dataRangeTo: intent.range.to,
      priorRangeFrom: prior.from,
      priorRangeTo: prior.to,
      summaries,
      timeseries: timeseries.length > 0 ? timeseries : undefined,
      goals,
      health,
      recentAlerts,
    };

    const systemPrompt = buildChatSystemPrompt(ctxPayload);
    const history = await this.conversations.loadRecentMessages(user.tenantId, conversationId, 20);

    return { systemPrompt, history };
  }
}
