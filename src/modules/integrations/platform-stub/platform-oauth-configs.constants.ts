import { IntegrationPlatform } from '@prisma/client';

/**
 * OAuth 2.0 configuration for every platform handled by StandardOAuthService.
 *
 * Research-verified fields (2026-04-29):
 *
 *   useBasicAuth     — true = token exchange sends credentials via
 *                      "Authorization: Basic base64(id:secret)" header instead of
 *                      request body. Required by Reddit, Pinterest, X/Twitter.
 *
 *   usesPKCE         — true = PKCE S256 flow. StandardOAuthService generates a
 *                      random code_verifier, computes SHA-256 challenge, stores
 *                      verifier in state JWT, and sends it in token exchange.
 *                      Required by X/Twitter.
 *
 *   requiresContextParam — true = BigCommerce sends a `context` query param in
 *                      the callback that must be forwarded in the token exchange
 *                      POST body.
 *
 *   requiresMetadataFetch — true = Mailchimp: after token exchange, call
 *                      GET /oauth2/metadata to get the server `dc` prefix.
 *                      Stored as externalAccountId for API call routing.
 *
 *   requiresShopDomain — true = auth/token URLs are built from the shopDomain
 *                      supplied in the auth-url request.
 *
 *   usesAuthCodeField — true = platform returns `auth_code` instead of `code`
 *                      (TikTok v1-style flows).
 */
export interface OAuthPlatformConfig {
  platform: IntegrationPlatform;
  clientIdKey: string;
  clientSecretKey: string;
  redirectUriKey: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scopes: string;
  scopeSeparator?: string;
  hasRefreshToken: boolean;
  tokenTtlMs?: number;
  extraAuthParams?: Record<string, string>;
  useBasicAuth?: boolean;
  usesPKCE?: boolean;
  requiresContextParam?: boolean;
  requiresMetadataFetch?: boolean;
  requiresShopDomain?: boolean;
  shopAuthTemplate?: string;
  shopTokenTemplate?: string;
  usesAuthCodeField?: boolean;
}

// 60-day TTL used for Meta-family tokens (no refresh token issued)
const META_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export const OAUTH_PLATFORM_CONFIGS = new Map<IntegrationPlatform, OAuthPlatformConfig>([

  // ─── Microsoft / Bing family ────────────────────────────────────────────────
  [
    IntegrationPlatform.MICROSOFT_ADS,
    {
      platform: IntegrationPlatform.MICROSOFT_ADS,
      clientIdKey: 'microsoft.clientId',
      clientSecretKey: 'microsoft.clientSecret',
      redirectUriKey: 'microsoft.redirectUri',
      authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      // offline_access grants a refresh token
      scopes: 'https://ads.microsoft.com/msads.manage offline_access',
      hasRefreshToken: true,
      extraAuthParams: { prompt: 'select_account' },
    },
  ],
  [
    IntegrationPlatform.BING_WEBMASTER_TOOLS,
    {
      platform: IntegrationPlatform.BING_WEBMASTER_TOOLS,
      clientIdKey: 'microsoft.clientId',
      clientSecretKey: 'microsoft.clientSecret',
      redirectUriKey: 'bingWebmasterTools.redirectUri',
      authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      // Verified scope: https://learn.microsoft.com/en-us/bingwebmaster/oauth2
      scopes: 'https://webmaster.bing.com/api/webmaster.manage',
      hasRefreshToken: true,
    },
  ],

  // ─── Google family (google.clientId / google.clientSecret) ─────────────────
  // Standard Google OAuth — access_type=offline + prompt=consent ensures refresh token
  [
    IntegrationPlatform.GOOGLE_AD_MANAGER,
    {
      platform: IntegrationPlatform.GOOGLE_AD_MANAGER,
      clientIdKey: 'google.clientId',
      clientSecretKey: 'google.clientSecret',
      redirectUriKey: 'googleAdManager.redirectUri',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scopes: 'https://www.googleapis.com/auth/dfp',
      hasRefreshToken: true,
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
  ],
  [
    IntegrationPlatform.GOOGLE_DV360,
    {
      platform: IntegrationPlatform.GOOGLE_DV360,
      clientIdKey: 'google.clientId',
      clientSecretKey: 'google.clientSecret',
      redirectUriKey: 'googleDv360.redirectUri',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scopes: 'https://www.googleapis.com/auth/display-video',
      hasRefreshToken: true,
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
  ],
  [
    IntegrationPlatform.GOOGLE_LOCAL_SERVICES_ADS,
    {
      platform: IntegrationPlatform.GOOGLE_LOCAL_SERVICES_ADS,
      clientIdKey: 'google.clientId',
      clientSecretKey: 'google.clientSecret',
      redirectUriKey: 'googleLocalServicesAds.redirectUri',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      // LSA uses the same OAuth scope as Google Ads API
      // Ref: https://developers.google.com/local-services-ads/guides/set-up-and-use-oauth
      scopes: 'https://www.googleapis.com/auth/adwords',
      hasRefreshToken: true,
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
  ],
  [
    IntegrationPlatform.GOOGLE_BUSINESS_PROFILE,
    {
      platform: IntegrationPlatform.GOOGLE_BUSINESS_PROFILE,
      clientIdKey: 'google.clientId',
      clientSecretKey: 'google.clientSecret',
      redirectUriKey: 'googleBusinessProfile.redirectUri',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scopes: 'https://www.googleapis.com/auth/business.manage',
      hasRefreshToken: true,
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
  ],
  [
    IntegrationPlatform.GOOGLE_BIGQUERY,
    {
      platform: IntegrationPlatform.GOOGLE_BIGQUERY,
      clientIdKey: 'google.clientId',
      clientSecretKey: 'google.clientSecret',
      redirectUriKey: 'googleBigQuery.redirectUri',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scopes: 'https://www.googleapis.com/auth/bigquery.readonly',
      hasRefreshToken: true,
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
  ],

  // ─── Meta family (meta.appId / meta.appSecret) ──────────────────────────────
  // All three share meta.redirectUri — register all 3 callback paths in the same
  // Facebook App under "Valid OAuth Redirect URIs".
  // Meta tokens are long-lived (~60 days) with no refresh token.
  [
    IntegrationPlatform.INSTAGRAM_ADS,
    {
      platform: IntegrationPlatform.INSTAGRAM_ADS,
      clientIdKey: 'meta.appId',
      clientSecretKey: 'meta.appSecret',
      redirectUriKey: 'meta.redirectUri',
      authEndpoint: 'https://www.facebook.com/dialog/oauth',
      tokenEndpoint: 'https://graph.facebook.com/v21.0/oauth/access_token',
      scopes: 'ads_read,ads_management',
      scopeSeparator: ',',
      hasRefreshToken: false,
      tokenTtlMs: META_TTL_MS,
    },
  ],
  [
    IntegrationPlatform.FACEBOOK_ORGANIC,
    {
      platform: IntegrationPlatform.FACEBOOK_ORGANIC,
      clientIdKey: 'meta.appId',
      clientSecretKey: 'meta.appSecret',
      redirectUriKey: 'meta.redirectUri',
      authEndpoint: 'https://www.facebook.com/dialog/oauth',
      tokenEndpoint: 'https://graph.facebook.com/v21.0/oauth/access_token',
      scopes: 'pages_show_list,pages_read_engagement,read_insights',
      scopeSeparator: ',',
      hasRefreshToken: false,
      tokenTtlMs: META_TTL_MS,
    },
  ],
  [
    IntegrationPlatform.INSTAGRAM_ORGANIC,
    {
      platform: IntegrationPlatform.INSTAGRAM_ORGANIC,
      clientIdKey: 'meta.appId',
      clientSecretKey: 'meta.appSecret',
      redirectUriKey: 'meta.redirectUri',
      authEndpoint: 'https://www.facebook.com/dialog/oauth',
      tokenEndpoint: 'https://graph.facebook.com/v21.0/oauth/access_token',
      scopes: 'instagram_basic,instagram_manage_insights,pages_show_list',
      scopeSeparator: ',',
      hasRefreshToken: false,
      tokenTtlMs: META_TTL_MS,
    },
  ],

  // ─── TikTok family ──────────────────────────────────────────────────────────
  // TikTok Organic v2 returns `code` (not `auth_code` — that was v1.3 Ads).
  [
    IntegrationPlatform.TIKTOK_ORGANIC,
    {
      platform: IntegrationPlatform.TIKTOK_ORGANIC,
      clientIdKey: 'tiktok.appId',
      clientSecretKey: 'tiktok.secret',
      redirectUriKey: 'tiktok.redirectUri',
      authEndpoint: 'https://www.tiktok.com/v2/auth/authorize/',
      tokenEndpoint: 'https://open.tiktokapis.com/v2/oauth/token/',
      scopes: 'user.info.basic,video.list',
      scopeSeparator: ',',
      hasRefreshToken: true,
    },
  ],

  // ─── Pinterest ──────────────────────────────────────────────────────────────
  // Pinterest v5 token exchange requires HTTP Basic auth header.
  // Ref: https://developers.pinterest.com/docs/api/v5/oauth-token/
  [
    IntegrationPlatform.PINTEREST_ADS,
    {
      platform: IntegrationPlatform.PINTEREST_ADS,
      clientIdKey: 'pinterest.appId',
      clientSecretKey: 'pinterest.appSecret',
      redirectUriKey: 'pinterest.redirectUri',
      authEndpoint: 'https://www.pinterest.com/oauth/',
      tokenEndpoint: 'https://api.pinterest.com/v5/oauth/token',
      scopes: 'ads:read',
      hasRefreshToken: true,
      useBasicAuth: true,
    },
  ],
  [
    IntegrationPlatform.PINTEREST_ORGANIC,
    {
      platform: IntegrationPlatform.PINTEREST_ORGANIC,
      clientIdKey: 'pinterest.appId',
      clientSecretKey: 'pinterest.appSecret',
      redirectUriKey: 'pinterest.redirectUri',
      authEndpoint: 'https://www.pinterest.com/oauth/',
      tokenEndpoint: 'https://api.pinterest.com/v5/oauth/token',
      scopes: 'boards:read,pins:read,user_accounts:read',
      hasRefreshToken: true,
      useBasicAuth: true,
    },
  ],

  // ─── Snapchat ───────────────────────────────────────────────────────────────
  [
    IntegrationPlatform.SNAPCHAT_ADS,
    {
      platform: IntegrationPlatform.SNAPCHAT_ADS,
      clientIdKey: 'snapchat.clientId',
      clientSecretKey: 'snapchat.clientSecret',
      redirectUriKey: 'snapchat.redirectUri',
      authEndpoint: 'https://accounts.snapchat.com/login/oauth2/authorize',
      tokenEndpoint: 'https://accounts.snapchat.com/login/oauth2/access_token',
      scopes: 'snapchat-marketing-api',
      hasRefreshToken: true,
    },
  ],

  // ─── X (Twitter) ────────────────────────────────────────────────────────────
  // X OAuth 2.0 requires:
  //   1. PKCE (S256) — mandatory, not optional
  //   2. HTTP Basic auth on the token endpoint
  //   3. offline.access scope to get a refresh token
  // Ref: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
  [
    IntegrationPlatform.X_ADS,
    {
      platform: IntegrationPlatform.X_ADS,
      clientIdKey: 'xads.apiKey',
      clientSecretKey: 'xads.apiSecretKey',
      redirectUriKey: 'xads.redirectUri',
      authEndpoint: 'https://twitter.com/i/oauth2/authorize',
      tokenEndpoint: 'https://api.x.com/2/oauth2/token',
      scopes: 'tweet.read users.read ads.read offline.access',
      hasRefreshToken: true,
      useBasicAuth: true,
      usesPKCE: true,
    },
  ],
  [
    IntegrationPlatform.X_ORGANIC,
    {
      platform: IntegrationPlatform.X_ORGANIC,
      clientIdKey: 'xads.apiKey',
      clientSecretKey: 'xads.apiSecretKey',
      redirectUriKey: 'xads.redirectUri',
      authEndpoint: 'https://twitter.com/i/oauth2/authorize',
      tokenEndpoint: 'https://api.x.com/2/oauth2/token',
      scopes: 'tweet.read users.read offline.access',
      hasRefreshToken: true,
      useBasicAuth: true,
      usesPKCE: true,
    },
  ],

  // ─── Reddit ─────────────────────────────────────────────────────────────────
  // Reddit token exchange uses HTTP Basic auth. `duration=permanent` in auth URL
  // requests a refresh token. User-Agent header needed on API calls (not auth).
  // Ref: https://github.com/reddit-archive/reddit/wiki/OAuth2
  [
    IntegrationPlatform.REDDIT_ADS,
    {
      platform: IntegrationPlatform.REDDIT_ADS,
      clientIdKey: 'reddit.clientId',
      clientSecretKey: 'reddit.clientSecret',
      redirectUriKey: 'reddit.redirectUri',
      authEndpoint: 'https://www.reddit.com/api/v1/authorize',
      tokenEndpoint: 'https://www.reddit.com/api/v1/access_token',
      scopes: 'read adsread',
      hasRefreshToken: true,
      useBasicAuth: true,
      extraAuthParams: { duration: 'permanent' },
    },
  ],

  // ─── AdRoll ─────────────────────────────────────────────────────────────────
  // Standard RFC 6749 — credentials in POST body, no Basic auth.
  // Ref: https://apidocs.nextroll.com/guides/oauth.html
  [
    IntegrationPlatform.ADROLL,
    {
      platform: IntegrationPlatform.ADROLL,
      clientIdKey: 'adroll.clientId',
      clientSecretKey: 'adroll.clientSecret',
      redirectUriKey: 'adroll.redirectUri',
      authEndpoint: 'https://services.adroll.com/auth/oauth2/authorize',
      // Verified: /auth/token (not /auth/oauth2/token)
      tokenEndpoint: 'https://services.adroll.com/auth/token',
      scopes: 'read_reports',
      hasRefreshToken: true,
    },
  ],

  // ─── Spotify Ads Studio ─────────────────────────────────────────────────────
  [
    IntegrationPlatform.SPOTIFY_ADS,
    {
      platform: IntegrationPlatform.SPOTIFY_ADS,
      clientIdKey: 'spotify.clientId',
      clientSecretKey: 'spotify.clientSecret',
      redirectUriKey: 'spotify.redirectUri',
      authEndpoint: 'https://accounts.spotify.com/authorize',
      tokenEndpoint: 'https://accounts.spotify.com/api/token',
      scopes: 'streaming',
      hasRefreshToken: true,
    },
  ],

  // ─── Mailchimp ──────────────────────────────────────────────────────────────
  // Standard token exchange, but REQUIRES a follow-up GET to /oauth2/metadata
  // to retrieve the server `dc` prefix (e.g. "us1"). Without it, API base URL
  // cannot be constructed. dc is stored as externalAccountId.
  // Ref: https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
  [
    IntegrationPlatform.MAILCHIMP,
    {
      platform: IntegrationPlatform.MAILCHIMP,
      clientIdKey: 'mailchimp.clientId',
      clientSecretKey: 'mailchimp.clientSecret',
      redirectUriKey: 'mailchimp.redirectUri',
      authEndpoint: 'https://login.mailchimp.com/oauth2/authorize',
      tokenEndpoint: 'https://login.mailchimp.com/oauth2/token',
      scopes: '',
      hasRefreshToken: false,
      requiresMetadataFetch: true,
    },
  ],

  // ─── Constant Contact ───────────────────────────────────────────────────────
  [
    IntegrationPlatform.CONSTANT_CONTACT,
    {
      platform: IntegrationPlatform.CONSTANT_CONTACT,
      clientIdKey: 'constantContact.clientId',
      clientSecretKey: 'constantContact.clientSecret',
      redirectUriKey: 'constantContact.redirectUri',
      authEndpoint: 'https://authz.constantcontact.com/oauth2/default/v1/authorize',
      tokenEndpoint: 'https://authz.constantcontact.com/oauth2/default/v1/token',
      scopes: 'contact_data campaign_data',
      hasRefreshToken: true,
    },
  ],

  // ─── HubSpot ────────────────────────────────────────────────────────────────
  [
    IntegrationPlatform.HUBSPOT,
    {
      platform: IntegrationPlatform.HUBSPOT,
      clientIdKey: 'hubspot.clientId',
      clientSecretKey: 'hubspot.clientSecret',
      redirectUriKey: 'hubspot.redirectUri',
      authEndpoint: 'https://app.hubspot.com/oauth/authorize',
      tokenEndpoint: 'https://api.hubapi.com/oauth/v1/token',
      scopes: 'crm.objects.contacts.read crm.objects.deals.read crm.objects.owners.read oauth',
      hasRefreshToken: true,
    },
  ],

  // ─── Salesforce ─────────────────────────────────────────────────────────────
  [
    IntegrationPlatform.SALESFORCE,
    {
      platform: IntegrationPlatform.SALESFORCE,
      clientIdKey: 'salesforce.clientId',
      clientSecretKey: 'salesforce.clientSecret',
      redirectUriKey: 'salesforce.redirectUri',
      authEndpoint: 'https://login.salesforce.com/services/oauth2/authorize',
      tokenEndpoint: 'https://login.salesforce.com/services/oauth2/token',
      scopes: 'api refresh_token',
      hasRefreshToken: true,
    },
  ],

  // ─── Keap (Infusionsoft) ────────────────────────────────────────────────────
  [
    IntegrationPlatform.KEAP,
    {
      platform: IntegrationPlatform.KEAP,
      clientIdKey: 'keap.clientId',
      clientSecretKey: 'keap.clientSecret',
      redirectUriKey: 'keap.redirectUri',
      authEndpoint: 'https://accounts.infusionsoft.com/app/oauth/authorize',
      tokenEndpoint: 'https://api.infusionsoft.com/token',
      scopes: '',
      hasRefreshToken: true,
    },
  ],

  // ─── Shopify (per-shop OAuth) ────────────────────────────────────────────────
  // shopDomain is required. Auth URL and token URL are per-shop.
  // redirect_uri IS required in Shopify token exchange and must match exactly.
  // Ref: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
  [
    IntegrationPlatform.SHOPIFY,
    {
      platform: IntegrationPlatform.SHOPIFY,
      clientIdKey: 'shopify.apiKey',
      clientSecretKey: 'shopify.apiSecret',
      redirectUriKey: 'shopify.redirectUri',
      authEndpoint: '',
      tokenEndpoint: '',
      shopAuthTemplate: 'https://{shop}/admin/oauth/authorize',
      shopTokenTemplate: 'https://{shop}/admin/oauth/access_token',
      scopes: 'read_orders,read_products,read_analytics',
      hasRefreshToken: false,
      requiresShopDomain: true,
    },
  ],
  // ─── BigCommerce (per-shop OAuth) ────────────────────────────────────────────
  // Callback receives `context` query param (e.g. "stores/abc123") which must
  // be forwarded in the token exchange POST body.
  // Ref: https://developer.bigcommerce.com/api-docs/apps/guide/auth
  [
    IntegrationPlatform.BIGCOMMERCE,
    {
      platform: IntegrationPlatform.BIGCOMMERCE,
      clientIdKey: 'bigcommerce.clientId',
      clientSecretKey: 'bigcommerce.clientSecret',
      redirectUriKey: 'bigcommerce.redirectUri',
      authEndpoint: 'https://login.bigcommerce.com/oauth2/authorize',
      tokenEndpoint: 'https://login.bigcommerce.com/oauth2/token',
      scopes: 'store_v2_orders_read_only store_v2_products_read_only store_v2_analytics',
      hasRefreshToken: false,
      requiresContextParam: true,
    },
  ],

  // ─── Trustpilot ─────────────────────────────────────────────────────────────
  // Authorization code flow with Basic auth for token exchange.
  // Access token TTL: 100 hours. Refresh token TTL: 30 days.
  // Scopes: not used by Trustpilot — access is determined by app registration.
  // Ref: https://developers.trustpilot.com/authentication
  [
    IntegrationPlatform.TRUSTPILOT,
    {
      platform: IntegrationPlatform.TRUSTPILOT,
      clientIdKey: 'trustpilot.clientId',
      clientSecretKey: 'trustpilot.clientSecret',
      redirectUriKey: 'trustpilot.redirectUri',
      authEndpoint: 'https://authenticate.trustpilot.com',
      tokenEndpoint: 'https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken',
      scopes: '',
      hasRefreshToken: true,
      tokenTtlMs: 100 * 60 * 60 * 1000, // 100 hours
      useBasicAuth: true,
    },
  ],

  // ─── Yext (Sandbox Mode) ───────────────────────────────────────────────────
  [
    IntegrationPlatform.YEXT,
    {
      platform: IntegrationPlatform.YEXT,
      clientIdKey: 'yext.clientId',
      clientSecretKey: 'yext.clientSecret',
      redirectUriKey: 'yext.redirectUri',
      authEndpoint: 'https://sandbox.yext.com/oauth2/authorize',
      tokenEndpoint: 'https://sandbox.yext.com/oauth2/token',
      scopes: 'listings analytics',
      hasRefreshToken: true,
    },
  ],

  // ─── Vimeo ──────────────────────────────────────────────────────────────────
  // Standard POST body — credentials in body, no Basic auth required.
  // Ref: https://developer.vimeo.com/api/authentication
  [
    IntegrationPlatform.VIMEO,
    {
      platform: IntegrationPlatform.VIMEO,
      clientIdKey: 'vimeo.clientId',
      clientSecretKey: 'vimeo.clientSecret',
      redirectUriKey: 'vimeo.redirectUri',
      authEndpoint: 'https://api.vimeo.com/oauth/authorize',
      tokenEndpoint: 'https://api.vimeo.com/oauth/access_token',
      scopes: 'public private stats',
      hasRefreshToken: false,
    },
  ],
]);
