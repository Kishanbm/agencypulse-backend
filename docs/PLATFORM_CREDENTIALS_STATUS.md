# Platform Credentials & Status Report

Generated: 2026-05-15
Source: PLATFORM_CREDENTIALS_GUIDE.md, FEATURES.md, PROGRESS.md, INTEGRATIONS_TESTING_GUIDE.md, platform-catalog.ts, platform-credentials.ts

---

## Summary

| Metric | Count |
|--------|-------|
| Total platforms implemented (sync code + tests) | 82 |
| Total platforms in catalog (including 3 PENDING) | 85 |
| Connected (credentials obtained & OAuth flow verified) | 32 |
| In Review / In Progress / Pending (waiting on external action) | 5 |
| Skipped (manual barrier / cost / regional block) | 21 |
| Not yet attempted | ~27 |
| Fully tested with real live data | 2 (GA4, Google Search Console) |
| Seeded/fake data then deleted | 1 (Google PageSpeed) |

---

## Legend

- **Sync Status**: `DONE` = full sync code implemented + 340 tests passing; `PENDING` = sync not yet implemented
- **Credential Status**: `CONNECTED` = OAuth flow or API key verified in dev environment; `IN_REVIEW` = waiting on platform approval; `PENDING` = waiting on external action; `SKIPPED` = not attempted due to barriers; `NONE` = not yet tried
- **Key Type**: `REAL` = production-grade real credentials; `TRIAL` = trial/free-tier key; `FREE_TIER` = platform has a free tier with API access; `NONE` = no key held
- **Real Data Tested**: `YES` = real API response ingested and verified; `SEEDED_DELETED` = fake seed data used then deleted; `NO` = sync code exists but never run against real API

---

## Platform Status Table

### PPC / Paid Advertising (17 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 1 | Google Ads | OAuth (Google) | CONNECTED | REAL | Same Google OAuth app as GA4; requires GOOGLE_ADS_DEVELOPER_TOKEN | NO | Agency connects via Google OAuth; needs MCC Customer ID |
| 2 | Meta Ads | OAuth (Facebook) | PENDING | NONE | Waiting for Facebook Business Manager credentials | NO | Agency connects Facebook Business account; needs App Review for ads_management scope in production |
| 3 | LinkedIn Ads | OAuth (LinkedIn) | IN_REVIEW | NONE | Waiting for LinkedIn Marketing Developer Platform approval (24h+) | NO | Agency connects LinkedIn Campaign Manager; needs LinkedIn MDP approval for r_ads_reporting scope |
| 4 | TikTok Ads | OAuth (TikTok) | BLOCKED | NONE | TikTok Ads API restricted in India; cannot create TikTok for Business account | NO | Agency connects TikTok Business account; must be outside India or use VPN workaround |
| 5 | Amazon Ads | OAuth (Amazon LWA) | SKIPPED | NONE | Amazon ads account needs to be crested | NO | Agency connects Amazon Advertising account; Login with Amazon OAuth |
| 6 | Microsoft Ads | OAuth (Microsoft) | SKIPPED | NONE | Requires Azure app registration + credit card signup; skipped | NO | Agency connects Microsoft Advertising account; requires Azure AD app registration |
| 7 | Pinterest Ads | OAuth (Pinterest) | BLOCKED | NONE | Access denied by Pinterest — app needs public Privacy Policy + ToS URL to pass review | NO | Agency connects Pinterest Business; requires app review approval by Pinterest |
| 8 | Snapchat Ads | OAuth (Snapchat) | BLOCKED | NONE | Snapchat requires valid GSTIN for India accounts | NO | Agency connects Snapchat Business; GSTIN required for India |
| 9 | X Ads | OAuth+PKCE (X) | SKIPPED | NONE | X OAuth returned "Something went wrong" during test; needs the paid account | NO | Agency connects X account; requires separate Ads API tier approval from X |
| 10 | Reddit Ads | OAuth (Reddit) | PENDING | NONE | Network block during testing; OAuth app created but not verified | NO | Agency connects Reddit Ads account; straightforward OAuth |
| 11 | AdRoll | OAuth | SKIPPED | NONE | Account verification email issue during signup | NO | Agency connects AdRoll account; standard OAuth |
| 12 | Google Ad Manager | OAuth (Google) | CONNECTED | REAL | OAuth via shared Google app; Manager Account connected | NO | Agency connects Google account with Ad Manager network access; needs Network Code |
| 13 | Google DV360 | OAuth (Google) | CONNECTED | REAL | OAuth via shared Google app; Partner Account connected | NO | Agency connects Google account with DV360 Partner access |
| 14 | Google LSA | OAuth (Google) | CONNECTED | REAL | OAuth via shared Google app; Account ID connected | NO | Agency connects Google account managing Local Services Ads |
| 15 | Instagram Ads | OAuth (Facebook) | PENDING | NONE | Same as Meta Ads — pending same Facebook credentials | NO | Uses same Meta/Facebook OAuth app; needs Instagram linked to Business Manager |
| 16 | Spotify Ads | OAuth (Spotify) | CONNECTED | REAL | OAuth Client ID + Secret obtained and connected | NO | Agency connects Spotify Ads Studio account |
| 17 | StackAdapt | API Key | SKIPPED | NONE | Manual account evaluation required; no immediate self-serve access | NO | Agency provides API key from StackAdapt account settings; needs account manager approval |
| 18 | Simpli.fi | API Key | SKIPPED | NONE | Paid account required to generate API keys; no self-serve trial | NO | Agency provides API key; requires paid Simpli.fi account |
| 19 | Choozle | API Key | SKIPPED | NONE | Requires discovery call/demo; no immediate self-serve | NO | Agency provides API key from Choozle account settings |
| 20 | GroundTruth | API Key | SKIPPED | NONE | No self-serve API keys; requires support request | NO | Agency requests API key via GroundTruth support |
| 21 | Basis Platform | API Key | SKIPPED | NONE | Enterprise-only; requires manual onboarding | NO | Enterprise contract required |
| 22 | Yelp Ads | API Key | SKIPPED | NONE | paid-only licensing model | NO | Requires Yelp Partner API account (paid); contact yelp partner team |

---

### SEO (10 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 23 | GA4 (Google Analytics 4) | OAuth (Google) | CONNECTED | REAL | Fully tested; 2 display bugs fixed (bounce rate, session duration) | YES | Agency connects Google account with Viewer+ access to GA4 property |
| 24 | Google Search Console | OAuth (Google) | CONNECTED | REAL | Connected via shared Google OAuth app; techqwaz.com verified property | YES — 28 rows, 4 metrics (clicks avg 0.86/day, impressions avg 63/day, CTR 1.39%, position 19.78); techqwaz.com + scrimverse.com both verified; DNS TXT via Hostinger | Agency connects Google account with Restricted+ access to Search Console property |
| 25 | Google PageSpeed | API Key | CONNECTED | FREE_TIER | API key obtained (free tier: 10K req/day); | - | Agency creates API key in Google Cloud Console; optional — unauthenticated rate is sufficient for small accounts |
| 26 | Bing Webmaster Tools | API Key | CONNECTED | REAL | API Key + Site URL configured (qodet.com verified in Bing) | NO | Agency provides Bing Webmaster Tools API key from settings; must have verified site |
| 27 | SE Ranking | API Key | CONNECTED | TRIAL | 14-day trial API key obtained; Site ID: 11976821 | NO | Agency on any paid SE Ranking plan; API key in profile settings |
| 28 | Semrush | API Key | SKIPPED | NONE | API requires $500/mo Business plan + API credit units | NO | Agency needs Semrush Guru ($229/mo) or Business ($449/mo) plan for meaningful API access |
| 29 | Ahrefs | API Key | SKIPPED | NONE | API requires paid subscription plan; no free tier | NO | Agency needs Ahrefs Standard plan minimum; API key in account settings |
| 30 | Moz | API Key | SKIPPED | NONE | Requires credit card for trial API access | NO | Agency needs Moz Pro account; Access ID + Secret Key from account settings |
| 31 | Majestic SEO | API Key | SKIPPED | NONE | API key requires $400/mo API plan | NO | Agency needs Majestic API plan; key from account settings |
| 32 | BrightLocal | API Key | IN_PROGRESS | NONE | Setting up 14-day trial; pending GBP Manager access for Indian locations | NO | Agency on any BrightLocal paid plan; API key from account settings; India locations need GBP manager access |
| 33 | Google Lighthouse | API Key (optional) | N/A | FREE_TIER | No auth required for public URLs; uses same PageSpeed API key | N/A | No credentials needed; optional Google API key for higher rate limits |
| 34 | Rank Tracker | API Key | NONE | NONE | Not yet attempted; sync code pending | NO | Agency needs ranktracker.com paid account |
| 35 | Backlink Monitor | API Key | NONE | NONE | Not yet attempted; sync code pending | NO | Agency needs backlink monitoring service paid account |

---

### Social / Organic (6 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 36 | Facebook Organic | OAuth (Facebook) | PENDING | NONE | Waiting for same Facebook/Meta credentials | NO | Agency connects Facebook account with Admin/Editor access to the Page |
| 37 | Instagram Organic | OAuth (Facebook) | PENDING | NONE | Waiting for same Facebook/Meta credentials | NO | Agency needs Instagram Business account linked to Facebook Page |
| 38 | YouTube Analytics | OAuth (Google) | CONNECTED | REAL | Connected via shared Google OAuth app | NO | Agency connects Google account with channel Owner/Manager access |
| 39 | Pinterest Organic | OAuth (Pinterest) | BLOCKED | NONE | Same Pinterest access denial as Pinterest Ads (shared app) | NO | Agency needs Pinterest Business account; same app review requirements |
| 40 | X Organic | OAuth+PKCE (X) | SKIPPED | NONE | X OAuth issues; same "Something went wrong" error | NO | Agency connects X account; free Basic API has limited analytics |
| 41 | TikTok Organic | OAuth (TikTok Login Kit) | BLOCKED | NONE | TikTok regional restriction in India | NO | Agency needs TikTok Business/Creator account |
| 42 | Vimeo | OAuth (Vimeo) | CONNECTED | REAL | OAuth Client ID + Secret obtained and connected | NO | Agency needs Vimeo Plus/Pro/Business account (free accounts lack full analytics API) |

---

### Email Marketing (8 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 43 | Mailchimp | OAuth | CONNECTED | REAL | OAuth Client ID + Secret; trial Mailchimp account used | NO | Agency connects Mailchimp account with Admin access; OAuth auto-stores dc prefix |
| 44 | Klaviyo | API Key | CONNECTED | TRIAL | Private API Key obtained from trial account | NO | Agency generates private API key in Klaviyo account settings |
| 45 | ActiveCampaign | API Key | CONNECTED | REAL | API Key + Account URL obtained | NO | Agency provides API URL + API key from Settings > Developer |
| 46 | Brevo | API Key | CONNECTED | FREE_TIER | API Key obtained; Brevo free tier has generous API access | NO | Agency generates API key in Brevo SMTP & API settings; free tier available |
| 47 | Constant Contact | OAuth | CONNECTED | REAL | OAuth Client ID + Secret obtained and connected | NO | Agency connects Constant Contact account with Admin access |
| 48 | Campaign Monitor | API Key | CONNECTED | REAL | API Key + Client ID obtained | NO | Agency generates API key in Campaign Monitor account settings |
| 49 | ConvertKit (Kit) | API Key | CONNECTED | REAL | API Secret obtained from ConvertKit account | NO | Agency gets API secret from Settings > Advanced > API Secret |
| 50 | Drip | API Key | CONNECTED | REAL | API Token + Account ID obtained | NO | Agency gets API token from User Settings > API; Account ID from URL |

---

### Ecommerce (5 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 51 | Shopify | OAuth | CONNECTED | REAL | Connected via Custom App link (Custom Distribution, not Public) | NO | Agency installs AgencyPulse as Shopify custom app; requires store domain at connect time |
| 52 | WooCommerce | API Key | CONNECTED | REAL | Consumer Key + Consumer Secret + Site URL obtained | NO | Agency generates WooCommerce REST API key with Read permission |
| 53 | BigCommerce | API Key | CONNECTED | REAL | Store Hash + API Token obtained from BigCommerce trial store | NO | Agency creates V2/V3 API account in BigCommerce Advanced Settings |
| 54 | Stripe | API Key | SKIPPED | NONE | Stripe API key needed | NO | Agency provides Stripe secret key (sk_live_) or restricted key with read permissions |
| 55 | Keap | OAuth | PENDING | NONE | Waiting for manual account approval from Keap | NO | Agency connects Keap account; requires OAuth app approval by Keap team |

---

### Analytics & CRM (9 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 56 | HubSpot | OAuth | CONNECTED | REAL | OAuth Client ID + Secret obtained; trial HubSpot account | NO | Agency connects HubSpot account with Super Admin access |
| 57 | Matomo | API Key | CONNECTED | REAL | Auth Token + Instance URL + Site ID obtained (self-hosted instance) | NO | Agency provides Matomo auth token + their Matomo instance URL + site ID |
| 58 | Salesforce | OAuth | CONNECTED | REAL | OAuth Client ID + Secret obtained via Salesforce Developer Edition (free) | NO | Agency connects Salesforce account; needs Enterprise/Unlimited or Developer edition with API Enabled profile |
| 59 | SharpSpring | API Key | NONE | NONE | Not yet attempted | NO | Agency provides Account ID + Secret Key from SharpSpring Settings > API Settings |
| 60 | Gravity Forms | API Key | CONNECTED | REAL | Consumer Key + Consumer Secret + Site URL + Form ID obtained | NO | Agency provides WP admin credentials; generates Gravity Forms REST API key |
| 61 | Unbounce | OAuth | SKIPPED | NONE | Requires manual account approval (2-3 days); skipped | NO | Agency connects Unbounce account; OAuth approval required |
| 62 | HighLevel | OAuth | NONE | NONE | Not yet attempted | NO | Agency connects HighLevel/GoHighLevel Location; OAuth flow |
| 63 | Google Sheets | OAuth (Google) | CONNECTED | REAL | Connected via shared Google OAuth app | NO | Agency connects Google account with Editor access to the target spreadsheet |
| 64 | Google BigQuery | OAuth (Google) | CONNECTED | REAL | Connected via shared Google OAuth app | NO | Agency connects Google account with BigQuery Data Viewer + Job User roles |

---

### Call Tracking (9 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 65 | CallRail | API Key | SKIPPED | NONE | Requires credit card to unlock dashboard/API access | NO | Agency generates API key in CallRail Account Settings > API Access; needs paid plan |
| 66 | CallTrackingMetrics | API Key | SKIPPED | NONE | Requires credit card upfront for trial | NO | Agency generates Access Key + Secret Key in CTM Account Settings > API Keys |
| 67 | WhatConverts | API Key | SKIPPED | NONE | Requires credit card for 14-day trial | NO | Agency provides API token from WhatConverts account |
| 68 | Twilio | API Key | CONNECTED | REAL | Account SID + Auth Token obtained from Twilio trial account | NO | Agency provides Twilio Account SID + Auth Token (or API Key SID + Secret) |
| 69 | Marchex | API Key | NONE | NONE | Not yet attempted; requires account manager | NO | Agency contacts Marchex account manager for API credentials |
| 70 | Avanser | API Key | SKIPPED | NONE | Manual sales barrier; requires consultative onboarding | NO | Agency contacts Avanser support for API access |
| 71 | CallSource | API Key | NONE | NONE | Not yet attempted; requires account representative | NO | Agency contacts CallSource account rep for API credentials |
| 72 | Delacon | API Key | SKIPPED | NONE | Manual sales barrier; requires consultative onboarding (AU-focused) | NO | Agency contacts Delacon support at support@delacon.com.au |
| 73 | WildJar | API Key | SKIPPED | NONE | Manual sales barrier; requires "Let's Talk" form submission | NO | Agency contacts WildJar support at support@wildjar.com |

---

### Local & Reputation (11 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 74 | Google Business Profile | OAuth (Google) | CONNECTED | REAL | Connected via shared Google OAuth app | NO | Agency connects Google account with Owner/Manager access to GBP listing |
| 75 | BrightLocal | API Key | IN_PROGRESS | NONE | Setting up 14-day trial; India workaround via GBP manager requires kishan@qodet.com as GBP Manager | NO | Agency on any BrightLocal paid plan; API key from account settings |
| 76 | Trustpilot | OAuth | SKIPPED | NONE | API access requires Premium/Enterprise plan + Add-on (expensive) | NO | Agency needs Trustpilot Premium Business account; OAuth app registration |
| 77 | Yelp | API Key | SKIPPED | NONE | Yelp moved to paid-only licensing in 2026; Fusion API now paywalled | NO | Yelp API now requires paid licensing agreement |
| 78 | Birdeye | API Key | SKIPPED | NONE | Reputation API is enterprise-only; requires contract | NO | Agency contacts Birdeye account manager; enterprise contract required |
| 79 | Yext | OAuth | IN_PROGRESS | NONE | Troubleshooting Sandbox Token URL 404 issue; app created, OAuth not yet working | NO | Agency connects Yext account with Admin access |
| 80 | GatherUp | API Key | CONNECTED | REAL | Client ID + Bearer Token obtained | NO | Agency gets API key from GatherUp Settings > API section |
| 81 | Grade.us | API Key | NONE | NONE | Not yet attempted | NO | Agency gets API key from Grade.us Account > API Access |
| 82 | Synup | API Key | NONE | NONE | Not yet attempted; may require account manager | NO | Agency contacts Synup account manager for API access |
| 83 | Vendasta | OAuth | NONE | NONE | Not yet attempted; requires Partner-level access | NO | Agency connects Vendasta Partner account; OAuth flow |

---

### Database / Warehouse (4 platforms)

| # | Platform | Auth Type | Credential Status | Key Type | Notes | Real Data Tested | How to Get Production Keys |
|---|----------|-----------|-------------------|----------|-------|-----------------|--------------------------|
| 84 | Google BigQuery | OAuth (Google) | CONNECTED | REAL | Connected via shared Google OAuth app | NO | Agency connects Google account with BigQuery permissions; or uses service account JSON |
| 85 | Amazon Redshift | Credentials (direct) | NONE | NONE | User provides their own cluster credentials; no central key needed | N/A | Agency provides Redshift cluster endpoint + readonly user credentials |
| 86 | MySQL | Credentials (direct) | NONE | NONE | User provides their own DB credentials; no central key needed | N/A | Agency provides MySQL host + readonly user credentials |
| 87 | Snowflake | Credentials (direct) | NONE | NONE | User provides their own Snowflake credentials; no central key needed | N/A | Agency provides Snowflake account identifier + warehouse + user credentials |

---

## Summary by Status

| Status | Count | Platforms |
|--------|-------|-----------|
| CONNECTED (credentials obtained, OAuth verified) | 32 | GA4, Google Ads, Google Search Console, Google PageSpeed, Google Business Profile, Google Ad Manager, Google DV360, Google LSA, YouTube Analytics, Google Sheets, Google BigQuery, Spotify Ads, Vimeo, Mailchimp, Klaviyo, ActiveCampaign, Brevo, Constant Contact, Campaign Monitor, ConvertKit, Drip, Shopify, WooCommerce, BigCommerce, HubSpot, Matomo, Salesforce, Gravity Forms, SE Ranking, Bing Webmaster Tools, Twilio, GatherUp |
| IN_REVIEW or IN_PROGRESS | 5 | LinkedIn Ads (platform review), BrightLocal (trial setup), Yext (OAuth 404 bug), Keap (account approval), Reddit Ads (network issue) |
| BLOCKED (regional/policy) | 4 | TikTok Ads, TikTok Organic, Pinterest Ads, Pinterest Organic, Snapchat Ads (GSTIN), X Ads, X Organic |
| SKIPPED (cost/manual barrier) | ~16 | Semrush, Ahrefs, Moz, Majestic, StackAdapt, Simpli.fi, Choozle, GroundTruth, Basis, Yelp (paywalled), Yelp Ads, CallRail, CallTrackingMetrics, WhatConverts, Avanser, Delacon, WildJar, Trustpilot, Birdeye, AdRoll, Stripe, Unbounce |
| NOT YET ATTEMPTED | ~7 | SharpSpring, HighLevel, Marchex, CallSource, Grade.us, Synup, Vendasta, Meta Ads (Instagram Ads via Meta), Rank Tracker, Backlink Monitor |
| DATABASE (user-supplied) | 4 | Amazon Redshift, MySQL, Snowflake (user provides own credentials; no central key) |

---

## Credential Details by Platform Group

### Google Platform Group (1 OAuth App)
All Google platforms (GA4, Google Ads, Google Search Console, YouTube Analytics, Google Business Profile, Google Ad Manager, Google DV360, Google LSA, Google Sheets, Google BigQuery) share a **single** Google Cloud OAuth 2.0 client app.
- **Env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Additional**: `GOOGLE_ADS_DEVELOPER_TOKEN` for Google Ads
- **Key type**: Real Google Cloud credentials (free to create)
- **Expiry**: OAuth app credentials do not expire; individual refresh tokens expire if unused for 6 months

### Meta Platform Group (1 OAuth App)
Meta Ads, Instagram Ads, Facebook Organic, Instagram Organic share a single **Facebook app** in Business type.
- **Env vars**: `META_APP_ID`, `META_APP_SECRET`
- **Status**: PENDING — no Facebook credentials available yet
- **Production note**: Meta App Review required for `ads_management` scope; `pages_read_engagement` requires Business Verification

### Trial Accounts Detail

| Platform | Trial Type | Expiry | What's Used | Account Used |
|----------|-----------|--------|-------------|-------------|
| SE Ranking | 14-day trial | ~May 18, 2026 | API token + Site ID 11976821 | Check your email inbox for SE Ranking signup |
| Klaviyo | Free account (up to 250 contacts) | No expiry | Private API Key | Check Klaviyo account |
| Mailchimp | Free account (500 contacts/month) | No expiry | OAuth credentials | Check Mailchimp account |
| Brevo | Free account (300 emails/day) | No expiry | API Key | Check Brevo account |
| Twilio | Trial account ($15.50 credit) | Credit-based; no fixed expiry | Account SID + Auth Token | Check Twilio console |
| HubSpot | Free CRM tier | No expiry | OAuth credentials | Check HubSpot account |
| Salesforce | Developer Edition (free forever) | No expiry | OAuth credentials | Check Salesforce account |
| Spotify Ads | Developer app (sandbox) | No expiry | OAuth Client ID + Secret | Check Spotify Ads Studio |
| Vimeo | Basic/Plus account | No expiry | OAuth Client ID + Secret | Check Vimeo account |
| Campaign Monitor | Free account (basic) | No expiry | API Key + Client ID | Check Campaign Monitor account |
| ConvertKit | Free plan (up to 1000 subscribers) | No expiry | API Secret | Check ConvertKit account |
| Drip | Trial period | Check account | API Token + Account ID | Check Drip account |
| BigCommerce | Trial store | ~30 days from creation | Store Hash + API Token | Check BigCommerce account |
| Constant Contact | 60-day free trial | ~60 days from creation | OAuth credentials | Check Constant Contact account |
| GatherUp | Trial / free tier | Check account | Client ID + Bearer Token | Check GatherUp account |
| Matomo | Self-hosted instance | No expiry (self-hosted) | Auth Token + URL + Site ID | Own instance |

---

## Why No Real Data Tested (Beyond GA4)

The current dev environment is configured with a **single test campaign** for one agency. The reasons no other platforms have been tested with real data:

1. **No real client yet**: The test environment uses a developer's own personal accounts (SE Ranking site, Matomo instance, etc.) rather than a paying client's marketing accounts.
2. **OAuth credentials connected but no data ingested**: Connecting an OAuth account only stores the refresh token. Actual data only flows when `POST /sync/manual` is triggered with a valid `campaignId` that has data in the connected platform.
3. **GA4 was the exception**: GA4 was connected to a real Google Analytics property with real traffic data, synced, and two bugs were caught and fixed (bounce rate displayed as decimal vs. percentage, session duration unit mismatch).
4. **Google PageSpeed was connected but seeded**: Test data was injected manually (seeded) and then deleted. The API connection itself was verified to work.

---

## Platforms With Structural Barriers (Agencies Must Resolve)

### Platforms requiring Meta App Review (for production)
- Meta Ads, Instagram Ads, Facebook Organic, Instagram Organic
- **What agencies need**: A Facebook Business account with verified business identity; App Review approval for `ads_management`, `pages_read_engagement`, `instagram_manage_insights` scopes
- **Timeline**: App Review can take 1-5 business days

### Platforms requiring separate developer program approval
- LinkedIn Ads: Marketing Developer Platform access — apply at linkedin.com/developers (can take days to weeks)
- X Ads: Ads API tier — requires separate application from Developer Portal
- Amazon Ads: Must be enrolled in Amazon Advertising API program

### Platforms paywalled or enterprise-only (agencies pay for access)
- Semrush: Guru plan ($229/mo) minimum for meaningful API
- Ahrefs: Standard plan minimum for API access
- Moz: Pro plan minimum
- Majestic: API plan ($400/mo)
- StackAdapt, Simpli.fi, Choozle, GroundTruth, Basis Platform: Agency/media buyer accounts (B2B, not self-serve)
- Trustpilot: Premium/Enterprise + API Add-on
- Birdeye: Enterprise contract
- Yelp Fusion API: Now paid in 2026

### Platforms blocked in India (developer's current location)
- TikTok Ads: TikTok for Business unavailable in India
- TikTok Organic: Same restriction
- Snapchat Ads: GSTIN verification required
- Pinterest: App review denied (app needs live Privacy Policy + Terms page on registered domain)

---

## Action Items Before Go-Live

### Immediate (before first real client)
1. **Obtain Facebook/Meta credentials** — create Facebook app (Business type), get Meta_APP_ID + META_APP_SECRET. Submit for App Review with a live privacy policy URL.
2. **LinkedIn Ads approval** — confirm Marketing Developer Platform approval; test OAuth flow
3. **Reddit Ads** — diagnose and resolve network block issue; test OAuth flow
4. **SE Ranking trial expiry** — SE Ranking 14-day trial expires around May 18, 2026. If SE Ranking is needed for a client, purchase a paid plan.
5. **BigCommerce trial** — BigCommerce trial store may expire; if needed, obtain real client store credentials or purchase plan.
6. **Constant Contact trial** — 60-day trial has a fixed end date; obtain real client credentials when trial expires.

### When Real Clients Onboard
7. **Platform-specific**: Each platform integration is ready to connect as soon as an agency client has an account. The OAuth flows and API key forms are built and tested.
8. **Database platforms** (MySQL, Redshift, Snowflake): No central credentials needed — each client provides their own database credentials through the UI form.
9. **Google Ads Developer Token**: Current token may be a test account token. Apply for Basic access from Google Ads API Center before going live with real ad spend data.

### Before Production Deployment
10. **Stripe billing**: Add real Stripe secret key + webhook secret + Price IDs for subscription plans
11. **Anthropic API key**: Required for AI report summaries and AI assistant chat features
12. **SMTP configuration**: Update from Gmail SMTP (kishanbm25@gmail.com) to a transactional email service (Resend/SendGrid)
13. **Google OAuth redirect URIs**: Update all redirect URIs from `http://localhost:3000` to production domain in Google Cloud Console

---

## Notes on Credential Architecture

1. **All OAuth tokens encrypted at rest** using AES-256-GCM. `ENCRYPTION_KEY` (64 hex chars) is required in `.env`. Never stored or logged in plaintext.
2. **Database platforms** (MySQL, Redshift, Snowflake) use direct connection credentials provided by the client — AgencyPulse does not hold a central key for these.
3. **Google platforms** all share one Google Cloud OAuth app. The single `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` cover GA4, Ads, Search Console, YouTube, GBP, Sheets, BigQuery, DV360, Ad Manager, and LSA.
4. **Meta platforms** (Meta Ads, Instagram Ads, Facebook Organic, Instagram Organic) all share one Facebook app. `META_APP_ID` + `META_APP_SECRET` cover all four.
5. **TikTok** has two separate apps: TikTok Ads Business API (for TikTok Ads) and TikTok Login Kit (for TikTok Organic). Different env vars.
6. **Pinterest** has one app covering both Pinterest Ads and Pinterest Organic.

---

*Last updated: 2026-05-15*
