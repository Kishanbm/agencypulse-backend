import { IntegrationPlatform } from '@prisma/client';

/**
 * Seed data for metric_definitions — defines what metrics each platform produces.
 * Used by dashboards to know what's available and how to display it.
 *
 * category: traffic | engagement | cost | conversion
 * dataType: integer | decimal | percentage | currency
 */
export const METRIC_SEEDS: Array<{
  platform: IntegrationPlatform;
  metricKey: string;
  label: string;
  category: string;
  dataType: string;
  unit: string | null;
}> = [
  // ─── GA4 ──────────────────────────────────────────────────────────────
  { platform: 'GA4', metricKey: 'sessions',                label: 'Sessions',                 category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'totalUsers',              label: 'Total Users',              category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'newUsers',                label: 'New Users',                category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'screenPageViews',         label: 'Page Views',               category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GA4', metricKey: 'bounceRate',              label: 'Bounce Rate',              category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'GA4', metricKey: 'averageSessionDuration',  label: 'Avg Session Duration',     category: 'engagement', dataType: 'decimal',    unit: 'seconds' },

  // ─── Google Ads (values normalized before storage: micros → USD, ctr → %) ──
  { platform: 'GOOGLE_ADS', metricKey: 'clicks',       label: 'Clicks',        category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GOOGLE_ADS', metricKey: 'impressions',   label: 'Impressions',   category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'GOOGLE_ADS', metricKey: 'ctr',           label: 'CTR',           category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'GOOGLE_ADS', metricKey: 'avg_cpc',       label: 'Avg CPC',       category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'GOOGLE_ADS', metricKey: 'cost',          label: 'Cost',          category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'GOOGLE_ADS', metricKey: 'conversions',   label: 'Conversions',   category: 'conversion', dataType: 'decimal',    unit: 'count' },

  // ─── Meta Ads ─────────────────────────────────────────────────────────
  { platform: 'META_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'META_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'META_ADS', metricKey: 'spend',         label: 'Spend',        category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'META_ADS', metricKey: 'ctr',           label: 'CTR',          category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'META_ADS', metricKey: 'cpc',           label: 'CPC',          category: 'cost',       dataType: 'currency',   unit: 'USD' },
  { platform: 'META_ADS', metricKey: 'conversions',   label: 'Conversions',  category: 'conversion', dataType: 'decimal',    unit: 'count' },

  // ─── Mailchimp (Phase 3.9) ───────────────────────────────────────────
  { platform: 'MAILCHIMP', metricKey: 'sends',        label: 'Sends',        category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'MAILCHIMP', metricKey: 'opens',        label: 'Opens',        category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MAILCHIMP', metricKey: 'clicks',       label: 'Clicks',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MAILCHIMP', metricKey: 'unsubscribes', label: 'Unsubscribes', category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MAILCHIMP', metricKey: 'bounces',      label: 'Bounces',      category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Brevo (Phase 3.9) ───────────────────────────────────────────────
  { platform: 'BREVO', metricKey: 'delivered',       label: 'Delivered',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'BREVO', metricKey: 'opens',           label: 'Opens',           category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'BREVO', metricKey: 'clicks',          label: 'Clicks',          category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'BREVO', metricKey: 'unsubscribes',    label: 'Unsubscribes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'BREVO', metricKey: 'bounces',         label: 'Bounces',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'BREVO', metricKey: 'spam_complaints', label: 'Spam Complaints', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── ActiveCampaign (Phase 3.9) ──────────────────────────────────────
  { platform: 'ACTIVECAMPAIGN', metricKey: 'sends',        label: 'Sends',        category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'ACTIVECAMPAIGN', metricKey: 'opens',        label: 'Opens',        category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'ACTIVECAMPAIGN', metricKey: 'clicks',       label: 'Clicks',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'ACTIVECAMPAIGN', metricKey: 'unsubscribes', label: 'Unsubscribes', category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'ACTIVECAMPAIGN', metricKey: 'bounces',      label: 'Bounces',      category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Klaviyo (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'KLAVIYO', metricKey: 'delivered',       label: 'Delivered',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'KLAVIYO', metricKey: 'opens',           label: 'Opens',           category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'KLAVIYO', metricKey: 'clicks',          label: 'Clicks',          category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'KLAVIYO', metricKey: 'unsubscribes',    label: 'Unsubscribes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'KLAVIYO', metricKey: 'bounces',         label: 'Bounces',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'KLAVIYO', metricKey: 'spam_complaints', label: 'Spam Complaints', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Campaign Monitor (Phase 3.9) ─────────────────────────────────────
  { platform: 'CAMPAIGN_MONITOR', metricKey: 'sends',          label: 'Sends',           category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CAMPAIGN_MONITOR', metricKey: 'opens',          label: 'Opens',           category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CAMPAIGN_MONITOR', metricKey: 'clicks',         label: 'Clicks',          category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CAMPAIGN_MONITOR', metricKey: 'unsubscribes',   label: 'Unsubscribes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CAMPAIGN_MONITOR', metricKey: 'bounces',        label: 'Bounces',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CAMPAIGN_MONITOR', metricKey: 'spam_complaints', label: 'Spam Complaints', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── ConvertKit (Phase 3.9) ───────────────────────────────────────────
  { platform: 'CONVERTKIT', metricKey: 'sends',        label: 'Sends',       category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'CONVERTKIT', metricKey: 'open_rate',    label: 'Open Rate',   category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'CONVERTKIT', metricKey: 'click_rate',   label: 'Click Rate',  category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'CONVERTKIT', metricKey: 'unsubscribes', label: 'Unsubscribes', category: 'engagement', dataType: 'integer',   unit: 'count' },

  // ─── Drip (Phase 3.9) ─────────────────────────────────────────────────
  { platform: 'DRIP', metricKey: 'sends',          label: 'Sends',           category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'DRIP', metricKey: 'opens',          label: 'Opens',           category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'DRIP', metricKey: 'clicks',         label: 'Clicks',          category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'DRIP', metricKey: 'unsubscribes',   label: 'Unsubscribes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'DRIP', metricKey: 'bounces',        label: 'Bounces',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'DRIP', metricKey: 'spam_complaints', label: 'Spam Complaints', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Constant Contact (Phase 3.9) ─────────────────────────────────────
  { platform: 'CONSTANT_CONTACT', metricKey: 'sends',          label: 'Sends',           category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CONSTANT_CONTACT', metricKey: 'opens',          label: 'Opens',           category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CONSTANT_CONTACT', metricKey: 'clicks',         label: 'Clicks',          category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CONSTANT_CONTACT', metricKey: 'unsubscribes',   label: 'Unsubscribes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CONSTANT_CONTACT', metricKey: 'bounces',        label: 'Bounces',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CONSTANT_CONTACT', metricKey: 'spam_complaints', label: 'Spam Complaints', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Bing Webmaster Tools (Phase 3.9) ────────────────────────────────
  { platform: 'BING_WEBMASTER_TOOLS', metricKey: 'impressions',  label: 'Bing Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'BING_WEBMASTER_TOOLS', metricKey: 'clicks',       label: 'Bing Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'BING_WEBMASTER_TOOLS', metricKey: 'avg_position', label: 'Avg Position',      category: 'engagement', dataType: 'decimal', unit: 'position' },

  // ─── Majestic SEO (Phase 3.9) ─────────────────────────────────────────
  { platform: 'MAJESTIC_SEO', metricKey: 'backlinks',         label: 'Backlinks',              category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MAJESTIC_SEO', metricKey: 'ref_domains',       label: 'Referring Domains',      category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MAJESTIC_SEO', metricKey: 'citation_flow',     label: 'Citation Flow',          category: 'engagement', dataType: 'integer', unit: 'score' },
  { platform: 'MAJESTIC_SEO', metricKey: 'trust_flow',        label: 'Trust Flow',             category: 'engagement', dataType: 'integer', unit: 'score' },
  { platform: 'MAJESTIC_SEO', metricKey: 'ref_ips',           label: 'Referring IPs',          category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── SE Ranking (Phase 3.9) ───────────────────────────────────────────
  { platform: 'SE_RANKING', metricKey: 'visibility',      label: 'Visibility Score',   category: 'traffic',    dataType: 'decimal',  unit: 'score' },
  { platform: 'SE_RANKING', metricKey: 'avg_rank',        label: 'Average Rank',       category: 'traffic',    dataType: 'decimal',  unit: 'rank' },
  { platform: 'SE_RANKING', metricKey: 'keywords_top5',   label: 'Keywords in Top 5',  category: 'traffic',    dataType: 'integer',  unit: 'count' },
  { platform: 'SE_RANKING', metricKey: 'keywords_top10',  label: 'Keywords in Top 10', category: 'traffic',    dataType: 'integer',  unit: 'count' },
  { platform: 'SE_RANKING', metricKey: 'keywords_top30',  label: 'Keywords in Top 30', category: 'traffic',    dataType: 'integer',  unit: 'count' },

  // ─── BrightLocal (Phase 3.9) ──────────────────────────────────────────
  { platform: 'BRIGHTLOCAL', metricKey: 'avg_rank',           label: 'Average Rank',           category: 'traffic',    dataType: 'decimal',  unit: 'rank' },
  { platform: 'BRIGHTLOCAL', metricKey: 'keywords_top3',      label: 'Keywords in Top 3',      category: 'traffic',    dataType: 'integer',  unit: 'count' },
  { platform: 'BRIGHTLOCAL', metricKey: 'keywords_top10',     label: 'Keywords in Top 10',     category: 'traffic',    dataType: 'integer',  unit: 'count' },
  { platform: 'BRIGHTLOCAL', metricKey: 'keywords_top20',     label: 'Keywords in Top 20',     category: 'traffic',    dataType: 'integer',  unit: 'count' },

  // ─── Google PageSpeed (Phase 3.9) ─────────────────────────────────────
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'performance_score_mobile',  label: 'Performance Score (Mobile)',  category: 'engagement', dataType: 'integer',    unit: 'score' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'performance_score_desktop', label: 'Performance Score (Desktop)', category: 'engagement', dataType: 'integer',    unit: 'score' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'seo_score_mobile',          label: 'SEO Score (Mobile)',          category: 'engagement', dataType: 'integer',    unit: 'score' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'seo_score_desktop',         label: 'SEO Score (Desktop)',         category: 'engagement', dataType: 'integer',    unit: 'score' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'lcp_ms_mobile',             label: 'LCP (Mobile, ms)',            category: 'engagement', dataType: 'integer',    unit: 'ms' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'lcp_ms_desktop',            label: 'LCP (Desktop, ms)',           category: 'engagement', dataType: 'integer',    unit: 'ms' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'cls_mobile',                label: 'CLS (Mobile)',                category: 'engagement', dataType: 'decimal',    unit: 'score' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'cls_desktop',               label: 'CLS (Desktop)',               category: 'engagement', dataType: 'decimal',    unit: 'score' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'fcp_ms_mobile',             label: 'FCP (Mobile, ms)',            category: 'engagement', dataType: 'integer',    unit: 'ms' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'fcp_ms_desktop',            label: 'FCP (Desktop, ms)',           category: 'engagement', dataType: 'integer',    unit: 'ms' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'tbt_ms_mobile',             label: 'TBT (Mobile, ms)',            category: 'engagement', dataType: 'integer',    unit: 'ms' },
  { platform: 'GOOGLE_PAGESPEED', metricKey: 'tbt_ms_desktop',            label: 'TBT (Desktop, ms)',           category: 'engagement', dataType: 'integer',    unit: 'ms' },

  // ─── SEMrush (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'SEMRUSH', metricKey: 'org_keywords',  label: 'Organic Keywords',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SEMRUSH', metricKey: 'org_traffic',   label: 'Organic Traffic',   category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SEMRUSH', metricKey: 'paid_keywords', label: 'Paid Keywords',     category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SEMRUSH', metricKey: 'paid_traffic',  label: 'Paid Traffic',      category: 'traffic',    dataType: 'integer', unit: 'count' },

  // ─── Moz (Phase 3.9) ──────────────────────────────────────────────────
  { platform: 'MOZ', metricKey: 'domain_authority',   label: 'Domain Authority',       category: 'traffic',    dataType: 'integer', unit: 'score' },
  { platform: 'MOZ', metricKey: 'page_authority',     label: 'Page Authority',         category: 'traffic',    dataType: 'integer', unit: 'score' },
  { platform: 'MOZ', metricKey: 'spam_score',         label: 'Spam Score',             category: 'engagement', dataType: 'integer', unit: 'score' },
  { platform: 'MOZ', metricKey: 'external_links',     label: 'External Links',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MOZ', metricKey: 'linking_root_domains', label: 'Linking Root Domains', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Trustpilot (Phase 3.9) ───────────────────────────────────────────
  { platform: 'TRUSTPILOT', metricKey: 'avg_rating',   label: 'Average Rating',   category: 'engagement', dataType: 'decimal',  unit: 'score' },
  { platform: 'TRUSTPILOT', metricKey: 'review_count', label: 'Total Reviews',    category: 'engagement', dataType: 'integer',  unit: 'count' },
  { platform: 'TRUSTPILOT', metricKey: 'new_reviews',  label: 'New Reviews',      category: 'engagement', dataType: 'integer',  unit: 'count' },

  // ─── Yelp (Phase 3.9) ─────────────────────────────────────────────────
  { platform: 'YELP', metricKey: 'avg_rating',   label: 'Yelp Rating',    category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'YELP', metricKey: 'review_count', label: 'Yelp Reviews',   category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Birdeye (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'BIRDEYE', metricKey: 'avg_rating',   label: 'Average Rating', category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'BIRDEYE', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'BIRDEYE', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── GatherUp (Phase 3.9) ─────────────────────────────────────────────
  { platform: 'GATHERUP', metricKey: 'avg_rating',   label: 'Average Rating', category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'GATHERUP', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'GATHERUP', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Grade.us (Phase 3.9) ─────────────────────────────────────────────
  { platform: 'GRADE_US', metricKey: 'avg_rating',   label: 'Average Rating', category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'GRADE_US', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'GRADE_US', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Synup (Phase 3.9) ────────────────────────────────────────────────
  { platform: 'SYNUP', metricKey: 'avg_rating',   label: 'Average Rating', category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'SYNUP', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'SYNUP', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Yext (Phase 3.9) ─────────────────────────────────────────────────
  { platform: 'YEXT', metricKey: 'avg_rating',   label: 'Average Rating', category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'YEXT', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'YEXT', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Vendasta (Phase 3.9) ─────────────────────────────────────────────
  { platform: 'VENDASTA', metricKey: 'avg_rating',   label: 'Average Rating', category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'VENDASTA', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'VENDASTA', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Google Business Profile (Phase 3.9) ─────────────────────────────
  { platform: 'GOOGLE_BUSINESS_PROFILE', metricKey: 'avg_rating',   label: 'GBP Rating',     category: 'engagement', dataType: 'decimal', unit: 'score' },
  { platform: 'GOOGLE_BUSINESS_PROFILE', metricKey: 'review_count', label: 'Total Reviews',  category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_BUSINESS_PROFILE', metricKey: 'new_reviews',  label: 'New Reviews',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── CallRail (Phase 3.9) ─────────────────────────────────────────────
  { platform: 'CALLRAIL',            metricKey: 'total_calls',        label: 'Total Calls',         category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CALLRAIL',            metricKey: 'answered_calls',     label: 'Answered Calls',      category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CALLRAIL',            metricKey: 'missed_calls',       label: 'Missed Calls',        category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CALLRAIL',            metricKey: 'first_time_callers', label: 'First-Time Callers',  category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'CALLRAIL',            metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── CallTrackingMetrics (Phase 3.9) ──────────────────────────────────
  { platform: 'CALLTRACKING_METRICS', metricKey: 'total_calls',        label: 'Total Calls',         category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CALLTRACKING_METRICS', metricKey: 'answered_calls',     label: 'Answered Calls',      category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CALLTRACKING_METRICS', metricKey: 'missed_calls',       label: 'Missed Calls',        category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CALLTRACKING_METRICS', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── WhatConverts (Phase 3.9) ─────────────────────────────────────────
  { platform: 'WHATCONVERTS', metricKey: 'total_leads', label: 'Total Leads', category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'WHATCONVERTS', metricKey: 'call_leads',  label: 'Call Leads',  category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'WHATCONVERTS', metricKey: 'form_leads',  label: 'Form Leads',  category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'WHATCONVERTS', metricKey: 'chat_leads',  label: 'Chat Leads',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Twilio (Phase 3.9) ───────────────────────────────────────────────
  { platform: 'TWILIO', metricKey: 'total_calls',        label: 'Total Calls',          category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'TWILIO', metricKey: 'answered_calls',     label: 'Answered Calls',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'TWILIO', metricKey: 'missed_calls',       label: 'Missed Calls',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'TWILIO', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── Marchex (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'MARCHEX', metricKey: 'total_calls',        label: 'Total Calls',          category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'MARCHEX', metricKey: 'answered_calls',     label: 'Answered Calls',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MARCHEX', metricKey: 'missed_calls',       label: 'Missed Calls',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'MARCHEX', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── AVANSER (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'AVANSER', metricKey: 'total_calls',        label: 'Total Calls',          category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'AVANSER', metricKey: 'answered_calls',     label: 'Answered Calls',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'AVANSER', metricKey: 'missed_calls',       label: 'Missed Calls',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'AVANSER', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── CallSource (Phase 3.9) ───────────────────────────────────────────
  { platform: 'CALLSOURCE', metricKey: 'total_calls',        label: 'Total Calls',          category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CALLSOURCE', metricKey: 'answered_calls',     label: 'Answered Calls',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CALLSOURCE', metricKey: 'missed_calls',       label: 'Missed Calls',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'CALLSOURCE', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── Delacon (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'DELACON', metricKey: 'total_calls',        label: 'Total Calls',          category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'DELACON', metricKey: 'answered_calls',     label: 'Answered Calls',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'DELACON', metricKey: 'missed_calls',       label: 'Missed Calls',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'DELACON', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── WildJar (Phase 3.9) ──────────────────────────────────────────────
  { platform: 'WILDJAR', metricKey: 'total_calls',        label: 'Total Calls',          category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'WILDJAR', metricKey: 'answered_calls',     label: 'Answered Calls',       category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'WILDJAR', metricKey: 'missed_calls',       label: 'Missed Calls',         category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'WILDJAR', metricKey: 'total_duration_sec', label: 'Total Duration (sec)', category: 'engagement', dataType: 'integer', unit: 'seconds' },

  // ─── Microsoft Ads (Phase 3.10) ──────────────────────────────────────
  { platform: 'MICROSOFT_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'MICROSOFT_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'MICROSOFT_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'MICROSOFT_ADS', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'MICROSOFT_ADS', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'MICROSOFT_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Pinterest Ads (Phase 3.10) ───────────────────────────────────────
  { platform: 'PINTEREST_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'PINTEREST_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'PINTEREST_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'PINTEREST_ADS', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'PINTEREST_ADS', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'PINTEREST_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Snapchat Ads (Phase 3.10) ────────────────────────────────────────
  { platform: 'SNAPCHAT_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SNAPCHAT_ADS', metricKey: 'swipes',       label: 'Swipes',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SNAPCHAT_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'SNAPCHAT_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── X Ads / Twitter Ads (Phase 3.10) ────────────────────────────────
  { platform: 'X_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'X_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'X_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'X_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Reddit Ads (Phase 3.10) ──────────────────────────────────────────
  { platform: 'REDDIT_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'REDDIT_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'REDDIT_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'REDDIT_ADS', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'REDDIT_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── AdRoll (Phase 3.10) ──────────────────────────────────────────────
  { platform: 'ADROLL', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'ADROLL', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'ADROLL', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'ADROLL', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'ADROLL', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Google Ad Manager (Phase 3.10) ───────────────────────────────────
  { platform: 'GOOGLE_AD_MANAGER', metricKey: 'impressions',    label: 'Impressions',    category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_AD_MANAGER', metricKey: 'clicks',         label: 'Clicks',         category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_AD_MANAGER', metricKey: 'revenue',        label: 'Ad Revenue',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'GOOGLE_AD_MANAGER', metricKey: 'ctr',            label: 'CTR',            category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'GOOGLE_AD_MANAGER', metricKey: 'viewable_rate',  label: 'Viewable Rate',  category: 'engagement', dataType: 'decimal', unit: 'percent' },

  // ─── Google DV360 (Phase 3.10) ────────────────────────────────────────
  { platform: 'GOOGLE_DV360', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_DV360', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_DV360', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'GOOGLE_DV360', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'GOOGLE_DV360', metricKey: 'cpm',          label: 'CPM',          category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'GOOGLE_DV360', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Google Local Services Ads (Phase 3.10) ───────────────────────────
  { platform: 'GOOGLE_LOCAL_SERVICES_ADS', metricKey: 'impressions',    label: 'Impressions',      category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_LOCAL_SERVICES_ADS', metricKey: 'leads',          label: 'Total Leads',      category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_LOCAL_SERVICES_ADS', metricKey: 'phone_leads',    label: 'Phone Leads',      category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_LOCAL_SERVICES_ADS', metricKey: 'message_leads',  label: 'Message Leads',    category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'GOOGLE_LOCAL_SERVICES_ADS', metricKey: 'spend',          label: 'Ad Spend',         category: 'revenue',    dataType: 'decimal', unit: 'currency' },

  // ─── Instagram Ads (Phase 3.10) ───────────────────────────────────────
  { platform: 'INSTAGRAM_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'INSTAGRAM_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'INSTAGRAM_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'INSTAGRAM_ADS', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'INSTAGRAM_ADS', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'INSTAGRAM_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Spotify Ads (Phase 3.10) ─────────────────────────────────────────
  { platform: 'SPOTIFY_ADS', metricKey: 'impressions',        label: 'Impressions',        category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SPOTIFY_ADS', metricKey: 'clicks',             label: 'Clicks',             category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SPOTIFY_ADS', metricKey: 'spend',              label: 'Ad Spend',           category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'SPOTIFY_ADS', metricKey: 'ctr',                label: 'CTR',                category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'SPOTIFY_ADS', metricKey: 'video_completions',  label: 'Video Completions',  category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── StackAdapt (Phase 3.10) ──────────────────────────────────────────
  { platform: 'STACKADAPT', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'STACKADAPT', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'STACKADAPT', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'STACKADAPT', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'STACKADAPT', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'STACKADAPT', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Simpli.fi (Phase 3.10) ───────────────────────────────────────────
  { platform: 'SIMPLIFI', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SIMPLIFI', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'SIMPLIFI', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'SIMPLIFI', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'SIMPLIFI', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'SIMPLIFI', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Choozle (Phase 3.10) ─────────────────────────────────────────────
  { platform: 'CHOOZLE', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CHOOZLE', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'CHOOZLE', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'CHOOZLE', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'CHOOZLE', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'CHOOZLE', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── GroundTruth (Phase 3.10) ─────────────────────────────────────────
  { platform: 'GROUNDTRUTH', metricKey: 'impressions',   label: 'Impressions',    category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GROUNDTRUTH', metricKey: 'clicks',        label: 'Clicks',         category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'GROUNDTRUTH', metricKey: 'spend',         label: 'Ad Spend',       category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'GROUNDTRUTH', metricKey: 'ctr',           label: 'CTR',            category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'GROUNDTRUTH', metricKey: 'store_visits',  label: 'Store Visits',   category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Basis / Centro (Phase 3.10) ──────────────────────────────────────
  { platform: 'BASIS_PLATFORM', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'BASIS_PLATFORM', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'BASIS_PLATFORM', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'BASIS_PLATFORM', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'BASIS_PLATFORM', metricKey: 'avg_cpc',      label: 'Avg CPC',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'BASIS_PLATFORM', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Yelp Ads (Phase 3.10) ────────────────────────────────────────────
  { platform: 'YELP_ADS', metricKey: 'impressions',  label: 'Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'YELP_ADS', metricKey: 'clicks',       label: 'Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'YELP_ADS', metricKey: 'spend',        label: 'Ad Spend',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'YELP_ADS', metricKey: 'ctr',          label: 'CTR',          category: 'engagement', dataType: 'decimal', unit: 'percent' },
  { platform: 'YELP_ADS', metricKey: 'conversions',  label: 'Conversions',  category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Shopify (Phase 3.12) ─────────────────────────────────────────────
  { platform: 'SHOPIFY', metricKey: 'total_orders',     label: 'Total Orders',     category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'SHOPIFY', metricKey: 'total_revenue',    label: 'Total Revenue',    category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'SHOPIFY', metricKey: 'avg_order_value',  label: 'Avg Order Value',  category: 'revenue',    dataType: 'decimal', unit: 'currency' },

  // ─── WooCommerce (Phase 3.12) ─────────────────────────────────────────
  { platform: 'WOOCOMMERCE', metricKey: 'total_orders',     label: 'Total Orders',     category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'WOOCOMMERCE', metricKey: 'total_revenue',    label: 'Gross Revenue',    category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'WOOCOMMERCE', metricKey: 'net_revenue',      label: 'Net Revenue',      category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'WOOCOMMERCE', metricKey: 'avg_order_value',  label: 'Avg Order Value',  category: 'revenue',    dataType: 'decimal', unit: 'currency' },

  // ─── BigCommerce (Phase 3.12) ─────────────────────────────────────────
  { platform: 'BIGCOMMERCE', metricKey: 'total_orders',     label: 'Total Orders',     category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'BIGCOMMERCE', metricKey: 'total_revenue',    label: 'Total Revenue',    category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'BIGCOMMERCE', metricKey: 'avg_order_value',  label: 'Avg Order Value',  category: 'revenue',    dataType: 'decimal', unit: 'currency' },

  // ─── Stripe (Phase 3.12) ──────────────────────────────────────────────
  { platform: 'STRIPE_ECOMMERCE', metricKey: 'total_charges',    label: 'Total Charges',     category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'STRIPE_ECOMMERCE', metricKey: 'total_revenue',    label: 'Total Revenue',     category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'STRIPE_ECOMMERCE', metricKey: 'avg_charge_value', label: 'Avg Charge Value',  category: 'revenue',    dataType: 'decimal', unit: 'currency' },

  // ─── Keap / Infusionsoft (Phase 3.12) ─────────────────────────────────
  { platform: 'KEAP', metricKey: 'total_orders',     label: 'Total Orders',    category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'KEAP', metricKey: 'total_revenue',    label: 'Total Revenue',   category: 'revenue',    dataType: 'decimal', unit: 'currency' },
  { platform: 'KEAP', metricKey: 'avg_order_value',  label: 'Avg Order Value', category: 'revenue',    dataType: 'decimal', unit: 'currency' },

  // ─── Facebook Organic (Phase 3.11) ───────────────────────────────────
  { platform: 'FACEBOOK_ORGANIC', metricKey: 'impressions',       label: 'Page Impressions',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'FACEBOOK_ORGANIC', metricKey: 'reach',             label: 'Page Reach',        category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'FACEBOOK_ORGANIC', metricKey: 'engaged_users',     label: 'Engaged Users',     category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'FACEBOOK_ORGANIC', metricKey: 'post_engagements',  label: 'Post Engagements',  category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Instagram Organic (Phase 3.11) ──────────────────────────────────
  { platform: 'INSTAGRAM_ORGANIC', metricKey: 'impressions',    label: 'Impressions',      category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'INSTAGRAM_ORGANIC', metricKey: 'reach',          label: 'Reach',            category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'INSTAGRAM_ORGANIC', metricKey: 'profile_views',  label: 'Profile Views',    category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'INSTAGRAM_ORGANIC', metricKey: 'new_followers',  label: 'New Followers',    category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Pinterest Organic (Phase 3.11) ──────────────────────────────────
  { platform: 'PINTEREST_ORGANIC', metricKey: 'impressions',      label: 'Impressions',      category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'PINTEREST_ORGANIC', metricKey: 'saves',            label: 'Saves',            category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'PINTEREST_ORGANIC', metricKey: 'pin_clicks',       label: 'Pin Clicks',       category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'PINTEREST_ORGANIC', metricKey: 'outbound_clicks',  label: 'Outbound Clicks',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'PINTEREST_ORGANIC', metricKey: 'engagements',      label: 'Engagements',      category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Vimeo (Phase 3.11) ───────────────────────────────────────────────
  { platform: 'VIMEO', metricKey: 'total_plays',    label: 'Total Plays',    category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'VIMEO', metricKey: 'total_likes',    label: 'Total Likes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'VIMEO', metricKey: 'total_comments', label: 'Total Comments', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── X Organic (Phase 3.11) ───────────────────────────────────────────
  { platform: 'X_ORGANIC', metricKey: 'impressions', label: 'Tweet Impressions', category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'X_ORGANIC', metricKey: 'likes',       label: 'Likes',             category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'X_ORGANIC', metricKey: 'retweets',    label: 'Retweets',          category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'X_ORGANIC', metricKey: 'replies',     label: 'Replies',           category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── TikTok Organic (Phase 3.11) ─────────────────────────────────────
  { platform: 'TIKTOK_ORGANIC', metricKey: 'total_views',    label: 'Video Views',    category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'TIKTOK_ORGANIC', metricKey: 'total_likes',    label: 'Total Likes',    category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'TIKTOK_ORGANIC', metricKey: 'total_comments', label: 'Total Comments', category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'TIKTOK_ORGANIC', metricKey: 'total_shares',   label: 'Total Shares',   category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── Ahrefs (Phase 3.9) ───────────────────────────────────────────────
  { platform: 'AHREFS', metricKey: 'org_traffic',          label: 'Organic Traffic',         category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'AHREFS', metricKey: 'org_keywords',         label: 'Organic Keywords',         category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'AHREFS', metricKey: 'paid_traffic',         label: 'Paid Traffic',             category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'AHREFS', metricKey: 'paid_keywords',        label: 'Paid Keywords',            category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'AHREFS', metricKey: 'refdomains',           label: 'Referring Domains',        category: 'engagement', dataType: 'integer', unit: 'count' },
  { platform: 'AHREFS', metricKey: 'dofollow_refdomains',  label: 'Dofollow Referring Domains', category: 'engagement', dataType: 'integer', unit: 'count' },

  // ─── HubSpot (Phase 3.13) ─────────────────────────────────────────────
  { platform: 'HUBSPOT', metricKey: 'new_contacts',   label: 'New Contacts',    category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'HUBSPOT', metricKey: 'total_contacts', label: 'Total Contacts',  category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'HUBSPOT', metricKey: 'new_deals',      label: 'New Deals',       category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'HUBSPOT', metricKey: 'total_deals',    label: 'Total Deals',     category: 'traffic',    dataType: 'integer', unit: 'count' },
  { platform: 'HUBSPOT', metricKey: 'deal_revenue',   label: 'Deal Revenue',    category: 'revenue',    dataType: 'currency', unit: 'USD' },

  // ─── Matomo (Phase 3.13) ──────────────────────────────────────────────
  { platform: 'MATOMO', metricKey: 'sessions',             label: 'Sessions',             category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'MATOMO', metricKey: 'users',                label: 'Unique Visitors',      category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'MATOMO', metricKey: 'pageviews',            label: 'Page Views',           category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'MATOMO', metricKey: 'bounce_rate',          label: 'Bounce Rate',          category: 'engagement', dataType: 'percentage', unit: '%' },
  { platform: 'MATOMO', metricKey: 'avg_session_duration', label: 'Avg Session Duration', category: 'engagement', dataType: 'decimal',    unit: 'seconds' },

  // ─── Salesforce (Phase 3.13) ──────────────────────────────────────────
  { platform: 'SALESFORCE', metricKey: 'new_leads',     label: 'New Leads',      category: 'conversion', dataType: 'integer',  unit: 'count' },
  { platform: 'SALESFORCE', metricKey: 'closed_deals',  label: 'Closed Deals',   category: 'conversion', dataType: 'integer',  unit: 'count' },
  { platform: 'SALESFORCE', metricKey: 'deal_revenue',  label: 'Deal Revenue',   category: 'revenue',    dataType: 'currency', unit: 'USD' },

  // ─── SharpSpring (Phase 3.13) ─────────────────────────────────────────
  { platform: 'SHARPSPRING', metricKey: 'new_leads',    label: 'New Leads',     category: 'conversion', dataType: 'integer',  unit: 'count' },
  { platform: 'SHARPSPRING', metricKey: 'new_deals',    label: 'New Deals',     category: 'conversion', dataType: 'integer',  unit: 'count' },
  { platform: 'SHARPSPRING', metricKey: 'deal_revenue', label: 'Deal Revenue',  category: 'revenue',    dataType: 'currency', unit: 'USD' },

  // ─── Gravity Forms (Phase 3.13) ───────────────────────────────────────
  { platform: 'GRAVITY_FORMS', metricKey: 'total_entries', label: 'Total Entries', category: 'conversion', dataType: 'integer', unit: 'count' },
  { platform: 'GRAVITY_FORMS', metricKey: 'new_entries',   label: 'New Entries',   category: 'conversion', dataType: 'integer', unit: 'count' },

  // ─── Unbounce (Phase 3.13) ────────────────────────────────────────────
  { platform: 'UNBOUNCE', metricKey: 'page_visits',      label: 'Page Visits',      category: 'traffic',    dataType: 'integer',    unit: 'count' },
  { platform: 'UNBOUNCE', metricKey: 'conversions',      label: 'Conversions',      category: 'conversion', dataType: 'integer',    unit: 'count' },
  { platform: 'UNBOUNCE', metricKey: 'conversion_rate',  label: 'Conversion Rate',  category: 'conversion', dataType: 'percentage', unit: '%' },

  // ─── HighLevel (Phase 3.13) ───────────────────────────────────────────
  { platform: 'HIGHLEVEL', metricKey: 'new_contacts',      label: 'New Contacts',       category: 'conversion', dataType: 'integer',  unit: 'count' },
  { platform: 'HIGHLEVEL', metricKey: 'new_opportunities', label: 'New Opportunities',  category: 'conversion', dataType: 'integer',  unit: 'count' },
  { platform: 'HIGHLEVEL', metricKey: 'won_revenue',       label: 'Won Revenue',        category: 'revenue',    dataType: 'currency', unit: 'USD' },

  // ─── Google Sheets (Phase 3.13) ───────────────────────────────────────
  { platform: 'GOOGLE_SHEETS', metricKey: 'custom_value', label: 'Custom Value', category: 'traffic', dataType: 'decimal', unit: null },

  // ─── Google BigQuery (Phase 3.13) ─────────────────────────────────────
  { platform: 'GOOGLE_BIGQUERY', metricKey: 'custom_value', label: 'Custom Value', category: 'traffic', dataType: 'decimal', unit: null },

  // ─── MySQL (Phase 3.13) ───────────────────────────────────────────────
  { platform: 'MYSQL_DB', metricKey: 'custom_value', label: 'Custom Value', category: 'traffic', dataType: 'decimal', unit: null },

  // ─── Amazon Redshift (Phase 3.13) ─────────────────────────────────────
  { platform: 'AMAZON_REDSHIFT', metricKey: 'custom_value', label: 'Custom Value', category: 'traffic', dataType: 'decimal', unit: null },

  // ─── Snowflake (Phase 3.13) ───────────────────────────────────────────
  { platform: 'SNOWFLAKE', metricKey: 'custom_value', label: 'Custom Value', category: 'traffic', dataType: 'decimal', unit: null },
];
