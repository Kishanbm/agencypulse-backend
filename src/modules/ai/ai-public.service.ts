import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AnthropicClient } from './anthropic.client';
import { PUBLIC_ASSISTANT_PROMPT } from './prompts/public-assistant.prompt';
import type { PublicSendMessageDto } from './dto/public-message.dto';
import type Anthropic from '@anthropic-ai/sdk';

const MAX_OUTPUT_TOKENS = 400;
const MAX_HISTORY_TURNS = 10;

/**
 * Public, unauthenticated marketing-site chat.
 *
 * Stateless — no DB, no conversation persistence. The browser keeps prior
 * turns in localStorage and POSTs them back as `history` on each request.
 *
 * No tools. No data access. Hard-scoped to platform info via the system prompt.
 */
@Injectable()
export class AiPublicService {
  private readonly logger = new Logger(AiPublicService.name);

  constructor(private readonly anthropic: AnthropicClient) {}

  async chat(dto: PublicSendMessageDto): Promise<{ content: string }> {
    const history = (dto.history ?? []).slice(-MAX_HISTORY_TURNS);

    const messages: Anthropic.Messages.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: dto.message },
    ];

    const client = this.anthropic.getClient();
    // Default chat model is already Haiku — fast and cheap, fine for public bot.
    const model = this.anthropic.getChatModel();

    try {
      const resp = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: PUBLIC_ASSISTANT_PROMPT,
        messages,
      });
      const block = resp.content[0];
      const text = block?.type === 'text' ? block.text.trim() : '';
      return { content: text || "Sorry, I didn't catch that — could you rephrase?" };
    } catch (err: unknown) {
      this.logger.error(`Public AI failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Assistant temporarily unavailable.');
    }
  }
}
