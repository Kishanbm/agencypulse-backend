# Platform Credentials Guide

### 📊 Integration Progress Tracker
*Last Updated: April 30, 2026*

| Platform | Status | Handled? |
| :--- | :--- | :--- |
| **Google Ads** | ✅ **Connected** | Yes |
| **Google Analytics 4** | ✅ **Connected** | Yes |
| **Google Search Console** | ✅ **Connected** | Yes |
| **Google Business Profile** | ✅ **Connected** | Yes |
| **YouTube Analytics** | ✅ **Connected** | Yes |
| **Shopify** | ✅ **Connected** | Yes (via Custom App link) |
| **Mailchimp** | ✅ **Connected** | Yes |
| **HubSpot** | ✅ **Connected** | Yes |
| **ActiveCampaign** | ✅ **Connected** | Yes |
| **Klaviyo** | ✅ **Connected** | Yes |
| **ConvertKit (Kit)** | ✅ **Connected** | Yes |
| **Drip** | ✅ **Connected** | Yes |
| **Campaign Monitor** | ✅ **Connected** | Yes |
| **Brave** | ✅ **Connected** | Yes |
| **LinkedIn Ads** | ⏳ **In Review** | Waiting for LinkedIn approval (24h) |
| **Meta Ads (FB/IG)** | ⏳ **Pending** | Waiting for credentials from Lead |
| **X Ads** | ⏭️ **Skipped** | X "Something went wrong" OAuth error |
| **X (Twitter)** | ⏭️ **Skipped** | X "Something went wrong" OAuth error |
| **Reddit Ads** | ⏳ **Pending** | Troubleshooting network block |
| **Microsoft Ads** | ⏭️ **Skipped** | Requires Azure Signup / Credit Card |
| **Amazon Ads** | ⏭️ **Skipped** | User requested to skip |
| **Stripe** | ⏭️ **Skipped** | User requested to skip |
| **Pinterest Ads** | ❌ **Blocked** | Access denied by Pinterest |
| **Snapchat Ads** | ❌ **Blocked** | GSTIN requirement |
| **TikTok Ads** | ❌ **Blocked** | Restricted in India |

---

## Table of Contents

- [PPC / Paid Advertising](#ppc--paid-advertising)
  - [Google Ads](#google-ads)
  - [Meta Ads (Facebook & Instagram)](#meta-ads-facebook--instagram)
  - [LinkedIn Ads](#linkedin-ads)
  - [TikTok Ads](#tiktok-ads)
  - [Amazon Ads](#amazon-ads)
  - [Microsoft Ads (Bing)](#microsoft-ads-bing)
  - [Pinterest Ads](#pinterest-ads)
  - [Snapchat Ads](#snapchat-ads)
  - [X Ads (Twitter)](#x-ads-twitter)
  - [Reddit Ads](#reddit-ads)
  - [AdRoll](#adroll)
  - [Google Ad Manager](#google-ad-manager)
  - [Google DV360](#google-dv360)
  - [Google Local Services Ads](#google-local-services-ads)
  - [Instagram Ads](#instagram-ads)
  - [Spotify Ads](#spotify-ads)
  - [StackAdapt](#stackadapt)
  - [Simpli.fi](#simplifi)
  - [Choozle](#choozle)
  - [GroundTruth](#groundtruth)
  - [Basis Platform](#basis-platform)
  - [Yelp Ads](#yelp-ads)
- [SEO](#seo)
  - [Google Analytics 4 (GA4)](#google-analytics-4-ga4)
  - [Google Search Console](#google-search-console)
  - [Semrush](#semrush)
  - [Ahrefs](#ahrefs)
  - [Moz](#moz)
  - [SE Ranking](#se-ranking)
  - [Majestic SEO](#majestic-seo)
  - [Bing Webmaster Tools](#bing-webmaster-tools)
  - [Google Lighthouse](#google-lighthouse)
  - [Google PageSpeed Insights](#google-pagespeed-insights)
  - [Rank Tracker](#rank-tracker)
  - [Backlink Monitor](#backlink-monitor)
- [Social / Organic](#social--organic)
  - [Facebook (Organic)](#facebook-organic)
  - [Instagram (Organic)](#instagram-organic)
  - [YouTube Analytics](#youtube-analytics)
  - [Pinterest (Organic)](#pinterest-organic)
  - [X / Twitter (Organic)](#x--twitter-organic)
  - [TikTok (Organic)](#tiktok-organic)
  - [Vimeo](#vimeo)
- [Email Marketing](#email-marketing)
  - [Mailchimp](#mailchimp)
  - [Klaviyo](#klaviyo)
  - [ActiveCampaign](#activecampaign)
  - [Brevo (Sendinblue)](#brevo-sendinblue)
  - [Constant Contact](#constant-contact)
  - [Campaign Monitor](#campaign-monitor)
  - [ConvertKit (Kit)](#convertkit-kit)
  - [Drip](#drip)
- [Ecommerce](#ecommerce)
  - [Shopify](#shopify)
  - [WooCommerce](#woocommerce)
  - [BigCommerce](#bigcommerce)
  - [Stripe](#stripe)
  - [Keap](#keap)
- [Analytics & CRM](#analytics--crm)
  - [HubSpot](#hubspot)
  - [Matomo](#matomo)
  - [Salesforce](#salesforce)
  - [SharpSpring](#sharpspring)
  - [Gravity Forms](#gravity-forms)
  - [Unbounce](#unbounce)
  - [HighLevel](#highlevel)
  - [Google Sheets](#google-sheets)
- [Call Tracking](#call-tracking)
  - [CallRail](#callrail)
  - [CallTrackingMetrics](#calltrackingmetrics)
  - [Twilio](#twilio)
  - [WhatConverts](#whatconverts)
  - [Marchex](#marchex)
  - [Avanser](#avanser)
  - [CallSource](#callsource)
  - [Delacon](#delacon)
  - [WildJar](#wildjar)
- [Local & Reputation](#local--reputation)
  - [Google Business Profile](#google-business-profile)
  - [BrightLocal](#brightlocal)
  - [Trustpilot](#trustpilot)
  - [Yelp](#yelp)
  - [Birdeye](#birdeye)
  - [Yext](#yext)
  - [GatherUp](#gatherup)
  - [Grade.us](#gradeus)
  - [Synup](#synup)
  - [Vendasta](#vendasta)
- [Database / Warehouse](#database--warehouse)
  - [Google BigQuery](#google-bigquery)
  - [Amazon Redshift](#amazon-redshift)
  - [MySQL](#mysql)
  - [Snowflake](#snowflake)

---

## PPC / Paid Advertising

---

### Google Ads

**Auth type:** OAuth (Google)

**What you need:** A Google account that has access to the Google Ads account (as an admin or standard user).

**Steps:**

1. Go to [ads.google.com](https://ads.google.com) and sign in.
2. In the top-right corner, click the wrench icon → **Setup** → **API Center**.
   - If you don't see "API Center", you are not on a manager (MCC) account. Navigate to your MCC account first.
3. Note the **Customer ID** shown in the top-right (format: `XXX-XXX-XXXX`). You will need this.
4. When connecting in AgencyPulse, click **Connect** and complete the Google OAuth flow.
5. After authorizing, paste in the **Customer ID** when prompted.

**Permissions required:** The Google account must have at least "Standard" access to the Ads account.

**Note:** If you manage multiple accounts under a Google Ads Manager (MCC) account, authenticate with the MCC account and provide the child account's Customer ID.

**Troubleshooting:** If you see a "Bad Request" or "Validation Error" during the callback, ensure the backend allows `iss` and `scope` parameters, which Google often sends during the handshake.

---

### Meta Ads (Facebook & Instagram)

**Auth type:** OAuth (Facebook)

**What you need:** A Facebook account with Admin or Advertiser access to the Business Manager and the specific Ad Account.

**Steps:**

1. Go to [business.facebook.com](https://business.facebook.com) and sign in.
2. Navigate to **Business Settings** → **Ad Accounts** and confirm you can see the ad account you want to connect.
3. In AgencyPulse, click **Connect** on Meta Ads.
4. Complete the Facebook OAuth flow — when prompted for permissions, accept **all** requested permissions (ads_read, pages_read_engagement, etc.).
5. After authorization, you will be asked to select the **Ad Account** and optionally the **Facebook Page** to connect.

**Permissions required:** Advertiser or Admin role on the Ad Account.

**Note:** Instagram Ads data flows through the same Facebook OAuth connection — connecting Meta Ads also grants Instagram Ads data if the campaigns include Instagram placements.

---

### LinkedIn Ads

**Auth type:** OAuth (LinkedIn)

**What you need:** A LinkedIn account with Admin access to the LinkedIn Campaign Manager account.

**Steps:**

1. Go to [linkedin.com/campaignmanager](https://www.linkedin.com/campaignmanager) and sign in.
2. Confirm you can see the Ad Account you want to connect (you need Admin access, not just Report Viewer).
3. In AgencyPulse, click **Connect** on LinkedIn Ads.
4. Complete the LinkedIn OAuth flow and accept all requested permissions.
5. After authorization, select the **Ad Account** to connect.

**Permissions required:** Account Manager or Account Admin role in Campaign Manager.

---

### TikTok Ads

**Auth type:** OAuth (TikTok)

**What you need:** A TikTok for Business account with access to TikTok Ads Manager.

**Steps:**

1. Go to [ads.tiktok.com](https://ads.tiktok.com) and sign in.
2. Navigate to **Assets** → **Account Info** to find your **Advertiser ID**.
3. In AgencyPulse, click **Connect** on TikTok Ads.
4. Complete the TikTok OAuth flow.
5. After authorization, select the **Advertiser Account** to connect.

**Permissions required:** Operator or Admin access to the Advertiser account.

---

### Amazon Ads

**Auth type:** OAuth (Amazon)

**What you need:** An Amazon Advertising account (Seller Central, Vendor Central, or DSP account).

**Steps:**

1. Go to [advertising.amazon.com](https://advertising.amazon.com) and sign in.
2. Confirm you are an Admin on the advertising account.
3. In AgencyPulse, click **Connect** on Amazon Ads.
4. Complete the Amazon OAuth flow.
5. After authorization, select the **Profile** (ad account) to connect.

**Permissions required:** Admin access on the advertising profile.

---

### Microsoft Ads (Bing)

**Auth type:** OAuth (Microsoft)

**What you need:** A Microsoft account with access to the Microsoft Advertising account.

**Steps:**

1. Go to [ads.microsoft.com](https://ads.microsoft.com) and sign in.
2. Note your **Account ID** (shown in the top bar, format: a string of numbers).
3. In AgencyPulse, click **Connect** on Microsoft Ads.
4. Complete the Microsoft OAuth flow.
5. After authorization, select the **Account** to connect.

**Permissions required:** Super Admin or Standard User access on the account.

---

### Pinterest Ads

**Auth type:** OAuth (Pinterest)

**What you need:** A Pinterest Business account with Admin access to the Ad Account.

**Steps:**

1. Go to [ads.pinterest.com](https://ads.pinterest.com) and sign in.
2. Confirm you have Admin access to the ad account.
3. In AgencyPulse, click **Connect** on Pinterest Ads.
4. Complete the Pinterest OAuth flow and accept all requested permissions.
5. After authorization, select the **Ad Account** to connect.

**Permissions required:** Admin access on the Pinterest Business account.

**Note:** Pinterest is highly restrictive for new apps. You MUST have a public Privacy Policy URL and a terms-of-service page on your domain to pass the initial automated check.

---

### Snapchat Ads

**Auth type:** OAuth (Snapchat)

**What you need:** A Snapchat Business account with Admin access to Ads Manager.

**Steps:**

1. Go to [ads.snapchat.com](https://ads.snapchat.com) and sign in.
2. Navigate to **Business Details** to find your **Organization ID** and **Ad Account ID**.
3. In AgencyPulse, click **Connect** on Snapchat Ads.
4. Complete the Snapchat OAuth flow.
5. After authorization, select the **Ad Account** to connect.

**Permissions required:** Admin access on the Snapchat Ad Account.

**Note:** For users in India, Snapchat often requires a valid **GSTIN** to be provided in the Business Details before allowing API access or OAuth connections.

---

### X Ads (Twitter)

**Auth type:** OAuth (X/Twitter)

**What you need:** An X (Twitter) account with access to X Ads.

**Steps:**

1. Go to [ads.twitter.com](https://ads.twitter.com) and sign in with the X account that has Ads access.
2. Note your **Account ID** (visible in the URL after `/accounts/`).
3. In AgencyPulse, click **Connect** on X Ads.
4. Complete the X OAuth flow.
5. After authorization, select the **Ad Account** to connect.

**Permissions required:** Admin access on the X Ads account.

---

### Reddit Ads

**Auth type:** OAuth (Reddit)

**What you need:** A Reddit account with Admin access to the Reddit Ads account.

**Steps:**

1. Go to [ads.reddit.com](https://ads.reddit.com) and sign in.
2. Navigate to **Account** → note your **Account ID**.
3. In AgencyPulse, click **Connect** on Reddit Ads.
4. Complete the Reddit OAuth flow.
5. After authorization, select the **Ad Account** to connect.

**Permissions required:** Admin access on the Reddit Ads account.

---

### AdRoll

**Auth type:** OAuth

**What you need:** An AdRoll account with access to the advertiser profile.

**Steps:**

1. Go to [app.adroll.com](https://app.adroll.com) and sign in.
2. Navigate to **Settings** → **User Settings** to confirm you have Admin access.
3. In AgencyPulse, click **Connect** on AdRoll.
4. Complete the AdRoll OAuth flow.
5. Select the **Advertiser** to connect.

---

### Google Ad Manager

**Auth type:** OAuth (Google)

**What you need:** A Google account with access to a Google Ad Manager network.

**Steps:**

1. Go to [admanager.google.com](https://admanager.google.com) and sign in.
2. Navigate to **Admin** → **Network Settings** and note your **Network Code** (a number like `12345678`).
3. In AgencyPulse, click **Connect** on Google Ad Manager.
4. Complete the Google OAuth flow.
5. Enter your **Network Code** when prompted.

**Permissions required:** Administrator or Report Analyst access on the network.

---

### Google DV360

**Auth type:** OAuth (Google)

**What you need:** A Google account with access to Display & Video 360.

**Steps:**

1. Go to [displayvideo.google.com](https://displayvideo.google.com) and sign in.
2. Navigate to **Settings** → **Account** and note your **Partner ID** and **Advertiser ID**.
3. In AgencyPulse, click **Connect** on Google DV360.
4. Complete the Google OAuth flow.
5. Enter your **Partner ID** and **Advertiser ID** when prompted.

**Permissions required:** Admin or Reporter access on the DV360 partner.

---

### Google Local Services Ads

**Auth type:** OAuth (Google)

**What you need:** A Google account that manages Local Services Ads.

**Steps:**

1. Go to [ads.google.com/local-services-ads](https://ads.google.com/local-services-ads) and sign in.
2. Confirm you have Admin access to the Local Services account.
3. In AgencyPulse, click **Connect** on Google Local Services Ads.
4. Complete the Google OAuth flow — the same flow as Google Ads.
5. The correct account will be automatically detected.

---

### Instagram Ads

**Auth type:** OAuth (Facebook)

**What you need:** Same as Meta Ads — a Facebook account with Advertiser access and the Instagram account linked to the Business Manager.

**Steps:**

1. Ensure your Instagram Business account is connected to a Facebook Page in **Business Settings** → **Accounts** → **Instagram Accounts**.
2. In AgencyPulse, click **Connect** on Instagram Ads.
3. Complete the Facebook OAuth flow (same as Meta Ads).
4. Select the **Ad Account** and **Instagram Account** when prompted.

**Note:** Instagram Ads data is served via the Meta Marketing API. The OAuth flow is identical to Meta Ads.

---

### Spotify Ads

**Auth type:** OAuth (Spotify)

**What you need:** A Spotify for Podcasters or Spotify Ads Studio account.

**Steps:**

1. Go to [adstudio.spotify.com](https://adstudio.spotify.com) and sign in.
2. Navigate to **Account Settings** to find your **Account ID**.
3. In AgencyPulse, click **Connect** on Spotify Ads.
4. Complete the Spotify OAuth flow.
5. Select the **Ad Account** to connect.

---

### StackAdapt

**Auth type:** API Key

**What you need:** A StackAdapt account with API access enabled.

**Steps:**

1. Log in to [app.stackadapt.com](https://app.stackadapt.com).
2. Click your profile avatar in the top-right → **Account Settings**.
3. In the left menu, click **API** (or navigate to the **Integrations** section).
4. Click **Generate API Key** (or copy the existing key if already generated).
5. Copy the API key.
6. In AgencyPulse, paste the API key when prompted.

**Note:** If you don't see the API section, ask your StackAdapt account manager to enable API access — it may need to be unlocked at the account level.

---

### Simpli.fi

**Auth type:** API Key

**What you need:** A Simpli.fi account with API access.

**Steps:**

1. Log in to [app.simpli.fi](https://app.simpli.fi).
2. Navigate to **Settings** → **API Access** or contact your Simpli.fi account manager to request API credentials.
3. You will receive an **API Key** and possibly an **Organization ID**.
4. In AgencyPulse, paste the API key when prompted.

**Note:** Simpli.fi API access is typically granted on request — if you don't see an API section, email their support at support@simpli.fi.

---

### Choozle

**Auth type:** API Key

**What you need:** A Choozle account with API access.

**Steps:**

1. Log in to [app.choozle.com](https://app.choozle.com).
2. Navigate to **Account** → **API Access** in your account settings.
3. Generate or copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

---

### GroundTruth

**Auth type:** API Key

**What you need:** A GroundTruth Ads Manager account.

**Steps:**

1. Log in to your GroundTruth Ads Manager account.
2. Navigate to **Account Settings** → **API Credentials**.
3. Generate or copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

**Note:** If you don't have API access, contact your GroundTruth account manager or reach out at [groundtruth.com/contact](https://groundtruth.com/contact).

---

### Basis Platform

**Auth type:** API Key

**What you need:** A Basis (formerly Centro) account with API access.

**Steps:**

1. Log in to your Basis Platform account at [basis.com](https://basis.com).
2. Navigate to **Settings** → **API Tokens**.
3. Click **Create Token** and name it (e.g., "AgencyPulse").
4. Copy the generated token — you will only see it once.
5. In AgencyPulse, paste the token when prompted.

**Note:** API access may require a specific plan or may need to be enabled by your Basis account representative.

---

### Yelp Ads

**Auth type:** API Key

**What you need:** A Yelp Fusion API key (Yelp's public API for business data).

**Steps:**

1. Go to [fusion.yelp.com](https://fusion.yelp.com) and sign in with your Yelp account.
2. Click **Create App**.
3. Fill in the app name, industry, contact email, and description (e.g., "AgencyPulse analytics integration").
4. Accept the Yelp API Terms of Use and click **Submit**.
5. Your **API Key** will be displayed on the app page.
6. Copy the API key.
7. In AgencyPulse, paste the API key when prompted.

---

## SEO

---

### Google Analytics 4 (GA4)

**Auth type:** OAuth (Google)

**What you need:** A Google account with at least Viewer access to the GA4 property.

**Steps:**

1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Navigate to **Admin** (gear icon at the bottom-left).
3. Under **Property**, click **Property Settings** and note the **Property ID** (format: `G-XXXXXXXXXX` or a numeric ID like `123456789`).
4. In AgencyPulse, click **Connect** on Google Analytics 4.
5. Complete the Google OAuth flow.
6. After authorization, select the **GA4 Property** to connect from the dropdown.

**Permissions required:** Viewer access or higher on the GA4 property.

---

### Google Search Console

**Auth type:** OAuth (Google)

**What you need:** A Google account with at least Restricted User access to the Search Console property.

**Steps:**

1. Go to [search.google.com/search-console](https://search.google.com/search-console) and sign in.
2. Select the property you want to connect.
3. Navigate to **Settings** → **Users and permissions** — confirm your account has at minimum "Restricted" access (Full access recommended for complete data).
4. In AgencyPulse, click **Connect** on Google Search Console.
5. Complete the Google OAuth flow.
6. After authorization, select the **Property** (domain or URL prefix) to connect.

**Permissions required:** Restricted User or Full User access on the property.

---

### Semrush

**Auth type:** API Key

**What you need:** A Semrush account (Guru plan or above recommended for full API access).

**Steps:**

1. Log in to [semrush.com](https://www.semrush.com).
2. Click your avatar in the top-right → **Profile**.
3. Navigate to the **API** tab (or go to **Subscription Info** → **API**).
4. Your **API Key** is displayed here. Copy it.
5. In AgencyPulse, paste the API key when prompted.

**Note:** Free Semrush accounts have limited API credits. Pro plans get 3,000 requests/day; Guru and Business plans get more.

---

### Ahrefs

**Auth type:** API Key

**What you need:** An Ahrefs account on a paid plan (Standard, Advanced, or Agency).

**Steps:**

1. Log in to [ahrefs.com](https://ahrefs.com).
2. Navigate to the top-right menu → **Account Settings**.
3. In the left sidebar, click **API Keys** (or go to [ahrefs.com/api](https://ahrefs.com/api)).
4. Click **Generate API Key**, give it a name (e.g., "AgencyPulse"), and set appropriate permissions (read-only is sufficient).
5. Copy the generated key.
6. In AgencyPulse, paste the API key when prompted.

**Note:** API access is available from the Standard plan. Agency plans get higher API unit limits.

---

### Moz

**Auth type:** API Key

**What you need:** A Moz account (free tier provides limited API access; Medium or Large plan recommended for reporting).

**Steps:**

1. Log in to [moz.com](https://moz.com).
2. Go to [moz.com/products/api/keys](https://moz.com/products/api/keys) or navigate to **Account** → **API Access**.
3. You will see your **Access ID** and **Secret Key**.
4. Copy both the Access ID and Secret Key.
5. In AgencyPulse, paste both values when prompted.

---

### SE Ranking

**Auth type:** API Key

**What you need:** An SE Ranking account on a paid plan.

**Steps:**

1. Log in to [seranking.com](https://seranking.com).
2. Click your profile avatar in the top-right → **Profile Settings**.
3. Navigate to the **API** tab.
4. Your **API Key** is displayed here. Copy it.
5. In AgencyPulse, paste the API key when prompted.

**Note:** API access is only available on paid plans.

---

### Majestic SEO

**Auth type:** API Key

**What you need:** A Majestic account (API access from Lite plan and above).

**Steps:**

1. Log in to [majestic.com](https://majestic.com).
2. Click your account name in the top-right → **Account Settings**.
3. Navigate to the **API Keys** section.
4. Click **Create New API Key**, name it (e.g., "AgencyPulse"), and select **Read** permissions.
5. Copy the generated key.
6. In AgencyPulse, paste the API key when prompted.

---

### Bing Webmaster Tools

**Auth type:** OAuth (Microsoft)

**What you need:** A Microsoft account with verified sites in Bing Webmaster Tools.

**Steps:**

1. Go to [bing.com/webmasters](https://www.bing.com/webmasters) and sign in with your Microsoft account.
2. Confirm your site is verified and you can see data for it.
3. In AgencyPulse, click **Connect** on Bing Webmaster Tools.
4. Complete the Microsoft OAuth flow (same as Microsoft Ads).
5. After authorization, select the **Site** to connect.

---

### Google Lighthouse

**Auth type:** No auth required

**What you need:** A publicly accessible URL and a Google PageSpeed Insights API key (optional, for higher rate limits).

**Steps:**

1. Google Lighthouse data is retrieved via the Google PageSpeed Insights API.
2. For basic use, no API key is needed — the API allows unauthenticated requests at a rate of 1 request / 1 second.
3. For higher volume: go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials** → **Create Credentials** → **API Key** → enable the **PageSpeed Insights API**.
4. In AgencyPulse, enter the **URL** you want to audit and optionally the API key.

---

### Google PageSpeed Insights

**Auth type:** API Key (optional for higher rate limits)

**What you need:** A Google Cloud project with PageSpeed Insights API enabled.

**Steps:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Select or create a project.
3. In the left menu, go to **APIs & Services** → **Library**.
4. Search for **PageSpeed Insights API** and click **Enable**.
5. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**.
6. Copy the key. Optionally restrict it to the PageSpeed Insights API only.
7. In AgencyPulse, paste the API key when prompted.

---

### Rank Tracker

**Auth type:** API Key

**What you need:** A Rank Tracker account (ranktracker.com) on a paid plan.

**Steps:**

1. Log in to [app.ranktracker.com](https://app.ranktracker.com).
2. Navigate to **Account Settings** → **API**.
3. Copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

---

### Backlink Monitor

**Auth type:** API Key

**What you need:** A Backlink Monitor account.

**Steps:**

1. Log in to your Backlink Monitor account.
2. Navigate to **Settings** → **API Access**.
3. Generate and copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

---

## Social / Organic

---

### Facebook (Organic)

**Auth type:** OAuth (Facebook)

**What you need:** A Facebook account with Admin or Editor access to the Facebook Page.

**Steps:**

1. Go to [facebook.com](https://www.facebook.com) and ensure you are an Admin or Editor of the Page you want to connect.
2. In AgencyPulse, click **Connect** on Facebook.
3. Complete the Facebook OAuth flow — accept all permissions including `pages_read_engagement` and `pages_show_list`.
4. After authorization, select the **Facebook Page** to connect.

**Permissions required:** Admin or Editor access on the Page.

---

### Instagram (Organic)

**Auth type:** OAuth (Facebook)

**What you need:** An Instagram Business or Creator account connected to a Facebook Page.

**Steps:**

1. Ensure your Instagram account is an **Instagram Business** or **Instagram Creator** account (not a personal account).
2. In the Instagram app, go to **Settings** → **Account** → **Switch to Professional Account** if not already done.
3. Link your Instagram account to a Facebook Page: go to [business.facebook.com](https://business.facebook.com) → **Business Settings** → **Accounts** → **Instagram Accounts** → **Add**.
4. In AgencyPulse, click **Connect** on Instagram.
5. Complete the Facebook OAuth flow.
6. After authorization, select the **Instagram Account** to connect.

---

### YouTube Analytics

**Auth type:** OAuth (Google)

**What you need:** A Google account with Owner or Manager access to the YouTube channel.

**Steps:**

1. Go to [studio.youtube.com](https://studio.youtube.com) and sign in with the Google account that owns or manages the channel.
2. Confirm the channel is visible in the studio.
3. In AgencyPulse, click **Connect** on YouTube.
4. Complete the Google OAuth flow.
5. After authorization, the channel connected to your Google account will be linked automatically.

**Permissions required:** Channel owner or channel manager (via Brand Account).

---

### Pinterest (Organic)

**Auth type:** OAuth (Pinterest)

**What you need:** A Pinterest Business account.

**Steps:**

1. Go to [pinterest.com](https://pinterest.com) and ensure your account is a **Pinterest Business** account (not personal).
2. To convert: **Settings** → **Account Settings** → **Convert to Business**.
3. In AgencyPulse, click **Connect** on Pinterest.
4. Complete the Pinterest OAuth flow.
5. After authorization, the account is linked automatically.

---

### X / Twitter (Organic)

**Auth type:** OAuth (X)

**What you need:** An X (Twitter) account.

**Steps:**

1. Log in to [x.com](https://x.com) with the account you want to connect.
2. In AgencyPulse, click **Connect** on X (Twitter).
3. Complete the X OAuth flow.
4. After authorization, the account is linked automatically.

**Note:** X Basic API (free tier) provides limited analytics data. For full metrics history, an X Developer account with Elevated access is recommended.

---

### TikTok (Organic)

**Auth type:** OAuth (TikTok)

**What you need:** A TikTok Business account.

**Steps:**

1. Ensure your TikTok account is a **TikTok Business** or **Creator** account.
2. To convert: TikTok app → **Profile** → **Settings** → **Manage Account** → **Switch to Business Account**.
3. In AgencyPulse, click **Connect** on TikTok.
4. Complete the TikTok OAuth flow.
5. After authorization, the account is linked automatically.

---

### Vimeo

**Auth type:** OAuth (Vimeo)

**What you need:** A Vimeo account (Plus, Pro, Business, or Premium — free accounts don't get full analytics API access).

**Steps:**

1. Go to [vimeo.com](https://vimeo.com) and sign in.
2. Confirm you are the owner of the Vimeo account/channel you want to connect.
3. In AgencyPulse, click **Connect** on Vimeo.
4. Complete the Vimeo OAuth flow.
5. After authorization, the account is linked automatically.

---

## Email Marketing

---

### Mailchimp

**Auth type:** OAuth (Mailchimp)

**What you need:** A Mailchimp account with Admin access.

**Steps:**

1. Go to [mailchimp.com](https://mailchimp.com) and sign in.
2. Confirm you have Admin access to the account (not just a member).
3. In AgencyPulse, click **Connect** on Mailchimp.
4. Complete the Mailchimp OAuth flow.
5. After authorization, the account is linked automatically.

---

### Klaviyo

**Auth type:** API Key

**What you need:** A Klaviyo account with API access.

**Steps:**

1. Log in to [klaviyo.com](https://www.klaviyo.com).
2. Click your account name in the bottom-left → **Settings**.
3. In the left sidebar, click **API Keys**.
4. Click **Create Private API Key**.
5. Give it a name (e.g., "AgencyPulse") and set the scope:
   - Select **Read-only** for: Campaigns, Flows, Lists, Metrics, Profiles.
6. Click **Create** and copy the key — you won't be able to see it again.
7. In AgencyPulse, paste the API key when prompted.

**Note:** Klaviyo uses **Private API Keys** for server-to-server access. Never use Public Keys here.

---

### ActiveCampaign

**Auth type:** API Key

**What you need:** An ActiveCampaign account (any paid plan).

**Steps:**

1. Log in to your ActiveCampaign account.
2. Go to **Settings** (gear icon at the bottom-left) → **Developer**.
3. Your **API URL** (e.g., `https://youraccountname.api-us1.com`) and **API Key** are displayed here.
4. Copy both the **API URL** and **API Key**.
5. In AgencyPulse, paste both values when prompted.

---

### Brevo (Sendinblue)

**Auth type:** API Key

**What you need:** A Brevo account (free accounts have API access but with limits).

**Steps:**

1. Log in to [brevo.com](https://www.brevo.com) (formerly Sendinblue).
2. Click your account name in the top-right → **SMTP & API**.
3. Click the **API Keys** tab.
4. Click **Generate a new API key**, name it (e.g., "AgencyPulse"), and click **Generate**.
5. Copy the key — you won't be able to see it again after closing the dialog.
6. In AgencyPulse, paste the API key when prompted.

---

### Constant Contact

**Auth type:** OAuth

**What you need:** A Constant Contact account with Admin access.

**Steps:**

1. Go to [constantcontact.com](https://www.constantcontact.com) and sign in.
2. In AgencyPulse, click **Connect** on Constant Contact.
3. Complete the OAuth flow.
4. After authorization, the account is linked automatically.

---

### Campaign Monitor

**Auth type:** API Key

**What you need:** A Campaign Monitor account (any plan).

**Steps:**

1. Log in to [campaignmonitor.com](https://www.campaignmonitor.com).
2. Click your name in the top-right → **Account Settings**.
3. In the left sidebar, click **API Keys**.
4. Click **Generate API Key** and copy the key.
5. You will also need your **Client ID** for client-level data — go to the specific client's page and note the ID from the URL.
6. In AgencyPulse, paste the API key and Client ID when prompted.

---

### ConvertKit (Kit)

**Auth type:** API Key

**What you need:** A ConvertKit (now Kit) account.

**Steps:**

1. Log in to [app.convertkit.com](https://app.convertkit.com).
2. Click your avatar in the top-right → **Settings**.
3. In the left sidebar, click **Advanced**.
4. Your **API Key** and **API Secret** are displayed here.
5. Copy both values.
6. In AgencyPulse, paste the API key (and secret if requested) when prompted.

---

### Drip

**Auth type:** API Key

**What you need:** A Drip account.

**Steps:**

1. Log in to [drip.com](https://www.drip.com).
2. Click your account name in the top-right → **User Settings** (not Account Settings).
3. Navigate to the **API** section.
4. Your **API Token** is displayed here. Copy it.
5. You will also need your **Account ID** — it's visible in the URL when viewing your account: `app.getdrip.com/ACCOUNT_ID/...`
6. In AgencyPulse, paste the API token and Account ID when prompted.

---

## Ecommerce

---

### Shopify

**Auth type:** OAuth (Shopify)

**What you need:** A Shopify account (Owner or Staff with Reports permission).

**Steps:**

1. Log in to your Shopify admin at `your-store.myshopify.com/admin`.
2. Confirm you have **Reports** and **Orders** access.
3. In AgencyPulse, click **Connect** on Shopify.
4. Complete the Shopify OAuth flow — you will be prompted to install AgencyPulse as an app on your store.
5. After authorization, your store is linked automatically.

**Permissions required:** Owner or a Staff account with Analytics, Orders, and Products access.

**Developer Note (Test Stores):** If you are connecting a development store, do NOT select "Public Distribution" in the Shopify Partner Dashboard as it requires a multi-day manual review. Instead, select **"Custom Distribution"**, enter your store handle, and use the generated **"Custom Install Link"** to connect instantly.

---

### WooCommerce

**Auth type:** API Key (Consumer Key + Secret)

**What you need:** WordPress Admin access to the WooCommerce store.

**Steps:**

1. Log in to your WordPress admin at `yourstore.com/wp-admin`.
2. Go to **WooCommerce** → **Settings** → **Advanced** → **REST API**.
3. Click **Add Key**.
4. Set:
   - **Description:** AgencyPulse
   - **User:** Select yourself or an admin user
   - **Permissions:** Read
5. Click **Generate API Key**.
6. Copy the **Consumer Key** and **Consumer Secret** — you won't see the secret again after leaving this page.
7. Also note your store's **base URL** (e.g., `https://yourstore.com`).
8. In AgencyPulse, paste the Consumer Key, Consumer Secret, and store URL when prompted.

---

### BigCommerce

**Auth type:** API Key

**What you need:** A BigCommerce account with API access.

**Steps:**

1. Log in to your BigCommerce store admin.
2. Go to **Advanced Settings** → **API Accounts** → **Create API Account** → **Create V2/V3 API Token**.
3. Set:
   - **Name:** AgencyPulse
   - **Scope:** Set all relevant scopes to **Read-Only** (Catalog, Orders, Customers, Marketing, Analytics).
4. Click **Save**.
5. Copy the **Client ID**, **Client Secret**, and **Access Token** — the access token is shown only once.
6. Also note your **Store Hash** from the URL (format: `store-XXXXXXXX`).
7. In AgencyPulse, paste the Access Token and Store Hash when prompted.

---

### Stripe

**Auth type:** API Key (Secret Key or Restricted Key)

**What you need:** A Stripe account.

**Steps:**

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com).
2. In the left sidebar, go to **Developers** → **API Keys**.
3. It is recommended to create a **Restricted Key** instead of using the Secret Key:
   - Click **Create restricted key**.
   - Name it "AgencyPulse".
   - Set permissions to **Read** for: Balance, Charges, Customers, Payment Intents, Refunds, Subscriptions.
4. Click **Create key** and copy the restricted key.
5. In AgencyPulse, paste the API key when prompted.

**Important:** Never use your **Publishable Key** here — always use a Secret or Restricted Key.

---

### Keap

**Auth type:** OAuth

**What you need:** A Keap account (formerly Infusionsoft) with Admin access.

**Steps:**

1. Go to [keap.com](https://keap.com) and sign in.
2. In AgencyPulse, click **Connect** on Keap.
3. Complete the Keap OAuth flow.
4. After authorization, select the **Account** to connect.

---

## Analytics & CRM

---

### HubSpot

**Auth type:** OAuth (HubSpot)

**What you need:** A HubSpot account with Super Admin access.

**Steps:**

1. Log in to [app.hubspot.com](https://app.hubspot.com).
2. Confirm you are a Super Admin or have Reports access.
3. In AgencyPulse, click **Connect** on HubSpot.
4. Complete the HubSpot OAuth flow — accept all requested scopes.
5. After authorization, select the **HubSpot Account (portal)** to connect.

---

### Matomo

**Auth type:** API Key (Auth Token)

**What you need:** Access to a Matomo instance (self-hosted or Matomo Cloud).

**Steps:**

1. Log in to your Matomo instance.
2. Go to **Administration** (top-right cogwheel) → **Personal** → **Security** → **Auth tokens**.
3. Click **Create new token**.
4. Give it a description (e.g., "AgencyPulse") and click **Confirm password** to generate.
5. Copy the token.
6. Also note your Matomo **instance URL** (e.g., `https://analytics.yoursite.com`) and **Site ID** (visible in the URL when viewing a site: `idSite=X`).
7. In AgencyPulse, paste the token, instance URL, and Site ID when prompted.

---

### Salesforce

**Auth type:** OAuth (Salesforce)

**What you need:** A Salesforce account with API access (Enterprise or Unlimited edition).

**Steps:**

1. Log in to [login.salesforce.com](https://login.salesforce.com).
2. Confirm your user profile has **API Enabled** permission:
   - Go to **Setup** → **Users** → find your user → check the Profile → ensure **API Enabled** is checked.
3. In AgencyPulse, click **Connect** on Salesforce.
4. Complete the Salesforce OAuth flow.
5. After authorization, the account is linked automatically.

**Note:** API access is only available on Enterprise, Unlimited, and Developer editions. Professional edition requires an add-on.

---

### SharpSpring

**Auth type:** API Key (Account ID + Secret Key)

**What you need:** A SharpSpring account with Admin access.

**Steps:**

1. Log in to [sharpspring.com](https://sharpspring.com).
2. Navigate to **Settings** → **API Settings**.
3. Your **Account ID** and **Secret Key** are shown here.
4. Copy both values.
5. In AgencyPulse, paste both the Account ID and Secret Key when prompted.

---

### Gravity Forms

**Auth type:** API Key (Consumer Key + Consumer Secret)

**What you need:** WordPress Admin access with Gravity Forms installed.

**Steps:**

1. Log in to your WordPress admin.
2. Go to **Forms** → **Settings** → **REST API**.
3. Make sure the **Enable access to the API** checkbox is enabled.
4. Click **Add Key**.
5. Set:
   - **Description:** AgencyPulse
   - **User:** An admin user
   - **Permissions:** Read
6. Click **Update Key** and copy the **Consumer Key** and **Consumer Secret**.
7. Also note your site's **base URL**.
8. In AgencyPulse, paste the keys and site URL when prompted.

---

### Unbounce

**Auth type:** OAuth

**What you need:** An Unbounce account with access to the pages/campaigns you want to track.

**Steps:**

1. Log in to [app.unbounce.com](https://app.unbounce.com).
2. In AgencyPulse, click **Connect** on Unbounce.
3. Complete the Unbounce OAuth flow.
4. After authorization, select the **Account** and **Pages** to connect.

---

### HighLevel

**Auth type:** OAuth

**What you need:** A HighLevel (GoHighLevel) account.

**Steps:**

1. Log in to your HighLevel account at [app.gohighlevel.com](https://app.gohighlevel.com).
2. In AgencyPulse, click **Connect** on HighLevel.
3. Complete the HighLevel OAuth flow.
4. After authorization, select the **Location (Sub-Account)** to connect.

**Note:** HighLevel refers to client accounts as "Locations." You connect one Location per integration.

---

### Google Sheets

**Auth type:** OAuth (Google)

**What you need:** A Google account with access to the Sheets file you want to import.

**Steps:**

1. Go to [sheets.google.com](https://sheets.google.com) and open the spreadsheet you want to import.
2. Confirm you are the owner or have Editor access to the file.
3. Note the **Spreadsheet ID** from the URL: `docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
4. In AgencyPulse, click **Connect** on Google Sheets.
5. Complete the Google OAuth flow.
6. Paste the **Spreadsheet ID** and specify the **Sheet name** (tab name) when prompted.

---

## Call Tracking

---

### CallRail

**Auth type:** API Key

**What you need:** A CallRail account with API access.

**Steps:**

1. Log in to [app.callrail.com](https://app.callrail.com).
2. Click your company name in the top-left → **Company Settings** (or go to **Account Settings**).
3. In the left sidebar, click **API Access**.
4. Click **Create API Key**, give it a name (e.g., "AgencyPulse").
5. Copy the generated **API Key**.
6. Also note your **Account ID** (visible in the URL or Account Settings).
7. In AgencyPulse, paste the API key when prompted.

---

### CallTrackingMetrics

**Auth type:** API Key (Access Key + Secret Key)

**What you need:** A CallTrackingMetrics account with API access.

**Steps:**

1. Log in to [calltrackingmetrics.com](https://calltrackingmetrics.com).
2. Navigate to **Account** → **Settings** → **API Keys**.
3. Click **Add API Key**, name it "AgencyPulse".
4. Copy the **Access Key** and **Secret Key**.
5. In AgencyPulse, paste both values when prompted.

---

### Twilio

**Auth type:** API Key (Account SID + Auth Token)

**What you need:** A Twilio account.

**Steps:**

1. Log in to [console.twilio.com](https://console.twilio.com).
2. On the dashboard, you will see your **Account SID** and **Auth Token**.
3. It is recommended to create an **API Key** instead of using the primary Auth Token:
   - Go to **Account** → **API Keys & Tokens** → **Create API Key**.
   - Choose **Standard** type, name it "AgencyPulse".
   - Copy the **API Key SID** and **API Key Secret** — the secret is shown only once.
4. In AgencyPulse, paste the Account SID, API Key SID, and API Key Secret when prompted.

---

### WhatConverts

**Auth type:** API Key

**What you need:** A WhatConverts account.

**Steps:**

1. Log in to [app.whatconverts.com](https://app.whatconverts.com).
2. Go to **Account** → **API**.
3. Copy your **API Token**.
4. In AgencyPulse, paste the API token when prompted.

---

### Marchex

**Auth type:** API Key

**What you need:** A Marchex account with API access enabled.

**Steps:**

1. Log in to your Marchex account.
2. Navigate to **Account Settings** → **API Credentials**.
3. If no key exists, contact your Marchex account manager to generate API credentials.
4. Copy your **API Key**.
5. In AgencyPulse, paste the API key when prompted.

---

### Avanser

**Auth type:** API Key

**What you need:** An Avanser account with API access.

**Steps:**

1. Log in to your Avanser portal.
2. Navigate to **Settings** → **Integrations** → **API**.
3. Generate or copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

**Note:** If you can't find the API section, contact Avanser support at support@avanser.com.au to enable API access.

---

### CallSource

**Auth type:** API Key

**What you need:** A CallSource account with API access.

**Steps:**

1. Log in to your CallSource account.
2. Contact your CallSource account representative to request API credentials.
3. You will receive an **API Key** or **Username + Password** for API authentication.
4. In AgencyPulse, paste the credentials when prompted.

---

### Delacon

**Auth type:** API Key

**What you need:** A Delacon account.

**Steps:**

1. Log in to your Delacon portal.
2. Navigate to **Settings** → **API Access**.
3. Generate or copy your **API Key** and note your **Account ID**.
4. In AgencyPulse, paste the API key and Account ID when prompted.

**Note:** Delacon is primarily available in Australia. Contact support@delacon.com.au if you need API access enabled.

---

### WildJar

**Auth type:** API Key

**What you need:** A WildJar account.

**Steps:**

1. Log in to your WildJar portal.
2. Navigate to **Account Settings** → **API**.
3. Generate or copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

**Note:** Contact WildJar support at support@wildjar.com if the API section is not visible on your account.

---

## Local & Reputation

---

### Google Business Profile

**Auth type:** OAuth (Google)

**What you need:** A Google account that manages the Google Business Profile listing.

**Steps:**

1. Go to [business.google.com](https://business.google.com) and sign in.
2. Confirm you can see and manage the business listing you want to connect.
3. In AgencyPulse, click **Connect** on Google Business Profile.
4. Complete the Google OAuth flow.
5. After authorization, select the **Business Location** to connect.

**Permissions required:** Owner or Manager access on the Google Business Profile listing.

---

### BrightLocal

**Auth type:** API Key

**What you need:** A BrightLocal account (any paid plan).

**Steps:**

1. Log in to [brightlocal.com](https://www.brightlocal.com).
2. In the top menu, click your name → **Account Settings**.
3. Navigate to the **API** tab.
4. Copy your **API Key** (or click **Generate** if one doesn't exist).
5. In AgencyPulse, paste the API key when prompted.

---

### Trustpilot

**Auth type:** OAuth

**What you need:** A Trustpilot Business account with access to the company profile.

**Steps:**

1. Go to [business.trustpilot.com](https://business.trustpilot.com) and sign in.
2. Confirm you are an Admin on the company profile.
3. In AgencyPulse, click **Connect** on Trustpilot.
4. Complete the Trustpilot OAuth flow.
5. After authorization, the business profile is linked automatically.

---

### Yelp

**Auth type:** API Key (Yelp Fusion)

**What you need:** A Yelp developer app (free to create).

**Steps:**

1. Go to [fusion.yelp.com](https://fusion.yelp.com) and sign in.
2. Click **Create App** and fill in the details.
3. Copy your **API Key**.
4. In AgencyPulse, paste the API key and the **Yelp Business ID** (the slug from the Yelp URL: `yelp.com/biz/YOUR-BUSINESS-ID`) when prompted.

---

### Birdeye

**Auth type:** API Key

**What you need:** A Birdeye account with API access.

**Steps:**

1. Log in to your Birdeye account at [birdeye.com](https://birdeye.com).
2. Navigate to **Settings** → **Integrations** → **API**.
3. Copy your **API Key**.
4. You will also need your **Business ID** (visible in your Birdeye account URL or account settings).
5. In AgencyPulse, paste the API key and Business ID when prompted.

**Note:** API access may need to be enabled by your Birdeye account manager. Contact support@birdeye.com if you don't see it.

---

### Yext

**Auth type:** OAuth

**What you need:** A Yext account with Admin access.

**Steps:**

1. Log in to [yext.com](https://www.yext.com) and sign in.
2. Confirm you are an Admin on the account.
3. In AgencyPulse, click **Connect** on Yext.
4. Complete the Yext OAuth flow.
5. After authorization, select the **Account** to connect.

---

### GatherUp

**Auth type:** API Key

**What you need:** A GatherUp account with API access.

**Steps:**

1. Log in to your GatherUp account.
2. Navigate to **Settings** → **API**.
3. Your **API Key** is displayed here. Copy it.
4. In AgencyPulse, paste the API key when prompted.

**Note:** If you don't see an API section, contact GatherUp support — API access is available on most paid plans.

---

### Grade.us

**Auth type:** API Key

**What you need:** A Grade.us account.

**Steps:**

1. Log in to [grade.us](https://grade.us).
2. Navigate to **Account** → **API Access** or **Settings** → **Integrations**.
3. Generate or copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

---

### Synup

**Auth type:** API Key

**What you need:** A Synup account with API access.

**Steps:**

1. Log in to your Synup account.
2. Navigate to **Account Settings** → **API**.
3. Generate or copy your **API Key**.
4. In AgencyPulse, paste the API key when prompted.

**Note:** API access may need to be requested from your Synup account manager.

---

### Vendasta

**Auth type:** OAuth

**What you need:** A Vendasta account with Partner-level access.

**Steps:**

1. Log in to [vendasta.com](https://vendasta.com).
2. In AgencyPulse, click **Connect** on Vendasta.
3. Complete the Vendasta OAuth flow.
4. After authorization, select the **Account** to connect.

---

## Database / Warehouse

---

### Google BigQuery

**Auth type:** OAuth (Google) + Service Account (recommended for production)

**What you need:** A Google Cloud project with BigQuery enabled and a dataset you want to query.

**Steps (OAuth):**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and ensure your account has **BigQuery Data Viewer** and **BigQuery Job User** roles on the project.
2. In AgencyPulse, click **Connect** on Google BigQuery.
3. Complete the Google OAuth flow.
4. Enter your **Project ID**, **Dataset ID**, and optionally the **Table ID** when prompted.

**Steps (Service Account — recommended):**

1. In Google Cloud Console → **IAM & Admin** → **Service Accounts** → **Create Service Account**.
2. Name it (e.g., "agencypulse-bq"), grant it **BigQuery Data Viewer** + **BigQuery Job User** roles.
3. Click **Manage Keys** → **Add Key** → **Create new key** → **JSON**.
4. Download the JSON key file.
5. In AgencyPulse, upload the JSON key file when prompted.

---

### Amazon Redshift

**Auth type:** Credentials (Host + Port + Database + Username + Password)

**What you need:** Redshift cluster credentials with read access to the relevant schemas.

**Steps:**

1. Log in to [console.aws.amazon.com/redshift](https://console.aws.amazon.com/redshift).
2. Click your cluster and note the **Endpoint** (host), **Port** (default: 5439), and **Database name**.
3. Create a dedicated read-only user for AgencyPulse (recommended):
   ```sql
   CREATE USER agencypulse_reader PASSWORD 'StrongPassword123!';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO agencypulse_reader;
   ```
4. Ensure the Redshift cluster's **security group** allows inbound connections from AgencyPulse's server IP on port 5439.
5. In AgencyPulse, enter the Host, Port, Database, Username, and Password when prompted.

---

### MySQL

**Auth type:** Credentials (Host + Port + Database + Username + Password)

**What you need:** A MySQL server with a user that has SELECT access to the relevant database.

**Steps:**

1. Create a dedicated read-only user for AgencyPulse (recommended):
   ```sql
   CREATE USER 'agencypulse'@'%' IDENTIFIED BY 'StrongPassword123!';
   GRANT SELECT ON your_database.* TO 'agencypulse'@'%';
   FLUSH PRIVILEGES;
   ```
2. Note your MySQL server's **host** (IP or domain), **port** (default: 3306), and **database name**.
3. Ensure your firewall/security group allows inbound connections from AgencyPulse's server IP on port 3306.
4. In AgencyPulse, enter the Host, Port, Database, Username, and Password when prompted.

**Note:** For cloud-hosted MySQL (RDS, PlanetScale, etc.) you may also need to enable SSL — AgencyPulse supports SSL connections.

---

### Snowflake

**Auth type:** Credentials (Account + Warehouse + Database + Schema + Username + Password)

**What you need:** A Snowflake account with read access to the relevant warehouse and database.

**Steps:**

1. Log in to [app.snowflake.com](https://app.snowflake.com).
2. Note your **Account Identifier** (visible in the URL: `https://YOUR_ACCOUNT.snowflakecomputing.com`).
3. Create a dedicated user for AgencyPulse (recommended):
   ```sql
   CREATE USER AGENCYPULSE_USER PASSWORD = 'StrongPassword123!'
     DEFAULT_ROLE = AGENCYPULSE_ROLE
     DEFAULT_WAREHOUSE = YOUR_WAREHOUSE;
   
   CREATE ROLE AGENCYPULSE_ROLE;
   GRANT USAGE ON WAREHOUSE YOUR_WAREHOUSE TO ROLE AGENCYPULSE_ROLE;
   GRANT USAGE ON DATABASE YOUR_DATABASE TO ROLE AGENCYPULSE_ROLE;
   GRANT USAGE ON SCHEMA YOUR_DATABASE.YOUR_SCHEMA TO ROLE AGENCYPULSE_ROLE;
   GRANT SELECT ON ALL TABLES IN SCHEMA YOUR_DATABASE.YOUR_SCHEMA TO ROLE AGENCYPULSE_ROLE;
   GRANT ROLE AGENCYPULSE_ROLE TO USER AGENCYPULSE_USER;
   ```
4. Note the **Warehouse**, **Database**, and **Schema** names.
5. In AgencyPulse, enter the Account Identifier, Warehouse, Database, Schema, Username, and Password when prompted.

---

*Last updated: April 2026*
