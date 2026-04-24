import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Shared Anthropic SDK wrapper.
 * One client instance for both AI Report Summary (8.4) and AI Assistant (8.5).
 *
 * Defaults:
 *   - Chat model: claude-haiku-4-5 (fast, cheap — for conversation + report summaries)
 *   - Max tokens per response: 1024 (chat) / 1500 (report summary)
 *   - Request timeout: 30s
 */
@Injectable()
export class AnthropicClient {
  private readonly logger = new Logger(AnthropicClient.name);
  private readonly client: Anthropic | null;
  private readonly chatModel: string;
  private readonly reportSummaryModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('anthropic.apiKey');
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — AI features will return 503.');
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey, timeout: 30_000 });
    }
    this.chatModel = this.config.get<string>('anthropic.chatModel')!;
    this.reportSummaryModel = this.config.get<string>('anthropic.reportSummaryModel')!;
  }

  getClient(): Anthropic {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features are not configured. Set ANTHROPIC_API_KEY in .env.',
      );
    }
    return this.client;
  }

  getChatModel(): string {
    return this.chatModel;
  }

  getReportSummaryModel(): string {
    return this.reportSummaryModel;
  }
}
