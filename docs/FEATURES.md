# Features Build Log

Tracks every feature built — status, what was implemented, and notes.

---

## Feature Status Legend
- `PLANNED` — Decided, not started
- `IN PROGRESS` — Currently being built
- `COMPLETE` — Fully implemented (backend + frontend connected)
- `BACKEND DONE` — Backend complete, frontend pending
- `BLOCKED` — Blocked on dependency or decision

---

## Phase 1: Foundation (Core Infrastructure)

| # | Feature | Status | Notes |
|---|---|---|---|
| 1.1 | Project setup (NestJS + PostgreSQL + Redis) | COMPLETE | NestJS scaffolded, Docker Compose, typed config, PrismaService, global ValidationPipe, helmet, CORS, Swagger, exception filter |
| 1.2 | Database schema (Agency, User, Client, Campaign) | COMPLETE | 6 models, 4 enums, soft deletes, RLS-ready, indexes, updated_at triggers, manual migration SQL, dev seed script |
| 1.3 | Multi-tenancy RLS setup | COMPLETE | current_tenant_id() helper function, per-table PERMISSIVE policies for agencypulse role, setup-db-role.sql for app role creation, DECISION-002 updated with implementation detail |
| 1.4 | Authentication (register, login, JWT, refresh) | COMPLETE | bcrypt passwords, JWT access (15m) + httpOnly refresh tokens (7d), token rotation, SECURITY DEFINER SQL for login/refresh RLS bypass, rate limiting (10/15m login, 5/15m register), @Public decorator, CurrentUser decorator, TenantMiddleware wired to JWT |
| 1.5 | Role-based access control (Admin, Staff, Client) | COMPLETE | 5-level hierarchy (PLATFORM_OWNER→CLIENT_USER), RolesGuard (role-only, no data scoping), @Roles decorator, JwtAuthGuard + RolesGuard + ThrottlerGuard registered globally via APP_GUARD |
| 1.6 | Agency onboarding flow | COMPLETE | AgencyModule (GET/PATCH /agencies/me), TeamModule (invite staff, list, remove, resend), POST /team/accept-invite (public, RLS-bypass via $queryRaw), EmailService (Nodemailer + Handlebars), invitation token on users table (SHA-256 hash, 48h TTL, partial index) |

## Phase 2: Client & Campaign Management

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.1 | Client CRUD (agency manages clients) | COMPLETE | ClientsModule, create/list/get/update/soft-delete/restore, role-based data scoping (admin=all, staff=assigned, client_user=assigned), client_user_assignments table (many-to-many, mirrors staff pattern), paginated list with search+status filter |
| 2.2 | Campaign CRUD (clients have campaigns) | BACKEND DONE | CampaignsModule, nested routes `/clients/:clientId/campaigns`, role-based single-query scoping (admin=all, staff=assigned client relation, client_user=assigned client relation), soft delete, paginated list with search+status filter. No ClientsService coupling — access enforced inline via relational conditions. tenantId always explicit in every query. |
| 2.3 | Staff assignment to clients | BACKEND DONE | AssignmentsModule, nested routes `/clients/:clientId/assignments`, list/assign/unassign, client validated with `deletedAt: null`, user validated with `isActive: true + role: AGENCY_STAFF`, duplicate handled via DB unique constraint P2002 → 409 |
| 2.4 | Client portal login | BACKEND DONE | CLIENT_USER invite via `POST /team/invite-client` (stores pendingClientId), resend via `POST /team/resend-client-invite`, ClientUserAssignment created at accept time (not invite time) to avoid orphaned rows, reuses existing accept-invite flow + welcome email. Migration: `pending_client_id` column on users. |

## Phase 3: Integration Layer

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.1 | Integration framework (OAuth token manager) | BACKEND DONE | EncryptionModule (AES-256-GCM, v1:iv:tag:ciphertext, ENCRYPTION_KEY validated at startup, never logged), IntegrationConnection model (per campaign+platform, ConnectionStatus enum, IntegrationPlatform enum, refreshTokenExpiresAt, platformAccountType), IntegrationsService (upsert preserving existing tokens unless new ones provided, campaign access via full relational scoping, getDecryptedTokens internal only), IntegrationsController (PUT/GET/DELETE, encrypted fields NEVER in HTTP responses via publicSelect). Routes: /clients/:clientId/campaigns/:campaignId/integrations |
| 3.2 | Google Analytics 4 integration | BACKEND DONE | GA4 OAuth 2.0 connect flow (auth-url → callback → token storage), Ga4OAuthService (generateAuthUrl, handleCallback with TenantContextService.run(), getValidAccessToken with proactive refresh, refreshAccessToken, listPropertiesForCampaign), Ga4ApiService (listProperties via Admin API, runReport + fetchCoreMetrics via Data API). 6 AI fixes: GA4 enum value, callback validates campaign+client deletedAt, clientId derived from DB not params, redirect uses FRONTEND_URL from config, refresh token not overwritten unless returned, platform in state JWT. Routes: GET /integrations/ga4/auth-url, GET /integrations/ga4/callback (@Public), GET /integrations/ga4/properties |
| 3.3 | Google Ads integration | BACKEND DONE | GoogleOAuthService extracted (shared sign/verify/exchange/refresh for all Google platforms — GA4 refactored to use it). GoogleAdsOAuthService (generateAuthUrl, handleCallback with TenantContextService.run(), getValidAccessToken, refreshAccessToken, listCustomersForCampaign), GoogleAdsApiService (listAccessibleCustomers, runQuery, fetchCampaignPerformance via GAQL). 5 AI fixes: callback re-validates campaign+client deletedAt, redirect uses FRONTEND_URL config, GOOGLE_ADS_DEVELOPER_TOKEN validated at runtime not startup, customerId normalized (dashes stripped) before store and every API call, developer token never logged. Routes: GET /integrations/google-ads/auth-url, callback (@Public), customers |
| 3.4 | Meta Ads integration | BACKEND DONE | OAuthStateService extracted (platform-agnostic state JWT sign/verify — used by GA4, Google Ads, Meta Ads). MetaAdsOAuthService (generateAuthUrl, handleCallback with short→long-lived token exchange via fb_exchange_token, getValidAccessToken with proactive expiry check + marks EXPIRED in DB, selectAdAccount validates adAccountId against Meta API before saving, listAdAccountsForCampaign). MetaAdsApiService (exchangeForLongLivedToken, listAdAccounts, fetchCampaignInsights). 4 AI fixes: OAuthStateService extracted (no coupling to GoogleOAuthService), callback validates campaign+client deletedAt, adAccountId validated against Meta API on save (not trusted from client), proactive expiry throws immediately with re-connect message. New route: POST /integrations/meta-ads/select-account. Meta App Review needed for production ads_management scope. |
| 3.5 | Background job system (BullMQ) | BACKEND DONE | Single `integration-sync` queue, IntegrationSyncProcessor (dispatches to platform-specific private methods via job.data.platform switch). All 6 AI fixes + 2 sharp edges: deterministic jobId (tenantId:campaignId:platform:from:to, YYYY-MM-DD UTC, from<=to enforced), concurrency=5, missing externalAccountId skipped with warning (no status change), correlation IDs in all log entries, 7-day rolling default dateRange, no tokens in logs. Jitter backoff (base*2^attempt + random 0-1000ms). Sharp edge 2: 401/invalid_grant→EXPIRED (no retry), 429→retry (no ERROR), 5xx/network→retry→ERROR after 3 attempts via @OnWorkerEvent('failed'). Manual trigger: POST /sync/trigger (AGENCY_ADMIN+). IntegrationsService.markSynced/markExpired/markError added. |
| 3.6 | Data sync scheduler | BACKEND DONE | SyncSchedulerService — @Cron every 6h (SYNC_CRON env override). All 7 AI fixes: UTC-safe dates (toYMD), 30-day cap per run (backfill walks back gradually), CONNECTED-only query, platform staggering (GA4 0ms, GoogleAds +2min, Meta +4min via BullMQ delay), scheduler_run_id on all logs, max 500 jobs/cycle, soft-deleted campaign+client filtered before dispatch. Oldest-synced-first ordering (lastSyncAt ASC, null first). 50-job batches with 200ms pause. Incremental: lastSyncAt-1day to today; first sync: max(today-90d, today-30d). SystemPrismaService for cross-tenant query (no tokens selected). |
| 3.7 | Additional integrations (GSC, YouTube, LinkedIn, TikTok, Amazon) | BACKEND DONE | 5 new integration platforms: Google Search Console (Google OAuth), YouTube Analytics (Google OAuth), LinkedIn Ads (separate OAuth), TikTok Ads (separate OAuth), Amazon Ads (Login with Amazon). Each follows the same pattern as 3.2–3.4: OAuthService + ApiService + SyncProcessor method. `integration_platform` enum extended with `YOUTUBE_ANALYTICS` and `AMAZON_ADS` (migration 20260423000005). All 5 controllers registered under `/integrations/{platform}/auth-url|callback|{accounts}`. Returns 503 with clear "not configured" message when env keys missing. |
| 3.8 | Platform catalog expansion + stub OAuth/API-key connect layer | BACKEND DONE | IntegrationPlatform enum expanded from 12 → 85 platforms across 9 categories (PPC, SEO, Social, Email, Ecommerce, Analytics, Call Tracking, Local, Database). New IntegrationCategory enum. Manual SQL migration (20260429000001) using `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. PLATFORM_CATALOG constants file with PlatformMeta (key, name, category, authType, isImplemented, description). StandardOAuthService: generic OAuth 2.0 auth-code flow for 27 platforms — handles standard POST body auth, HTTP Basic auth (Reddit, Pinterest, X/Twitter), PKCE S256 (X/Twitter — verifier stored in signed state JWT, SHA-256 challenge), BigCommerce context param forwarding, Mailchimp post-exchange metadata fetch for dc server prefix. StandardApiKeyService: generic encrypted API key storage for ~30 API-key platforms. PlatformStubModule registered LAST in app.module.ts (specific modules take priority). All env vars documented in .env.example. Routes: GET /integrations/:platform/auth-url, GET /integrations/:platform/callback (@Public), POST /integrations/:platform/connect. Works end-to-end as soon as credentials are in .env — only sync data-fetch methods remain pending per platform. |

## Phase 3.9 Testing Harness

| # | Feature | Status | Notes |
|---|---|---|---|
| T-1 | fetch-with-retry.ts | DONE | 429 retry with Retry-After header + exponential backoff, drop-in for fetchWithTimeout |
| T-2 | safe-parse.ts | DONE | safeInt, safeFloat, safeStr — used across all 74 platform services |
| T-3 | mock-fetch.ts test helper | DONE | Queued fake HTTP responses for Jest; handles string (CSV) and object (JSON) bodies |
| T-4 | mock-db.ts test helper | DONE | Mocks mysql2/promise + pg Client for database platform tests |
| T-5 | Platform fixtures (74 primary + 7 page2) | DONE | All 81 fixture files in __fixtures__/ directory |
| T-6 | Platform Jest tests (76 files, 340 tests) | DONE | All 340 tests passing; covers golden path, empty, null fields, auth error, pagination |
| T-7 | POST /sync/test-connection | DONE | Read-only probe endpoint — AGENCY_ADMIN+, last 7 days, returns rowCount + sampleRows |

## Phase 3.9: Full Platform Sync Implementation (77 remaining platforms)

> **Context anchor for auto-compaction:** This section tracks every platform implemented in Phase 3.9.
> After each platform is implemented, its row is updated to DONE. Infrastructure prerequisites listed first.
> Pattern per platform: `{platform}-api.service.ts` → `integration-sync.processor.ts` case → `metric-seeds.ts` → `platform-catalog.constants.ts` isImplemented:true → `sync.module.ts` import.
> All API services live under `src/modules/integrations/platforms/`.
> StandardTokenService lives at `src/modules/integrations/platform-stub/standard-token.service.ts`.
> After each platform: run `cd D:/projects/agency-backend && npx tsc --noEmit` to validate.

### Infrastructure

| # | Item | Status | Notes |
|---|---|---|---|
| I-1 | `StandardApiKeyService` sentinel fix | DONE | Stores `'default'` as `externalAccountId` when no extras, so sync processor `getActiveConnection` null-check doesn't skip API-key jobs |
| I-2 | `StandardTokenService` | PENDING | Generic OAuth token refresh for all 27 stub OAuth platforms. Uses `OAUTH_PLATFORM_CONFIGS` for endpoints + Basic auth flag. Handles refresh-token rotation. For no-refresh platforms (Meta family, Mailchimp, Vimeo, Shopify), returns current token if not expired, throws if expired |

### Platform Status Table

| # | Platform | Category | Auth | Status | Notes |
|---|---|---|---|---|---|
| 1 | Klaviyo | EMAIL | API Key | DONE | `POST /api/campaign-values-reports/` + `GET /api/campaigns` with date filter. Metrics: delivered, opens, clicks, unsubscribes, bounces, spam_complaints. `klaviyo-api.service.ts` |
| 2 | ActiveCampaign | EMAIL | API Key | DONE | `GET /api/3/campaigns` with date filters. apiUrl stored in externalAccountId JSON. Metrics: sends, opens, clicks, unsubscribes, bounces. `activecampaign-api.service.ts` |
| 3 | Brevo | EMAIL | API Key | DONE | `GET /emailCampaigns?status=sent&startDateSent=...` — globalStats inline. Metrics: delivered, opens, clicks, unsubscribes, bounces, spam_complaints. `brevo-api.service.ts` |
| 4 | Mailchimp | EMAIL | OAuth | DONE | `GET https://{dc}.api.mailchimp.com/3.0/campaigns?status=sent` — dc from externalAccountId, StandardTokenService for OAuth. Metrics: sends, opens, clicks, unsubscribes, bounces. `mailchimp-api.service.ts` |
| 5 | Campaign Monitor | EMAIL | API Key | DONE | `GET /api/v3.3/clients/{clientId}/campaigns.json?sentfromdate=...`. Falls back to listing first client. Basic auth. Metrics: sends, opens, clicks, unsubscribes, bounces, spam_complaints. `campaign-monitor-api.service.ts` |
| 6 | ConvertKit | EMAIL | API Key | DONE | `GET /v4/broadcasts` (client-side date filter) + `GET /v4/broadcasts/{id}/stats` per broadcast (max 20). Metrics: sends, open_rate, click_rate, unsubscribes. `convertkit-api.service.ts` |
| 7 | Drip | EMAIL | API Key | DONE | `GET /v2/{accountId}/broadcasts?status=sent` — accountId in externalAccountId (required). Basic auth. Metrics: sends, opens, clicks, unsubscribes, bounces, spam_complaints. `drip-api.service.ts` |
| 8 | Constant Contact | EMAIL | OAuth | DONE | `GET /emails/activities?status=COMPLETE&after=...&before=...` — StandardTokenService for OAuth. Metrics: sends, opens, clicks, unsubscribes, bounces, spam_complaints. `constant-contact-api.service.ts` |
| 9 | Ahrefs | SEO | API Key | DONE | `GET /v3/site-explorer/metrics-history?target={domain}&date_from=...` — domain in externalAccountId. Metrics: org_traffic, org_keywords, paid_traffic, paid_keywords, refdomains, dofollow_refdomains. `ahrefs-api.service.ts` |
| 10 | Moz | SEO | API Key | DONE | `POST /v2/url_metrics` — secretKey as accessToken, JSON {accessId,domain} in externalAccountId. Snapshot metrics: domain_authority, page_authority, spam_score, external_links, linking_root_domains. `moz-api.service.ts` |
| 11 | SEMrush | SEO | API Key | DONE | `GET /?type=domain_history` — monthly snapshots, semicolon-delimited. JSON {domain,database} in externalAccountId. Metrics: org_keywords, org_traffic, paid_keywords, paid_traffic. `semrush-api.service.ts` |
| 12 | Majestic SEO | SEO | API Key | DONE | `GET /api/json?cmd=GetIndexItemInfo` — domain in externalAccountId. Snapshot metrics: backlinks, ref_domains, citation_flow, trust_flow, ref_ips. `majestic-api.service.ts` |
| 13 | SE Ranking | SEO | API Key | DONE | `GET /site/{siteId}/stats?date_from=...` — siteId in externalAccountId. Metrics: visibility, estimated_traffic, keywords_top10, keywords_top30. `se-ranking-api.service.ts` |
| 14 | BrightLocal | LOCAL | API Key | DONE | `GET /ranking/get-overview-report?campaign-id=...` — campaignId in externalAccountId. Metrics: avg_rank, keywords_top3/10/20. `brightlocal-api.service.ts` |
| 15 | Google PageSpeed | SEO | API Key | DONE | `GET /runPagespeed?url=...&strategy=mobile|desktop` — targetUrl in externalAccountId. Metrics: performance_score, seo_score, lcp_ms, cls, fcp_ms, tbt_ms (mobile+desktop). `google-pagespeed-api.service.ts` |
| 16 | Bing Webmaster Tools | SEO | OAuth | DONE | `GET /GetRankAndTrafficStats?siteUrl=...` — Microsoft OAuth via StandardTokenService, siteUrl in externalAccountId. Metrics: impressions, clicks, avg_position. `bing-webmaster-api.service.ts` |
| 17 | CallRail | CALL_TRACKING | API Key | DONE | `GET /v3/a/{accountId}/calls.json?start_date=...&end_date=...&per_page=250` — key=accessToken, accountId=externalAccountId. Aggregates by day: total_calls, answered_calls, missed_calls, first_time_callers, total_duration_sec. `callrail-api.service.ts` |
| 18 | CallTrackingMetrics | CALL_TRACKING | API Key | DONE | `GET /api/v1/accounts/{accountId}/calls?start_date=...&end_date=...` — Basic auth (accessKey:secretKey), externalAccountId=JSON{accountId,secretKey}. Metrics: total_calls, answered_calls, missed_calls, total_duration_sec. `calltracking-metrics-api.service.ts` |
| 19 | WhatConverts | CALL_TRACKING | API Key | DONE | `GET /api/v1/leads?date_range=custom&start_date=...&end_date=...` — Basic auth (token:secretKey), externalAccountId=JSON{secretKey}. Metrics: total_leads, call_leads, form_leads, chat_leads. `whatconverts-api.service.ts` |
| 20 | Twilio | CALL_TRACKING | API Key | DONE | `GET /2010-04-01/Accounts/{SID}/Calls.json?StartTime>={from}&StartTime<={to}` — Basic auth (accountSid:authToken), accountSid=externalAccountId. Aggregates by day. `twilio-api.service.ts` |
| 21 | Marchex | CALL_TRACKING | API Key | DONE | `GET /marketingedge/v5/api/calls?startdateutc=...&enddateutc=...&pagesize=10000` — Two headers: x-organization-token + subscription-key. externalAccountId=JSON{subscriptionKey}. `marchex-api.service.ts` |
| 22 | AVANSER | CALL_TRACKING | API Key | DONE | Three-step auth: getTokenKey → signIn with MD5(secret+tokenKey) → getCDR. `GET /JSON?action=getCDR`. externalAccountId=JSON{accountId,secret}. `avanser-api.service.ts` |
| 23 | CallSource | CALL_TRACKING | API Key | DONE | `POST http://xml.callsource.com/services/Report` — time-based MD5 token (valid 1hr). XML body+response parsed with regex. externalAccountId=JSON{username,customerCode}. `callsource-api.service.ts` |
| 24 | Delacon | CALL_TRACKING | API Key | DONE | `GET /site/report/report.jsp?reportoption=xml` — Auth header (not Authorization). XML response parsed with regex. externalAccountId='default'. `delacon-api.service.ts` |
| 25 | WildJar | CALL_TRACKING | API Key | DONE | OAuth client_credentials: POST /v2/token/ with Basic username:password → Bearer. Then GET /v2/calls/?date_from=...&date_to=.... externalAccountId=JSON{password}. `wildjar-api.service.ts` |
| 26 | Trustpilot | LOCAL | OAuth | DONE | GET /business-units/{id}/web (snapshot: avg_rating, review_count) + GET /reviews?startDate=...&endDate=... (new_reviews). OAuth via StandardTokenService. `trustpilot-api.service.ts` |
| 27 | Yelp | LOCAL | API Key | DONE | GET /v3/businesses/{id} → rating + review_count snapshot (Yelp has no date filter on reviews). Bearer API key. businessId = externalAccountId. `yelp-api.service.ts` |
| 28 | Birdeye | LOCAL | API Key | DONE | GET /resources/v1/business/{id}/reviewsStats (snapshot) + GET /reviews?startDate=...&endDate=... (new_reviews). api-key query param. businessId = externalAccountId. `birdeye-api.service.ts` |
| 29 | GatherUp | LOCAL | API Key | DONE | GET /api/v2/statistics?clientId=...&start=...&end=... → avg_rating, review_count, new_reviews. Bearer token + clientId in externalAccountId. `gatherup-api.service.ts` |
| 30 | Grade.us | LOCAL | API Key | DONE | GET /v4/locations/{id} (snapshot) + GET /v4/locations/{id}/reviews?start_date=...&end_date=... (count). Bearer API key. locationId = externalAccountId. `gradeus-api.service.ts` |
| 31 | Synup | LOCAL | API Key | DONE | GET /api/v4/locations/{id} (snapshot) + GET /api/v4/locations/{id}/reviews?start_date=...&end_date=... (count). Auth: "API {key}" header. locationId = externalAccountId. `synup-api.service.ts` |
| 32 | Yext | LOCAL | OAuth | DONE | GET /v2/accounts/{id}/reviews?entityId=...&v=20230301 → avg_rating (overall), review_count, new_reviews (filtered by publisherDate). externalAccountId = JSON{accountId,entityId}. `yext-api.service.ts` |
| 33 | Vendasta | LOCAL | OAuth | DONE | GET /reputation/v1/reviews/summary (snapshot) + GET /reputation/v1/reviews?startDate=...&endDate=... (new_reviews). OAuth via StandardTokenService. accountId = externalAccountId. `vendasta-api.service.ts` |
| 34 | Google Business Profile | LOCAL | OAuth | DONE | GET /v4/{accountId}/{locationId}/reviews?pageSize=50 → averageRating, totalReviewCount, new_reviews (filtered by createTime). externalAccountId = JSON{accountId,locationId}. `google-business-profile-api.service.ts` |
| 35 | Microsoft Ads | PPC | OAuth | DONE | Microsoft Advertising API v13 — async report: POST /v13/Reporting/ReportRequests/SubmitGenerateReport → poll → download CSV. externalAccountId=JSON{customerId,accountId,developerToken}. `microsoft-ads-api.service.ts` |
| 36 | Pinterest Ads | PPC | OAuth | DONE | `GET https://api.pinterest.com/v5/ad_accounts/{adAccountId}/analytics?start_date={from}&end_date={to}&granularity=DAY`. OAuth via StandardTokenService. metrics: impressions, clicks, spend, ctr, avg_cpc, conversions. `pinterest-ads-api.service.ts` |
| 37 | Snapchat Ads | PPC | OAuth | DONE | `GET https://adsapi.snapchat.com/v1/adaccounts/{adAccountId}/stats?granularity=DAY`. Spend in micro-USD ÷1,000,000. metrics: impressions, swipes, spend, conversions. `snapchat-ads-api.service.ts` |
| 38 | X Ads | PPC | OAuth+PKCE | DONE | `POST https://ads-api.x.com/12/stats/accounts/{accountId}`. Spend in micro-USD ÷1,000,000. metrics: impressions, clicks, spend, conversions. `x-ads-api.service.ts` |
| 39 | Reddit Ads | PPC | OAuth | DONE | `GET https://ads-api.reddit.com/api/v2.1/accounts/{accountId}/reports?start_date={from}&end_date={to}&interval=day`. metrics: impressions, clicks, spend, ctr, conversions. `reddit-ads-api.service.ts` |
| 40 | AdRoll | PPC | OAuth | DONE | `POST https://services.adroll.com/reporting/api/v1/query` (JSON body with metrics array and date range). metrics: impressions, clicks, spend, ctr, conversions. `adroll-api.service.ts` |
| 41 | Google Ad Manager | PPC | OAuth | DONE | GAM REST API v1 — async: POST /networks/{networkCode}/reports:run → poll → download CSV. metrics: impressions, clicks, revenue, ctr, viewable_rate. `google-ad-manager-api.service.ts` |
| 42 | Google DV360 | PPC | OAuth | DONE | Bid Manager API v2 — async: POST /queries → POST /queries/{queryId}:run → poll → download. metrics: impressions, clicks, spend, ctr, cpm, conversions. `google-dv360-api.service.ts` |
| 43 | Google LSA | PPC | OAuth | DONE | `GET https://localservices.googleapis.com/v1/accountReports:search?query.customerId={id}&query.startDate={from}&query.endDate={to}`. metrics: impressions, leads, phone_leads, message_leads, spend. `google-lsa-api.service.ts` |
| 44 | Instagram Ads | PPC | OAuth(Meta) | DONE | Meta Graph API `GET /{adAccountId}/insights?publisher_platforms=instagram&time_range={from,to}&level=account&time_increment=1`. metrics: impressions, clicks, spend, ctr, avg_cpc, conversions. `instagram-ads-api.service.ts` |
| 45 | Spotify Ads | PPC | OAuth | DONE | `GET https://api-partner.spotify.com/v1/reports?account_id={id}&start_date={from}&end_date={to}&granularity=day`. metrics: impressions, clicks, spend, ctr, video_completions. `spotify-ads-api.service.ts` |
| 46 | StackAdapt | PPC | API Key | DONE | `POST https://api.stackadapt.com/graphql` with X-Authorization header (GraphQL query for campaignStats by date). metrics: impressions, clicks, spend, ctr, avg_cpc, conversions. `stackadapt-api.service.ts` |
| 47 | Simpli.fi | PPC | API Key | DONE | `GET https://app.simpli.fi/api/organizations/{orgId}/campaigns/reporting?start_date={from}&end_date={to}`. App-Key + Authorization headers. externalAccountId=JSON{orgId,appKey}. metrics: impressions, clicks, spend, ctr, avg_cpc, conversions. `simplifi-api.service.ts` |
| 48 | Choozle | PPC | API Key | DONE | `GET https://app.choozle.com/api/v1/reports?account_id={id}&date_start={from}&date_end={to}&interval=day`. metrics: impressions, clicks, spend, ctr, avg_cpc, conversions. `choozle-api.service.ts` |
| 49 | GroundTruth | PPC | API Key | DONE | `GET https://api.groundtruth.com/v1/campaigns/stats?account_id={id}&start_date={from}&end_date={to}&granularity=daily`. metrics: impressions, clicks, spend, ctr, store_visits. `groundtruth-api.service.ts` |
| 50 | Basis Platform | PPC | OAuth | DONE | `GET https://api.basis.net/v1/campaigns/reporting?account_id={id}&start_date={from}&end_date={to}&interval=day`. metrics: impressions, clicks, spend, ctr, avg_cpc, conversions. `basis-api.service.ts` |
| 51 | Yelp Ads | PPC | API Key | DONE | Yelp Partner API v1 `GET https://partner-api.yelp.com/v1/advertising/performance?business_id={id}&start_date={from}&end_date={to}&interval=day`. Requires partner API key (separate from Yelp Fusion). metrics: impressions, clicks, spend, ctr, conversions. `yelp-ads-api.service.ts` |
| 52 | Facebook Organic | SOCIAL | OAuth(Meta) | DONE | Meta Graph API v19 `GET /{pageId}/insights?metric=page_impressions,page_reach,page_engaged_users,page_post_engagements&period=day&since={from}&until={to}`. metrics: impressions, reach, engaged_users, post_engagements. `facebook-organic-api.service.ts` |
| 53 | Instagram Organic | SOCIAL | OAuth(Meta) | DONE | Meta Graph API v19 `GET /{igUserId}/insights?metric=impressions,reach,profile_views,follower_count&period=day&since={from}&until={to}`. Requires instagram_manage_insights. metrics: impressions, reach, profile_views, new_followers. `instagram-organic-api.service.ts` |
| 54 | Pinterest Organic | SOCIAL | OAuth | DONE | `GET https://api.pinterest.com/v5/user_account/analytics?start_date={from}&end_date={to}&granularity=DAY`. metrics: impressions, saves, pin_clicks, outbound_clicks, engagements. `pinterest-organic-api.service.ts` |
| 55 | Vimeo | SOCIAL | OAuth | DONE | `GET https://api.vimeo.com/me/videos?fields=uri,stats&per_page=100`. Aggregates lifetime stats as snapshot at dateRange.to. metrics: total_plays, total_likes, total_comments. `vimeo-api.service.ts` |
| 56 | X Organic | SOCIAL | OAuth+PKCE | DONE | `GET https://api.x.com/2/users/{userId}/tweets?tweet.fields=public_metrics,created_at&start_time={from}T00:00:00Z`. Aggregates public_metrics across tweets in range. metrics: impressions, likes, retweets, replies. `x-organic-api.service.ts` |
| 57 | TikTok Organic | SOCIAL | OAuth(Login Kit) | DONE | `POST https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count`. Filters by create_time in range, aggregates stats. metrics: total_views, total_likes, total_comments, total_shares. `tiktok-organic-api.service.ts` |
| 58 | Shopify | ECOMMERCE | OAuth | DONE | `GET https://{shopDomain}/admin/api/2024-01/orders.json?status=any&created_at_min={from}&created_at_max={to}&limit=250`. Paginates via Link header. Skips refunded orders. metrics: total_orders, total_revenue, avg_order_value. `shopify-api.service.ts` |
| 59 | WooCommerce | ECOMMERCE | API Key | DONE | `GET https://{siteUrl}/wp-json/wc/v3/reports/sales?date_min={from}&date_max={to}`. Basic auth (consumer_key:consumer_secret). externalAccountId=JSON{siteUrl,consumerSecret}. metrics: total_orders, total_revenue, net_revenue, avg_order_value. `woocommerce-api.service.ts` |
| 60 | BigCommerce | ECOMMERCE | API Key | DONE | `GET https://api.bigcommerce.com/stores/{storeHash}/v2/orders?min_date_created={from}&max_date_created={to}&limit=250`. X-Auth-Token header. externalAccountId=JSON{storeHash}. Paginates via page param. metrics: total_orders, total_revenue, avg_order_value. `bigcommerce-api.service.ts` |
| 61 | Stripe | ECOMMERCE | API Key | DONE | `GET https://api.stripe.com/v1/charges?created[gte]={fromUnix}&created[lte]={toUnix}&limit=100`. Basic auth (secretKey:). Paginates via starting_after cursor. Amounts in cents ÷100. metrics: total_charges, total_revenue, avg_charge_value. `stripe-api.service.ts` |
| 62 | Keap | ECOMMERCE | OAuth | DONE | `GET https://api.infusionsoft.com/crm/rest/v1/orders?since={from}T00:00:00Z&until={to}T23:59:59Z&limit=200`. Paginates via offset. Skips Cancelled/Refunded. metrics: total_orders, total_revenue, avg_order_value. `keap-api.service.ts` |
| 63 | HubSpot | ANALYTICS | OAuth | DONE | CRM v3: `GET /crm/v3/objects/contacts` + `GET /crm/v3/objects/deals`. Paginates via paging.next.link. externalAccountId='default'. metrics: new_contacts, total_contacts, new_deals, total_deals, deal_revenue. `hubspot-api.service.ts` |
| 64 | Matomo | ANALYTICS | API Key | DONE | `GET /?module=API&method=VisitsSummary.get&period=range&date={from},{to}&format=JSON&token_auth={key}`. externalAccountId=JSON{matomoUrl,siteId}. metrics: sessions, users, pageviews, bounce_rate, avg_session_duration. `matomo-api.service.ts` |
| 65 | Salesforce | ANALYTICS | OAuth | DONE | SOQL via `GET /services/data/v58.0/query?q=SELECT...`. Lead/Opportunity queries with CreatedDate filter. instanceUrl=externalAccountId. metrics: new_leads, closed_deals, deal_revenue. `salesforce-api.service.ts` |
| 66 | SharpSpring | ANALYTICS | API Key | DONE | JSON-RPC `POST /pubapi/v1/?accountID={}&secretKey={}`. getLeads + getOpportunities methods. externalAccountId=JSON{accountID}. metrics: new_leads, new_deals, deal_revenue. `sharpspring-api.service.ts` |
| 67 | Gravity Forms | ANALYTICS | API Key | DONE | `GET /wp-json/gf/v2/forms/{formId}/entries?start_date={from}&end_date={to}`. Basic auth. externalAccountId=JSON{siteUrl,consumerSecret,formId}. metrics: total_entries, new_entries. `gravity-forms-api.service.ts` |
| 68 | Unbounce | ANALYTICS | OAuth | DONE | `GET /accounts/{accountId}/pages` then `GET /pages/{pageId}/leads?from={from}&to={to}`. Paginates via metadata.next. externalAccountId=accountId. metrics: page_visits, conversions, conversion_rate. `unbounce-api.service.ts` |
| 69 | HighLevel | ANALYTICS | OAuth | DONE | `GET /contacts/?locationId={}&startAfter={from}&startAfterDate={from}` + `GET /opportunities/search?location_id={}&startAfter={from}`. Version: 2021-07-28 header. externalAccountId=locationId. metrics: new_contacts, new_opportunities, won_revenue. `highlevel-api.service.ts` |
| 70 | Google Sheets | ANALYTICS | OAuth | DONE | `GET /spreadsheets/{id}/values/{range}`. externalAccountId=JSON{spreadsheetId,range,dateCol,metricKeyCol,valueCol}. Custom column index mapping. metrics: custom_value. `google-sheets-api.service.ts` |
| 71 | Google BigQuery | DATABASE | OAuth | DONE | `POST /projects/{projectId}/jobs` (async INSERT job) → poll GET /jobs/{jobId} → `GET /queries/{jobId}`. Query must return date, metric_key, value columns. externalAccountId=JSON{projectId,query}. `bigquery-api.service.ts` |
| 72 | MySQL | DATABASE | API Key | DONE | Direct `mysql2/promise` connection. password=accessToken. externalAccountId=JSON{host,port,database,user,query}. {from}/{to} placeholders replaced in query. SSL enforced. `mysql-api.service.ts` |
| 73 | Amazon Redshift | DATABASE | API Key | DONE | Direct `pg` Client connection (port 5439, PostgreSQL protocol). SSL rejectUnauthorized:false. externalAccountId=JSON{host,port,database,user,query}. {from}/{to} placeholders. `redshift-api.service.ts` |
| 74 | Snowflake | DATABASE | API Key | DONE | Snowflake SQL REST API v2: `POST /api/v2/statements` → poll GET /{statementHandle}. Basic auth (user:password). externalAccountId=JSON{account,user,database,schema,warehouse,query}. Columns: DATE, METRIC_KEY, VALUE. `snowflake-api.service.ts` |
| 75 | Google Sheets (OAuth) | ANALYTICS | OAuth | PENDING | `GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}` |
| 76 | Rank Tracker | SEO | API Key | PENDING | Custom rank tracking tool API |
| 77 | Backlink Monitor | SEO | API Key | PENDING | Custom backlink monitoring API |

## Phase 4: Data Storage & Metrics

| # | Feature | Status | Notes |
|---|---|---|---|
| 4.1 | Metrics data model + sync-to-storage wiring | BACKEND DONE | Plain PostgreSQL (not TimescaleDB — per STACK.md). Two tables: metric_definitions (global reference, no RLS) + metric_values (tenant-scoped, RLS enforced). BTREE indexes on (tenant_id, campaign_id, platform, recorded_at) for dashboard queries + (metric_key, recorded_at) for specific lookups. UNIQUE index with COALESCE(dimension_key,''), COALESCE(dimension_val,'') for idempotent upserts (ON CONFLICT DO UPDATE). CHECK value >= 0. Seed data: 6 GA4 + 6 Google Ads + 6 Meta Ads metric definitions. MetricsService: bulk upsert via raw SQL (500-row chunks), normalizeMetricValue for unit conversion (costMicros→USD, ctr fraction→%), METRIC_KEY_REMAP (cost_micros→cost, average_cpc→avg_cpc). MetricsController: GET /metrics (campaign metrics with date range), GET /metrics/definitions/:platform. Sync processor wiring: all 3 platform sync methods now convert API responses to MetricRowInput[] and call metricsService.upsertMetrics(). GA4 date YYYYMMDD→YYYY-MM-DD. Partition-ready design (recorded_at in all indexes). |
| 4.2 | Metrics query layer + Redis caching | BACKEND DONE | Combined query layer + caching. CacheService: ioredis wrapper with getOrSet (read-through, only caches non-empty), incrementVersion (INCR), getVersion, maxRetriesPerRequest:1. Versioned cache invalidation: key = metrics:v{version}:{tenant}:{campaign}:{platform}:{from}:{to}:{granularity}:{aggregate}:{sortedMetricKeys} — on upsert, INCR version makes all old keys stale without SCAN/DELETE. MetricGranularity (day/week/month) + MetricAggregate (sum/avg/last) enums. getMetrics(): raw SQL DATE_TRUNC AT TIME ZONE 'UTC' grouped by period+metric_key, reshaped to { period, metrics: { clicks:120 } }[], missing periods filled with 0. getMetricSummary(): SUM/AVG via GROUP BY; LAST via DISTINCT ON with dimension_key/val IS NULL filter (avoids breakdown rows). assertAggregateAllowed(): throws BadRequestException if AVG requested for derived metrics (ctr, cpc, avg_cpc). |

## Phase 5: Dashboard System

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.1 | Dashboard CRUD (backend) | BACKEND DONE | dashboards table (id, tenant_id, campaign_id, name, is_default boolean, created_at, updated_at, deleted_at, RLS). dashboard_widgets table (id, tenant_id, dashboard_id, campaign_id, widget_type enum, platform, metric_keys text[], config JSONB, position JSONB, deleted_at, RLS). API: POST/GET/PATCH/DELETE /campaigns/:campaignId/dashboards, POST/PATCH/DELETE /dashboards/:dashboardId/widgets. Access: AGENCY_ADMIN+ create/edit/delete; AGENCY_STAFF + CLIENT_USER view-only via assertCampaignAccess pattern. Integrity: UNIQUE index on (campaign_id) WHERE is_default=true AND deleted_at IS NULL prevents race conditions. Validation: metric_keys validated against metric_definitions; aggregation/comparison enums validated via @IsIn decorator; metricKeys requires ArrayMinSize(1). **TESTED**: 25 controller tests covering all endpoints, role-based access, parameter validation, service delegation. |
| 5.2 | Batch widget data endpoint (backend) | BACKEND DONE | POST /campaigns/:campaignId/dashboards/:dashboardId/widgets/data with { widgetIds, from, to }. Returns { results: [{ widgetId, widgetType, data }] }. Single call fetches all widget data concurrently (no N+1 problem). KPI widgets → getMetricSummary with optional comparison period (previous_period or previous_year). Chart/table widgets → getMetrics time-series. All responses cached via metricsService Redis layer. Date range validation: from < to enforced with BadRequestException. **TESTED**: 20+ service tests covering widget data fetching, comparison logic (previous_period + previous_year), error cases, edge cases (missing resources, invalid dates). |
| 5.3 | Default dashboard on campaign create | BACKEND DONE | CampaignsService.create() fire-and-forget calls DashboardsService.createDefaultDashboard() which creates "Main Dashboard" with is_default=true. Prevents campaign creation from failing if dashboard creation fails. clearDefaultFlag() unsets is_default on other dashboards when a new default is set (race condition-safe via UNIQUE index constraint). **TESTED**: Verified UNIQUE constraint enforcement, default flag unset behavior, multi-tenant isolation, campaign consistency validation. |
| 5.4 | Frontend: Dashboard viewer + widget rendering | COMPLETE | DashboardViewer.tsx connects to GET /campaigns/:id/dashboards/:dId and POST .../widgets/data batch endpoint. TanStack Query with queryKey [campaignId, dashboardId, from, to]. KPI, LineChart, BarChart, Table, PieChart widgets via WidgetRenderer factory. DateRangePicker with presets. Per-widget error isolation. 401/403 handled globally (api.ts interceptor). **BROWSER TESTED 2026-04-24**: Dashboards list loads correctly, widget count shows, navigation works. 5 bugs fixed during testing: (1) DashboardGrid hardcoded width=1200 overflowed on smaller screens — fixed with ResizeObserver; (2) React error #31 crash when KPI data returned `{ current: { metrics: {} } }` — fixed by checking typeof value === 'number' before rendering; (3) MetricDefinition interface used `key` but API returns `metricKey` — caused all checkboxes to toggle together; (4) WidgetConfigPanel same `m.key` bug fixed to `m.metricKey`; (5) Wrong GA4 metrics in DB (from dev seed) — deleted 5 stale rows, removed from seed.ts. |
| 5.5 | Frontend: Dashboard editor (drag-and-drop + widget config) | COMPLETE | react-grid-layout drag-and-drop grid. onDragStop/onResizeStop (not onLayoutChange) to avoid re-render on every pixel. originalWidgets + editedWidgets dual state in useDashboardEdit hook. isDirty tracking — enables Save button only when changes exist, warns on browser close. Sequential PATCH for changed widgets only on Save. WidgetConfigPanel (title, widgetType, platform, metricKeys). AddWidgetModal with type/platform/metric selection. Delete with confirmation. AGENCY_ADMIN+ only (role check in frontend + RLS enforced in backend). **BROWSER TESTED 2026-04-24**: Edit mode enter/cancel/save all working. Add Widget modal shows connected platforms (GA4 CONNECTED), correct 6 GA4 metrics selectable, widget creates and persists. Config panel opens on widget click with correct metric checkboxes. Create Dashboard navigates to new empty dashboard. |

## Phase 6: Report System

| # | Feature | Status | Notes |
|---|---|---|---|
| 6.1 | Report builder (backend) | BACKEND DONE | reports + report_schedules + report_share_links + report_deliveries tables. JSONB sections (max 20), version field (bumps on sections change), pdfUrl cleared on sections update. Schedules: cron_expression + next_run_at (auto-computed), indexes on (tenant_id, is_active), (report_id), (next_run_at). ReportsService: full CRUD + schedule CRUD + delivery history. ReportsController: nested under /campaigns/:id/reports. RLS enabled on all 4 tables. 17 unit tests passing. All AI review fixes incorporated. |
| 6.2 | PDF generation | BACKEND DONE | ReportRenderService: batch MetricsService calls per platform (not per section — no N+1), HTML template → Puppeteer PDF with 30s timeout + graceful fail. StorageService: S3-compatible upload/presigned URLs, key=tenantId/reportId/YYYY/MM/DD/ts.pdf. MinIO added to docker-compose for dev. POST /campaigns/:id/reports/:id/generate returns downloadUrl. pdfUrl + pdfGeneratedAt persisted on report. |
| 6.3 | Scheduled email reports | BACKEND DONE | ReportGenerationProcessor (BullMQ, concurrency=2): tenant context + delivery record tracking, PDF > 10MB → download link instead of attachment. ReportSchedulerService: @Cron every 5min, queries nextRunAt <= now, jobId=reportId:scheduleId:dateStr (deduplication). next_run_at advanced after each delivery. report-delivery.hbs email template. |
| 6.4 | Shareable report links (token-based) | BACKEND DONE | ReportShareLink stored with UUID token + expiry + revoke. POST /campaigns/:id/reports/:id/share-links → creates link. GET /reports/shared/:token → @Public endpoint, validates non-revoked + non-expired, returns report data + signed PDF download URL. DELETE .../share-links/:id to revoke. |

## Phase 7: White Labeling

| # | Feature | Status | Notes |
|---|---|---|---|
| 7.1 | Per-agency logo + color theming | BACKEND DONE | Extended Agency model: faviconUrl, secondaryColor, emailFromName, emailFromAddress. BrandingService: uploadLogo (multipart → MinIO, 2MB limit), uploadFavicon (512KB), updateBranding. GET /branding (public, throttled 60/min, host-based resolution). GET+PATCH /agencies/me/branding (OWNER only). |
| 7.2 | Custom subdomain routing | BACKEND DONE | HostResolutionService: reads Host header, resolves agency by slug (acme.agencypulse.com) or customDomain (reports.myagency.com). Redis cached 5min. Enforces isActive=true (deactivated agencies cannot resolve). TenantMiddleware updated: JWT first, then host fallback for unauthenticated public routes. Cache invalidation triggered on slug/customDomain change. |
| 7.3 | Custom email sending domain | BACKEND DONE | EmailService updated: all send methods accept optional AgencyFrom {name, address?}. Per-agency from address used if set (e.g. "Acme <reports@myagency.com>"). Falls back to platform noreply. sendReportDelivery also accepts agencyFrom. Note: deliverability (SPF/DKIM per agency) is Phase 7.3b — this phase covers display name + from address. |

## Phase 8: Advanced Features & Differentiators

| # | Feature | Status | Notes |
|---|---|---|---|
| 8.1 | Alerts & monitoring | BACKEND DONE | Smart alerts with threshold-based rules. `alerts` table (tenant_id, campaign_id, platform, metric_key, operator IN/ABOVE/BELOW, threshold, name, isActive). `alert_events` table (triggered_at, value, direction). AlertsService: CRUD + event log. POST /campaigns/:id/alerts, GET/PATCH/DELETE. AlertCheckerService: runs after every sync, compares current vs threshold, fires event + email if triggered. **DTO field: `threshold` (not `thresholdValue`).** Tested and passing. |
| 8.2 | Agency Health Score | BACKEND DONE | `GET /agencies/health` — composite score 0–100 across: data freshness, integration health, client activity, report delivery rate. AgencyHealthService queries IntegrationConnections + ReportDeliveries. Returns score + component breakdown. Tested and passing. |
| 8.3 | KPI engine (custom calculated metrics) | BACKEND DONE | Formula-based custom KPI definitions per campaign. `kpi_definitions` table (tenant_id, campaign_id, label, formula string, inputMetrics text[], created_by). KpiEngineService: evaluates formula with `expr-eval` against MetricSummary values. Input metric validation against metric_definitions. Built-in KPIs (CTR, CPC, ROAS, CPM) computed without DB lookup. GET /campaigns/:id/kpi (evaluate), POST/GET /campaigns/:id/kpi-definitions. Tested and passing. |
| 8.4 | AI report explanation | BACKEND DONE | AiReportService generates executive summary using Claude (`claude-haiku-4-5`). Context builder fetches current vs prior period summary across all platforms in the report, goals status, health status. System prompt enforces: cite specific numbers, no speculation, no internal system references. 24h cache invalidation: re-uses cached summary unless force=true, version changed, or >24h old. `aiSummary`, `aiSummaryGeneratedAt`, `aiSummaryModel`, `aiSummaryVersion` columns added to reports table. ServiceUnavailable if Claude API unreachable (report viewing unaffected). Throttled 5/min. ADMIN-only. |
| 8.5 | AI assistant (campaign Q&A — AWS Q-style) | BACKEND DONE | Conversational chat with Claude over live campaign data. 3 layers: AiConversationService (CRUD with user-scoped lookups — layer 2 on top of RLS), AiChatService (structured RAG + multi-turn memory + SSE streaming), AiInsightsService (proactive top-3 changes, 1h cache, no Claude call). **Structured RAG not vector**: intent-parser.ts detects time range ("last week"), metric keywords ("sessions"), platform hints ("meta"), comparison signals ("why did"), timeseries requests ("trend"). Only the needed data is fetched. **Multi-turn**: last 20 messages loaded per request, passed as Claude's `messages` array. **Isolation**: conversations filtered by `tenantId + userId` — AGENCY_OWNER cannot read STAFF conversations. **Streaming**: NestJS `@Sse()` with RxJS Subject, `stream.on('text', ...)` from Anthropic SDK. Fallback non-streaming endpoint. **Insights**: compares last 7 days vs prior 7 days, surfaces 3 biggest absolute changes ≥10%, cost-like metrics flipped (UP=bad). Throttled 20/min. Max 2000 chars/message. |
| 8.6 | Data Health Monitor | BACKEND DONE | `GET /agencies/health` — surfaces composite health score + per-integration status. AgencyHealthService checks data freshness (lastSyncAt), integration connection status (CONNECTED/EXPIRED/ERROR), active campaigns with data. Tested and passing. |
| 8.7 | Data export (CSV + XLSX) | BACKEND DONE | ExportService: streaming CSV row-by-row (no memory spike), XLSX via `exceljs`. Endpoints: `GET /campaigns/:id/export?format=csv|xlsx&from=&to=` (time-series), `GET /campaigns/:id/export/summary?format=csv|xlsx` (aggregated). 365-day cap enforced. Filename sanitized. Content-Type + Content-Disposition set correctly. **Note:** `from`/`to` must be within 365 days. Tested and passing. |
| 8.8 | ROI forecasting | BACKEND DONE | OLS linear regression on metric_values time-series. ForecastService: builds linear model from (dayIndex, value) pairs, projects N days forward with 95% CI bands (R² confidence). `GET /campaigns/:id/forecast?metric=sessions&horizon=30`. Returns historical + projected points with upper/lower bounds. Tested and passing. |
| 8.9 | Goals | BACKEND DONE | `goals` table (tenant_id, campaign_id, platform, metric_key, target_value, period, start_date, end_date). GoalsService: progress = actual/target × 100 via MetricsService.getMetricSummary(). CRUD under `/clients/:id/campaigns/:id/goals`. Tested and passing. |
| 8.10 | Campaign Notes | BACKEND DONE | `campaign_notes` table (tenant_id, campaign_id, author_id, body, isPinned, created_at). NotesService: CRUD under `/clients/:id/campaigns/:id/notes`. **DTO: `body` only in CreateNoteDto — `isPinned` is PATCH-only.** Tested and passing. |
| 8.11 | Template marketplace | BACKEND DONE | Two-tier design: Tier 1 — `dashboard_templates` + `report_templates` tables (no RLS, system-wide, seeded with 5 dashboard + 3 report templates). Tier 2 — `isTemplate` flag on existing `dashboards`/`reports` (private to agency). Clone operation is a transactional deep copy — widgets/sections get new UUIDs, clone_count incremented on source. Routes: `GET /templates/{dashboards,reports}` (browse public), `POST /templates/{dashboards,reports}/:id/clone`, `POST /.../save-as-template` (admin), `GET /agencies/me/templates/...` (agency private). Seed script: `ts-node src/modules/templates/seed/seed-templates.ts`. |
| 8.12 | Billing (Stripe) | BACKEND DONE | Three plans mapped to existing `AgencyPlan` enum (FREELANCER/AGENCY/AGENCY_PRO) with `PLAN_LIMITS` table: clients/staff/integrations-per-campaign. **BillingLimitsService** exported — injected into ClientsService, TeamService, IntegrationsService; enforces `assertWithinLimits()` only on NEW resource creation (not updates). **Trial grace**: new agencies on FREELANCER get AGENCY-tier limits while `subscriptionStatus='trialing'` and `trialEndsAt > now`. **BillingService**: `createCheckoutSession` (creates Stripe customer lazily on first checkout), `createPortalSession` (Stripe Customer Portal). **BillingWebhookService**: HMAC signature verification, `billing_events.stripe_event_id` UNIQUE for idempotency (duplicate webhooks silently skipped), handles `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`. Runs under SystemPrismaService (RLS bypass — webhook has no auth context). **main.ts**: `express.raw()` middleware scoped to `/api/v1/billing/webhook` before global JSON pipe (Stripe requires raw body). OWNER-only role guard on checkout/portal. Status endpoint exposes plan + usage. |

## Phase 9: Multi-Agency Hierarchy

| # | Feature | Status | Notes |
|---|---|---|---|
| 9.1 | Sub-agency model | PLANNED | COMPLEX. Master agency can create and manage sub-agencies. New role: RESELLER. Sub-agencies operate independently but are visible to master agency. Requires schema changes (parent_agency_id on agencies), new RLS policies (master can read sub-tenant data), billing split. Do this last — everything else first. |

---

## Frontend Integration Phases

### Phase A — Foundation (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Backend leakage purged | COMPLETE | Removed Express, Prisma, bcrypt, jsonwebtoken, server.ts, lib/auth.ts, prisma/ dir from frontend repo |
| Project structure fixed | COMPLETE | `@/` alias → `./src`, `components/ui/` moved under `src/`, all `@/src/` import bugs fixed |
| Unified Role type | COMPLETE | `src/types/auth.ts` — matches backend exactly: SUPER_ADMIN, AGENCY_OWNER, AGENCY_ADMIN, AGENCY_STAFF, CLIENT_USER |
| RBAC utilities | COMPLETE | `src/lib/rbac.ts` (hasRole, roleHome, isAgencyRole, isClientUser), `useRole`, `useHasRole`, `<RequireRole>`, `<RoleRoute>` |
| API client hardened | COMPLETE | `src/lib/api.ts` — `/api/v1` baseURL, `withCredentials: true`, refresh-on-401 single-flight interceptor, typed error helper |
| Real auth flow | COMPLETE | login, register, refresh, logout, /auth/me — role-aware redirects via `roleHome()`, AppBootstrap validates token on every page load |
| BrandingProvider | COMPLETE | Fetches `GET /branding` on boot, injects `--brand-primary`/`--brand-secondary` CSS vars, updates favicon + document title, falls back to platform defaults |
| AgencyAppLayout | COMPLETE | Collapsible sidebar, role-filtered nav groups (Manage, Settings), topbar with search stub + notification bell stub, user dropdown, branding logo slot, mobile overlay |
| ClientPortalLayout | COMPLETE | Hard-separated layout for CLIENT_USER — top header only, branded, no admin affordances, footer. Never shares components with agency app |
| AcceptInvitePage | COMPLETE | `/accept-invite?token=` — works for both staff and client invites, post-activation redirect via `roleHome()` (CLIENT_USER→/portal, others→/) |
| StubPage | COMPLETE | `<StubPage sliceId feature endpoints>` — every Phase-B route shows slice label + backend endpoint list until wired |
| Full route tree | COMPLETE | All routes registered in App.tsx with layered RoleRoute guards from day 1; no dead nav links |
| RootRedirect | COMPLETE | `/` redirects by role — CLIENT_USER→/portal, agency roles→/clients, no token→/login |

### Phase B1 — Clients & Campaigns (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Clients list | COMPLETE | `GET /clients` with search, list/grid toggle, create (POST), edit (PATCH), archive (DELETE soft), ADMIN+ gate for mutations, campaign count in row |
| Client detail | COMPLETE | `GET /clients/:id` — header with logo, name, status badge, website link, _count stats; campaigns table with ACTIVE/PAUSED/INACTIVE badges |
| Campaign CRUD | COMPLETE | `POST/PATCH/DELETE /clients/:id/campaigns` nested; create shows "default dashboard auto-created" note; soft-delete confirmation dialog |
| Campaign home | COMPLETE | 11 nav cards (Dashboards, Reports, Integrations, Alerts, Goals, Notes, Health, Scorecard, Forecast, Export, AI) with color-coded icons; breadcrumb chain |
| Types | COMPLETE | `src/types/clients.ts` — ClientStatus, CampaignStatus, PaginatedMeta, all DTOs aligned to real backend response shapes |

### Phase B2 — Team Management (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Team list | COMPLETE | `GET /team` — table with name, role badge (OWNER/ADMIN/STAFF), Active/Pending status, last login, joined date |
| Invite staff | COMPLETE | `POST /team/invite` — dialog with firstName/lastName/email, optimistic add as Pending row, invite email sent, 48h expiry noted |
| Pending state | COMPLETE | Pending = `emailVerifiedAt === null`; shows amber "Pending" badge + "Invited X days ago"; Resend option appears on pending rows only |
| Resend invite | COMPLETE | `POST /team/resend-invite` — on pending row ••• menu |
| Remove member | COMPLETE | `DELETE /team/:userId` — OWNER only; UI hides Remove for: non-owners, current user's own row, any OWNER row. Confirmation dialog names the member. Optimistic removal |
| Client team assignments | COMPLETE | `GET /clients/:clientId/assignments` — assigned staff table with assign date |
| Assign staff to client | COMPLETE | `POST /clients/:clientId/assignments` — dropdown filtered to: active + verified AGENCY_STAFF + not already assigned. Optimistic add. Prevents 409 duplicate at UI level |
| Unassign staff | COMPLETE | `DELETE /clients/:clientId/assignments/:userId` — trash icon per row, confirmation names the person. Optimistic removal |
| Types | COMPLETE | `src/types/team.ts` — TeamMember, InviteStaffDto, StaffAssignment |

### Phase B3 — White-label Settings (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Agency profile | COMPLETE | `GET/PATCH /agencies/me` — edit name + slug; slug validated with regex (no leading/trailing/double hyphens); server conflict error surfaced; save disabled unless dirty+valid; resets dirty state after save. ADMIN+ |
| Branding settings | COMPLETE | `GET/PATCH /agencies/me/branding` — primary+secondary color pickers (color wheel + hex input + live preview strip), custom domain with CNAME hint, email from-name + from-address with SPF/DKIM note. OWNER only |
| Logo upload | COMPLETE | `POST /agencies/me/branding/logo` — client-side type (PNG/JPEG/SVG/WebP) + size (2 MB) check before upload; SVG trust warning; spinner; cache-busted URL after upload; BrandingProvider refreshed live |
| Favicon upload | COMPLETE | `POST /agencies/me/branding/favicon` — client-side type (ICO/PNG) + size (512 KB) check; spinner; cache-busted URL; BrandingProvider refreshed (favicon + CSS vars update without reload) |
| RBAC guard | COMPLETE | Sidebar Branding item already at `minRole: AGENCY_OWNER`; route guarded by `<RoleRoute min="AGENCY_OWNER">`; Save disabled while pending |

### Phase B4 — Integrations / Data Sources (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Integration grid | COMPLETE | 8 platform cards in 2-column grid; DISCONNECTED/CONNECTED/ERROR states; branded colour dot per platform |
| Connect flow | COMPLETE | GET auth-url → window.location redirect → backend callback → redirect to `/clients/:clientId/campaigns/:campaignId/integrations?connected=platform` → toast + refetch |
| OAuth state fix (backend) | COMPLETE | `OAuthStatePayload` now includes `clientId` (derived from DB, not user input); all 8 platform redirect URLs updated to full `/clients/:clientId/campaigns/:campaignId/integrations` path — no sessionStorage, production-grade |
| Connected card details | COMPLETE | Shows `externalAccountId`, last synced time (relative), "First sync pending" if never synced |
| Error state | COMPLETE | ERROR badge + `lastErrorMessage` shown; Reconnect button triggers new OAuth flow |
| Disconnect | COMPLETE | `DELETE /integrations/:platform`; optimistic update; named confirmation dialog; historical data preserved |
| RBAC | COMPLETE | STAFF = read-only view; ADMIN+ = Connect/Disconnect actions visible |
| Platform config | COMPLETE | `src/types/integrations.ts` — PLATFORM_META array with id, name, description, brand colour for all 8 |

### Phase B5 — Dashboard Viewer (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Dashboard list | COMPLETE | `GET /campaigns/:id/dashboards` — empty state, create dialog (name only), loading skeletons |
| Dashboard viewer | COMPLETE | `GET /campaigns/:id/dashboards/:id` — real widgets rendered via `WidgetRenderer`; date range picker wired; role-aware edit button |
| Widget data | COMPLETE | `POST /campaigns/:id/dashboards/:id/widgets/data` — per-widget data fetch with TanStack Query; KPI, LineChart, BarChart, PieChart, Table variants |
| Metric definitions | COMPLETE | `GET /metrics/definitions/:platform` — `useMetricDefinitions(platform)` hook; `metricKey` field (not `key`); platform-aware labels |
| Connected platforms | COMPLETE | `useConnectedPlatforms(clientId, campaignId)` — fetches live integration status; unconnected platforms shown as disabled in pickers |
| Error/loading states | COMPLETE | Per-widget skeleton, `WidgetError`, `WidgetEmptyState`; full-page skeleton on dashboard load |
| RBAC | COMPLETE | `<RoleRoute min="AGENCY_ADMIN">` around edit route; edit button hidden for STAFF |

### Phase B6 — Dashboard Editor (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Drag-and-drop grid | COMPLETE | `react-grid-layout` with `ResizeObserver` for dynamic width; layout persisted to backend on every drop/resize |
| Widget config panel | COMPLETE | `WidgetConfigPanel` — type, title, platform, metricKey pickers; connected-platform guard with tooltip |
| Add widget modal | COMPLETE | `AddWidgetModal` — 5 widget types; defaults pre-filled; appended to layout at next open row |
| Save layout | COMPLETE | `PATCH /campaigns/:id/dashboards/:id` — debounced on drag/resize; optimistic; dirty-state tracking |
| Widget CRUD | COMPLETE | Add via modal; delete via widget header ×; edit via panel; all changes reflected live |
| ADMIN+ guard | COMPLETE | Editor route at `/dashboards/:id/edit` gated by `<RoleRoute min="AGENCY_ADMIN">` |

### Phase B7 — Reports (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Reports list | COMPLETE | `GET /campaigns/:id/reports` — table with name, status badge (PUBLISHED=emerald, DRAFT=muted), section count, last-updated; create dialog (name); delete confirmation |
| Report detail | COMPLETE | 4 tabs: Overview, Sections, Schedule, Deliveries; date-range picker → `dateRangeToDays()` → query param; Generate PDF button (disabled if DRAFT); status badge |
| Section viewer | COMPLETE | Ordered section list with type icons (METRICS/CHART/TEXT); expand/collapse; metric key + platform labels |
| Schedule display | COMPLETE | `cronToHuman()` parser (e.g. "0 8 * * 1" → "Every Monday at 8:00 AM"); enabled/disabled indicator |
| Share links | COMPLETE | Create link with optional expiry; copy with 2s "Copied!" state; expiry date display; revoke with confirmation dialog |
| Delivery history | COMPLETE | `GET /campaigns/:id/reports/:id/deliveries` — status icons (✓/✗/⏳); timestamp; recipient |
| Report builder | COMPLETE | `ReportBuilder` — section drag-reorder with ↑↓ arrows; add/edit section modal (METRICS/CHART/TEXT forms); `PlatformMetricPicker` with disabled+tooltip for unconnected platforms; save with `sections.map((s,i)=>({...s,order:i}))` to persist order |
| Public share viewer | COMPLETE | `/r/:token` → `SharedReportPage` — `getPublicApiClient()` (no auth headers); renders section list; PDF download from `downloadUrl`; 404/403/410 → "Link expired or revoked" |
| RBAC | COMPLETE | Builder at `/reports/:id/edit` gated by `<RoleRoute min="AGENCY_ADMIN">`; Generate/Schedule/Share only rendered for ADMIN+ |

### Phase B8 — Alerts + Goals + Notes (2026-04-24) ✅

| Feature | Status | Notes |
|---|---|---|
| Alerts list | COMPLETE | `GET /campaigns/:id/alerts` — card grid; severity badges (CRITICAL/WARNING/INFO); `conditionSummary()` helper; `timeAgo()` helper; active/inactive toggle |
| Alert toggle (debounced) | COMPLETE | `useRef<Map>` for pending timers, 400ms debounce; optimistic local state; reverts on API error; prevents spam |
| Alert history | COMPLETE | Lazy-fetched on first expand per alert; 20-item pagination with "Load more"; firedAt + value + threshold per event |
| Alert modal (create/edit) | COMPLETE | Platform picker (disabled+tooltip for unconnected); metric select; condition, threshold, period, severity, recipient emails (comma-separated, validated), cooldown hours |
| Goals list | COMPLETE | `GET /campaigns/:id/goals/progress` batch endpoint; progress bars with `Math.min(100, pct)` clamp; `deriveStatus()` (≥100 ACHIEVED, ≥70 ON_TRACK, ≥40 AT_RISK, else BEHIND); `STATUS_STYLES` record |
| Goal period auto-fill | COMPLETE | `suggestDateRange(periodType)` — auto-fills periodStart/periodEnd when type changes (WEEKLY=current week, MONTHLY=current month, QUARTERLY=current quarter) |
| Goal ACHIEVED lock | COMPLETE | Green border; "Completed" badge; edit button hidden; progress bar locked at 100% |
| Goal inline date validation | COMPLETE | `new Date(periodStart) >= new Date(periodEnd)` → inline error, Save disabled |
| Notes list | COMPLETE | `GET /campaigns/:id/notes` — sorted pinned-first then newest-first via `useMemo`; pin badge on pinned notes |
| Note optimistic CRUD | COMPLETE | Create: temp ID `temp-${Date.now()}`, replace with real on success, revert+restore body on error; pin toggle, edit, delete all fully optimistic |
| Note char limit | COMPLETE | `MAX_CHARS=5000`, `WARN_CHARS=4500`; counter turns red >4500; Save disabled if over limit |
| Note expand/collapse | COMPLETE | "Show more/less" toggle for notes >250 chars; `Set<string>` for expanded state |
| Note edit UX | COMPLETE | `editAreaRef` for focus; Esc→cancelEdit; Cmd/Ctrl+Enter→save; inline textarea replaces body |
| RBAC | COMPLETE | `canEdit = hasRole(role, "AGENCY_ADMIN") \|\| hasRole(role, "AGENCY_STAFF")`; create/edit/delete/pin hidden for CLIENT_USER |

### Phase B9 — AI Assistant (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| AI Summary tab on ReportDetail | COMPLETE | 5th tab on report detail page; `POST .../reports/:id/ai-summary`; ADMIN+ only; Generate + Regenerate (`?force=true`); old summary visible during regenerate (spinner overlay); `cached: true` → amber "Cached (24h)" badge; model name badge; "Last generated" timestamp; 503 → graceful error, no crash; "Add sections" guard when report has no sections |
| AI Insights panel on CampaignHomePage | COMPLETE | `GET .../ai/insights`; top-3 metric changes sorted by absolute changePct desc; POSITIVE=emerald / NEGATIVE=red; cost metrics label "(worse)"/"(better)"; "Last 7 days vs prior 7 days"; silently hidden on error or 0 insights (non-blocking); 1h stale-time matches backend cache |
| AI Assistant page | COMPLETE | `/clients/:clientId/campaigns/:campaignId/ai` → `AiAssistantPage`; two-panel layout (conversation list + chat) |
| Conversation list | COMPLETE | `GET .../ai/conversations`; title + message count + timeAgo; "New Chat" button; delete with confirmation (optimistic); empty state "Start a new chat" |
| New conversation (first message) | COMPLETE | `POST .../ai/conversations` with `{ question }`; synchronous first reply; seeds message cache; adds conversation to list optimistically |
| SSE streaming (subsequent messages) | COMPLETE | Native `EventSource` with `{ withCredentials: true }`; `useRef<EventSource>` for lifecycle; closes on unmount, route change, conversation switch, new send; accumulates `delta.content` into streaming bubble; `type: done` → invalidate messages query; `type: error` → toast + re-enable composer; `onerror` → toast + cleanup |
| Conversation switching safety | COMPLETE | `activeConvIdRef` prevents stale SSE chunks from wrong conversation appearing; stream cancelled before switching |
| Content encoding guard | COMPLETE | `encodeURIComponent(content.trim())`; MAX_CHARS=2000; over-limit blocks send with visible error |
| Message bubbles | COMPLETE | User (right, primary bg) + assistant (left, muted bg) with streaming cursor `animate-pulse`; token count shown faintly under assistant messages |
| Example prompts | COMPLETE | 4 clickable prompt suggestions in empty-chat state; click fills composer |
| RBAC | COMPLETE | AI Summary Generate button: ADMIN+ only; assistant page: all agency roles; conversation isolation: `tenantId + userId` enforced by backend |

### Phase B10 — Scorecard + Forecast + Health + Export (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Health page | COMPLETE | `GET .../health`; summary pills (connected/expired/error/disconnected counts); one card per integration; CONNECTED=emerald/EXPIRED=amber/ERROR=red/DISCONNECTED=muted; `lastSyncAt` as relative time with absolute on title-hover; null lastSyncAt → "First sync pending"; error messages truncated at 100 chars with "Show more/less"; CONNECTED→"View data" link to dashboards; EXPIRED/ERROR→"Reconnect" link to integrations; auto-refetch every 60s |
| Scorecard page | COMPLETE | `GET .../scorecard?from&to&platform`; platform selector (connected only); DateRangePicker; current + prior period date labels; metric table: current, prior, absolute change, changePct; sorted by `abs(changePct) DESC` (biggest movers first); UP=emerald↑ / DOWN=red↓ / FLAT=muted→; `changePct=null` → "—" (no prior data); values formatted for currency/percent/large numbers; metric label from `useMetricDefinitions` |
| Forecast page | COMPLETE | `GET .../forecast?platform&metricKey&from&to&forecastDays`; platform + metric + date range + horizon slider (7–90 days); recharts `ComposedChart`; CI band via stacked Areas (`lowerBound` transparent + `bandHeight` primary/15); historical solid line + projected dashed line; `insufficient_data` → centred message with dataPoints/minimumRequired; `lowConfidence` (R²<0.3) → amber warning banner; R² badge: ≥0.7=Good/≥0.4=Moderate/<0.4=Weak; summary cards: projected total, projected end value, trend direction + R²; 1h stale-time (historical doesn't change) |
| Export page | COMPLETE | Two export types: Time-series (one row per period) + Summary (aggregated totals); platform selector + DateRangePicker + granularity (day/week/month) + format (CSV/XLSX) toggles; client-side 365-day max validation with error message; auth-safe download: `api.get(..., { responseType: 'blob' })` → `URL.createObjectURL` → programmatic `<a download>` → `URL.revokeObjectURL`; filename from `Content-Disposition` header with sanitized fallback; "Download started" toast on success; blob error body parsed for meaningful error messages |

### Phase B11 — Custom KPIs + Templates Marketplace (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| KPI Definitions page | COMPLETE | `/kpi-definitions` (ADMIN+); two-level campaign selector (client→campaign) persisted in sessionStorage; built-in KPI cards (CTR/CPC/ROAS/CPM static); custom KPI list from `GET /campaigns/:id/kpi-definitions`; delete with inline confirmation; `Evaluate All` → `GET /campaigns/:id/kpi` → results table (value + OK/ERROR status + error message) |
| Create KPI modal | COMPLETE | Label + input metrics (platform tabs + checkbox list from `GET /metrics/definitions/:platform` filtered by connected platforms) + formula textarea with click-to-insert token buttons (one per selected metric); hint box with operator examples; backend owns formula validation (frontend only checks non-empty + inputMetrics non-empty) |
| Templates page | COMPLETE | `/templates` (all agency roles); two tabs: Template Library (public system templates) and My Agency (agency private); `GET /templates/dashboards` + `/reports` for library; `GET /agencies/me/templates/dashboards` + `/reports` for agency tab (lazy — only fetches when tab is active) |
| Template cards | COMPLETE | Preview image slot (fallback to icon if null); name, description, widget/section count, clone count; "Use Template" button; source campaign name badge on agency templates |
| Clone modal | COMPLETE | Client picker → campaign picker → optional name override; `POST /templates/dashboards/:id/clone` or `/reports/:id/clone` with `{ campaignId }`; on success: toast "Dashboard/Report created in X" with "Open" action button that navigates directly to the cloned resource; `qc.invalidateQueries(["templates","agency"])` for immediate My Agency tab refresh |
| Save as Template — Dashboard | COMPLETE | "Save as Template" button (ADMIN+) in DashboardViewer header (view mode only); `POST .../dashboards/:id/save-as-template`; toast with "View Templates" action; `qc.invalidateQueries(["templates","agency"])` for immediate My Agency tab refresh |
| Save as Template — Report | COMPLETE | "Save as Template" button (ADMIN+) in ReportDetail header; `POST .../reports/:id/save-as-template`; same toast pattern |
| Types | COMPLETE | `src/types/kpi.ts` (KpiDefinition, KpiEvaluationResult, KpiEvaluationResponse, CreateKpiDefinitionDto); `src/types/templates.ts` (DashboardTemplate, ReportTemplate, CloneDashboardResponse, CloneReportResponse) |

### Agency Overview Backend Module (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Agency metrics summary endpoint | COMPLETE | `GET /agencies/me/metrics/summary?from&to` — aggregates SUM/COUNT across ALL campaigns for a tenant; returns sessions, users, clicks, impressions, conversions, cost, revenue, leads with current + prior period delta %; prior period = equal-length window immediately before `from`. STAFF-scoped via EXISTS subquery on `staff_client_assignments`. 5-min Redis cache (`CacheService.getOrSet`). `dimension_key IS NULL` filter avoids breakdown rows being double-counted. Raw SQL in `$transaction` with `SET LOCAL app.current_tenant` for RLS. |
| Campaign ranking endpoint | COMPLETE | `GET /agencies/me/campaigns/ranking?metric&from&to&limit&order` — ranks campaigns by any metric (sessions/clicks/impressions/conversions/cost/revenue/leads), ASC (bottom) or DESC (top), configurable limit (default 10). Returns `campaignId`, `campaignName`, `clientId`, `clientName`, current total, prior period total, delta %. `@Transform` on `limit` param to parse query string as int. Same STAFF scoping + 5-min Redis cache. |

### Phase B12 — Billing (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Billing page | COMPLETE | `/settings/billing` (OWNER only) — current plan card with plan + status badges; usage meters (Clients/Staff/Integrations with progress bars, red overflow indicator); plan comparison grid (Starter/Agency/Agency Pro) with "Most Popular" badge; trial banner (amber → red when ≤3 days) |
| Stripe Checkout | COMPLETE | `POST /billing/checkout` — loading state per plan button, `window.location.href = checkoutUrl`; "Stripe not configured" amber card shown when keys missing |
| Stripe Portal | COMPLETE | `POST /billing/portal` — instant redirect to Stripe Customer Portal for subscription management |
| Billing success/cancel pages | COMPLETE | `/billing/success` — subscription activated card + 3s auto-redirect; `/billing/cancel` — no-changes card + back button |

### Phase B13 — Audit Log Viewer (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Audit log page | COMPLETE | `/settings/audit-log` (ADMIN+) — quick filter chips (All/Integrations/Reports/Team), filter bar (Action dropdown, Resource dropdown, From/To date inputs with 300ms debounce), table with 7 columns |
| Audit table | COMPLETE | Timestamp (relative + absolute tooltip), User (email or "System" pill), Action (colored badge: CREATE/CONNECT/INVITE=green, UPDATE/GENERATE=blue, DELETE/DISCONNECT/REVOKE=red, RESTORE=cyan), Resource type, Resource name, IP address, Details (metadata expand with copy-to-clipboard) |
| Pagination | COMPLETE | Numbered page buttons with ellipsis, Prev/Next, "Showing X–Y of Z entries" count, page resets to 1 on filter change |

### Phase B14 — Notifications Bell + SSE (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Notification bell | COMPLETE | Unread count badge (capped "9+"), hidden when 0, 2s pulse animation (ring + scale + bounce) when new notification arrives via SSE |
| Notification dropdown | COMPLETE | Last 20 notifications; unread rows bold + blue dot + bg tint; "Mark all read" button; click-navigation by type (INVITE_ACCEPTED→/team, SYNC_FAILED/CONNECTED→/clients, others→/clients); optimistic mark-read |
| SSE stream | COMPLETE | Native `fetch()` + ReadableStream (not EventSource — can't send auth headers); safe JSON.parse with try/catch; filters HEARTBEAT/CONNECTED events; exponential backoff reconnect (5s → 30s cap); AbortController cleanup on unmount |
| Fallback poll | COMPLETE | Baseline poll every 60s; relative timestamps refresh every 60s |

### Phase B15 — Agency Overview Command Center (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Overview page — refactored | COMPLETE | 8-file architecture: `overview.types.ts`, `overview.utils.ts`, + 5 focused components (`OverviewInsights`, `OverviewKpis`, `OverviewRanking`, `OverviewHealth`, `OverviewClients`) + thin `OverviewPage` orchestrator |
| Scorecard strip | COMPLETE | 4 tiles: Active Clients, Campaigns, Integration Health %, Connected/Total integrations — live from `/agencies/health` + `/clients` |
| Insights layer | COMPLETE | CRITICAL/WARNING/INFO severity system — integration errors (CRITICAL/red), expired tokens (CRITICAL/red), metric drops >30% (CRITICAL), 10–30% drops (WARNING/amber), >20% gains (INFO/green); sorted by severity; each insight has "Fix now"/"View campaign" action button with deep-link navigation |
| KPI cards | COMPLETE | Agency-wide metric sums with delta % (sessions, users, clicks, impressions, conversions, ad spend, revenue, leads); date range selector (7d/30d/90d/MTD) |
| Campaign ranking | COMPLETE | Top/Bottom performer toggle (order=desc/asc), bar chart, gold/silver/bronze medals, "At risk" badge when bottom performer AND delta negative, switchable metric |
| Integration health | COMPLETE | Per-campaign health status with colored icons, scrollable list, "Fix now" → integrations page; `campaignId→clientId` cross-reference map built from ranking data |

### Phase B16 — Client Portal (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| PortalLanding | COMPLETE | `/portal` — auto-redirects if single client; branded welcome with agency logo; client card grid with campaign count; "No clients assigned" empty state |
| PortalClientHome | COMPLETE | `/portal/:clientId` — 3-tab interface (Overview/Dashboards/Reports) via `?tab=` query param; hero header with agency logo, client name, personal greeting, quick-stat pills |
| Portal Overview tab | COMPLETE | Per-campaign cards: connected platforms, issue indicators (amber left-border if health issues), "View Dashboard" + "View Reports" CTAs; navigates to default dashboard in portal routes |
| Portal Dashboards tab | COMPLETE | All dashboards across campaigns grouped by campaign, card grid with widget count |
| Portal Reports tab | COMPLETE | All reports across campaigns in clean list with relative timestamps |
| PortalReportsList | COMPLETE | `/portal/:clientId/campaigns/:campaignId/reports` — standalone read-only reports list with back navigation |
| Portal reuses agency viewers | COMPLETE | `DashboardViewer` + `ReportDetail` work in both agency + portal routes; edit buttons already hidden for `CLIENT_USER` via role checks; no admin chrome in portal tree |
| **BROWSER TESTED** | ✅ 2026-04-25 | Real Gmail SMTP invite sent to `kishanbm22@gmail.com`; accepted invite, set password, logged in as CLIENT_USER; portal shows correct client + campaign + dashboards + reports. Schedule + Share Links tabs hidden for CLIENT_USER (fixed `ReportDetail` tab filter). `listPortalUsers` fixed to include pending (pre-accept) users. `resendClientInvite` fixed to send `{ email }` not `{ userId }` |

### Portal Summary Backend + Portal UX Enhancements (2026-04-25) ✅

| Feature | Status | Notes |
|---|---|---|
| Portal-summary endpoint | COMPLETE | `GET /campaigns/:campaignId/portal-summary` — single call returns KPI cards, next report, AI narrative snippet, last sync timestamp. No `@Roles` guard; `assertCampaignAccess` handles all 5 roles (OWNER/ADMIN/STAFF/CLIENT_USER/SUPER_ADMIN) — CLIENT_USER checked via `clientUserAssignments: { some: { userId } }`. Avoids CLIENT_USER hitting the AGENCY_STAFF-gated `/metrics` endpoint. |
| KPI aggregation | COMPLETE | Raw SQL in `$transaction` with `SET LOCAL app.current_tenant` for RLS safety. Last 30 days vs prior 30 days. `dimension_key IS NULL` filter prevents breakdown double-counting. PORTAL_METRIC_META priority (sessions→users→clicks→impressions→conversions→cost→revenue→leads) — picks first 4 with non-zero data. Delta: `Math.round(((curr-prev)/prev)*1000)/10` (1dp, null when no prior data). |
| AI narrative snippet | COMPLETE | Queries most-recently-generated `aiSummary` from reports; trims to 280 chars at a word boundary with `…`; returns `{ snippet, generatedAt }`. |
| Next report | COMPLETE | Queries `reportSchedule` ordered by `nextRunAt ASC`; returns `{ reportName, nextRunAt, cronExpression }`. |
| Last sync timestamp | COMPLETE | Queries `integrationConnection` ordered by `lastSyncAt DESC`; returns latest timestamp or null. |
| Portal invite management | COMPLETE | `GET /clients/:clientId/portal-users` — returns active `clientUserAssignment` rows + pending users (`pendingClientId=clientId, isActive=false, role=CLIENT_USER`); combined array with `isPending` flag. `DELETE /clients/:clientId/portal-users/:userId` — removes `clientUserAssignment`. Both ADMIN+ only. |
| PortalClientHome KPI cards | COMPLETE | `KpiCards` component — 2×4 grid; `formatMetric(value, format)` with K/M suffixes for number/currency; TrendingUp (green)/TrendingDown (red)/Minus (muted) delta badges. |
| PortalClientHome goals summary | COMPLETE | `GoalsSummary` component — avg progress bar + achieved/on-track/at-risk counts from `GET .../goals/progress` (retry:false for graceful failure). |
| PortalClientHome next report badge | COMPLETE | `cronToHuman(expr)` parser (e.g. "0 8 * * 1" → "Every Mon at 8:00 AM"); badge with next date; shown when portal-summary returns next report. |
| PortalClientHome AI narrative | COMPLETE | Expandable snippet with "Show more/Show less" toggle (`useState aiExpanded`); `generatedAt` relative timestamp; hidden when no AI summary exists. |
| PortalClientHome data freshness | COMPLETE | "Synced 2h ago" relative timestamp from `lastSyncAt`; hidden when null. |
| ClientTeamPage portal access section | COMPLETE | "Portal Access" section below assigned staff — Active/Pending badges, Resend button for pending users, Revoke with `AlertDialog` confirmation. `InvitePortalDialog` component with firstName/lastName/email form via `POST /team/invite-client`. Optimistic revoke with cache rollback on error. |
