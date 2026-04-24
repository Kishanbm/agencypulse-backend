import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Ga4Module } from '../integrations/ga4/ga4.module';
import { GoogleAdsModule } from '../integrations/google-ads/google-ads.module';
import { MetaAdsModule } from '../integrations/meta-ads/meta-ads.module';
import { GscModule } from '../integrations/google-search-console/gsc.module';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { LinkedinAdsModule } from '../integrations/linkedin-ads/linkedin-ads.module';
import { TiktokAdsModule } from '../integrations/tiktok-ads/tiktok-ads.module';
import { AmazonAdsModule } from '../integrations/amazon-ads/amazon-ads.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SYNC_QUEUE } from './constants/sync-queue.constants';
import { ALERT_CHECK_QUEUE } from '../alerts/constants/alert-queue.constants';
import { IntegrationSyncProcessor } from './processors/integration-sync.processor';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { SyncController } from './sync.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'custom' },
        removeOnComplete: { count: 100 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
    BullModule.registerQueue({ name: ALERT_CHECK_QUEUE }),
    DatabaseModule,
    IntegrationsModule,

    // Phase 3.2–3.4 platforms
    Ga4Module,
    GoogleAdsModule,
    MetaAdsModule,

    // Phase 3.7 platforms
    GscModule,
    YoutubeModule,
    LinkedinAdsModule,
    TiktokAdsModule,
    AmazonAdsModule,

    MetricsModule,
    NotificationsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncSchedulerService, IntegrationSyncProcessor],
  exports: [SyncService],
})
export class SyncModule {}
