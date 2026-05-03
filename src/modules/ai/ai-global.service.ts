import { Injectable, Logger, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AnthropicClient } from './anthropic.client';
import { AiConversationService } from './ai-conversation.service';
import { AiToolsService, TOOL_DEFINITIONS } from './ai-tools.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { buildGlobalSystemPrompt, GlobalContextPayload } from './prompts/global-assistant.prompt';
import type Anthropic from '@anthropic-ai/sdk';

const MAX_OUTPUT_TOKENS = 1500;
const MAX_TOOL_ROUNDS = 5;

/**
 * Global (agency-wide) AI assistant.
 *
 * Differences from per-campaign AiChatService:
 *   - Conversations have scope='GLOBAL' and campaignId=null.
 *   - System prompt is agency-wide; live data comes via tool calls.
 *   - Always uses tool-use loop (Claude can call list_clients, query_metrics, generate_report_pdf, etc.)
 */
@Injectable()
export class AiGlobalService {
  private readonly logger = new Logger(AiGlobalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicClient,
    private readonly conversations: AiConversationService,
    private readonly tools: AiToolsService,
  ) {}

  // ─── Conversation CRUD (global scope) ──────────────────────────────────────

  async createConversation(user: AuthenticatedUser, firstQuestion: string) {
    return (this.prisma as any).aiConversation.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        campaignId: null,
        scope: 'GLOBAL',
        title: this.generateTitle(firstQuestion),
      },
    });
  }

  async listConversations(user: AuthenticatedUser) {
    return (this.prisma as any).aiConversation.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        scope: 'GLOBAL',
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async getConversation(user: AuthenticatedUser, conversationId: string) {
    const conv = await (this.prisma as any).aiConversation.findFirst({
      where: {
        id: conversationId,
        tenantId: user.tenantId,
        userId: user.id,
        scope: 'GLOBAL',
        deletedAt: null,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found.');
    return conv;
  }

  async getMessages(user: AuthenticatedUser, conversationId: string) {
    await this.getConversation(user, conversationId);
    return (this.prisma as any).aiMessage.findMany({
      where: { tenantId: user.tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async deleteConversation(user: AuthenticatedUser, conversationId: string) {
    await this.getConversation(user, conversationId);
    await (this.prisma as any).aiConversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Send message with tool-use loop ───────────────────────────────────────

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    userMessage: string,
  ): Promise<{ content: string; tokenCount: number; toolCalls: string[] }> {
    await this.getConversation(user, conversationId);

    const systemPrompt = await this.buildSystemPrompt(user);
    const history = await this.conversations.loadRecentMessages(user.tenantId, conversationId, 20);

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

        // Append assistant turn (full content blocks — required by Anthropic for tool_result follow-ups)
        messages.push({ role: 'assistant', content: resp.content });

        if (resp.stop_reason === 'tool_use') {
          const toolUses = resp.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
          );

          // Dispatch each tool call (in parallel)
          const toolResults = await Promise.all(
            toolUses.map(async (tu) => {
              toolCallsLog.push(tu.name);
              const result = await this.tools.dispatch(user, tu.name, tu.input as Record<string, unknown>);
              return {
                type: 'tool_result' as const,
                tool_use_id: tu.id,
                content: result,
              };
            }),
          );

          messages.push({ role: 'user', content: toolResults });
          continue;
        }

        // No more tool calls — extract final text
        const textBlocks = resp.content.filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === 'text',
        );
        finalText = textBlocks.map((b) => b.text).join('\n').trim();
        break;
      }

      if (!finalText) {
        finalText = "I had to stop after several tool rounds without a final answer. Try rephrasing your question or being more specific.";
      }
    } catch (err: unknown) {
      this.logger.error(`Global AI failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('AI assistant temporarily unavailable.');
    }

    // Persist messages
    await this.conversations.appendMessage(user.tenantId, conversationId, 'user', userMessage);
    await this.conversations.appendMessage(user.tenantId, conversationId, 'assistant', finalText, totalOutputTokens);

    return { content: finalText, tokenCount: totalOutputTokens, toolCalls: toolCallsLog };
  }

  // ─── Context prompt builder ────────────────────────────────────────────────

  private async buildSystemPrompt(user: AuthenticatedUser): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [agency, userRow, clientCount, activeCampaignCount, alertCount, unhealthyCount, topClients] = await Promise.all([
      this.prisma.agency.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true } }),
      this.prisma.client.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
      this.prisma.campaign.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
      (this.prisma as any).alertEvent.count({
        where: { tenantId: user.tenantId, notifiedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.integrationConnection.count({
        where: { tenantId: user.tenantId, status: { in: ['ERROR', 'DISCONNECTED'] } },
      }),
      this.prisma.client.findMany({
        where: { tenantId: user.tenantId, deletedAt: null },
        select: {
          id: true, name: true,
          _count: { select: { campaigns: { where: { deletedAt: null } } } },
        },
        orderBy: { campaigns: { _count: 'desc' } },
        take: 5,
      }),
    ]);

    const ctx: GlobalContextPayload = {
      agencyName: agency?.name ?? 'your agency',
      userFirstName: userRow?.firstName ?? 'there',
      today,
      clientCount,
      activeCampaignCount,
      recentAlertCount: alertCount,
      unhealthyIntegrationCount: unhealthyCount,
      topClientsByActivity: topClients.map((c) => ({
        id: c.id,
        name: c.name,
        campaignCount: c._count.campaigns,
        url: `/clients/${c.id}`,
      })),
    };

    return buildGlobalSystemPrompt(ctx);
  }

  private generateTitle(firstQuestion: string): string {
    const trimmed = firstQuestion.trim();
    if (trimmed.length <= 60) return trimmed;
    return trimmed.slice(0, 57) + '...';
  }
}
