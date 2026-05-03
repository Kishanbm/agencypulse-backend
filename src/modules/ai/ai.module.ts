import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { GlobalAiController } from './global-ai.controller';
import { PublicAiController } from './public-ai.controller';
import { AnthropicClient } from './anthropic.client';
import { AiReportService } from './ai-report.service';
import { AiConversationService } from './ai-conversation.service';
import { AiChatService } from './ai-chat.service';
import { AiInsightsService } from './ai-insights.service';
import { AiToolsService } from './ai-tools.service';
import { AiGlobalService } from './ai-global.service';
import { AiPublicService } from './ai-public.service';
import { MetricsModule } from '../metrics/metrics.module';
import { ReportsModule } from '../reports/reports.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [MetricsModule, CacheModule, ReportsModule],
  controllers: [AiController, GlobalAiController, PublicAiController],
  providers: [
    AnthropicClient,
    AiReportService,
    AiConversationService,
    AiChatService,
    AiInsightsService,
    AiToolsService,
    AiGlobalService,
    AiPublicService,
  ],
  exports: [AiReportService, AiChatService, AiGlobalService],
})
export class AiModule {}
