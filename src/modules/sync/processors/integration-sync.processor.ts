import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { IntegrationPlatform, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { Ga4OAuthService } from '../../integrations/ga4/ga4-oauth.service';
import { Ga4ApiService } from '../../integrations/ga4/ga4-api.service';
import { GoogleAdsOAuthService } from '../../integrations/google-ads/google-ads-oauth.service';
import { GoogleAdsApiService } from '../../integrations/google-ads/google-ads-api.service';
import { MetaAdsOAuthService } from '../../integrations/meta-ads/meta-ads-oauth.service';
import { MetaAdsApiService } from '../../integrations/meta-ads/meta-ads-api.service';
import { GscOAuthService } from '../../integrations/google-search-console/gsc-oauth.service';
import { GscApiService } from '../../integrations/google-search-console/gsc-api.service';
import { YoutubeOAuthService } from '../../integrations/youtube/youtube-oauth.service';
import { YoutubeApiService } from '../../integrations/youtube/youtube-api.service';
import { LinkedinAdsOAuthService } from '../../integrations/linkedin-ads/linkedin-ads-oauth.service';
import { LinkedinAdsApiService } from '../../integrations/linkedin-ads/linkedin-ads-api.service';
import { TiktokAdsOAuthService } from '../../integrations/tiktok-ads/tiktok-ads-oauth.service';
import { TiktokAdsApiService } from '../../integrations/tiktok-ads/tiktok-ads-api.service';
import { AmazonAdsOAuthService } from '../../integrations/amazon-ads/amazon-ads-oauth.service';
import { AmazonAdsApiService } from '../../integrations/amazon-ads/amazon-ads-api.service';
import { KlaviyoApiService } from '../../integrations/platforms/klaviyo-api.service';
import { ActiveCampaignApiService } from '../../integrations/platforms/activecampaign-api.service';
import { BrevoApiService } from '../../integrations/platforms/brevo-api.service';
import { MailchimpApiService } from '../../integrations/platforms/mailchimp-api.service';
import { CampaignMonitorApiService } from '../../integrations/platforms/campaign-monitor-api.service';
import { ConvertKitApiService } from '../../integrations/platforms/convertkit-api.service';
import { DripApiService } from '../../integrations/platforms/drip-api.service';
import { ConstantContactApiService } from '../../integrations/platforms/constant-contact-api.service';
import { AhrefsApiService } from '../../integrations/platforms/ahrefs-api.service';
import { MozApiService } from '../../integrations/platforms/moz-api.service';
import { SemrushApiService } from '../../integrations/platforms/semrush-api.service';
import { MajesticApiService } from '../../integrations/platforms/majestic-api.service';
import { SeRankingApiService } from '../../integrations/platforms/se-ranking-api.service';
import { BrightLocalApiService } from '../../integrations/platforms/brightlocal-api.service';
import { GooglePagespeedApiService } from '../../integrations/platforms/google-pagespeed-api.service';
import { BingWebmasterApiService } from '../../integrations/platforms/bing-webmaster-api.service';
import { CallrailApiService } from '../../integrations/platforms/callrail-api.service';
import { CalltrackingMetricsApiService } from '../../integrations/platforms/calltracking-metrics-api.service';
import { WhatConvertsApiService } from '../../integrations/platforms/whatconverts-api.service';
import { TwilioApiService } from '../../integrations/platforms/twilio-api.service';
import { MarchexApiService } from '../../integrations/platforms/marchex-api.service';
import { AvanserApiService } from '../../integrations/platforms/avanser-api.service';
import { CallsourceApiService } from '../../integrations/platforms/callsource-api.service';
import { DelaconApiService } from '../../integrations/platforms/delacon-api.service';
import { WildJarApiService } from '../../integrations/platforms/wildjar-api.service';
import { TrustpilotApiService } from '../../integrations/platforms/trustpilot-api.service';
import { YelpApiService } from '../../integrations/platforms/yelp-api.service';
import { BirdeyeApiService } from '../../integrations/platforms/birdeye-api.service';
import { GatherUpApiService } from '../../integrations/platforms/gatherup-api.service';
import { GradeUsApiService } from '../../integrations/platforms/gradeus-api.service';
import { SynupApiService } from '../../integrations/platforms/synup-api.service';
import { YextApiService } from '../../integrations/platforms/yext-api.service';
import { VendastaApiService } from '../../integrations/platforms/vendasta-api.service';
import { GoogleBusinessProfileApiService } from '../../integrations/platforms/google-business-profile-api.service';
import { MicrosoftAdsApiService } from '../../integrations/platforms/microsoft-ads-api.service';
import { PinterestAdsApiService } from '../../integrations/platforms/pinterest-ads-api.service';
import { SnapchatAdsApiService } from '../../integrations/platforms/snapchat-ads-api.service';
import { XAdsApiService } from '../../integrations/platforms/x-ads-api.service';
import { RedditAdsApiService } from '../../integrations/platforms/reddit-ads-api.service';
import { AdrollApiService } from '../../integrations/platforms/adroll-api.service';
import { GoogleAdManagerApiService } from '../../integrations/platforms/google-ad-manager-api.service';
import { GoogleDv360ApiService } from '../../integrations/platforms/google-dv360-api.service';
import { GoogleLsaApiService } from '../../integrations/platforms/google-lsa-api.service';
import { InstagramAdsApiService } from '../../integrations/platforms/instagram-ads-api.service';
import { SpotifyAdsApiService } from '../../integrations/platforms/spotify-ads-api.service';
import { StackAdaptApiService } from '../../integrations/platforms/stackadapt-api.service';
import { SimplifiApiService } from '../../integrations/platforms/simplifi-api.service';
import { ChoozleApiService } from '../../integrations/platforms/choozle-api.service';
import { GroundtruthApiService } from '../../integrations/platforms/groundtruth-api.service';
import { BasisApiService } from '../../integrations/platforms/basis-api.service';
import { YelpAdsApiService } from '../../integrations/platforms/yelp-ads-api.service';
import { FacebookOrganicApiService } from '../../integrations/platforms/facebook-organic-api.service';
import { InstagramOrganicApiService } from '../../integrations/platforms/instagram-organic-api.service';
import { PinterestOrganicApiService } from '../../integrations/platforms/pinterest-organic-api.service';
import { VimeoApiService } from '../../integrations/platforms/vimeo-api.service';
import { XOrganicApiService } from '../../integrations/platforms/x-organic-api.service';
import { TiktokOrganicApiService } from '../../integrations/platforms/tiktok-organic-api.service';
import { ShopifyApiService } from '../../integrations/platforms/shopify-api.service';
import { WoocommerceApiService } from '../../integrations/platforms/woocommerce-api.service';
import { BigcommerceApiService } from '../../integrations/platforms/bigcommerce-api.service';
import { StripeApiService } from '../../integrations/platforms/stripe-api.service';
import { KeapApiService } from '../../integrations/platforms/keap-api.service';
import { HubspotApiService } from '../../integrations/platforms/hubspot-api.service';
import { MatomoApiService } from '../../integrations/platforms/matomo-api.service';
import { SalesforceApiService } from '../../integrations/platforms/salesforce-api.service';
import { SharpspringApiService } from '../../integrations/platforms/sharpspring-api.service';
import { GravityFormsApiService } from '../../integrations/platforms/gravity-forms-api.service';
import { UnbounceApiService } from '../../integrations/platforms/unbounce-api.service';
import { HighlevelApiService } from '../../integrations/platforms/highlevel-api.service';
import { GoogleSheetsApiService } from '../../integrations/platforms/google-sheets-api.service';
import { BigqueryApiService } from '../../integrations/platforms/bigquery-api.service';
import { MysqlApiService } from '../../integrations/platforms/mysql-api.service';
import { RedshiftApiService } from '../../integrations/platforms/redshift-api.service';
import { SnowflakeApiService } from '../../integrations/platforms/snowflake-api.service';
import { StandardTokenService } from '../../integrations/platform-stub/standard-token.service';
import { MetricsService } from '../../metrics/metrics.service';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { SYNC_QUEUE } from '../constants/sync-queue.constants';
import { SyncJobPayload } from '../dto/sync-job.dto';
import { ALERT_CHECK_QUEUE } from '../../alerts/constants/alert-queue.constants';
import { AlertCheckJobPayload } from '../../alerts/processors/alert-check.processor';
import { NotificationsService } from '../../notifications/notifications.service';

@Processor(SYNC_QUEUE, {
  concurrency: 5, // Fix 2: max 5 jobs running simultaneously per worker process

  settings: {
    // Optional but high-value: jitter prevents thundering herd when many jobs
    // retry at the same time (e.g. after a brief platform outage).
    // delay = base * 2^attempt + random(0–1000ms)
    backoffStrategy: (attemptsMade: number): number => {
      return Math.pow(2, attemptsMade) * 5_000 + Math.floor(Math.random() * 1_000);
    },
  },
})
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly ga4OAuth: Ga4OAuthService,
    private readonly ga4Api: Ga4ApiService,
    private readonly googleAdsOAuth: GoogleAdsOAuthService,
    private readonly googleAdsApi: GoogleAdsApiService,
    private readonly metaAdsOAuth: MetaAdsOAuthService,
    private readonly metaAdsApi: MetaAdsApiService,
    private readonly gscOAuth: GscOAuthService,
    private readonly gscApi: GscApiService,
    private readonly youtubeOAuth: YoutubeOAuthService,
    private readonly youtubeApi: YoutubeApiService,
    private readonly linkedinAdsOAuth: LinkedinAdsOAuthService,
    private readonly linkedinAdsApi: LinkedinAdsApiService,
    private readonly tiktokAdsOAuth: TiktokAdsOAuthService,
    private readonly tiktokAdsApi: TiktokAdsApiService,
    private readonly amazonAdsOAuth: AmazonAdsOAuthService,
    private readonly amazonAdsApi: AmazonAdsApiService,
    private readonly klaviyoApi: KlaviyoApiService,
    private readonly activeCampaignApi: ActiveCampaignApiService,
    private readonly brevoApi: BrevoApiService,
    private readonly mailchimpApi: MailchimpApiService,
    private readonly campaignMonitorApi: CampaignMonitorApiService,
    private readonly convertKitApi: ConvertKitApiService,
    private readonly dripApi: DripApiService,
    private readonly constantContactApi: ConstantContactApiService,
    private readonly ahrefsApi: AhrefsApiService,
    private readonly mozApi: MozApiService,
    private readonly semrushApi: SemrushApiService,
    private readonly majesticApi: MajesticApiService,
    private readonly seRankingApi: SeRankingApiService,
    private readonly brightLocalApi: BrightLocalApiService,
    private readonly googlePagespeedApi: GooglePagespeedApiService,
    private readonly bingWebmasterApi: BingWebmasterApiService,
    private readonly callrailApi: CallrailApiService,
    private readonly calltrackingMetricsApi: CalltrackingMetricsApiService,
    private readonly whatconvertsApi: WhatConvertsApiService,
    private readonly twilioApi: TwilioApiService,
    private readonly marchexApi: MarchexApiService,
    private readonly avanserApi: AvanserApiService,
    private readonly callsourceApi: CallsourceApiService,
    private readonly delaconApi: DelaconApiService,
    private readonly wildJarApi: WildJarApiService,
    private readonly trustpilotApi: TrustpilotApiService,
    private readonly yelpApi: YelpApiService,
    private readonly birdeyeApi: BirdeyeApiService,
    private readonly gatherUpApi: GatherUpApiService,
    private readonly gradeUsApi: GradeUsApiService,
    private readonly synupApi: SynupApiService,
    private readonly yextApi: YextApiService,
    private readonly vendastaApi: VendastaApiService,
    private readonly googleBusinessProfileApi: GoogleBusinessProfileApiService,
    private readonly microsoftAdsApi: MicrosoftAdsApiService,
    private readonly pinterestAdsApi: PinterestAdsApiService,
    private readonly snapchatAdsApi: SnapchatAdsApiService,
    private readonly xAdsApi: XAdsApiService,
    private readonly redditAdsApi: RedditAdsApiService,
    private readonly adrollApi: AdrollApiService,
    private readonly googleAdManagerApi: GoogleAdManagerApiService,
    private readonly googleDv360Api: GoogleDv360ApiService,
    private readonly googleLsaApi: GoogleLsaApiService,
    private readonly instagramAdsApi: InstagramAdsApiService,
    private readonly spotifyAdsApi: SpotifyAdsApiService,
    private readonly stackAdaptApi: StackAdaptApiService,
    private readonly simplifiApi: SimplifiApiService,
    private readonly choozleApi: ChoozleApiService,
    private readonly groundtruthApi: GroundtruthApiService,
    private readonly basisApi: BasisApiService,
    private readonly yelpAdsApi: YelpAdsApiService,
    private readonly facebookOrganicApi: FacebookOrganicApiService,
    private readonly instagramOrganicApi: InstagramOrganicApiService,
    private readonly pinterestOrganicApi: PinterestOrganicApiService,
    private readonly vimeoApi: VimeoApiService,
    private readonly xOrganicApi: XOrganicApiService,
    private readonly tiktokOrganicApi: TiktokOrganicApiService,
    private readonly shopifyApi: ShopifyApiService,
    private readonly woocommerceApi: WoocommerceApiService,
    private readonly bigcommerceApi: BigcommerceApiService,
    private readonly stripeApi: StripeApiService,
    private readonly keapApi: KeapApiService,
    private readonly hubspotApi: HubspotApiService,
    private readonly matomoApi: MatomoApiService,
    private readonly salesforceApi: SalesforceApiService,
    private readonly sharpspringApi: SharpspringApiService,
    private readonly gravityFormsApi: GravityFormsApiService,
    private readonly unbounceApi: UnbounceApiService,
    private readonly highlevelApi: HighlevelApiService,
    private readonly googleSheetsApi: GoogleSheetsApiService,
    private readonly bigqueryApi: BigqueryApiService,
    private readonly mysqlApi: MysqlApiService,
    private readonly redshiftApi: RedshiftApiService,
    private readonly snowflakeApi: SnowflakeApiService,
    private readonly standardToken: StandardTokenService,
    private readonly metricsService: MetricsService,
    @InjectQueue(ALERT_CHECK_QUEUE)
    private readonly alertCheckQueue: Queue<AlertCheckJobPayload>,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  // FIX (queue explosion): deduplicated by campaign+platform+date — one check per day max
  private async enqueueAlertCheck(
    tenantId: string, campaignId: string, campaignName: string, platform: string,
  ): Promise<void> {
    const dateStr = new Date().toISOString().slice(0, 10);
    const jobId = `alert-check:${tenantId}:${campaignId}:${platform}:${dateStr}`;
    try {
      await this.alertCheckQueue.add(
        'check',
        { tenantId, campaignId, campaignName, platform },
        { jobId, delay: 2_000 }, // 2s delay — let upsert fully commit first
      );
    } catch {
      // Non-critical — never fail a sync because alert check couldn't be queued
    }
  }

  // ─── Job router ────────────────────────────────────────────────────────────

  async process(job: Job<SyncJobPayload>): Promise<void> {
    switch (job.data.platform) {
      case IntegrationPlatform.GA4:
        return this.syncGa4(job);
      case IntegrationPlatform.GOOGLE_ADS:
        return this.syncGoogleAds(job);
      case IntegrationPlatform.META_ADS:
        return this.syncMetaAds(job);
      case IntegrationPlatform.GOOGLE_SEARCH_CONSOLE:
        return this.syncGsc(job);
      case IntegrationPlatform.YOUTUBE_ANALYTICS:
        return this.syncYoutube(job);
      case IntegrationPlatform.LINKEDIN_ADS:
        return this.syncLinkedinAds(job);
      case IntegrationPlatform.TIKTOK_ADS:
        return this.syncTiktokAds(job);
      case IntegrationPlatform.AMAZON_ADS:
        return this.syncAmazonAds(job);
      // ─── Phase 3.9 platforms ────────────────────────────────────────────────
      case IntegrationPlatform.KLAVIYO:
        return this.syncKlaviyo(job);
      case IntegrationPlatform.ACTIVECAMPAIGN:
        return this.syncActiveCampaign(job);
      case IntegrationPlatform.BREVO:
        return this.syncBrevo(job);
      case IntegrationPlatform.MAILCHIMP:
        return this.syncMailchimp(job);
      case IntegrationPlatform.CAMPAIGN_MONITOR:
        return this.syncCampaignMonitor(job);
      case IntegrationPlatform.CONVERTKIT:
        return this.syncConvertKit(job);
      case IntegrationPlatform.DRIP:
        return this.syncDrip(job);
      case IntegrationPlatform.CONSTANT_CONTACT:
        return this.syncConstantContact(job);
      case IntegrationPlatform.AHREFS:
        return this.syncAhrefs(job);
      case IntegrationPlatform.MOZ:
        return this.syncMoz(job);
      case IntegrationPlatform.SEMRUSH:
        return this.syncSemrush(job);
      case IntegrationPlatform.MAJESTIC_SEO:
        return this.syncMajestic(job);
      case IntegrationPlatform.SE_RANKING:
        return this.syncSeRanking(job);
      case IntegrationPlatform.BRIGHTLOCAL:
        return this.syncBrightLocal(job);
      case IntegrationPlatform.GOOGLE_PAGESPEED:
        return this.syncGooglePagespeed(job);
      case IntegrationPlatform.BING_WEBMASTER_TOOLS:
        return this.syncBingWebmaster(job);
      // ─── Call Tracking platforms ────────────────────────────────────────────
      case IntegrationPlatform.CALLRAIL:
        return this.syncCallRail(job);
      case IntegrationPlatform.CALLTRACKING_METRICS:
        return this.syncCallTrackingMetrics(job);
      case IntegrationPlatform.WHATCONVERTS:
        return this.syncWhatConverts(job);
      case IntegrationPlatform.TWILIO:
        return this.syncTwilio(job);
      case IntegrationPlatform.MARCHEX:
        return this.syncMarchex(job);
      case IntegrationPlatform.AVANSER:
        return this.syncAvanser(job);
      case IntegrationPlatform.CALLSOURCE:
        return this.syncCallSource(job);
      case IntegrationPlatform.DELACON:
        return this.syncDelacon(job);
      case IntegrationPlatform.WILDJAR:
        return this.syncWildJar(job);
      // ─── Local / Reputation platforms ───────────────────────────────────────
      case IntegrationPlatform.TRUSTPILOT:
        return this.syncTrustpilot(job);
      case IntegrationPlatform.YELP:
        return this.syncYelp(job);
      case IntegrationPlatform.BIRDEYE:
        return this.syncBirdeye(job);
      case IntegrationPlatform.GATHERUP:
        return this.syncGatherUp(job);
      case IntegrationPlatform.GRADE_US:
        return this.syncGradeUs(job);
      case IntegrationPlatform.SYNUP:
        return this.syncSynup(job);
      case IntegrationPlatform.YEXT:
        return this.syncYext(job);
      case IntegrationPlatform.VENDASTA:
        return this.syncVendasta(job);
      case IntegrationPlatform.GOOGLE_BUSINESS_PROFILE:
        return this.syncGoogleBusinessProfile(job);
      // ─── PPC platforms ──────────────────────────────────────────────────────
      case IntegrationPlatform.MICROSOFT_ADS:
        return this.syncMicrosoftAds(job);
      case IntegrationPlatform.PINTEREST_ADS:
        return this.syncPinterestAds(job);
      case IntegrationPlatform.SNAPCHAT_ADS:
        return this.syncSnapchatAds(job);
      case IntegrationPlatform.X_ADS:
        return this.syncXAds(job);
      case IntegrationPlatform.REDDIT_ADS:
        return this.syncRedditAds(job);
      case IntegrationPlatform.ADROLL:
        return this.syncAdRoll(job);
      case IntegrationPlatform.GOOGLE_AD_MANAGER:
        return this.syncGoogleAdManager(job);
      case IntegrationPlatform.GOOGLE_DV360:
        return this.syncGoogleDv360(job);
      case IntegrationPlatform.GOOGLE_LOCAL_SERVICES_ADS:
        return this.syncGoogleLsa(job);
      case IntegrationPlatform.INSTAGRAM_ADS:
        return this.syncInstagramAds(job);
      case IntegrationPlatform.SPOTIFY_ADS:
        return this.syncSpotifyAds(job);
      case IntegrationPlatform.STACKADAPT:
        return this.syncStackAdapt(job);
      case IntegrationPlatform.SIMPLIFI:
        return this.syncSimplifi(job);
      case IntegrationPlatform.CHOOZLE:
        return this.syncChoozle(job);
      case IntegrationPlatform.GROUNDTRUTH:
        return this.syncGroundTruth(job);
      case IntegrationPlatform.BASIS_PLATFORM:
        return this.syncBasis(job);
      case IntegrationPlatform.YELP_ADS:
        return this.syncYelpAds(job);
      case IntegrationPlatform.FACEBOOK_ORGANIC:
        return this.syncFacebookOrganic(job);
      case IntegrationPlatform.INSTAGRAM_ORGANIC:
        return this.syncInstagramOrganic(job);
      case IntegrationPlatform.PINTEREST_ORGANIC:
        return this.syncPinterestOrganic(job);
      case IntegrationPlatform.VIMEO:
        return this.syncVimeo(job);
      case IntegrationPlatform.X_ORGANIC:
        return this.syncXOrganic(job);
      case IntegrationPlatform.TIKTOK_ORGANIC:
        return this.syncTiktokOrganic(job);
      case IntegrationPlatform.SHOPIFY:
        return this.syncShopify(job);
      case IntegrationPlatform.WOOCOMMERCE:
        return this.syncWoocommerce(job);
      case IntegrationPlatform.BIGCOMMERCE:
        return this.syncBigcommerce(job);
      case IntegrationPlatform.STRIPE_ECOMMERCE:
        return this.syncStripe(job);
      case IntegrationPlatform.KEAP:
        return this.syncKeap(job);
      case IntegrationPlatform.HUBSPOT:
        return this.syncHubspot(job);
      case IntegrationPlatform.MATOMO:
        return this.syncMatomo(job);
      case IntegrationPlatform.SALESFORCE:
        return this.syncSalesforce(job);
      case IntegrationPlatform.SHARPSPRING:
        return this.syncSharpspring(job);
      case IntegrationPlatform.GRAVITY_FORMS:
        return this.syncGravityForms(job);
      case IntegrationPlatform.UNBOUNCE:
        return this.syncUnbounce(job);
      case IntegrationPlatform.HIGHLEVEL:
        return this.syncHighlevel(job);
      case IntegrationPlatform.GOOGLE_SHEETS:
        return this.syncGoogleSheets(job);
      case IntegrationPlatform.GOOGLE_BIGQUERY:
        return this.syncBigquery(job);
      case IntegrationPlatform.MYSQL_DB:
        return this.syncMysql(job);
      case IntegrationPlatform.AMAZON_REDSHIFT:
        return this.syncRedshift(job);
      case IntegrationPlatform.SNOWFLAKE:
        return this.syncSnowflake(job);
      default:
        this.logger.warn(`[${job.id}] Unknown platform: ${job.data.platform} — skipping`);
    }
  }

  // ─── @OnWorkerEvent('failed') — marks ERROR after all retries exhausted ───
  // Sharp edge 2: only mark ERROR after all attempts are used up (not on every failure).
  // 401 errors return early without rethrowing, so they never reach this handler.

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SyncJobPayload>, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 3;
    const { tenantId, campaignId, platform } = job.data;

    // Log every failure attempt for observability
    this.logger.warn(
      `[${job.id}] Attempt ${job.attemptsMade}/${maxAttempts} failed — platform=${platform} campaign=${campaignId}`,
      { tenantId, campaignId, platform, error: error.message, stack: error.stack },
    );

    if (job.attemptsMade >= maxAttempts) {
      await this.tenantContext.run(tenantId, async () => {
        await this.integrationsService.markError(tenantId, campaignId, platform, error.message);
      });

      void this.notifications.notifyAdmins(tenantId, {
        type: 'SYNC_FAILED',
        title: `Sync failed: ${platform}`,
        message: `Data sync for ${platform} failed after ${maxAttempts} attempts. Reconnect the integration if the issue persists.`,
        resourceType: 'Integration',
        resourceId: campaignId,
      });

      this.logger.error(
        `[${job.id}] DLQ: all ${maxAttempts} attempts exhausted — marked ERROR`,
        {
          tenantId,
          campaignId,
          platform,
          jobId: job.id,
          error: error.message,
          stack: error.stack,
          data: job.data,
        },
      );
    }
  }

  // ─── GA4 ──────────────────────────────────────────────────────────────────

  private async syncGa4(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      // Validate campaign + client still active, get externalAccountId
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return; // logged inside getActiveConnection

      // Fix 6: Never log accessToken — only log correlation ID, platform, dateRange
      let accessToken: string;
      try {
        accessToken = await this.ga4OAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] GA4 token refresh failed — marked EXPIRED`, {
          tenantId, campaignId, platform,
        });
        return; // Suppress retry — user must re-connect
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const result = await this.ga4Api.fetchCoreMetrics(
          accessToken,
          connection.externalAccountId!,
          { startDate: dateRange.from, endDate: dateRange.to },
        );

        // Convert GA4 rows → MetricRowInput[]
        // GA4 date format is YYYYMMDD → convert to YYYY-MM-DD
        const metricRows: MetricRowInput[] = [];
        for (const row of result.rows) {
          const rawDate = row.dimensions.date; // e.g. '20240115'
          const recordedAt = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

          for (const [metricKey, value] of Object.entries(row.metrics)) {
            metricRows.push({ metricKey, value, recordedAt });
          }
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] GA4 sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform,
          dateRange, rowCount: result.rowCount,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Google Ads ────────────────────────────────────────────────────────────

  private async syncGoogleAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.googleAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Google Ads token refresh failed — marked EXPIRED`, {
          tenantId, campaignId, platform,
        });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const result = await this.googleAdsApi.fetchCampaignPerformance(
          accessToken,
          connection.externalAccountId!,
          { startDate: dateRange.from, endDate: dateRange.to },
        );

        // Convert Google Ads rows → MetricRowInput[]
        // Google Ads metric fields: clicks, impressions, ctr, average_cpc, cost_micros, conversions
        // segments.date is YYYY-MM-DD
        const googleAdsMetricFields = ['clicks', 'impressions', 'ctr', 'average_cpc', 'cost_micros', 'conversions'];
        const metricRows: MetricRowInput[] = [];
        for (const row of result.rows) {
          const recordedAt = String(row['segments.date'] ?? row['date'] ?? '');
          if (!recordedAt) continue;

          for (const field of googleAdsMetricFields) {
            const rawKey = `metrics.${field}`;
            const value = row[rawKey] ?? row[field];
            if (value == null) continue;
            metricRows.push({ metricKey: field, value: String(value), recordedAt });
          }
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Google Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform,
          dateRange, rowCount: result.rows.length,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Meta Ads ─────────────────────────────────────────────────────────────

  private async syncMetaAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      // Meta has no refresh token — getValidAccessToken throws if expired
      let accessToken: string;
      try {
        accessToken = await this.metaAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Meta Ads token expired — marked EXPIRED`, {
          tenantId, campaignId, platform,
        });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.metaAdsApi.fetchCampaignInsights(
          accessToken,
          connection.externalAccountId!,
          { since: dateRange.from, until: dateRange.to },
        );

        // Convert Meta Ads rows → MetricRowInput[]
        // Meta returns date_start as YYYY-MM-DD; metric fields: impressions, clicks, spend, ctr, cpc, conversions
        const metaMetricFields = ['impressions', 'clicks', 'spend', 'ctr', 'cpc', 'conversions'];
        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          const recordedAt = row.date_start ?? '';
          if (!recordedAt) continue;

          for (const field of metaMetricFields) {
            const value = row[field];
            if (value == null) continue;
            metricRows.push({ metricKey: field, value: String(value), recordedAt });
          }
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Meta Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform,
          dateRange, rowCount: rows.length,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Google Search Console ────────────────────────────────────────────────

  private async syncGsc(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.gscOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] GSC token refresh failed — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.gscApi.queryAnalytics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        // GSC metrics: clicks, impressions, ctr, position — all keyed by date
        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'ctr', value: String(row.ctr), recordedAt: row.date },
            { metricKey: 'position', value: String(row.position), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] GSC sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── YouTube Analytics ────────────────────────────────────────────────────

  private async syncYoutube(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.youtubeOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] YouTube token refresh failed — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.youtubeApi.fetchCoreMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'views', value: String(row.views), recordedAt: row.date },
            { metricKey: 'estimatedMinutesWatched', value: String(row.estimatedMinutesWatched), recordedAt: row.date },
            { metricKey: 'averageViewDuration', value: String(row.averageViewDuration), recordedAt: row.date },
            { metricKey: 'likes', value: String(row.likes), recordedAt: row.date },
            { metricKey: 'comments', value: String(row.comments), recordedAt: row.date },
            { metricKey: 'subscribersGained', value: String(row.subscribersGained), recordedAt: row.date },
            { metricKey: 'subscribersLost', value: String(row.subscribersLost), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] YouTube sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── LinkedIn Ads ─────────────────────────────────────────────────────────

  private async syncLinkedinAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.linkedinAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] LinkedIn Ads token expired — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.linkedinAdsApi.fetchDailyMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          if (!row.date) continue;
          metricRows.push(
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'spend', value: String(row.costInLocalCurrency), recordedAt: row.date },
            { metricKey: 'conversions', value: String(row.externalWebsiteConversions), recordedAt: row.date },
            { metricKey: 'videoViews', value: String(row.videoViews), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] LinkedIn Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── TikTok Ads ───────────────────────────────────────────────────────────

  private async syncTiktokAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      // TikTok has no refresh token — getValidAccessToken throws if expired
      let accessToken: string;
      try {
        accessToken = await this.tiktokAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] TikTok Ads token expired (24h) — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.tiktokAdsApi.fetchCampaignMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'spend', value: String(row.spend), recordedAt: row.date },
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'ctr', value: String(row.ctr), recordedAt: row.date },
            { metricKey: 'cpc', value: String(row.cpc), recordedAt: row.date },
            { metricKey: 'conversions', value: String(row.conversion), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] TikTok Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Amazon Ads ───────────────────────────────────────────────────────────
  // Amazon Ads uses async report generation with polling (within the job).
  // ProfileId stored as externalAccountId. Reports typically complete in 30–60s.

  private async syncAmazonAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.amazonAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Amazon Ads token refresh failed — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.amazonAdsApi.fetchDailyMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'spend', value: String(row.spend), recordedAt: row.date },
            { metricKey: 'sales', value: String(row.sales), recordedAt: row.date },
            { metricKey: 'orders', value: String(row.orders), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Amazon Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Klaviyo ──────────────────────────────────────────────────────────────
  // API-key platform. API key stored as accessToken. externalAccountId = 'default'.

  private async syncKlaviyo(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) {
        this.logger.warn(`[${job.id}] Klaviyo: no API key stored — skipping`);
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.klaviyoApi.fetchCoreMetrics(
          tokens.accessToken!,
          connection.externalAccountId ?? 'default',
          { from: dateRange.from, to: dateRange.to },
        );

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Klaviyo sync complete — ${metricRows.length} metric rows`, {
          tenantId, campaignId, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── ActiveCampaign ───────────────────────────────────────────────────────
  // API-key platform. API key = accessToken. apiUrl stored in externalAccountId JSON.

  private async syncActiveCampaign(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) {
        this.logger.warn(`[${job.id}] ActiveCampaign: no API key stored — skipping`);
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.activeCampaignApi.fetchCoreMetrics(
          tokens.accessToken!,
          connection.externalAccountId ?? 'default',
          { from: dateRange.from, to: dateRange.to },
        );

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] ActiveCampaign sync complete — ${metricRows.length} metric rows`, {
          tenantId, campaignId, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Brevo ────────────────────────────────────────────────────────────────
  // API-key platform. API key = accessToken. externalAccountId = 'default'.

  private async syncBrevo(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Brevo: no API key — skipping`); return; }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.brevoApi.fetchCoreMetrics(
          tokens.accessToken!, connection.externalAccountId ?? 'default',
          { from: dateRange.from, to: dateRange.to },
        );
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Brevo sync complete — ${metricRows.length} metric rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Mailchimp ────────────────────────────────────────────────────────────
  // OAuth platform (no refresh token — long-lived). dc prefix stored as externalAccountId.

  private async syncMailchimp(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Mailchimp token invalid — marked EXPIRED`, { tenantId, campaignId });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        // externalAccountId holds the Mailchimp dc prefix (e.g. "us1")
        const metricRows = await this.mailchimpApi.fetchCoreMetrics(
          accessToken,
          connection.externalAccountId ?? 'default',
          { from: dateRange.from, to: dateRange.to },
        );
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Mailchimp sync complete — ${metricRows.length} metric rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Campaign Monitor ─────────────────────────────────────────────────────
  private async syncCampaignMonitor(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] CampaignMonitor: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.campaignMonitorApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] CampaignMonitor sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── ConvertKit ────────────────────────────────────────────────────────────
  private async syncConvertKit(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] ConvertKit: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.convertKitApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] ConvertKit sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Drip ──────────────────────────────────────────────────────────────────
  private async syncDrip(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Drip: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.dripApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Drip sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Constant Contact ──────────────────────────────────────────────────────
  private async syncConstantContact(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.constantContactApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] ConstantContact sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Ahrefs ────────────────────────────────────────────────────────────────
  // API-key platform. Key = accessToken. Target domain stored as externalAccountId.

  private async syncAhrefs(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Ahrefs: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.ahrefsApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Ahrefs sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Bing Webmaster Tools ─────────────────────────────────────────────────
  // OAuth platform (Microsoft). siteUrl = externalAccountId.

  private async syncBingWebmaster(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try {
        accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Bing Webmaster token expired — marked EXPIRED`, { tenantId, campaignId });
        return;
      }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.bingWebmasterApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Bing Webmaster sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google PageSpeed ─────────────────────────────────────────────────────
  // API-key platform. key = accessToken. targetUrl = externalAccountId.

  private async syncGooglePagespeed(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] PageSpeed: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.googlePagespeedApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] PageSpeed sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── BrightLocal ──────────────────────────────────────────────────────────
  // API-key platform. key = accessToken. campaignId = externalAccountId.

  private async syncBrightLocal(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] BrightLocal: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.brightLocalApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] BrightLocal sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── SE Ranking ───────────────────────────────────────────────────────────
  // API-key platform. key = accessToken. siteId = externalAccountId.

  private async syncSeRanking(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] SE Ranking: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.seRankingApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] SE Ranking sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Majestic SEO ─────────────────────────────────────────────────────────
  // API-key platform. key = accessToken. domain = externalAccountId.

  private async syncMajestic(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Majestic: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.majesticApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Majestic sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── SEMrush ──────────────────────────────────────────────────────────────
  // API-key platform. key = accessToken. externalAccountId = JSON {domain, database}.

  private async syncSemrush(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] SEMrush: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.semrushApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] SEMrush sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Moz ───────────────────────────────────────────────────────────────────
  // API-key platform. secretKey = accessToken. externalAccountId = JSON {accessId, domain}.

  private async syncMoz(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Moz: no secret key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.mozApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Moz sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── CallRail ─────────────────────────────────────────────────────────────
  // API-key platform. key = accessToken. accountId = externalAccountId.

  private async syncCallRail(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] CallRail: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.callrailApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] CallRail sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── CallTrackingMetrics ──────────────────────────────────────────────────
  // API-key platform. accessKey = accessToken. externalAccountId = JSON {accountId, secretKey}.

  private async syncCallTrackingMetrics(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] CallTrackingMetrics: no access key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.calltrackingMetricsApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] CallTrackingMetrics sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── WhatConverts ─────────────────────────────────────────────────────────
  // API-key platform. token = accessToken. externalAccountId = JSON {secretKey}.

  private async syncWhatConverts(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] WhatConverts: no token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.whatconvertsApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] WhatConverts sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Twilio ───────────────────────────────────────────────────────────────
  // API-key platform. authToken = accessToken. accountSid = externalAccountId.

  private async syncTwilio(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Twilio: no auth token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.twilioApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Twilio sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Marchex ──────────────────────────────────────────────────────────────
  // API-key platform. orgToken = accessToken. externalAccountId = JSON {subscriptionKey}.

  private async syncMarchex(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Marchex: no org token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.marchexApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Marchex sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── AVANSER ──────────────────────────────────────────────────────────────
  // API-key platform. apiKey = accessToken. externalAccountId = JSON {accountId, secret}.
  // Service handles three-step MD5 auth internally.

  private async syncAvanser(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] AVANSER: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.avanserApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] AVANSER sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── CallSource ───────────────────────────────────────────────────────────
  // API-key platform. password = accessToken. externalAccountId = JSON {username, customerCode}.
  // Service computes time-based MD5 token internally (valid 1 hour).

  private async syncCallSource(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] CallSource: no password`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.callsourceApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] CallSource sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Delacon ──────────────────────────────────────────────────────────────
  // API-key platform. apiKey = accessToken. externalAccountId = 'default' (key scopes to account).

  private async syncDelacon(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Delacon: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.delaconApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Delacon sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Trustpilot ───────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. businessUnitId = externalAccountId.

  private async syncTrustpilot(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.trustpilotApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Trustpilot sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Yelp ─────────────────────────────────────────────────────────────────
  // API-key platform. apiKey = accessToken. businessId = externalAccountId.

  private async syncYelp(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Yelp: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.yelpApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Yelp sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Birdeye ──────────────────────────────────────────────────────────────
  // API-key platform. apiKey = accessToken. businessId = externalAccountId.

  private async syncBirdeye(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Birdeye: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.birdeyeApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Birdeye sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── GatherUp ─────────────────────────────────────────────────────────────
  // API-key platform. bearerToken = accessToken. clientId = externalAccountId.

  private async syncGatherUp(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] GatherUp: no bearer token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.gatherUpApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] GatherUp sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Grade.us ─────────────────────────────────────────────────────────────
  // API-key platform. apiKey = accessToken. locationId = externalAccountId.

  private async syncGradeUs(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Grade.us: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.gradeUsApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Grade.us sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Synup ────────────────────────────────────────────────────────────────
  // API-key platform. apiKey = accessToken. locationId = externalAccountId.

  private async syncSynup(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Synup: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.synupApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Synup sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Yext ─────────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. externalAccountId = JSON {accountId, entityId}.

  private async syncYext(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.yextApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Yext sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Vendasta ─────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. accountId = externalAccountId.

  private async syncVendasta(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.vendastaApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Vendasta sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google Business Profile ───────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. externalAccountId = JSON {accountId, locationId}.

  private async syncGoogleBusinessProfile(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.googleBusinessProfileApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Google Business Profile sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── WildJar ──────────────────────────────────────────────────────────────
  // API-key platform. username = accessToken. externalAccountId = JSON {password}.
  // Service handles OAuth client_credentials exchange internally each sync.

  private async syncWildJar(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] WildJar: no username`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.wildJarApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] WildJar sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Microsoft Ads ────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = JSON {customerId, accountId, developerToken}.

  private async syncMicrosoftAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.microsoftAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Microsoft Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Pinterest Ads ────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. adAccountId = externalAccountId.

  private async syncPinterestAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.pinterestAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Pinterest Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Snapchat Ads ─────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. adAccountId = externalAccountId.
  // Spend returned in micro-USD (÷1,000,000) — handled in service.

  private async syncSnapchatAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.snapchatAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Snapchat Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── X Ads (Twitter Ads) ──────────────────────────────────────────────────
  // OAuth PKCE. accessToken via StandardTokenService. accountId = externalAccountId.
  // Spend returned in micro-USD (÷1,000,000) — handled in service.

  private async syncXAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.xAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] X Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Reddit Ads ───────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. accountId = externalAccountId.

  private async syncRedditAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.redditAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Reddit Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── AdRoll ───────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. advertisableEid = externalAccountId.

  private async syncAdRoll(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.adrollApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] AdRoll sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google Ad Manager ────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = networkCode. Async report: submit → poll → download CSV.

  private async syncGoogleAdManager(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.googleAdManagerApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Google Ad Manager sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google DV360 ─────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = partnerId. Async Bid Manager report: create query → run → poll → download.

  private async syncGoogleDv360(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.googleDv360Api.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Google DV360 sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google Local Services Ads ────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. customerId = externalAccountId.
  // Metrics: impressions, leads, phone_leads, message_leads, spend.

  private async syncGoogleLsa(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.googleLsaApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Google LSA sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Instagram Ads ────────────────────────────────────────────────────────
  // Meta OAuth. accessToken via StandardTokenService. adAccountId = externalAccountId.
  // Uses Meta Graph API /insights with publisher_platforms=instagram filter.

  private async syncInstagramAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.instagramAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Instagram Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Spotify Ads ──────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. accountId = externalAccountId.
  // Extra metric: video_completions.

  private async syncSpotifyAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.spotifyAdsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Spotify Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── StackAdapt ───────────────────────────────────────────────────────────
  // API key platform. apiToken = accessToken. X-Authorization header.
  // Uses GraphQL POST /graphql. accountId = externalAccountId.

  private async syncStackAdapt(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] StackAdapt: no API token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.stackAdaptApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] StackAdapt sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Simpli.fi ────────────────────────────────────────────────────────────
  // API key platform. apiKey = accessToken. externalAccountId = JSON {orgId, appKey}.
  // App-Key header required alongside Authorization.

  private async syncSimplifi(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Simpli.fi: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.simplifiApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Simpli.fi sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Choozle ──────────────────────────────────────────────────────────────
  // API key platform. apiKey = accessToken. accountId = externalAccountId.

  private async syncChoozle(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Choozle: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.choozleApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Choozle sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── GroundTruth ──────────────────────────────────────────────────────────
  // API key platform. apiKey = accessToken. accountId = externalAccountId.
  // Extra metric: store_visits (location-based advertising attribution).

  private async syncGroundTruth(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] GroundTruth: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.groundtruthApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] GroundTruth sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Basis (Centro) ───────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. accountId = externalAccountId.

  private async syncBasis(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.basisApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Basis sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Yelp Ads ─────────────────────────────────────────────────────────────
  // API key platform. partner API key = accessToken. businessId = externalAccountId.
  // Requires Yelp Ads partner access (separate from Yelp Fusion API).

  private async syncYelpAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Yelp Ads: no API key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.yelpAdsApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Yelp Ads sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── HubSpot ──────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. externalAccountId = 'default'.

  private async syncHubspot(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.hubspotApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] HubSpot sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Matomo ───────────────────────────────────────────────────────────────
  // API key platform. apiToken = accessToken. externalAccountId = JSON {matomoUrl, siteId}.

  private async syncMatomo(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Matomo: no API token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.matomoApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Matomo sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Salesforce ───────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. instanceUrl = externalAccountId.

  private async syncSalesforce(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.salesforceApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Salesforce sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── SharpSpring ──────────────────────────────────────────────────────────
  // API key platform. secretKey = accessToken. externalAccountId = JSON {accountID}.

  private async syncSharpspring(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] SharpSpring: no secret key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.sharpspringApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] SharpSpring sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Gravity Forms ────────────────────────────────────────────────────────
  // API key platform. consumerKey = accessToken. externalAccountId = JSON {siteUrl, consumerSecret, formId}.

  private async syncGravityForms(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Gravity Forms: no consumer key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.gravityFormsApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Gravity Forms sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Unbounce ─────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. accountId = externalAccountId.

  private async syncUnbounce(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.unbounceApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Unbounce sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── HighLevel ────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. locationId = externalAccountId.

  private async syncHighlevel(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.highlevelApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] HighLevel sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google Sheets ────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = JSON {spreadsheetId, range, dateColumn, metricKeyColumn, valueColumn}.

  private async syncGoogleSheets(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.googleSheetsApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Google Sheets sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Google BigQuery ──────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = JSON {projectId, query}. Async: insert job → poll → fetch results.

  private async syncBigquery(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.bigqueryApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] BigQuery sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── MySQL ────────────────────────────────────────────────────────────────
  // Direct DB connection. password = accessToken. externalAccountId = JSON {host, port, database, user, query}.

  private async syncMysql(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] MySQL: no password configured`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.mysqlApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? '{}', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] MySQL sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Amazon Redshift ──────────────────────────────────────────────────────
  // Direct PostgreSQL connection (Redshift uses PG protocol on 5439).
  // password = accessToken. externalAccountId = JSON {host, port, database, user, query}.

  private async syncRedshift(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Redshift: no password configured`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.redshiftApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? '{}', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Redshift sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Snowflake ────────────────────────────────────────────────────────────
  // API key (password). Uses Snowflake SQL REST API.
  // password = accessToken. externalAccountId = JSON {account, user, database, schema, warehouse, query}.

  private async syncSnowflake(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Snowflake: no password configured`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.snowflakeApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? '{}', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Snowflake sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Shopify ──────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. shopDomain = externalAccountId.
  // GET /admin/api/2024-01/orders.json — paginates via Link header.

  private async syncShopify(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.shopifyApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Shopify sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── WooCommerce ──────────────────────────────────────────────────────────
  // API key platform. consumerKey = accessToken. externalAccountId = JSON {siteUrl, consumerSecret}.

  private async syncWoocommerce(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] WooCommerce: no consumer key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.woocommerceApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] WooCommerce sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── BigCommerce ──────────────────────────────────────────────────────────
  // API key platform. apiToken = accessToken. externalAccountId = JSON {storeHash}.

  private async syncBigcommerce(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] BigCommerce: no API token`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.bigcommerceApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] BigCommerce sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Stripe ───────────────────────────────────────────────────────────────
  // API key platform. secretKey = accessToken. externalAccountId = 'default'.

  private async syncStripe(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      const tokens = await this.integrationsService.getDecryptedTokens(tenantId, campaignId, platform);
      if (!tokens?.accessToken) { this.logger.warn(`[${job.id}] Stripe: no secret key`); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.stripeApi.fetchCoreMetrics(tokens.accessToken!, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Stripe sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Keap (Infusionsoft) ──────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService. externalAccountId = 'default'.

  private async syncKeap(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.keapApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Keap sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Facebook Organic ─────────────────────────────────────────────────────
  // Meta OAuth. accessToken via StandardTokenService. pageId = externalAccountId.
  // GET /{pageId}/insights with period=day.

  private async syncFacebookOrganic(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.facebookOrganicApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Facebook Organic sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Instagram Organic ────────────────────────────────────────────────────
  // Meta OAuth. accessToken via StandardTokenService. igUserId = externalAccountId.
  // GET /{igUserId}/insights with period=day. Requires instagram_manage_insights.

  private async syncInstagramOrganic(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.instagramOrganicApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Instagram Organic sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Pinterest Organic ────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = 'default' (user-level endpoint). GET /user_account/analytics.

  private async syncPinterestOrganic(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.pinterestOrganicApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Pinterest Organic sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Vimeo ────────────────────────────────────────────────────────────────
  // OAuth platform. accessToken via StandardTokenService.
  // externalAccountId = 'default' (user-level). GET /me/videos — snapshot of total stats.

  private async syncVimeo(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.vimeoApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] Vimeo sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── X Organic ────────────────────────────────────────────────────────────
  // OAuth PKCE. accessToken via StandardTokenService. userId = externalAccountId.
  // GET /2/users/{userId}/tweets — aggregates public_metrics over date range.

  private async syncXOrganic(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.xOrganicApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] X Organic sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── TikTok Organic ───────────────────────────────────────────────────────
  // OAuth platform (TikTok Login Kit — separate from TikTokAdsOAuthService).
  // accessToken via StandardTokenService. externalAccountId = 'default'.
  // POST /v2/video/list — filters by create_time in dateRange, aggregates stats.

  private async syncTiktokOrganic(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();
    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;
      let accessToken: string;
      try { accessToken = await this.standardToken.getValidAccessToken(platform, tenantId, campaignId); }
      catch (err) { await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message); return; }
      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const metricRows = await this.tiktokOrganicApi.fetchCoreMetrics(accessToken, connection.externalAccountId ?? 'default', { from: dateRange.from, to: dateRange.to });
        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));
        this.logger.log(`[${job.id}] TikTok Organic sync complete — ${metricRows.length} rows`, { tenantId, campaignId, durationMs: Date.now() - startTime });
      });
    });
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  /**
   * Validates:
   *   1. IntegrationConnection exists with status = CONNECTED
   *   2. Fix 3: externalAccountId is set (skip with warning if not — no status change)
   *   3. Campaign + client are still active (not soft-deleted)
   *
   * Returns null (and logs) if any check fails — caller returns early.
   */
  private async getActiveConnection(
    jobId: string,
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
  ): Promise<{ externalAccountId: string | null } | null> {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { campaignId, platform, tenantId, status: ConnectionStatus.CONNECTED },
      select: { externalAccountId: true },
    });

    if (!connection) {
      this.logger.warn(`[${jobId}] No CONNECTED integration — skipping`, {
        tenantId, campaignId, platform,
      });
      return null;
    }

    // Fix 3: externalAccountId not set = user connected OAuth but never picked a property
    // Skip silently — no status change, no error. User needs to configure in the UI.
    if (!connection.externalAccountId) {
      this.logger.warn(`[${jobId}] externalAccountId not configured — skipping`, {
        tenantId, campaignId, platform,
      });
      return null;
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId, deletedAt: null, client: { deletedAt: null } },
      select: { id: true },
    });

    if (!campaign) {
      this.logger.warn(`[${jobId}] Campaign or client deleted — skipping`, {
        tenantId, campaignId, platform,
      });
      return null;
    }

    return connection;
  }

  /**
   * Wraps the actual API call:
   *   - 401 / invalid_grant → markExpired, suppress retry (return without throw)
   *   - 429 → rethrow (BullMQ retries with jitter backoff)
   *   - 5xx / network → rethrow (BullMQ retries; @OnWorkerEvent('failed') marks ERROR)
   *   - success → markSynced
   *
   * Sharp edge 2: precise status classification enforced here.
   */
  private async executeWithErrorHandling(
    job: Job<SyncJobPayload>,
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
      await this.integrationsService.markSynced(tenantId, campaignId, platform);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status: number | undefined = (err as any)?.response?.status ?? (err as any)?.status;
      const message: string = (err as Error).message ?? 'Unknown error';

      if (status === 401 || message.includes('invalid_grant')) {
        // Sharp edge 2: 401 → EXPIRED — no retry
        await this.integrationsService.markExpired(tenantId, campaignId, platform, message);
        this.logger.error(`[${job.id}] 401 response — marked EXPIRED (no retry)`, {
          tenantId, campaignId, platform,
        });
        return; // Suppress — do NOT rethrow, do not retry
      }

      if (status === 429) {
        // Sharp edge 2: 429 → retry with backoff, do NOT mark ERROR yet
        this.logger.warn(`[${job.id}] 429 rate limit — will retry`, {
          tenantId, campaignId, platform,
        });
        throw err; // BullMQ applies jitter backoff and retries
      }

      // 5xx / network — log and rethrow; @OnWorkerEvent('failed') marks ERROR
      // after all attempts are exhausted
      this.logger.error(`[${job.id}] API error — will retry (attempt ${job.attemptsMade + 1})`, {
        tenantId, campaignId, platform, error: message,
      });
      throw err;
    }
  }
}
