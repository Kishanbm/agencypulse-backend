import { IntegrationPlatform } from '@prisma/client';

/** Single queue — all integration sync jobs flow through this */
export const SYNC_QUEUE = 'integration-sync';

/**
 * Maps every IntegrationPlatform to a BullMQ job name.
 * All jobs are routed to IntegrationSyncProcessor.process() which switches on
 * job.data.platform — the job name is a label only (not used for routing).
 */
export const SYNC_JOB_NAMES: Partial<Record<IntegrationPlatform, string>> = {
  // ─── Analytics ───────────────────────────────────────────────────────────────
  [IntegrationPlatform.GA4]:                        'ga4-sync',
  [IntegrationPlatform.GOOGLE_SEARCH_CONSOLE]:      'gsc-sync',
  [IntegrationPlatform.YOUTUBE_ANALYTICS]:          'youtube-sync',
  [IntegrationPlatform.MATOMO]:                     'matomo-sync',
  [IntegrationPlatform.GOOGLE_SHEETS]:              'google-sheets-sync',
  [IntegrationPlatform.GOOGLE_BIGQUERY]:            'bigquery-sync',
  [IntegrationPlatform.MYSQL_DB]:                   'mysql-sync',
  [IntegrationPlatform.AMAZON_REDSHIFT]:            'redshift-sync',
  [IntegrationPlatform.SNOWFLAKE]:                  'snowflake-sync',
  // ─── Paid Advertising ────────────────────────────────────────────────────────
  [IntegrationPlatform.GOOGLE_ADS]:                 'google-ads-sync',
  [IntegrationPlatform.META_ADS]:                   'meta-ads-sync',
  [IntegrationPlatform.MICROSOFT_ADS]:              'microsoft-ads-sync',
  [IntegrationPlatform.LINKEDIN_ADS]:               'linkedin-ads-sync',
  [IntegrationPlatform.TIKTOK_ADS]:                 'tiktok-ads-sync',
  [IntegrationPlatform.AMAZON_ADS]:                 'amazon-ads-sync',
  [IntegrationPlatform.PINTEREST_ADS]:              'pinterest-ads-sync',
  [IntegrationPlatform.SNAPCHAT_ADS]:               'snapchat-ads-sync',
  [IntegrationPlatform.X_ADS]:                      'x-ads-sync',
  [IntegrationPlatform.REDDIT_ADS]:                 'reddit-ads-sync',
  [IntegrationPlatform.ADROLL]:                     'adroll-sync',
  [IntegrationPlatform.GOOGLE_AD_MANAGER]:          'google-ad-manager-sync',
  [IntegrationPlatform.GOOGLE_DV360]:               'google-dv360-sync',
  [IntegrationPlatform.GOOGLE_LOCAL_SERVICES_ADS]:  'google-lsa-sync',
  [IntegrationPlatform.INSTAGRAM_ADS]:              'instagram-ads-sync',
  [IntegrationPlatform.SPOTIFY_ADS]:                'spotify-ads-sync',
  [IntegrationPlatform.STACKADAPT]:                 'stackadapt-sync',
  [IntegrationPlatform.SIMPLIFI]:                   'simplifi-sync',
  [IntegrationPlatform.CHOOZLE]:                    'choozle-sync',
  [IntegrationPlatform.GROUNDTRUTH]:                'groundtruth-sync',
  [IntegrationPlatform.BASIS_PLATFORM]:             'basis-sync',
  [IntegrationPlatform.YELP_ADS]:                   'yelp-ads-sync',
  // ─── Email Marketing ─────────────────────────────────────────────────────────
  [IntegrationPlatform.MAILCHIMP]:                  'mailchimp-sync',
  [IntegrationPlatform.KLAVIYO]:                    'klaviyo-sync',
  [IntegrationPlatform.ACTIVECAMPAIGN]:             'activecampaign-sync',
  [IntegrationPlatform.BREVO]:                      'brevo-sync',
  [IntegrationPlatform.CAMPAIGN_MONITOR]:           'campaign-monitor-sync',
  [IntegrationPlatform.CONVERTKIT]:                 'convertkit-sync',
  [IntegrationPlatform.DRIP]:                       'drip-sync',
  [IntegrationPlatform.CONSTANT_CONTACT]:           'constant-contact-sync',
  // ─── SEO ─────────────────────────────────────────────────────────────────────
  [IntegrationPlatform.SEMRUSH]:                    'semrush-sync',
  [IntegrationPlatform.AHREFS]:                     'ahrefs-sync',
  [IntegrationPlatform.MOZ]:                        'moz-sync',
  [IntegrationPlatform.MAJESTIC_SEO]:               'majestic-sync',
  [IntegrationPlatform.SE_RANKING]:                 'se-ranking-sync',
  [IntegrationPlatform.BRIGHTLOCAL]:                'brightlocal-sync',
  [IntegrationPlatform.GOOGLE_PAGESPEED]:           'google-pagespeed-sync',
  [IntegrationPlatform.BING_WEBMASTER_TOOLS]:       'bing-webmaster-sync',
  // ─── Call Tracking ───────────────────────────────────────────────────────────
  [IntegrationPlatform.CALLRAIL]:                   'callrail-sync',
  [IntegrationPlatform.CALLTRACKING_METRICS]:       'calltracking-metrics-sync',
  [IntegrationPlatform.WHATCONVERTS]:               'whatconverts-sync',
  [IntegrationPlatform.TWILIO]:                     'twilio-sync',
  [IntegrationPlatform.MARCHEX]:                    'marchex-sync',
  [IntegrationPlatform.AVANSER]:                    'avanser-sync',
  [IntegrationPlatform.CALLSOURCE]:                 'callsource-sync',
  [IntegrationPlatform.DELACON]:                    'delacon-sync',
  [IntegrationPlatform.WILDJAR]:                    'wildjar-sync',
  // ─── Reputation & Local ──────────────────────────────────────────────────────
  [IntegrationPlatform.TRUSTPILOT]:                 'trustpilot-sync',
  [IntegrationPlatform.YELP]:                       'yelp-sync',
  [IntegrationPlatform.BIRDEYE]:                    'birdeye-sync',
  [IntegrationPlatform.GATHERUP]:                   'gatherup-sync',
  [IntegrationPlatform.GRADE_US]:                   'gradeus-sync',
  [IntegrationPlatform.SYNUP]:                      'synup-sync',
  [IntegrationPlatform.YEXT]:                       'yext-sync',
  [IntegrationPlatform.VENDASTA]:                   'vendasta-sync',
  [IntegrationPlatform.GOOGLE_BUSINESS_PROFILE]:    'google-business-profile-sync',
  // ─── Social Organic ──────────────────────────────────────────────────────────
  [IntegrationPlatform.FACEBOOK_ORGANIC]:           'facebook-organic-sync',
  [IntegrationPlatform.INSTAGRAM_ORGANIC]:          'instagram-organic-sync',
  [IntegrationPlatform.PINTEREST_ORGANIC]:          'pinterest-organic-sync',
  [IntegrationPlatform.VIMEO]:                      'vimeo-sync',
  [IntegrationPlatform.X_ORGANIC]:                  'x-organic-sync',
  [IntegrationPlatform.TIKTOK_ORGANIC]:             'tiktok-organic-sync',
  // ─── Ecommerce ───────────────────────────────────────────────────────────────
  [IntegrationPlatform.SHOPIFY]:                    'shopify-sync',
  [IntegrationPlatform.WOOCOMMERCE]:                'woocommerce-sync',
  [IntegrationPlatform.BIGCOMMERCE]:                'bigcommerce-sync',
  [IntegrationPlatform.STRIPE_ECOMMERCE]:           'stripe-sync',
  // ─── CRM / Lead Gen ──────────────────────────────────────────────────────────
  [IntegrationPlatform.HUBSPOT]:                    'hubspot-sync',
  [IntegrationPlatform.SALESFORCE]:                 'salesforce-sync',
  [IntegrationPlatform.KEAP]:                       'keap-sync',
  [IntegrationPlatform.SHARPSPRING]:                'sharpspring-sync',
  [IntegrationPlatform.GRAVITY_FORMS]:              'gravity-forms-sync',
  [IntegrationPlatform.UNBOUNCE]:                   'unbounce-sync',
  [IntegrationPlatform.HIGHLEVEL]:                  'highlevel-sync',
};
