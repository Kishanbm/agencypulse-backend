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
import { KlaviyoApiService } from '../integrations/platforms/klaviyo-api.service';
import { ActiveCampaignApiService } from '../integrations/platforms/activecampaign-api.service';
import { BrevoApiService } from '../integrations/platforms/brevo-api.service';
import { MailchimpApiService } from '../integrations/platforms/mailchimp-api.service';
import { CampaignMonitorApiService } from '../integrations/platforms/campaign-monitor-api.service';
import { ConvertKitApiService } from '../integrations/platforms/convertkit-api.service';
import { DripApiService } from '../integrations/platforms/drip-api.service';
import { ConstantContactApiService } from '../integrations/platforms/constant-contact-api.service';
import { AhrefsApiService } from '../integrations/platforms/ahrefs-api.service';
import { MozApiService } from '../integrations/platforms/moz-api.service';
import { SemrushApiService } from '../integrations/platforms/semrush-api.service';
import { MajesticApiService } from '../integrations/platforms/majestic-api.service';
import { SeRankingApiService } from '../integrations/platforms/se-ranking-api.service';
import { BrightLocalApiService } from '../integrations/platforms/brightlocal-api.service';
import { GooglePagespeedApiService } from '../integrations/platforms/google-pagespeed-api.service';
import { BingWebmasterApiService } from '../integrations/platforms/bing-webmaster-api.service';
import { CallrailApiService } from '../integrations/platforms/callrail-api.service';
import { CalltrackingMetricsApiService } from '../integrations/platforms/calltracking-metrics-api.service';
import { WhatConvertsApiService } from '../integrations/platforms/whatconverts-api.service';
import { TwilioApiService } from '../integrations/platforms/twilio-api.service';
import { MarchexApiService } from '../integrations/platforms/marchex-api.service';
import { AvanserApiService } from '../integrations/platforms/avanser-api.service';
import { CallsourceApiService } from '../integrations/platforms/callsource-api.service';
import { DelaconApiService } from '../integrations/platforms/delacon-api.service';
import { WildJarApiService } from '../integrations/platforms/wildjar-api.service';
import { TrustpilotApiService } from '../integrations/platforms/trustpilot-api.service';
import { YelpApiService } from '../integrations/platforms/yelp-api.service';
import { BirdeyeApiService } from '../integrations/platforms/birdeye-api.service';
import { GatherUpApiService } from '../integrations/platforms/gatherup-api.service';
import { GradeUsApiService } from '../integrations/platforms/gradeus-api.service';
import { SynupApiService } from '../integrations/platforms/synup-api.service';
import { YextApiService } from '../integrations/platforms/yext-api.service';
import { VendastaApiService } from '../integrations/platforms/vendasta-api.service';
import { GoogleBusinessProfileApiService } from '../integrations/platforms/google-business-profile-api.service';
import { MicrosoftAdsApiService } from '../integrations/platforms/microsoft-ads-api.service';
import { PinterestAdsApiService } from '../integrations/platforms/pinterest-ads-api.service';
import { SnapchatAdsApiService } from '../integrations/platforms/snapchat-ads-api.service';
import { XAdsApiService } from '../integrations/platforms/x-ads-api.service';
import { RedditAdsApiService } from '../integrations/platforms/reddit-ads-api.service';
import { AdrollApiService } from '../integrations/platforms/adroll-api.service';
import { GoogleAdManagerApiService } from '../integrations/platforms/google-ad-manager-api.service';
import { GoogleDv360ApiService } from '../integrations/platforms/google-dv360-api.service';
import { GoogleLsaApiService } from '../integrations/platforms/google-lsa-api.service';
import { InstagramAdsApiService } from '../integrations/platforms/instagram-ads-api.service';
import { SpotifyAdsApiService } from '../integrations/platforms/spotify-ads-api.service';
import { StackAdaptApiService } from '../integrations/platforms/stackadapt-api.service';
import { SimplifiApiService } from '../integrations/platforms/simplifi-api.service';
import { ChoozleApiService } from '../integrations/platforms/choozle-api.service';
import { GroundtruthApiService } from '../integrations/platforms/groundtruth-api.service';
import { BasisApiService } from '../integrations/platforms/basis-api.service';
import { YelpAdsApiService } from '../integrations/platforms/yelp-ads-api.service';
import { FacebookOrganicApiService } from '../integrations/platforms/facebook-organic-api.service';
import { InstagramOrganicApiService } from '../integrations/platforms/instagram-organic-api.service';
import { PinterestOrganicApiService } from '../integrations/platforms/pinterest-organic-api.service';
import { VimeoApiService } from '../integrations/platforms/vimeo-api.service';
import { XOrganicApiService } from '../integrations/platforms/x-organic-api.service';
import { TiktokOrganicApiService } from '../integrations/platforms/tiktok-organic-api.service';
import { ShopifyApiService } from '../integrations/platforms/shopify-api.service';
import { WoocommerceApiService } from '../integrations/platforms/woocommerce-api.service';
import { BigcommerceApiService } from '../integrations/platforms/bigcommerce-api.service';
import { StripeApiService } from '../integrations/platforms/stripe-api.service';
import { KeapApiService } from '../integrations/platforms/keap-api.service';
import { HubspotApiService } from '../integrations/platforms/hubspot-api.service';
import { MatomoApiService } from '../integrations/platforms/matomo-api.service';
import { SalesforceApiService } from '../integrations/platforms/salesforce-api.service';
import { SharpspringApiService } from '../integrations/platforms/sharpspring-api.service';
import { GravityFormsApiService } from '../integrations/platforms/gravity-forms-api.service';
import { UnbounceApiService } from '../integrations/platforms/unbounce-api.service';
import { HighlevelApiService } from '../integrations/platforms/highlevel-api.service';
import { GoogleSheetsApiService } from '../integrations/platforms/google-sheets-api.service';
import { BigqueryApiService } from '../integrations/platforms/bigquery-api.service';
import { MysqlApiService } from '../integrations/platforms/mysql-api.service';
import { RedshiftApiService } from '../integrations/platforms/redshift-api.service';
import { SnowflakeApiService } from '../integrations/platforms/snowflake-api.service';
import { PlatformStubModule } from '../integrations/platform-stub/platform-stub.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SYNC_QUEUE } from './constants/sync-queue.constants';
import { ALERT_CHECK_QUEUE } from '../alerts/constants/alert-queue.constants';
import { IntegrationSyncProcessor } from './processors/integration-sync.processor';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { TestConnectionService } from './test-connection.service';
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
    // Phase 3.9 — provides StandardTokenService for OAuth stub platforms
    PlatformStubModule,
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncSchedulerService,
    TestConnectionService,
    IntegrationSyncProcessor,
    // Phase 3.9 platform API services
    KlaviyoApiService,
    ActiveCampaignApiService,
    BrevoApiService,
    MailchimpApiService,
    CampaignMonitorApiService,
    ConvertKitApiService,
    DripApiService,
    ConstantContactApiService,
    AhrefsApiService,
    MozApiService,
    SemrushApiService,
    MajesticApiService,
    SeRankingApiService,
    BrightLocalApiService,
    GooglePagespeedApiService,
    BingWebmasterApiService,
    // Local / Reputation platforms
    TrustpilotApiService,
    YelpApiService,
    BirdeyeApiService,
    GatherUpApiService,
    GradeUsApiService,
    SynupApiService,
    YextApiService,
    VendastaApiService,
    GoogleBusinessProfileApiService,
    // Call Tracking platforms
    CallrailApiService,
    CalltrackingMetricsApiService,
    WhatConvertsApiService,
    TwilioApiService,
    MarchexApiService,
    AvanserApiService,
    CallsourceApiService,
    DelaconApiService,
    WildJarApiService,
    // PPC platforms (Phase 3.10)
    MicrosoftAdsApiService,
    PinterestAdsApiService,
    SnapchatAdsApiService,
    XAdsApiService,
    RedditAdsApiService,
    AdrollApiService,
    GoogleAdManagerApiService,
    GoogleDv360ApiService,
    GoogleLsaApiService,
    InstagramAdsApiService,
    SpotifyAdsApiService,
    StackAdaptApiService,
    SimplifiApiService,
    ChoozleApiService,
    GroundtruthApiService,
    BasisApiService,
    YelpAdsApiService,
    // Social/Organic platforms (Phase 3.11)
    FacebookOrganicApiService,
    InstagramOrganicApiService,
    PinterestOrganicApiService,
    VimeoApiService,
    XOrganicApiService,
    TiktokOrganicApiService,
    // Ecommerce platforms (Phase 3.12)
    ShopifyApiService,
    WoocommerceApiService,
    BigcommerceApiService,
    StripeApiService,
    KeapApiService,
    // Analytics / CRM / Database platforms (Phase 3.13)
    HubspotApiService,
    MatomoApiService,
    SalesforceApiService,
    SharpspringApiService,
    GravityFormsApiService,
    UnbounceApiService,
    HighlevelApiService,
    GoogleSheetsApiService,
    BigqueryApiService,
    MysqlApiService,
    RedshiftApiService,
    SnowflakeApiService,
  ],
  exports: [SyncService],
})
export class SyncModule {}
