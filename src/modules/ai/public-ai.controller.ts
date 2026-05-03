import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { AiPublicService } from './ai-public.service';
import { PublicSendMessageDto } from './dto/public-message.dto';

/**
 * Public marketing-site bot — answers ONLY questions about AgencyPulse.
 *
 * No auth, no DB writes, no tools. Heavy IP-based rate limiting since this
 * endpoint is exposed to the open internet and each call costs Anthropic credits.
 */
@ApiTags('AI Public')
@Controller('ai/public')
export class PublicAiController {
  constructor(private readonly publicService: AiPublicService) {}

  // 8 messages per minute per IP — enough for genuine browsing, blocks abuse loops.
  @Public()
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Stateless platform-info chat (no auth required)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async chat(@Body() dto: PublicSendMessageDto): Promise<{ content: string }> {
    return this.publicService.chat(dto);
  }
}
