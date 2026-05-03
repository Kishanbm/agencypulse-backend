import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiGlobalService } from './ai-global.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('AI Global')
@ApiBearerAuth()
@Controller('ai/global')
export class GlobalAiController {
  constructor(private readonly globalService: AiGlobalService) {}

  @Post('conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start a new agency-wide conversation (returns conversation id + first response)' })
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    const conv = await this.globalService.createConversation(user, dto.question);
    const reply = await this.globalService.sendMessage(user, conv.id, dto.question);
    return { conversationId: conv.id, title: conv.title, reply };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List your global conversations' })
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.globalService.listConversations(user);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get full message history of a global conversation' })
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.globalService.getMessages(user, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a follow-up message to a global conversation' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.globalService.sendMessage(user, conversationId, dto.content);
  }

  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a global conversation' })
  deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.globalService.deleteConversation(user, conversationId);
  }
}
