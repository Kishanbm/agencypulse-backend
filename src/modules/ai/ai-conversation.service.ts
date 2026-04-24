import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const MAX_MESSAGES_PER_CONVERSATION = 50;

/**
 * CRUD for AI conversations.
 *
 * Isolation guarantees:
 *   Layer 1 — PostgreSQL RLS enforces tenant_id match
 *   Layer 2 — every lookup also filters on user_id so one user cannot read another user's chats
 *   Layer 3 — context is rebuilt fresh per message; never shared across requests
 */
@Injectable()
export class AiConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    firstQuestion: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    return (this.prisma as any).aiConversation.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        campaignId,
        title: this.generateTitle(firstQuestion),
      },
    });
  }

  async listConversations(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    return (this.prisma as any).aiConversation.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id, // strict: user sees only their own conversations
        campaignId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async getConversation(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    const conv = await (this.prisma as any).aiConversation.findFirst({
      where: {
        id: conversationId,
        tenantId: user.tenantId,
        userId: user.id,
        campaignId,
        deletedAt: null,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found.');
    return conv;
  }

  async getMessages(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
  ) {
    await this.getConversation(user, clientId, campaignId, conversationId);
    return (this.prisma as any).aiMessage.findMany({
      where: { tenantId: user.tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: MAX_MESSAGES_PER_CONVERSATION,
    });
  }

  async deleteConversation(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    conversationId: string,
  ) {
    await this.getConversation(user, clientId, campaignId, conversationId);
    await (this.prisma as any).aiConversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Load last N messages ordered oldest-first (for Claude's messages array).
   * If the conversation is over the cap, only the most recent N are returned.
   */
  async loadRecentMessages(
    tenantId: string,
    conversationId: string,
    limit = 20,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const rows = await (this.prisma as any).aiMessage.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    // Reverse to oldest-first + filter to user/assistant only
    return rows
      .reverse()
      .filter((r: any) => r.role === 'user' || r.role === 'assistant')
      .map((r: any) => ({ role: r.role, content: r.content }));
  }

  async appendMessage(
    tenantId: string,
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    tokenCount?: number,
  ) {
    await (this.prisma as any).aiMessage.create({
      data: { tenantId, conversationId, role, content, tokenCount },
    });
    await (this.prisma as any).aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), messageCount: { increment: 1 } },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private generateTitle(firstQuestion: string): string {
    const trimmed = firstQuestion.trim();
    if (trimmed.length <= 60) return trimmed;
    return trimmed.slice(0, 57) + '...';
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        clientId,
        tenantId: user.tenantId,
        deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }
}
