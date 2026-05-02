export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    url: process.env.APP_URL || 'http://localhost:5173',       // used in invite links
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  database: {
    url: process.env.DATABASE_URL,
    // Owner role URL — used only by SystemPrismaService for auth bootstrap ops
    migrationUrl: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // GA4 callback URL — registered in Google Cloud Console
    // Example: http://localhost:3000/api/v1/integrations/ga4/callback
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    ads: {
      // Google Ads callback URL — separate registered URI
      // Example: http://localhost:3000/api/v1/integrations/google-ads/callback
      redirectUri: process.env.GOOGLE_ADS_REDIRECT_URI,
      // Required on every Google Ads API call — never log this value
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      // Optional — agency's MCC (manager) customer ID (no dashes)
      managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
    },
  },
  meta: {
    appId: process.env.META_APP_ID,
    // Never log META_APP_SECRET — used only for short→long-lived token exchange
    appSecret: process.env.META_APP_SECRET,
    // Example: http://localhost:3000/api/v1/integrations/meta-ads/callback
    redirectUri: process.env.META_ADS_REDIRECT_URI,
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@agencypulse.com',
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  sync: {
    // Cron expression for the data sync scheduler (UTC).
    // Default: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC).
    // Override: SYNC_CRON='0 * * * *' for hourly, '0 2 * * *' for daily at 2AM UTC.
    cron: process.env.SYNC_CRON || '0 */6 * * *',
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'agencypulse',
    region: process.env.STORAGE_REGION || 'auto',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceIds: {
      agency: process.env.STRIPE_PRICE_ID_AGENCY,
      agencyPro: process.env.STRIPE_PRICE_ID_AGENCY_PRO,
    },
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Haiku for cheap/fast summaries & chat; Sonnet for complex analysis
    chatModel: process.env.ANTHROPIC_CHAT_MODEL || 'claude-haiku-4-5-20251001',
    reportSummaryModel: process.env.ANTHROPIC_REPORT_MODEL || 'claude-haiku-4-5-20251001',
  },
  // Phase 3.7 — New integration platforms
  gsc: {
    // Example: http://localhost:3000/api/v1/integrations/google-search-console/callback
    redirectUri: process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI,
  },
  youtube: {
    // Example: http://localhost:3000/api/v1/integrations/youtube/callback
    redirectUri: process.env.YOUTUBE_REDIRECT_URI,
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    // Never log LINKEDIN_CLIENT_SECRET
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    // Example: http://localhost:3000/api/v1/integrations/linkedin-ads/callback
    redirectUri: process.env.LINKEDIN_ADS_REDIRECT_URI,
  },
  tiktok: {
    appId: process.env.TIKTOK_APP_ID,
    // Never log TIKTOK_APP_SECRET
    secret: process.env.TIKTOK_APP_SECRET,
    // Example: http://localhost:3000/api/v1/integrations/tiktok-ads/callback
    redirectUri: process.env.TIKTOK_ADS_REDIRECT_URI,
  },
  amazon: {
    clientId: process.env.AMAZON_ADS_CLIENT_ID,
    // Never log AMAZON_ADS_CLIENT_SECRET
    clientSecret: process.env.AMAZON_ADS_CLIENT_SECRET,
    // Example: http://localhost:3000/api/v1/integrations/amazon-ads/callback
    redirectUri: process.env.AMAZON_ADS_REDIRECT_URI,
  },

  // ─── Phase 3.8+ — New integration platforms ───────────────────────────────
  microsoft: {
    clientId: process.env.MICROSOFT_ADS_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_ADS_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_ADS_REDIRECT_URI,
  },
  pinterest: {
    appId: process.env.PINTEREST_APP_ID,
    appSecret: process.env.PINTEREST_APP_SECRET,
    redirectUri: process.env.PINTEREST_REDIRECT_URI,
  },
  snapchat: {
    clientId: process.env.SNAPCHAT_CLIENT_ID,
    clientSecret: process.env.SNAPCHAT_CLIENT_SECRET,
    redirectUri: process.env.SNAPCHAT_REDIRECT_URI,
  },
  xads: {
    apiKey: process.env.X_ADS_API_KEY,
    apiSecretKey: process.env.X_ADS_API_SECRET_KEY,
    accessToken: process.env.X_ADS_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ADS_ACCESS_TOKEN_SECRET,
    redirectUri: process.env.X_ADS_REDIRECT_URI,
  },
  reddit: {
    clientId: process.env.REDDIT_ADS_CLIENT_ID,
    clientSecret: process.env.REDDIT_ADS_CLIENT_SECRET,
    redirectUri: process.env.REDDIT_ADS_REDIRECT_URI,
  },
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    redirectUri: process.env.SHOPIFY_REDIRECT_URI,
  },
  mailchimp: {
    clientId: process.env.MAILCHIMP_CLIENT_ID,
    clientSecret: process.env.MAILCHIMP_CLIENT_SECRET,
    redirectUri: process.env.MAILCHIMP_REDIRECT_URI,
  },
  klaviyo: {
    apiKey: process.env.KLAVIYO_API_KEY,
  },
  hubspot: {
    clientId: process.env.HUBSPOT_CLIENT_ID,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    redirectUri: process.env.HUBSPOT_REDIRECT_URI,
  },
  semrush: {
    apiKey: process.env.SEMRUSH_API_KEY,
  },
  callrail: {
    apiKey: process.env.CALLRAIL_API_KEY,
  },
  googleBusinessProfile: {
    redirectUri: process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI,
  },
  activecampaign: {
    apiUrl: process.env.ACTIVECAMPAIGN_API_URL,
    apiKey: process.env.ACTIVECAMPAIGN_API_KEY,
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
  },
  constantContact: {
    clientId: process.env.CONSTANT_CONTACT_CLIENT_ID,
    clientSecret: process.env.CONSTANT_CONTACT_CLIENT_SECRET,
    redirectUri: process.env.CONSTANT_CONTACT_REDIRECT_URI,
  },
  campaignMonitor: {
    apiKey: process.env.CAMPAIGN_MONITOR_API_KEY,
  },
  convertkit: {
    apiKey: process.env.CONVERTKIT_API_KEY,
  },
  drip: {
    apiKey: process.env.DRIP_API_KEY,
  },
  woocommerce: {
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  },
  bigcommerce: {
    clientId: process.env.BIGCOMMERCE_CLIENT_ID,
    clientSecret: process.env.BIGCOMMERCE_CLIENT_SECRET,
    redirectUri: process.env.BIGCOMMERCE_REDIRECT_URI,
  },
  stripeEcommerce: {
    apiKey: process.env.STRIPE_ECOMMERCE_API_KEY,
  },
  keap: {
    clientId: process.env.KEAP_CLIENT_ID,
    clientSecret: process.env.KEAP_CLIENT_SECRET,
    redirectUri: process.env.KEAP_REDIRECT_URI,
  },
  salesforce: {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    redirectUri: process.env.SALESFORCE_REDIRECT_URI,
  },
  matomo: {
    apiUrl: process.env.MATOMO_API_URL,
    apiToken: process.env.MATOMO_API_TOKEN,
  },
  ahrefs: {
    apiKey: process.env.AHREFS_API_KEY,
  },
  moz: {
    accessId: process.env.MOZ_ACCESS_ID,
    secretKey: process.env.MOZ_SECRET_KEY,
  },
  calltrackingmetrics: {
    accessKey: process.env.CTM_ACCESS_KEY,
    secretKey: process.env.CTM_SECRET_KEY,
  },
  brightlocal: {
    apiKey: process.env.BRIGHTLOCAL_API_KEY,
  },
  yext: {
    clientId: process.env.YEXT_CLIENT_ID,
    clientSecret: process.env.YEXT_CLIENT_SECRET,
    redirectUri: process.env.YEXT_REDIRECT_URI,
  },
  googleBigQuery: {
    redirectUri: process.env.GOOGLE_BIGQUERY_REDIRECT_URI,
  },
  googleAdManager: {
    redirectUri: process.env.GOOGLE_AD_MANAGER_REDIRECT_URI,
  },
  googleDv360: {
    redirectUri: process.env.GOOGLE_DV360_REDIRECT_URI,
  },
  googleLocalServicesAds: {
    redirectUri: process.env.GOOGLE_LOCAL_SERVICES_ADS_REDIRECT_URI,
  },
  bingWebmasterTools: {
    redirectUri: process.env.BING_WEBMASTER_TOOLS_REDIRECT_URI,
  },
  adroll: {
    clientId: process.env.ADROLL_CLIENT_ID,
    clientSecret: process.env.ADROLL_CLIENT_SECRET,
    redirectUri: process.env.ADROLL_REDIRECT_URI,
  },
  spotify: {
    clientId: process.env.SPOTIFY_ADS_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_ADS_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_ADS_REDIRECT_URI,
  },
  vimeo: {
    clientId: process.env.VIMEO_CLIENT_ID,
    clientSecret: process.env.VIMEO_CLIENT_SECRET,
    redirectUri: process.env.VIMEO_REDIRECT_URI,
  },
  snowflake: {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
  },
});
