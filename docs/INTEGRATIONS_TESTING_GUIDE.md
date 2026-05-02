# AgencyPulse — Integration Sync Testing Guide

**Purpose**: Complete reference for testing every platform sync implementation. For each platform: what credentials are stored, what API is called, what metric rows are written to the DB, and what errors to expect on bad credentials.

**How sync is triggered**:
```
POST /sync/manual
Body: { "campaignId": "<uuid>", "platform": "<ENUM_KEY>", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }
Authorization: Bearer <ADMIN_or_OWNER_token>
```
After triggering, poll `GET /sync/status/:campaignId` for job state, or watch `metric_values` table.

**Where data lands**:
- `metric_values` table: rows per `(tenant_id, campaign_id, platform, metric_key, recorded_at)`
- `integration_connections` table: `status` field goes to `CONNECTED` on success, `ERROR` or `TOKEN_EXPIRED` on failure

**Credential storage fields on `integration_connections`**:
- `accessToken` — encrypted AES-256-GCM; decrypted at sync time
- `externalAccountId` — plaintext string (account ID, instance URL, or JSON config object)

---

## Group 1 — Core Platforms (Dedicated Modules)

These use their own NestJS modules (`Ga4Module`, `GoogleAdsModule`, etc.) rather than the shared platform service pattern.

---

### 1. GA4 — Google Analytics 4
- **Enum**: `GA4`
- **Category**: ANALYTICS
- **Auth**: Google OAuth 2.0 (refresh token via `GoogleOAuthService`)
- **accessToken**: Google OAuth refresh token
- **externalAccountId**: GA4 property ID (e.g. `"properties/123456789"`)
- **API**: Google Analytics Data API v1beta — `POST https://analyticsdata.googleapis.com/v1beta/{propertyId}:runReport`
- **Date filter**: `dateRanges: [{ startDate: from, endDate: to }]`
- **Metrics returned** (per day, `recordedAt = each date`):
  - `sessions` — nb_sessions
  - `totalUsers` — total users
  - `newUsers` — new users
  - `screenPageViews` — page views
  - `bounceRate` — as percentage (×100)
  - `averageSessionDuration` — seconds
- **Pagination**: `offset` + `limit` loop; stops when `rowCount` exhausted
- **Error cases**: 401/403 → token expired + marked `TOKEN_EXPIRED`; property not found → 404

---

### 2. Google Ads
- **Enum**: `GOOGLE_ADS`
- **Category**: PPC
- **Auth**: Google OAuth 2.0 (shared `GoogleOAuthService`)
- **accessToken**: Google OAuth refresh token
- **externalAccountId**: Google Ads customer ID (digits only, e.g. `"1234567890"`)
- **API**: Google Ads API v14 via GAQL — `POST https://googleads.googleapis.com/v14/customers/{customerId}/googleAds:searchStream`
- **Query**: `SELECT segments.date, metrics.clicks, metrics.impressions, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '{from}' AND '{to}'`
- **Normalization**: `cost_micros ÷ 1,000,000` → USD; `ctr × 100` → percentage
- **Metrics returned** (per day):
  - `clicks`, `impressions`, `ctr`, `avg_cpc`, `cost`, `conversions`
- **Error cases**: 401 → `TOKEN_EXPIRED`; customer ID not found → `CUSTOMER_NOT_FOUND` GAQL error

---

### 3. Meta Ads
- **Enum**: `META_ADS`
- **Category**: PPC
- **Auth**: Facebook OAuth 2.0 long-lived token (exchanged from short-lived at connect time)
- **accessToken**: long-lived Facebook access token
- **externalAccountId**: Ad Account ID (e.g. `"act_123456789"`)
- **API**: Meta Marketing API v19.0 — `GET https://graph.facebook.com/v19.0/{adAccountId}/insights`
- **Params**: `fields=impressions,clicks,spend,ctr,cpc,actions&time_increment=1&time_range={since,until}&level=account`
- **Metrics returned** (per day):
  - `impressions`, `clicks`, `spend`, `ctr`, `cpc`, `conversions` (from `actions` where `action_type=offsite_conversion`)
- **Pagination**: `paging.next` cursor loop
- **Token refresh**: `OAuthTokenManager` proactively refreshes 5 days before expiry
- **Error cases**: 190 (token expired) → `TOKEN_EXPIRED`

---

### 4. Google Search Console
- **Enum**: `GOOGLE_SEARCH_CONSOLE`
- **Category**: SEO
- **Auth**: Google OAuth 2.0
- **accessToken**: Google OAuth refresh token
- **externalAccountId**: Verified site URL (e.g. `"https://example.com/"` or `"sc-domain:example.com"`)
- **API**: Search Console API v3 — `POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query`
- **Body**: `{ startDate, endDate, dimensions: ['date'], rowLimit: 25000 }`
- **Metrics returned** (per day):
  - `clicks`, `impressions`, `ctr` (as %), `position` (avg ranking)
- **Error cases**: 403 → site not verified or token lacks `webmasters.readonly` scope

---

### 5. YouTube Analytics
- **Enum**: `YOUTUBE_ANALYTICS`
- **Category**: SOCIAL
- **Auth**: Google OAuth 2.0
- **accessToken**: Google OAuth refresh token
- **externalAccountId**: YouTube channel ID (e.g. `"UCxxxxxx"`)
- **API**: YouTube Analytics API v2 — `GET https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3D{channelId}&startDate={from}&endDate={to}&metrics=views,estimatedMinutesWatched,likes,subscribersGained,subscribersLost&dimensions=day`
- **Metrics returned** (per day):
  - `views`, `watch_time_minutes` (estimatedMinutesWatched), `likes`, `new_subscribers` (subscribersGained - subscribersLost)
- **Error cases**: 403 → channel not accessible or wrong scope

---

### 6. LinkedIn Ads
- **Enum**: `LINKEDIN_ADS`
- **Category**: PPC
- **Auth**: LinkedIn OAuth 2.0 (60-day access tokens)
- **accessToken**: LinkedIn access token
- **externalAccountId**: LinkedIn Ad Account ID (numeric, e.g. `"509123456"`)
- **API**: LinkedIn Marketing API v2 — `GET https://api.linkedin.com/v2/adAnalytics?q=analytics&dateRange=(start:(year:{Y},month:{M},day:{D}),end:(...))&timeGranularity=DAILY&pivot=CAMPAIGN&accounts=List(urn:li:sponsoredAccount:{id})`
- **Metrics returned** (per day):
  - `impressions`, `clicks`, `costInUsd` (→ `spend`), `conversions`, `approximateUniqueImpressions`
- **Error cases**: 401/403 → `TOKEN_EXPIRED`; ad account ID wrong → 400

---

### 7. TikTok Ads
- **Enum**: `TIKTOK_ADS`
- **Category**: PPC
- **Auth**: TikTok Business API OAuth (24-hour tokens; refresh via refresh_token)
- **accessToken**: TikTok Business access token
- **externalAccountId**: TikTok Advertiser ID (e.g. `"7012345678901234567"`)
- **API**: `GET https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id={id}&report_type=BASIC&dimensions=["stat_time_day"]&metrics=["spend","impressions","clicks","ctr"]&start_date={from}&end_date={to}`
- **Normalization**: None (already in USD)
- **Metrics returned** (per day):
  - `spend`, `impressions`, `clicks`, `ctr`
- **Error cases**: 40001 → token expired → `TOKEN_EXPIRED`

---

### 8. Amazon Ads
- **Enum**: `AMAZON_ADS`
- **Category**: PPC
- **Auth**: Login With Amazon (LWA) OAuth
- **accessToken**: LWA access token (refresh via standard refresh_token flow)
- **externalAccountId**: Amazon Ads Profile ID (e.g. `"1234567890123"`)
- **API**: Amazon Ads API v3 (async report) — `POST https://advertising-api.amazon.com/reporting/reports` → poll `GET /reporting/reports/{reportId}` → download report ZIP from `url`
- **Report spec**: `SPONSORED_PRODUCTS`, metrics: `impressions,clicks,spend,sales,orders`, `timeUnit=DAILY`
- **Metrics returned** (per day):
  - `impressions`, `clicks`, `spend`, `sales`, `orders`
- **Polling**: up to 30 × 2s polls for report COMPLETED status
- **Error cases**: 401 → `TOKEN_EXPIRED`; profile not found → 400

---

## Group 2 — Email Marketing Platforms (Phase 3.9)

All use `integrationsService.getDecryptedTokens()` to fetch credentials (not `StandardTokenService`).

---

### 9. Klaviyo
- **Enum**: `KLAVIYO`
- **Category**: EMAIL
- **Auth**: API Key (Private API Key)
- **accessToken**: Klaviyo Private API Key (starts with `pk_`)
- **externalAccountId**: not used (`'default'`)
- **API**: Klaviyo API v2024-02-15 — `GET https://a.klaviyo.com/api/campaigns/?filter=equals(messages.channel,'email'),greater-or-equal(created_at,{from}),less-or-equal(created_at,{to})&page[size]=50`
- **Stats per campaign**: `GET /api/campaign-message-send-job/{messageId}` → `GET /api/campaign-send-jobs/{sendJobId}`
- **Metrics returned** (per send date):
  - `sends`, `opens`, `clicks`, `unsubscribes`, `bounces`, `conversions`
- **Pagination**: `links.next` cursor loop
- **Error cases**: 401 → invalid API key

---

### 10. ActiveCampaign
- **Enum**: `ACTIVECAMPAIGN`
- **Category**: EMAIL
- **Auth**: API Key + Account URL
- **accessToken**: ActiveCampaign API key
- **externalAccountId**: ActiveCampaign account URL (e.g. `"https://myaccount.api-us1.com"`)
- **API**: `GET {accountUrl}/api/3/campaigns?filters[sdate_range]={from}%20to%20{to}&limit=100&offset=0`
- **Metrics returned** (per campaign send date):
  - `sends`, `opens`, `clicks`, `unsubscribes`, `bounces`
- **Pagination**: `offset` loop until count < limit
- **Error cases**: 403 → invalid key; ENOTFOUND → bad account URL

---

### 11. Brevo (formerly SendinBlue)
- **Enum**: `BREVO`
- **Category**: EMAIL
- **Auth**: API Key
- **accessToken**: Brevo API key
- **externalAccountId**: not used (`'default'`)
- **API**: `GET https://api.brevo.com/v3/emailCampaigns?status=sent&startDate={from}&endDate={to}&limit=50` with header `api-key: {key}`
- **Stats per campaign**: `GET /v3/emailCampaigns/{id}`
- **Metrics returned** (per send date):
  - `delivered`, `opens`, `clicks`, `unsubscribes`, `hardBounces`
- **Pagination**: `offset` loop
- **Error cases**: 401 → invalid API key

---

### 12. Mailchimp
- **Enum**: `MAILCHIMP`
- **Category**: EMAIL
- **Auth**: OAuth 2.0 (special: Mailchimp returns a `dc` prefix at token exchange time via `GET https://login.mailchimp.com/oauth2/metadata`)
- **accessToken**: Mailchimp OAuth access token
- **externalAccountId**: Mailchimp data center prefix (e.g. `"us14"`) — stored automatically at connect time
- **API**: `GET https://{dc}.api.mailchimp.com/3.0/campaigns?status=sent&since_send_time={from}T00:00:00+00:00&before_send_time={to}T23:59:59+00:00&count=100`
- **Stats per campaign**: included in list response under `report_summary`
- **Metrics returned** (per send date):
  - `sends`, `opens`, `clicks`, `unsubscribes`, `bounces`
- **Error cases**: 401 → token expired or revoked

---

### 13. Campaign Monitor
- **Enum**: `CAMPAIGN_MONITOR`
- **Category**: EMAIL
- **Auth**: API Key (Basic auth with `api_key:x`)
- **accessToken**: Campaign Monitor API key
- **externalAccountId**: Client ID (e.g. `"a1b2c3d4e5f6..."`) — required to list campaigns
- **API**: `GET https://api.createsend.com/api/v3.3/clients/{clientId}/campaigns.json?sentfromdate={from}&senttodate={to}&page=1&pagesize=50`
- **Stats per campaign**: `GET /api/v3.3/campaigns/{campaignId}/summary.json`
- **Metrics returned** (per send date):
  - `sends`, `opens`, `clicks`, `unsubscribes`, `bounces`
- **Error cases**: 401 → invalid API key; 404 → invalid client ID

---

### 14. ConvertKit
- **Enum**: `CONVERTKIT`
- **Category**: EMAIL
- **Auth**: API Key (query param `api_key`)
- **accessToken**: ConvertKit API key (v3 — 24-char hex)
- **externalAccountId**: not used (`'default'`)
- **API**: `GET https://api.convertkit.com/v3/broadcasts?api_key={key}&page=1&per_page=50`
- **Stats per broadcast**: `GET /v3/broadcasts/{id}/stats?api_key={key}`
- **Filters**: broadcast `created_at` date string compared to dateRange
- **Metrics returned** (per send date):
  - `sends` (recipients), `opens`, `clicks`, `unsubscribes`
- **Error cases**: 401 → invalid API key

---

### 15. Drip
- **Enum**: `DRIP`
- **Category**: EMAIL
- **Auth**: API Key (Bearer token)
- **accessToken**: Drip API token
- **externalAccountId**: Drip Account ID (numeric, e.g. `"9999999"`)
- **API**: `GET https://api.getdrip.com/v2/{accountId}/broadcasts?status=sent&per_page=100`
- **Filters**: broadcast `send_at` date string compared to dateRange (no server-side date filter available)
- **Metrics returned** (per send date):
  - `sends`, `opens`, `clicks`, `unsubscribes`, `conversions`
- **Error cases**: 401 → invalid token; 404 → invalid account ID

---

### 16. Constant Contact
- **Enum**: `CONSTANT_CONTACT`
- **Category**: EMAIL
- **Auth**: OAuth 2.0 (Bearer via `StandardTokenService`)
- **accessToken**: Constant Contact OAuth access token
- **externalAccountId**: not used (`'default'`)
- **API**: `GET https://api.cc.email/v3/reports/summary_reports/email_campaign_summaries?scheduled_after={from}T00:00:00-00:00&scheduled_before={to}T23:59:59-00:00&per_page=50`
- **Metrics returned** (per send date):
  - `sends`, `opens`, `clicks`, `unsubscribes`, `bounces`
- **Pagination**: `_links.next.href` cursor loop
- **Error cases**: 401/403 → `TOKEN_EXPIRED`

---

## Group 3 — SEO Platforms (Phase 3.9)

---

### 17. Ahrefs
- **Enum**: `AHREFS`
- **Category**: SEO
- **Auth**: API Key (Bearer token)
- **accessToken**: Ahrefs API Key (v3)
- **externalAccountId**: Target domain (e.g. `"example.com"`)
- **API**: `GET https://api.ahrefs.com/v3/site-explorer/organic-search-overview?select=org_traffic,org_keywords,paid_traffic,paid_keywords&date_from={from}&date_to={to}&target={domain}`
- **Backlinks**: `GET /v3/site-explorer/refdomains-history?target={domain}&date_from={from}&date_to={to}`
- **Metrics returned** (per day):
  - `org_traffic`, `org_keywords`, `paid_traffic`, `paid_keywords`, `refdomains`, `dofollow_refdomains`
- **Error cases**: 401 → invalid API key; 422 → domain not found in Ahrefs index

---

### 18. Moz
- **Enum**: `MOZ`
- **Category**: SEO
- **Auth**: API Key (Basic auth with `mozscape-{key}:`)
- **accessToken**: Moz API key (after `mozscape-` prefix)
- **externalAccountId**: Target URL (e.g. `"https://example.com"`)
- **API**: `POST https://lsapi.seomoz.com/v2/url_metrics` with body `{ targets: [url] }`
- **Metrics returned** (snapshot at `to` date — SEO metrics are not time-series by day):
  - `domain_authority`, `page_authority`, `spam_score`, `linking_domains`, `ranking_keywords`
- **Note**: snapshot stored at `recordedAt = dateRange.to` — Moz data is point-in-time
- **Error cases**: 401 → invalid API key

---

### 19. SEMrush
- **Enum**: `SEMRUSH`
- **Category**: SEO
- **Auth**: API Key (query param `key`)
- **accessToken**: SEMrush API key
- **externalAccountId**: Target domain (e.g. `"example.com"`)
- **API**: `GET https://api.semrush.com/?type=domain_rank&key={key}&export_columns=Or,Ot,Oad,Rk&domain={domain}&database=us&display_date={to.replace(/-/g,'')}`
- **Metrics returned** (snapshot at `to`):
  - `organic_keywords`, `organic_traffic`, `organic_cost`, `authority_score`
- **Error cases**: 400 → invalid API key or invalid domain

---

### 20. Majestic
- **Enum**: `MAJESTIC`
- **Category**: SEO
- **Auth**: API Key (query param `privatekey`)
- **accessToken**: Majestic API key
- **externalAccountId**: Target URL (e.g. `"https://example.com"`)
- **API**: `GET https://api.majestic.com/api/json?cmd=GetIndexItemInfo&items=1&item0={url}&privatekey={key}&datasource=fresh`
- **Metrics returned** (snapshot at `to`):
  - `trust_flow`, `citation_flow`, `referring_domains`, `referring_ips`, `external_backlinks`
- **Error cases**: 401 → invalid API key

---

### 21. SE Ranking
- **Enum**: `SE_RANKING`
- **Category**: SEO
- **Auth**: API Key (Bearer)
- **accessToken**: SE Ranking API key
- **externalAccountId**: SE Ranking Project ID (numeric, e.g. `"12345"`)
- **API**: `GET https://api.seranking.com/projects/{projectId}/positions?date_from={from}&date_to={to}` — keyword ranking data
- **Metrics returned** (per day):
  - `avg_position`, `keywords_in_top_3`, `keywords_in_top_10`, `keywords_in_top_30`
- **Error cases**: 401 → invalid key; 404 → project not found

---

### 22. BrightLocal
- **Enum**: `BRIGHTLOCAL`
- **Category**: SEO / LOCAL
- **Auth**: API Key (Basic auth with `{apiKey}:`)
- **accessToken**: BrightLocal API key
- **externalAccountId**: Campaign ID (numeric)
- **API**: `GET https://tools.brightlocal.com/seo-tools/api/v4/lsrc/reports?campaign={id}&date-from={from}&date-to={to}`
- **Metrics returned** (per report date):
  - `local_visibility_score`, `avg_rank`, `citations_found`, `reviews_count`, `avg_review_score`
- **Error cases**: 401 → invalid API key; 422 → bad campaign ID

---

### 23. Google PageSpeed
- **Enum**: `GOOGLE_PAGESPEED`
- **Category**: SEO
- **Auth**: API Key (query param `key`) — uses Google PageSpeed Insights API key
- **accessToken**: Google PageSpeed API key
- **externalAccountId**: Target URL (e.g. `"https://example.com"`)
- **API**: `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&key={key}&strategy=mobile` and `strategy=desktop`
- **Metrics returned** (snapshot at `to`, stored for both strategies):
  - `mobile_performance`, `mobile_cls`, `mobile_lcp`, `mobile_fid`, `mobile_ttfb`
  - `desktop_performance`, `desktop_cls`, `desktop_lcp`, `desktop_fid`, `desktop_ttfb`
- **Note**: These are Core Web Vitals scores from Lighthouse
- **Error cases**: 400 → URL unreachable; 403 → invalid API key

---

### 24. Bing Webmaster Tools
- **Enum**: `BING_WEBMASTER`
- **Category**: SEO
- **Auth**: OAuth 2.0 (Microsoft account via `StandardTokenService`)
- **accessToken**: Microsoft OAuth access token
- **externalAccountId**: Verified site URL (e.g. `"https://example.com/"`)
- **API**: `GET https://ssl.bing.com/webmaster/api.svc/json/GetPageStats?siteUrl={url}&startDate={from}&endDate={to}` with header `Authorization: Bearer {token}`
- **Metrics returned** (per day):
  - `crawls`, `impressions`, `clicks`, `avg_ctr`, `avg_position`
- **Error cases**: 401 → token expired; 404 → site not verified in Bing

---

## Group 4 — Call Tracking Platforms (Phase 3.9)

---

### 25. CallRail
- **Enum**: `CALLRAIL`
- **Category**: CALL_TRACKING
- **Auth**: API Key (header `Authorization: Token token="{key}"`)
- **accessToken**: CallRail API key
- **externalAccountId**: Account ID (e.g. `"ACC8154748d"`)
- **API**: `GET https://api.callrail.com/v3/a/{accountId}/calls.json?date_range=custom&start_date={from}&end_date={to}&per_page=250`
- **Metrics returned** (per call date):
  - `total_calls`, `answered_calls`, `missed_calls`, `avg_duration_sec`, `first_time_callers`
- **Pagination**: `page` + `total_pages` loop
- **Error cases**: 401 → invalid token; 422 → invalid account ID

---

### 26. CallTrackingMetrics
- **Enum**: `CALLTRACKING_METRICS`
- **Category**: CALL_TRACKING
- **Auth**: API Key + Account Secret (Basic auth with `{accessKey}:{secretKey}`)
- **accessToken**: API access key + secret, stored as `{key}:{secret}` (colon-separated)
- **externalAccountId**: Account ID
- **API**: `GET https://api.calltrackingmetrics.com/api/v1/accounts/{accountId}/calls.json?start_time={from}T00:00:00&end_time={to}T23:59:59&per_page=250`
- **Metrics returned** (per call date):
  - `total_calls`, `answered_calls`, `missed_calls`, `avg_duration_sec`
- **Error cases**: 401 → invalid credentials

---

### 27. WhatConverts
- **Enum**: `WHATCONVERTS`
- **Category**: CALL_TRACKING
- **Auth**: API Key + Secret (header `X-WhatsConvert-Account-Token`)
- **accessToken**: API token (profile token)
- **externalAccountId**: Profile ID (numeric)
- **API**: `GET https://app.whatconverts.com/api/v1/leads?profile_id={id}&date_from={from}&date_to={to}&per_page=250`
- **Metrics returned** (per lead date):
  - `total_leads`, `call_leads`, `form_leads`, `chat_leads`, `transaction_leads`
- **Error cases**: 401 → invalid token

---

### 28. Twilio
- **Enum**: `TWILIO`
- **Category**: CALL_TRACKING
- **Auth**: API Key (Account SID + Auth Token, Basic auth with `{accountSid}:{authToken}`)
- **accessToken**: Auth Token; `accountSid` stored in externalAccountId
- **externalAccountId**: Twilio Account SID (e.g. `"ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`)
- **API**: `GET https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Calls.json?StartTime>={from}&StartTime<={to}&PageSize=1000`
- **Metrics returned** (per call date):
  - `total_calls`, `inbound_calls`, `outbound_calls`, `avg_duration_sec`
- **Pagination**: `nextPageUri` loop
- **Error cases**: 401 → invalid credentials; 404 → invalid account SID

---

### 29. Marchex
- **Enum**: `MARCHEX`
- **Category**: CALL_TRACKING
- **Auth**: API Key (Bearer)
- **accessToken**: Marchex API key
- **externalAccountId**: Account UUID
- **API**: `GET https://analytics.marchex.io/call-analytics/v2/calls?account_id={id}&start_date={from}&end_date={to}&limit=1000`
- **Metrics returned** (per call date):
  - `total_calls`, `qualified_calls`, `avg_duration_sec`
- **Error cases**: 401 → invalid API key

---

### 30. Avanser
- **Enum**: `AVANSER`
- **Category**: CALL_TRACKING
- **Auth**: API Key (header `X-Api-Key`)
- **accessToken**: Avanser API key
- **externalAccountId**: Account ID
- **API**: `GET https://api.avanser.com.au/v2/calls?account_id={id}&date_from={from}&date_to={to}`
- **Metrics returned** (per call date):
  - `total_calls`, `answered_calls`, `missed_calls`, `avg_duration_sec`
- **Error cases**: 401 → invalid key

---

### 31. CallSource
- **Enum**: `CALLSOURCE`
- **Category**: CALL_TRACKING
- **Auth**: API Key + Account ID (Basic auth)
- **accessToken**: API key
- **externalAccountId**: CallSource Account ID
- **API**: `GET https://reporting.callsource.com/api/v1/calls?account={id}&start={from}&end={to}&format=json`
- **Metrics returned** (per call date):
  - `total_calls`, `sales_calls`, `service_calls`, `avg_duration_sec`
- **Error cases**: 401 → invalid credentials

---

### 32. Delacon
- **Enum**: `DELACON`
- **Category**: CALL_TRACKING
- **Auth**: API Key (query param)
- **accessToken**: Delacon API key
- **externalAccountId**: Delacon Client ID
- **API**: `GET https://app.delacon.com.au/api/v3/calls?client_id={id}&date_from={from}&date_to={to}&api_key={key}`
- **Metrics returned** (per call date):
  - `total_calls`, `answered_calls`, `missed_calls`, `avg_duration_sec`
- **Error cases**: 401 → invalid API key

---

### 33. WildJar
- **Enum**: `WILDJAR`
- **Category**: CALL_TRACKING
- **Auth**: API Key (Bearer)
- **accessToken**: WildJar API key
- **externalAccountId**: Account SID
- **API**: `GET https://api.wildjar.com/v1/calls?account_sid={sid}&start_date={from}&end_date={to}&limit=500`
- **Metrics returned** (per call date):
  - `total_calls`, `answered_calls`, `missed_calls`, `avg_duration_sec`, `transcribed_calls`
- **Error cases**: 401 → invalid key

---

## Group 5 — Local & Reputation Platforms (Phase 3.9)

---

### 34. Trustpilot
- **Enum**: `TRUSTPILOT`
- **Category**: LOCAL
- **Auth**: OAuth 2.0 (Bearer via `StandardTokenService`)
- **accessToken**: Trustpilot OAuth access token
- **externalAccountId**: Trustpilot Business Unit ID (e.g. `"5abc123def456"`)
- **API**: `GET https://api.trustpilot.com/v1/business-units/{businessUnitId}/reviews?startDateTime={from}T00:00:00Z&endDateTime={to}T23:59:59Z&perPage=100`
- **Metrics returned** (per review date):
  - `review_count`, `avg_rating`, `five_star`, `four_star`, `three_star`, `two_star`, `one_star`
- **Pagination**: `links.next` cursor
- **Error cases**: 401 → token expired; 404 → invalid business unit ID

---

### 35. Yelp
- **Enum**: `YELP`
- **Category**: LOCAL
- **Auth**: API Key (Bearer)
- **accessToken**: Yelp Fusion API key
- **externalAccountId**: Yelp Business ID (e.g. `"the-yellow-house-san-francisco"`)
- **API**: `GET https://api.yelp.com/v3/businesses/{businessId}` → snapshot
- **Metrics returned** (snapshot at `to`):
  - `review_count`, `avg_rating`
- **Note**: Yelp Fusion API does not expose per-day review history — snapshot only
- **Error cases**: 401 → invalid API key; 404 → invalid business ID

---

### 36. Birdeye
- **Enum**: `BIRDEYE`
- **Category**: LOCAL
- **Auth**: API Key (header `apiKey`)
- **accessToken**: Birdeye API key
- **externalAccountId**: Business ID (numeric)
- **API**: `GET https://api.birdeye.com/resources/v1/business/{id}/rating?startDate={from}&endDate={to}` and reviews endpoint
- **Metrics returned** (per date):
  - `review_count`, `avg_rating`, `new_reviews`, `responded_reviews`
- **Error cases**: 401 → invalid API key

---

### 37. GatherUp
- **Enum**: `GATHERUP`
- **Category**: LOCAL
- **Auth**: API Key (query param `api_key`)
- **accessToken**: GatherUp API key
- **externalAccountId**: Location ID
- **API**: `GET https://app.gatherup.com/api/v1/reviews?location_id={id}&api_key={key}&date_from={from}&date_to={to}`
- **Metrics returned** (per review date):
  - `review_count`, `avg_rating`, `request_sent_count`
- **Error cases**: 401 → invalid API key

---

### 38. Grade.us
- **Enum**: `GRADE_US`
- **Category**: LOCAL
- **Auth**: API Key (Bearer)
- **accessToken**: Grade.us API key
- **externalAccountId**: Location ID
- **API**: `GET https://grade.us/api/v1/reviews?location={id}&from={from}&to={to}`
- **Metrics returned** (per review date):
  - `review_count`, `avg_rating`, `positive_reviews`, `negative_reviews`
- **Error cases**: 401 → invalid key

---

### 39. Synup
- **Enum**: `SYNUP`
- **Category**: LOCAL
- **Auth**: API Key (header `Authorization: Bearer {key}`)
- **accessToken**: Synup API token
- **externalAccountId**: Location UID (UUID)
- **API**: `GET https://api.synup.com/api/v4.0/locations/{uid}/reviews?from={from}&to={to}`
- **Metrics returned** (per review date):
  - `review_count`, `avg_rating`, `new_reviews`
- **Error cases**: 401 → invalid token

---

### 40. Yext
- **Enum**: `YEXT`
- **Category**: LOCAL
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Yext OAuth access token
- **externalAccountId**: Yext Account ID
- **API**: `GET https://api.yext.com/v2/accounts/{accountId}/reviewsStats?dateFrom={from}&dateTo={to}&v=20231201`
- **Metrics returned** (per date):
  - `review_count`, `avg_rating`, `listing_sync_accuracy`
- **Error cases**: 401 → token expired; 403 → insufficient permissions

---

### 41. Vendasta
- **Enum**: `VENDASTA`
- **Category**: LOCAL
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Vendasta OAuth access token
- **externalAccountId**: Business Location ID (e.g. `"AG-XXXXXXXXXX"`)
- **API**: `GET https://reputation-intelligence.apigateway.vendasta.com/api/v4/reviews?businessId={id}&startDate={from}&endDate={to}`
- **Metrics returned** (per review date):
  - `review_count`, `avg_rating`, `positive_reviews`, `negative_reviews`
- **Error cases**: 401 → token expired

---

### 42. Google Business Profile
- **Enum**: `GOOGLE_BUSINESS_PROFILE`
- **Category**: LOCAL
- **Auth**: Google OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Google OAuth access token
- **externalAccountId**: GBP Location Name (e.g. `"accounts/12345/locations/67890"`)
- **API**: `GET https://mybusiness.googleapis.com/v4/{locationName}/reviews?pageSize=100`
- **Also**: `GET https://mybusinessbusinessinformation.googleapis.com/v1/{locationName}` for star rating
- **Metrics returned** (snapshot at `to`):
  - `review_count`, `avg_rating`, `new_reviews` (filtered by review createTime in date range)
- **Error cases**: 401 → token expired; 403 → Business Profile not verified

---

## Group 6 — PPC Platforms (Phase 3.10)

All PPC platforms use `StandardTokenService` for OAuth platforms, or `integrationsService.getDecryptedTokens()` for API-key platforms.

---

### 43. Microsoft Ads (Bing Ads)
- **Enum**: `MICROSOFT_ADS`
- **Category**: PPC
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Microsoft OAuth access token
- **externalAccountId**: Microsoft Ads Customer ID (numeric)
- **API**: Bing Ads API v13 — `POST https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/V13/ReportingService.svc/JSON/SubmitGenerateReport` → poll → download
- **Report type**: `CampaignPerformanceReport`, `DailyAggregation`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `avg_cpc`, `conversions`
- **Error cases**: 401 → token expired; AccountId not authorized → OperationError

---

### 44. Pinterest Ads
- **Enum**: `PINTEREST_ADS`
- **Category**: PPC
- **Auth**: OAuth 2.0 (Basic auth header at token endpoint, as per Pinterest OAuth spec)
- **accessToken**: Pinterest OAuth access token
- **externalAccountId**: Pinterest Ad Account ID (e.g. `"549755885175"`)
- **API**: `GET https://api.pinterest.com/v5/ad_accounts/{adAccountId}/analytics?start_date={from}&end_date={to}&columns=IMPRESSION_1,CLICK_1,SPEND_IN_DOLLAR,TOTAL_CONVERSIONS&granularity=DAY`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `conversions`
- **Error cases**: 401 → token expired

---

### 45. Snapchat Ads
- **Enum**: `SNAPCHAT_ADS`
- **Category**: PPC
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Snapchat OAuth access token
- **externalAccountId**: Snapchat Ad Account ID (UUID)
- **API**: `GET https://adsapi.snapchat.com/v1/adaccounts/{adAccountId}/stats?granularity=DAY&fields=impressions,swipes,spend&start_time={from}T00:00:00-07:00&end_time={to}T23:59:59-07:00`
- **Normalization**: `spend` is in micro-USD → divide by 1,000,000
- **Metrics returned** (per day): `impressions`, `swipes` (→ clicks), `spend`
- **Error cases**: 401 → token expired; 403 → ad account ID wrong

---

### 46. X Ads (Twitter Ads)
- **Enum**: `X_ADS`
- **Category**: PPC
- **Auth**: OAuth 1.0a / OAuth 2.0 PKCE (`StandardTokenService` — PKCE flow for X/Twitter)
- **accessToken**: X OAuth access token
- **externalAccountId**: X Ads Account ID (e.g. `"18ce55wxyz"`)
- **API**: `GET https://ads-api.twitter.com/12/stats/accounts/{accountId}?entity=ACCOUNT&granularity=DAY&metric_groups=ENGAGEMENT,BILLING&start_time={from}T00:00:00Z&end_time={to}T23:59:59Z`
- **Normalization**: `billed_charge_local_micro` → divide by 1,000,000
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `retweets`, `likes`
- **Error cases**: 401 → token expired

---

### 47. Reddit Ads
- **Enum**: `REDDIT_ADS`
- **Category**: PPC
- **Auth**: OAuth 2.0 (Basic auth header with client credentials, as per Reddit OAuth spec)
- **accessToken**: Reddit OAuth access token
- **externalAccountId**: Reddit Ad Account ID (e.g. `"t2_xxxxxxxx"`)
- **API**: `GET https://ads-api.reddit.com/api/v2.0/accounts/{accountId}/campaigns/stats?startDate={from}&endDate={to}&breakdown=day`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `conversions`
- **Error cases**: 401 → token expired

---

### 48. AdRoll
- **Enum**: `ADROLL`
- **Category**: PPC
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: AdRoll OAuth access token
- **externalAccountId**: AdRoll Advertiser EID (e.g. `"ABCDEFGHIJKLMNOPQRSTUVWXYZ1234"`)
- **API**: `GET https://services.adroll.com/reporting/api/v1/report/advertiser?date_start={from}&date_end={to}&currency=USD&rollup=false`
- **Header**: `Authorization: Bearer {token}`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `cpc`, `conversions`
- **Error cases**: 401 → token expired

---

### 49. Google Ad Manager
- **Enum**: `GOOGLE_AD_MANAGER`
- **Category**: PPC
- **Auth**: Google OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Google OAuth access token (requires `dfp_api` scope)
- **externalAccountId**: Ad Manager Network Code (e.g. `"12345678"`)
- **API**: Ad Manager API v202311 SOAP → `ReportService.runReportJob` (async) → `ReportService.getReportJobStatus` → `ReportService.getReportDownloadURL` → CSV download
- **Metrics returned** (per day): `impressions`, `clicks`, `total_line_item_level_revenue`, `ctr`
- **Error cases**: 401 → token expired; network not accessible → SOAP Fault

---

### 50. Google Display & Video 360 (DV360)
- **Enum**: `GOOGLE_DV360`
- **Category**: PPC
- **Auth**: Google OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Google OAuth access token (requires `doubleclickbidmanager` scope)
- **externalAccountId**: DV360 Advertiser ID (numeric)
- **API**: DV360 Reporting API v2 — `POST https://doubleclickbidmanager.googleapis.com/v2/queries` (async) → poll `GET /queries/{queryId}` → `GET /queries/{queryId}/reports` → download CSV
- **Metrics returned** (per day): `impressions`, `clicks`, `total_media_cost_partner_currency`, `conversions`
- **Error cases**: 401 → token expired

---

### 51. Google Local Services Ads (LSA)
- **Enum**: `GOOGLE_LOCAL_SERVICES_ADS`
- **Category**: PPC
- **Auth**: Google OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Google OAuth access token (requires `localservices` scope)
- **externalAccountId**: Google LSA Customer ID
- **API**: Local Services API — `GET https://localservices.googleapis.com/v1/accountReports:search?query=customerId={id}&startDate.year={Y}&startDate.month={M}&startDate.day={D}&endDate.year={Y}&endDate.month={M}&endDate.day={D}`
- **Metrics returned** (per day): `impressions`, `clicks`, `phone_calls`, `spend`, `avg_cost_per_lead`
- **Error cases**: 401 → token expired; customer ID not LSA-enrolled → 404

---

### 52. Instagram Ads
- **Enum**: `INSTAGRAM_ADS`
- **Category**: PPC
- **Auth**: Facebook OAuth (same as Meta Ads — shares `META_ADS` OAuth config, separate connection)
- **accessToken**: Facebook long-lived access token
- **externalAccountId**: Instagram-linked Ad Account ID (e.g. `"act_123456789"`)
- **API**: Meta Marketing API v19.0 — same as Meta Ads but filtered to `publisher_platform=instagram`
  - `GET https://graph.facebook.com/v19.0/{adAccountId}/insights?fields=impressions,clicks,spend,actions&publisher_platform=instagram&time_increment=1&time_range={since,until}`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `conversions`
- **Error cases**: 190 → token expired

---

### 53. Spotify Ads
- **Enum**: `SPOTIFY_ADS`
- **Category**: PPC
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Spotify OAuth access token (Ad Studio API)
- **externalAccountId**: Spotify Ad Account ID
- **API**: `GET https://api-partner.spotify.com/ads/v1/reporting/{adAccountId}?startDate={from}&endDate={to}&granularity=DAILY`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `frequency`, `reach`
- **Error cases**: 401 → token expired

---

### 54. StackAdapt
- **Enum**: `STACKADAPT`
- **Category**: PPC
- **Auth**: API Key (Bearer)
- **accessToken**: StackAdapt API key
- **externalAccountId**: Account ID or `'default'`
- **API**: `POST https://api.stackadapt.com/graphql` — GraphQL query for campaign stats with date filter
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `conversions`
- **Error cases**: 401 → invalid API key

---

### 55. Simplifi
- **Enum**: `SIMPLIFI`
- **Category**: PPC
- **Auth**: API Key (Bearer)
- **accessToken**: Simplifi API key
- **externalAccountId**: Organization ID
- **API**: `GET https://api.simpli.fi/api/organizations/{orgId}/campaigns/reports?date_range=custom&start_date={from}&end_date={to}`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `conversions`
- **Error cases**: 401 → invalid key

---

### 56. Choozle
- **Enum**: `CHOOZLE`
- **Category**: PPC
- **Auth**: API Key (header `X-Api-Key`)
- **accessToken**: Choozle API key
- **externalAccountId**: Company ID (numeric)
- **API**: `GET https://app.choozle.com/api/v1/campaigns/metrics?company_id={id}&start_date={from}&end_date={to}`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `conversions`
- **Error cases**: 401 → invalid API key

---

### 57. GroundTruth Ads
- **Enum**: `GROUNDTRUTH`
- **Category**: PPC
- **Auth**: API Key (Bearer)
- **accessToken**: GroundTruth API key
- **externalAccountId**: Advertiser ID
- **API**: `GET https://ads.groundtruth.com/api/v1/advertisers/{id}/campaigns/stats?start_date={from}&end_date={to}`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `visits`
- **Error cases**: 401 → invalid key

---

### 58. Basis (Centro)
- **Enum**: `BASIS_PLATFORM`
- **Category**: PPC
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Basis OAuth access token
- **externalAccountId**: Campaign Group ID
- **API**: `GET https://api.basis.net/v1/reporting/campaign-groups/{id}/summary?startDate={from}&endDate={to}&breakdown=day`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `conversions`
- **Error cases**: 401 → token expired

---

### 59. Yelp Ads
- **Enum**: `YELP_ADS`
- **Category**: PPC
- **Auth**: API Key (Bearer) — separate from Yelp Reputation key
- **accessToken**: Yelp Ads API key (Yelp Partner / Yelp Ads Manager)
- **externalAccountId**: Business ID
- **API**: `GET https://api.yelp.com/v3/businesses/{businessId}/ads/analytics?start_date={from}&end_date={to}`
- **Metrics returned** (per day): `impressions`, `clicks`, `spend`, `ctr`, `cpc`
- **Error cases**: 401 → invalid API key; 403 → not enrolled in Yelp Ads

---

## Group 7 — Social / Organic Platforms (Phase 3.11)

---

### 60. Facebook Organic (Page Insights)
- **Enum**: `FACEBOOK_ORGANIC`
- **Category**: SOCIAL
- **Auth**: Facebook OAuth 2.0 (`StandardTokenService`) — requires `pages_show_list` + `pages_read_engagement` scopes
- **accessToken**: Facebook access token (page token)
- **externalAccountId**: Facebook Page ID (e.g. `"123456789012345"`)
- **API**: Meta Graph API v19.0 — `GET https://graph.facebook.com/v19.0/{pageId}/insights?metric=page_impressions,page_reach,page_engaged_users,page_post_engagements&period=day&since={fromUnix}&until={toUnix}`
- **Metrics returned** (per day):
  - `impressions` (page_impressions)
  - `reach` (page_reach)
  - `engaged_users` (page_engaged_users)
  - `post_engagements` (page_post_engagements)
- **Note**: Only emits rows for days with non-zero values
- **Error cases**: 190 → token expired; 100 → page ID invalid; scope missing → OAuthException

---

### 61. Instagram Organic (Business Insights)
- **Enum**: `INSTAGRAM_ORGANIC`
- **Category**: SOCIAL
- **Auth**: Facebook OAuth 2.0 (`StandardTokenService`) — requires `instagram_basic` + `instagram_manage_insights` scopes
- **accessToken**: Facebook access token (linked Instagram Business account)
- **externalAccountId**: Instagram User/Business Account ID (numeric, e.g. `"17841412345678901"`)
- **API**: Meta Graph API v19.0 — `GET https://graph.facebook.com/v19.0/{igUserId}/insights?metric=impressions,reach,profile_views,follower_count&period=day&since={fromUnix}&until={toUnix}`
- **Metrics returned** (per day):
  - `impressions`, `reach`, `profile_views`, `new_followers` (follower_count delta)
- **Error cases**: 190 → token expired; page not linked to Instagram Business → 400

---

### 62. Pinterest Organic
- **Enum**: `PINTEREST_ORGANIC`
- **Category**: SOCIAL
- **Auth**: Pinterest OAuth 2.0 (same app as Pinterest Ads; separate connection)
- **accessToken**: Pinterest OAuth access token
- **externalAccountId**: `'default'` (account-level analytics)
- **API**: `GET https://api.pinterest.com/v5/user_account/analytics?start_date={from}&end_date={to}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK,ENGAGEMENT&granularity=DAY`
- **Metrics returned** (per day):
  - `impressions`, `saves`, `pin_clicks`, `outbound_clicks`, `engagements`
- **Error cases**: 401 → token expired

---

### 63. Vimeo
- **Enum**: `VIMEO`
- **Category**: SOCIAL
- **Auth**: OAuth 2.0 (`StandardTokenService`) — requires `stats` scope
- **accessToken**: Vimeo OAuth access token
- **externalAccountId**: `'default'` (account-level)
- **API**: `GET https://api.vimeo.com/me/videos?fields=uri,stats,created_time&per_page=100`
  - Paginates via `paging.next` until all videos fetched
  - **Only processes videos created within date range** (created_time filter)
  - Stats: `stats.plays`, `stats.likes`, `stats.comments`
- **Metrics returned** (snapshot aggregated at `recordedAt = dateRange.to`):
  - `total_plays` (sum of plays across all videos in range)
  - `total_likes`, `total_comments`
- **Note**: These are cumulative snapshot counts, not incremental daily data
- **Error cases**: 401 → token expired; scope missing → 403

---

### 64. X Organic (Twitter)
- **Enum**: `X_ORGANIC`
- **Category**: SOCIAL
- **Auth**: X OAuth 2.0 PKCE (`StandardTokenService` with PKCE + verifier in state JWT)
- **accessToken**: X OAuth 2.0 access token
- **externalAccountId**: X User ID (numeric string, e.g. `"1234567890"`)
- **API**: X API v2 — `GET https://api.twitter.com/2/users/{userId}/tweets?tweet.fields=public_metrics,created_at&start_time={from}T00:00:00Z&end_time={to}T23:59:59Z&max_results=100`
- **Metrics returned** (per tweet date — each tweet aggregated by day):
  - `impressions` (impression_count sum)
  - `likes` (like_count sum)
  - `retweets` (retweet_count sum)
  - `replies` (reply_count sum)
- **Pagination**: `next_token` loop
- **Error cases**: 401 → token expired; 403 → tweets access restricted

---

### 65. TikTok Organic (Creator/Login Kit)
- **Enum**: `TIKTOK_ORGANIC`
- **Category**: SOCIAL
- **Auth**: TikTok Login Kit OAuth (`StandardTokenService`) — separate from TikTok Ads Business API
- **accessToken**: TikTok Login Kit access token
- **externalAccountId**: `'default'` (account-level)
- **API**: `POST https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count`
  - Body: `{ "max_count": 20, "cursor": 0 }`
  - Client-side filters: videos where `create_time` (Unix) falls in `[from, to]` range
- **Metrics returned** (snapshot aggregated at `recordedAt = dateRange.to`):
  - `total_views`, `total_likes`, `total_comments`, `total_shares`
- **Pagination**: `cursor` + `has_more` loop
- **Note**: Snapshot aggregation — not per-day daily rows
- **Error cases**: invalid token → error code in JSON body

---

## Group 8 — Ecommerce Platforms (Phase 3.12)

---

### 66. Shopify
- **Enum**: `SHOPIFY`
- **Category**: ECOMMERCE
- **Auth**: Shopify OAuth (custom per-shop URL flow: `https://{shop}.myshopify.com/admin/oauth/authorize`)
- **accessToken**: Shopify permanent access token (no expiry after OAuth)
- **externalAccountId**: Shopify shop domain (e.g. `"mystore.myshopify.com"`)
- **API**: Admin REST API 2024-01 — `GET https://{shop}.myshopify.com/admin/api/2024-01/orders.json?status=closed&created_at_min={from}T00:00:00Z&created_at_max={to}T23:59:59Z&limit=250&fields=id,created_at,total_price,financial_status`
- **Filtering**: Skips orders with `financial_status = 'refunded'`
- **Metrics returned** (per order date):
  - `total_orders` (count), `total_revenue` (sum of `total_price`), `avg_order_value`
- **Pagination**: `Link` response header `<url>; rel="next"` cursor loop
- **Error cases**: 401 → access token revoked; 404 → shop not found

---

### 67. WooCommerce
- **Enum**: `WOOCOMMERCE`
- **Category**: ECOMMERCE
- **Auth**: Basic auth (consumer key : consumer secret; Base64 encoded in Authorization header)
- **accessToken**: Consumer secret
- **externalAccountId**: JSON `{ "siteUrl": "https://mystore.com", "consumerKey": "ck_abc123" }`
- **API**: WooCommerce REST API v3 — `GET {siteUrl}/wp-json/wc/v3/reports/sales?date_min={from}&date_max={to}`
- **Metrics returned** (aggregated per date):
  - `total_orders`, `total_revenue` (gross revenue), `net_revenue`, `avg_order_value`
- **Error cases**: 401/403 → invalid consumer key/secret; ENOTFOUND → bad siteUrl

---

### 68. BigCommerce
- **Enum**: `BIGCOMMERCE`
- **Category**: ECOMMERCE
- **Auth**: API Key (header `X-Auth-Token`)
- **accessToken**: BigCommerce Store API token
- **externalAccountId**: JSON `{ "storeHash": "abc123xyz" }`
- **API**: `GET https://api.bigcommerce.com/stores/{storeHash}/v2/orders?min_date_created={from}&max_date_created={to}&limit=250&status_id=10`
- **Filtering**: Skips orders with `status_id` 4 (cancelled), 5 (declined), or 14 (refunded)
- **Metrics returned** (per order date):
  - `total_orders`, `total_revenue` (sum subtotal_ex_tax), `avg_order_value`
- **Pagination**: `page` param incremented until response has < 250 orders
- **Error cases**: 401 → invalid token; 404 → invalid store hash

---

### 69. Stripe
- **Enum**: `STRIPE_ECOMMERCE`
- **Category**: ECOMMERCE
- **Auth**: API Key (Basic auth with `{secretKey}:` — empty password; Base64 encoded)
- **accessToken**: Stripe Secret Key (starts with `sk_live_` or `sk_test_`)
- **externalAccountId**: `'default'`
- **API**: `GET https://api.stripe.com/v1/charges?created[gte]={fromUnix}&created[lte]={toUnix}&limit=100&expand[]=data.balance_transaction`
- **Normalization**: Amounts in cents → divide by 100 for USD
- **Filtering**: Only `status = 'succeeded'` charges
- **Metrics returned** (per charge date):
  - `total_charges` (count), `total_revenue` (sum in USD), `avg_charge_value`
- **Pagination**: `starting_after = body.data.at(-1).id` cursor loop while `body.has_more`
- **Error cases**: 401 → invalid secret key

---

### 70. Keap (Infusionsoft)
- **Enum**: `KEAP`
- **Category**: ECOMMERCE
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Keap OAuth access token
- **externalAccountId**: `'default'`
- **API**: `GET https://api.infusionsoft.com/crm/rest/v1/orders?since={from}T00:00:00Z&until={to}T23:59:59Z&limit=200&offset=0`
- **Filtering**: Skips orders with `status` in `['Cancelled', 'Refunded']`
- **Metrics returned** (per order date):
  - `total_orders`, `total_revenue` (sum of `total`), `avg_order_value`
- **Pagination**: `offset` loop until count < limit
- **Error cases**: 401 → token expired

---

## Group 9 — Analytics / CRM / Database Platforms (Phase 3.13)

---

### 71. HubSpot
- **Enum**: `HUBSPOT`
- **Category**: ANALYTICS
- **Auth**: OAuth 2.0 (`StandardTokenService`) — requires `crm.objects.contacts.read` + `crm.objects.deals.read` scopes
- **accessToken**: HubSpot OAuth access token
- **externalAccountId**: `'default'` (portal ID resolved from token)
- **API**: HubSpot CRM API v3:
  1. `GET https://api.hubapi.com/crm/v3/objects/contacts?limit=1&createdAfter={from}T00:00:00Z&createdBefore={to}T23:59:59Z` → `paging.total` for new contact count
  2. `GET https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealstage,amount&createdAfter={from}T00:00:00Z&createdBefore={to}T23:59:59Z` → paginate, count deals, sum amount for `Closed Won` stage
- **Metrics returned** (snapshot at `to`):
  - `new_contacts`, `new_deals`, `deal_revenue` (USD, Closed Won only)
- **Pagination**: `paging.next.link` cursor loop for deals
- **Error cases**: 401/403 → token expired or missing scopes

---

### 72. Matomo
- **Enum**: `MATOMO`
- **Category**: ANALYTICS
- **Auth**: API token (query param `token_auth`) — 32-char MD5 hash from Matomo settings
- **accessToken**: Matomo API token
- **externalAccountId**: JSON `{ "matomoUrl": "https://analytics.example.com", "siteId": "1" }`
- **API**: `GET {matomoUrl}/?module=API&method=VisitsSummary.get&idSite={siteId}&period=range&date={from},{to}&format=JSON&token_auth={token}`
- **Metrics returned** (aggregated range, stored as snapshot at `to`):
  - `sessions` (nb_visits), `users` (nb_uniq_visitors), `pageviews` (nb_pageviews), `bounce_rate` (%), `avg_session_sec` (avg_time_on_site seconds)
- **Note**: Self-hosted Matomo — `matomoUrl` must be accessible from the backend server
- **Error cases**: 401 → invalid token; ENOTFOUND → bad matomoUrl

---

### 73. Salesforce
- **Enum**: `SALESFORCE`
- **Category**: ANALYTICS
- **Auth**: OAuth 2.0 (`StandardTokenService`) — requires `api` scope
- **accessToken**: Salesforce OAuth access token
- **externalAccountId**: Salesforce instance URL (e.g. `"https://mycompany.my.salesforce.com"`) — stored automatically at connect time from OAuth `instance_url` field
- **API**: Salesforce REST API v58.0 SOQL:
  1. `GET {instanceUrl}/services/data/v58.0/query?q=SELECT COUNT(Id) cnt FROM Lead WHERE CreatedDate >= {from}T00:00:00Z AND CreatedDate <= {to}T23:59:59Z`
  2. `GET {instanceUrl}/services/data/v58.0/query?q=SELECT COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE CloseDate >= {from} AND CloseDate <= {to} AND StageName = 'Closed Won'`
- **Metrics returned** (snapshot at `to`):
  - `new_leads`, `closed_deals`, `deal_revenue` (USD)
- **Error cases**: 401 → token expired; `instance_url` wrong → ENOTFOUND

---

### 74. SharpSpring
- **Enum**: `SHARPSPRING`
- **Category**: ANALYTICS
- **Auth**: API Key + Account ID (query params `accountID` + `secretKey` on every request)
- **accessToken**: SharpSpring `secretKey`
- **externalAccountId**: JSON `{ "accountID": "abc123xyz" }`
- **API**: JSON-RPC `POST https://api.sharpspring.com/pubapi/v1/?accountID={id}&secretKey={key}`
  1. Body: `{ method: "getLeads", params: { where: { createTimestamp: { op: "BETWEEN", value: from, valueTo: to } }, limit: 500 } }`
  2. Body: `{ method: "getOpportunities", params: { where: { createTimestamp: { op: "BETWEEN", value: from, valueTo: to } }, limit: 500 } }`
- **Metrics returned** (snapshot at `to`):
  - `new_leads` (count), `new_deals` (count), `deal_revenue` (sum of `dealValue`)
- **Error cases**: 401/403 → invalid credentials; JSON-RPC error body → `error.message` thrown

---

### 75. Gravity Forms
- **Enum**: `GRAVITY_FORMS`
- **Category**: ANALYTICS
- **Auth**: Basic auth (consumer key : consumer secret; Base64 encoded)
- **accessToken**: Consumer secret
- **externalAccountId**: JSON `{ "siteUrl": "https://mysite.com", "consumerKey": "ck_abc123", "formId": "1" }`
- **API**: `GET {siteUrl}/wp-json/gf/v2/forms/{formId}/entries?start_date={from}&end_date={to}&status=active&paging[page_size]=100`
- **Metrics returned** (per entry submission date):
  - `new_entries` (count for that date), `total_entries` (cumulative count in range)
- **Pagination**: `paging[current_page]` loop until `total_count` exhausted
- **Error cases**: 401/403 → invalid consumer key/secret; ENOTFOUND → bad siteUrl

---

### 76. Unbounce
- **Enum**: `UNBOUNCE`
- **Category**: ANALYTICS
- **Auth**: OAuth 2.0 (`StandardTokenService`)
- **accessToken**: Unbounce OAuth access token
- **externalAccountId**: Unbounce Account ID (e.g. `"ABC-123"`)
- **API**:
  1. `GET https://api.unbounce.com/accounts/{accountId}/pages?sort_by=created_at&sort_order=asc&page_size=100` — list all pages
  2. Per page: `GET /pages/{pageId}/leads?from={from}T00:00:00.000Z&to={to}T23:59:59.999Z&count=100` — lead count + visit count
- **Metrics returned** (aggregated per page-visit-date):
  - `page_visits`, `conversions` (leads), `conversion_rate` (%) — per page
- **Pagination**: `metadata.next` cursor
- **Error cases**: 401 → token expired

---

### 77. HighLevel (GoHighLevel)
- **Enum**: `HIGHLEVEL`
- **Category**: ANALYTICS
- **Auth**: OAuth 2.0 (`StandardTokenService`) — requires `contacts.readonly` + `opportunities.readonly` scopes
- **accessToken**: HighLevel OAuth access token
- **externalAccountId**: HighLevel Location ID (e.g. `"abc123xyz"`)
- **API**:
  1. `GET https://services.leadconnectorhq.com/contacts/?locationId={id}&startAfter={from}&startAfterDate={from}T00:00:00Z` with header `Version: 2021-07-28`
  2. `GET /opportunities/search?location_id={id}&startAfter={from}T00:00:00Z`
- **Metrics returned** (snapshot at `to`):
  - `new_contacts` (count), `new_opportunities` (count), `won_revenue` (sum of `monetaryValue` for `won` status)
- **Pagination**: `meta.nextPageUrl` cursor loop
- **Error cases**: 401 → token expired; locationId wrong → 422

---

### 78. Google Sheets
- **Enum**: `GOOGLE_SHEETS`
- **Category**: ANALYTICS
- **Auth**: Google OAuth 2.0 (`StandardTokenService`) — requires `spreadsheets.readonly` scope
- **accessToken**: Google OAuth access token
- **externalAccountId**: JSON `{ "spreadsheetId": "1BxiMVs0XRA...", "range": "Sheet1!A:C", "dateColumn": 0, "metricKeyColumn": 1, "valueColumn": 2 }`
  - `dateColumn`, `metricKeyColumn`, `valueColumn` are 0-indexed column positions
- **API**: `GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{encodedRange}`
- **Processing**: Skips header row (row 0). For each data row, filters `row[dateColumn]` against `[from, to]` range. Expects date in `YYYY-MM-DD` format. Normalizes `metricKey` to `lowercase_with_underscores`.
- **Metrics returned**: whatever column data is in the sheet — metric keys come from `metricKeyColumn`, one `MetricRowInput` per matching row
- **Error cases**: 401/403 → token expired or no sheet access; spreadsheetId invalid → 404

---

### 79. Google BigQuery
- **Enum**: `GOOGLE_BIGQUERY`
- **Category**: DATABASE
- **Auth**: Google OAuth 2.0 (`StandardTokenService`) — requires `bigquery.jobs.create` + `bigquery.jobs.get` permissions
- **accessToken**: Google OAuth access token
- **externalAccountId**: JSON `{ "projectId": "my-gcp-project", "query": "SELECT date, metric_key, value FROM \`dataset.table\` WHERE date BETWEEN '{from}' AND '{to}'" }`
  - `{from}` and `{to}` placeholders in query are replaced with date range values
- **API**: BigQuery Jobs API v2 (async job pattern):
  1. `POST https://bigquery.googleapis.com/bigquery/v2/projects/{projectId}/jobs` — insert async query job
  2. Poll `GET /projects/{projectId}/jobs/{jobId}?fields=status` until `status.state = 'DONE'` (max 30 × 2s = 60s)
  3. `GET /projects/{projectId}/queries/{jobId}?maxResults=1000` — fetch result rows
- **Query requirements**: Must return columns named exactly `date` (YYYY-MM-DD), `metric_key` (string), `value` (numeric)
- **Metrics returned**: whatever the query returns — `metricKey` from `metric_key` column, one row per result row
- **Error cases**: 401/403 → token expired or insufficient permissions; query error → `status.errorResult.message`

---

### 80. MySQL
- **Enum**: `MYSQL_DB`
- **Category**: DATABASE
- **Auth**: Direct database connection (username + password)
- **accessToken**: MySQL password
- **externalAccountId**: JSON `{ "host": "db.example.com", "port": 3306, "database": "analytics", "user": "readonly_user", "query": "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'" }`
- **Driver**: `mysql2/promise` — `createConnection()` per sync, destroyed immediately after query
- **SSL**: Enforced (`ssl: { rejectUnauthorized: false }`) — self-signed certs accepted
- **Connection timeout**: 10,000ms
- **Query processing**: `{from}` and `{to}` replaced in query template. Result rows must have columns `date`, `metric_key`, `value`.
- **Metrics returned**: per-row from query result — `metricKey` normalized to `lowercase_underscores`
- **Error cases**: Access denied → "MySQL: access denied"; ENOTFOUND/ETIMEDOUT → connection error message

---

### 81. Amazon Redshift
- **Enum**: `AMAZON_REDSHIFT`
- **Category**: DATABASE
- **Auth**: Direct database connection (PostgreSQL protocol on port 5439)
- **accessToken**: Redshift password
- **externalAccountId**: JSON `{ "host": "mycluster.xxxx.us-east-1.redshift.amazonaws.com", "port": 5439, "database": "analytics", "user": "readonly_user", "query": "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'" }`
- **Driver**: `pg` (node-postgres Client) — Redshift speaks PostgreSQL wire protocol
- **SSL**: `{ rejectUnauthorized: false }` — Redshift uses SSL by default, self-signed allowed
- **Connection timeout**: 10,000ms
- **Query processing**: Same `{from}` / `{to}` placeholder replacement. Result must have `date`, `metric_key`, `value` columns.
- **Metrics returned**: per-row from query result
- **Error cases**: auth failed → "Redshift: authentication failed"; ENOTFOUND/ETIMEDOUT → connection error; Redshift requires VPC security group allowing inbound on port 5439 from backend server IP

---

### 82. Snowflake
- **Enum**: `SNOWFLAKE`
- **Category**: DATABASE
- **Auth**: HTTP Basic auth (`{user}:{password}` Base64) to Snowflake SQL REST API v2
- **accessToken**: Snowflake password
- **externalAccountId**: JSON `{ "account": "myorg-myaccount", "user": "READONLY_USER", "database": "ANALYTICS_DB", "schema": "PUBLIC", "warehouse": "COMPUTE_WH", "query": "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'" }`
- **API**: Snowflake SQL REST API v2 (async statement execution):
  1. `POST https://{account}.snowflakecomputing.com/api/v2/statements` — submit SQL statement
  2. Poll `GET /api/v2/statements/{statementHandle}` until `status = 'success'` (max 30 × 2s = 60s)
  3. Extract rows from `resultSetMetaData.rowType` + `data` fields
- **Query requirements**: Must return columns named `DATE`, `METRIC_KEY`, `VALUE` (case-insensitive — uppercased during matching)
- **Parameters**: `TIMESTAMP_OUTPUT_FORMAT: 'YYYY-MM-DD'` set in statement submission
- **Metrics returned**: per row from result set
- **Error cases**: 401/403 → invalid credentials; status ≠ 'success' after polling → timeout error

---

## Testing Patterns

### Test: Successful sync
1. Create an `integration_connections` row for the campaign with valid credentials
2. `POST /sync/manual` with the platform enum and date range
3. Expect BullMQ job to process (status → COMPLETED)
4. Query `metric_values` table for `(campaign_id, platform, metric_key)` rows
5. Verify `recorded_at` values match the date range
6. Verify `integration_connections.status = 'CONNECTED'` and `last_synced_at` updated

### Test: Invalid credentials
1. Store deliberately wrong credentials
2. Trigger sync
3. Expect: `integration_connections.status = 'ERROR'` (or `'TOKEN_EXPIRED'` for OAuth)
4. Expect: `integration_connections.last_error` contains descriptive message
5. Expect: no new rows in `metric_values`

### Test: OAuth token refresh
1. Expire/clear the OAuth access token in the token store (or set `expiresAt` to the past)
2. Trigger sync
3. Expect: `StandardTokenService.getValidAccessToken()` calls the refresh endpoint
4. Expect: new token stored, sync completes successfully if refresh token is valid

### Test: Date range handling
- Time-series platforms (GA4, Google Ads, Meta Ads, etc.): expect one row per day in `metric_values`
- Snapshot platforms (Moz, SEMrush, Vimeo, TikTok Organic, CRM platforms): expect one row with `recorded_at = to` date
- All `MetricRowInput.recordedAt` values are `YYYY-MM-DD` format, sliced to 10 chars

### Test: Pagination
For high-volume platforms, test with a wide date range (90 days) to trigger multi-page requests:
- Shopify, WooCommerce, BigCommerce, Stripe: cursor/page pagination
- GA4, Google Ads: offset pagination
- HubSpot, Unbounce, Keap, HighLevel: `next_link` cursor

### Important: Metric key normalization
All `metricKey` values are lowercased + spaces replaced with `_` before storage. Exact metric keys to look for in `metric_values.metric_key` column are listed in each platform's "Metrics returned" section above.

---

## Platform Enum Reference

```
GA4, GOOGLE_ADS, META_ADS, GOOGLE_SEARCH_CONSOLE, YOUTUBE_ANALYTICS,
LINKEDIN_ADS, TIKTOK_ADS, AMAZON_ADS,
KLAVIYO, ACTIVECAMPAIGN, BREVO, MAILCHIMP, CAMPAIGN_MONITOR,
CONVERTKIT, DRIP, CONSTANT_CONTACT,
AHREFS, MOZ, SEMRUSH, MAJESTIC, SE_RANKING, BRIGHTLOCAL,
GOOGLE_PAGESPEED, BING_WEBMASTER,
CALLRAIL, CALLTRACKING_METRICS, WHATCONVERTS, TWILIO, MARCHEX,
AVANSER, CALLSOURCE, DELACON, WILDJAR,
TRUSTPILOT, YELP, BIRDEYE, GATHERUP, GRADE_US, SYNUP,
YEXT, VENDASTA, GOOGLE_BUSINESS_PROFILE,
MICROSOFT_ADS, PINTEREST_ADS, SNAPCHAT_ADS, X_ADS, REDDIT_ADS,
ADROLL, GOOGLE_AD_MANAGER, GOOGLE_DV360, GOOGLE_LOCAL_SERVICES_ADS,
INSTAGRAM_ADS, SPOTIFY_ADS, STACKADAPT, SIMPLIFI, CHOOZLE,
GROUNDTRUTH, BASIS_PLATFORM, YELP_ADS,
FACEBOOK_ORGANIC, INSTAGRAM_ORGANIC, PINTEREST_ORGANIC,
VIMEO, X_ORGANIC, TIKTOK_ORGANIC,
SHOPIFY, WOOCOMMERCE, BIGCOMMERCE, STRIPE_ECOMMERCE, KEAP,
HUBSPOT, MATOMO, SALESFORCE, SHARPSPRING, GRAVITY_FORMS,
UNBOUNCE, HIGHLEVEL, GOOGLE_SHEETS,
GOOGLE_BIGQUERY, MYSQL_DB, AMAZON_REDSHIFT, SNOWFLAKE
```

Total implemented: **82 platforms** (all with `isImplemented: true` in `PLATFORM_CATALOG`)
