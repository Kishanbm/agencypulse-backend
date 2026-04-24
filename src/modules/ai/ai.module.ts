import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AnthropicClient } from './anthropic.client';
import { AiReportService } from './ai-report.service';
import { AiConversationService } from './ai-conversation.service';
import { AiChatService } from './ai-chat.service';
import { AiInsightsService } from './ai-insights.service';
import { MetricsModule } from '../metrics/metrics.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [MetricsModule, CacheModule],
  controllers: [AiController],
  providers: [
    AnthropicClient,
    AiReportService,
    AiConversationService,
    AiChatService,
    AiInsightsService,
  ],
  exports: [AiReportService, AiChatService],
})
export class AiModule {}
