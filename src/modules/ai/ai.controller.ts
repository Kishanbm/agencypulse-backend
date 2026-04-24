import {
  Controller, Get, Post, Delete, Param, Body, Query, Sse, MessageEvent,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable, map } from 'rxjs';
import { AiReportService } from './ai-report.service';
import { AiConversationService } from './ai-conversation.service';
import { AiChatService } from './ai-chat.service';
import { AiInsightsService } from './ai-insights.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('clients/:clientId/campaigns/:campaignId')
export class AiController {
  constructor(
    private readonly reportService: AiReportService,
    private readonly conversationService: AiConversationService,
    private readonly chatService: AiChatService,
    private readonly insightsService: AiInsightsService,
  ) {}

  // ─── 8.4: AI Report Summary ─────────────────────────────────────────────────

  @Post('reports/:reportId/ai-summary')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generate (or regenerate) the AI executive summary for a report' })
  generateReportSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('reportId') reportId: string,
    @Query('force') force?: string,
  ) {
    return this.reportService.generateSummary(user, clientId, campaignId, reportId, force === 'true');
  }

  // ─── 8.5: AI Assistant Conversations ────────────────────────────────────────

  @Post('ai/conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start a new conversation (returns conversation id + first response)' })
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateConversationDto,
  ) {
    const conv = await this.conversationService.createConversation(
      user, clientId, campaignId, dto.question,
    );
    const reply = await this.chatService.sendMessage(
      user, clientId, campaignId, conv.id, dto.question,
    );
    return { conversationId: conv.id, title: conv.title, reply };
  }

  @Get('ai/conversations')
  @ApiOperation({ summary: 'List your conversations for this campaign' })
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.conversationService.listConversations(user, clientId, campaignId);
  }

  @Get('ai/conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get full message history of a conversation' })
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationService.getMessages(user, clientId, campaignId, conversationId);
  }

  @Post('ai/conversations/:conversationId/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a follow-up message (non-streaming JSON response)' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user, clientId, campaignId, conversationId, dto.content);
  }

  @Sse('ai/conversations/:conversationId/stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'SSE stream — send a message and receive token-by-token response' })
  streamMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('conversationId') conversationId: string,
    @Query('content') content: string,
  ): Observable<MessageEvent> {
    return this.chatService
      .streamMessage(user, clientId, campaignId, conversationId, content)
      .pipe(map(event => ({ data: event.data }) as MessageEvent));
  }

  @Delete('ai/conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationService.deleteConversation(user, clientId, campaignId, conversationId);
  }

  // ─── 8.5b: Proactive Insights ───────────────────────────────────────────────

  @Get('ai/insights')
  @ApiOperation({ summary: 'Get top 3 proactive insights (biggest changes last 7 days)' })
  getInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.insightsService.getInsights(user, clientId, campaignId);
  }
}
