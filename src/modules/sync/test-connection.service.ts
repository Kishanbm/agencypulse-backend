import { Injectable } from '@nestjs/common';
import { IntegrationPlatform } from '@prisma/client';
import { MetricRowInput } from '../metrics/dto/query-metrics.dto';

// Import all 74 platform services
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

type ApiService = {
  fetchCoreMetrics(
    accessToken: string,
    externalAccountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]>;
};

@Injectable()
export class TestConnectionService {
  private readonly serviceMap: Partial<Record<IntegrationPlatform, ApiService>>;

  constructor(
    private readonly klaviyo: KlaviyoApiService,
    private readonly activeCampaign: ActiveCampaignApiService,
    private readonly brevo: BrevoApiService,
    private readonly mailchimp: MailchimpApiService,
    private readonly campaignMonitor: CampaignMonitorApiService,
    private readonly convertKit: ConvertKitApiService,
    private readonly drip: DripApiService,
    private readonly constantContact: ConstantContactApiService,
    private readonly ahrefs: AhrefsApiService,
    private readonly moz: MozApiService,
    private readonly semrush: SemrushApiService,
    private readonly majestic: MajesticApiService,
    private readonly seRanking: SeRankingApiService,
    private readonly brightLocal: BrightLocalApiService,
    private readonly googlePagespeed: GooglePagespeedApiService,
    private readonly bingWebmaster: BingWebmasterApiService,
    private readonly callrail: CallrailApiService,
    private readonly calltrackingMetrics: CalltrackingMetricsApiService,
    private readonly whatConverts: WhatConvertsApiService,
    private readonly twilio: TwilioApiService,
    private readonly marchex: MarchexApiService,
    private readonly avanser: AvanserApiService,
    private readonly callsource: CallsourceApiService,
    private readonly delacon: DelaconApiService,
    private readonly wildJar: WildJarApiService,
    private readonly trustpilot: TrustpilotApiService,
    private readonly yelp: YelpApiService,
    private readonly birdeye: BirdeyeApiService,
    private readonly gatherUp: GatherUpApiService,
    private readonly gradeUs: GradeUsApiService,
    private readonly synup: SynupApiService,
    private readonly yext: YextApiService,
    private readonly vendasta: VendastaApiService,
    private readonly googleBusinessProfile: GoogleBusinessProfileApiService,
    private readonly microsoftAds: MicrosoftAdsApiService,
    private readonly pinterestAds: PinterestAdsApiService,
    private readonly snapchatAds: SnapchatAdsApiService,
    private readonly xAds: XAdsApiService,
    private readonly redditAds: RedditAdsApiService,
    private readonly adroll: AdrollApiService,
    private readonly googleAdManager: GoogleAdManagerApiService,
    private readonly googleDv360: GoogleDv360ApiService,
    private readonly googleLsa: GoogleLsaApiService,
    private readonly instagramAds: InstagramAdsApiService,
    private readonly spotifyAds: SpotifyAdsApiService,
    private readonly stackAdapt: StackAdaptApiService,
    private readonly simplifi: SimplifiApiService,
    private readonly choozle: ChoozleApiService,
    private readonly groundtruth: GroundtruthApiService,
    private readonly basis: BasisApiService,
    private readonly yelpAds: YelpAdsApiService,
    private readonly facebookOrganic: FacebookOrganicApiService,
    private readonly instagramOrganic: InstagramOrganicApiService,
    private readonly pinterestOrganic: PinterestOrganicApiService,
    private readonly vimeo: VimeoApiService,
    private readonly xOrganic: XOrganicApiService,
    private readonly tiktokOrganic: TiktokOrganicApiService,
    private readonly shopify: ShopifyApiService,
    private readonly woocommerce: WoocommerceApiService,
    private readonly bigcommerce: BigcommerceApiService,
    private readonly stripe: StripeApiService,
    private readonly keap: KeapApiService,
    private readonly hubspot: HubspotApiService,
    private readonly matomo: MatomoApiService,
    private readonly salesforce: SalesforceApiService,
    private readonly sharpspring: SharpspringApiService,
    private readonly gravityForms: GravityFormsApiService,
    private readonly unbounce: UnbounceApiService,
    private readonly highlevel: HighlevelApiService,
    private readonly googleSheets: GoogleSheetsApiService,
    private readonly bigquery: BigqueryApiService,
    private readonly mysql: MysqlApiService,
    private readonly redshift: RedshiftApiService,
    private readonly snowflake: SnowflakeApiService,
  ) {
    this.serviceMap = {
      [IntegrationPlatform.KLAVIYO]: this.klaviyo,
      [IntegrationPlatform.ACTIVECAMPAIGN]: this.activeCampaign,
      [IntegrationPlatform.BREVO]: this.brevo,
      [IntegrationPlatform.MAILCHIMP]: this.mailchimp,
      [IntegrationPlatform.CAMPAIGN_MONITOR]: this.campaignMonitor,
      [IntegrationPlatform.CONVERTKIT]: this.convertKit,
      [IntegrationPlatform.DRIP]: this.drip,
      [IntegrationPlatform.CONSTANT_CONTACT]: this.constantContact,
      [IntegrationPlatform.AHREFS]: this.ahrefs,
      [IntegrationPlatform.MOZ]: this.moz,
      [IntegrationPlatform.SEMRUSH]: this.semrush,
      [IntegrationPlatform.MAJESTIC_SEO]: this.majestic,
      [IntegrationPlatform.SE_RANKING]: this.seRanking,
      [IntegrationPlatform.BRIGHTLOCAL]: this.brightLocal,
      [IntegrationPlatform.GOOGLE_PAGESPEED]: this.googlePagespeed,
      [IntegrationPlatform.BING_WEBMASTER_TOOLS]: this.bingWebmaster,
      [IntegrationPlatform.CALLRAIL]: this.callrail,
      [IntegrationPlatform.CALLTRACKING_METRICS]: this.calltrackingMetrics,
      [IntegrationPlatform.WHATCONVERTS]: this.whatConverts,
      [IntegrationPlatform.TWILIO]: this.twilio,
      [IntegrationPlatform.MARCHEX]: this.marchex,
      [IntegrationPlatform.AVANSER]: this.avanser,
      [IntegrationPlatform.CALLSOURCE]: this.callsource,
      [IntegrationPlatform.DELACON]: this.delacon,
      [IntegrationPlatform.WILDJAR]: this.wildJar,
      [IntegrationPlatform.TRUSTPILOT]: this.trustpilot,
      [IntegrationPlatform.YELP]: this.yelp,
      [IntegrationPlatform.BIRDEYE]: this.birdeye,
      [IntegrationPlatform.GATHERUP]: this.gatherUp,
      [IntegrationPlatform.GRADE_US]: this.gradeUs,
      [IntegrationPlatform.SYNUP]: this.synup,
      [IntegrationPlatform.YEXT]: this.yext,
      [IntegrationPlatform.VENDASTA]: this.vendasta,
      [IntegrationPlatform.GOOGLE_BUSINESS_PROFILE]: this.googleBusinessProfile,
      [IntegrationPlatform.MICROSOFT_ADS]: this.microsoftAds,
      [IntegrationPlatform.PINTEREST_ADS]: this.pinterestAds,
      [IntegrationPlatform.SNAPCHAT_ADS]: this.snapchatAds,
      [IntegrationPlatform.X_ADS]: this.xAds,
      [IntegrationPlatform.REDDIT_ADS]: this.redditAds,
      [IntegrationPlatform.ADROLL]: this.adroll,
      [IntegrationPlatform.GOOGLE_AD_MANAGER]: this.googleAdManager,
      [IntegrationPlatform.GOOGLE_DV360]: this.googleDv360,
      [IntegrationPlatform.GOOGLE_LOCAL_SERVICES_ADS]: this.googleLsa,
      [IntegrationPlatform.INSTAGRAM_ADS]: this.instagramAds,
      [IntegrationPlatform.SPOTIFY_ADS]: this.spotifyAds,
      [IntegrationPlatform.STACKADAPT]: this.stackAdapt,
      [IntegrationPlatform.SIMPLIFI]: this.simplifi,
      [IntegrationPlatform.CHOOZLE]: this.choozle,
      [IntegrationPlatform.GROUNDTRUTH]: this.groundtruth,
      [IntegrationPlatform.BASIS_PLATFORM]: this.basis,
      [IntegrationPlatform.YELP_ADS]: this.yelpAds,
      [IntegrationPlatform.FACEBOOK_ORGANIC]: this.facebookOrganic,
      [IntegrationPlatform.INSTAGRAM_ORGANIC]: this.instagramOrganic,
      [IntegrationPlatform.PINTEREST_ORGANIC]: this.pinterestOrganic,
      [IntegrationPlatform.VIMEO]: this.vimeo,
      [IntegrationPlatform.X_ORGANIC]: this.xOrganic,
      [IntegrationPlatform.TIKTOK_ORGANIC]: this.tiktokOrganic,
      [IntegrationPlatform.SHOPIFY]: this.shopify,
      [IntegrationPlatform.WOOCOMMERCE]: this.woocommerce,
      [IntegrationPlatform.BIGCOMMERCE]: this.bigcommerce,
      [IntegrationPlatform.STRIPE_ECOMMERCE]: this.stripe,
      [IntegrationPlatform.KEAP]: this.keap,
      [IntegrationPlatform.HUBSPOT]: this.hubspot,
      [IntegrationPlatform.MATOMO]: this.matomo,
      [IntegrationPlatform.SALESFORCE]: this.salesforce,
      [IntegrationPlatform.SHARPSPRING]: this.sharpspring,
      [IntegrationPlatform.GRAVITY_FORMS]: this.gravityForms,
      [IntegrationPlatform.UNBOUNCE]: this.unbounce,
      [IntegrationPlatform.HIGHLEVEL]: this.highlevel,
      [IntegrationPlatform.GOOGLE_SHEETS]: this.googleSheets,
      [IntegrationPlatform.GOOGLE_BIGQUERY]: this.bigquery,
      [IntegrationPlatform.MYSQL_DB]: this.mysql,
      [IntegrationPlatform.AMAZON_REDSHIFT]: this.redshift,
      [IntegrationPlatform.SNOWFLAKE]: this.snowflake,
    };
  }

  async testConnection(
    platform: IntegrationPlatform,
    accessToken: string,
    externalAccountId: string,
  ): Promise<
    | { status: 'ok'; rowCount: number; sampleRows: MetricRowInput[] }
    | { status: 'error'; message: string }
  > {
    const service = this.serviceMap[platform];
    if (!service) {
      return {
        status: 'error',
        message: `Platform ${platform} does not support test-connection.`,
      };
    }

    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    try {
      const rows = await service.fetchCoreMetrics(accessToken, externalAccountId, { from, to });
      return { status: 'ok', rowCount: rows.length, sampleRows: rows.slice(0, 3) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', message };
    }
  }
}
