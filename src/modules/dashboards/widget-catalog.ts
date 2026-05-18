import { IntegrationPlatform, WidgetType } from '@prisma/client';

export interface WidgetSeedSpec {
  widgetType: WidgetType;
  metricKeys: string[];
  config: {
    title: string;
    aggregation?: 'sum' | 'avg' | 'last';
    comparison?: 'previous_period' | 'none';
  };
  position: { x: number; y: number; w: number; h: number };
}

// 12-column grid. KPI cards: h=2. Charts: h=4.
export const PLATFORM_DEFAULT_WIDGETS: Partial<Record<IntegrationPlatform, WidgetSeedSpec[]>> = {

  // ─── Google Analytics 4 ──────────────────────────────────────────────────
  [IntegrationPlatform.GA4]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['sessions'],               config: { title: 'Sessions',               aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['totalUsers'],             config: { title: 'Total Users',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['newUsers'],               config: { title: 'New Users',              aggregation: 'sum', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['screenPageViews'],        config: { title: 'Page Views',             aggregation: 'sum', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['sessions', 'totalUsers'], config: { title: 'Sessions & Users Over Time' },                                               position: { x: 0, y: 2, w: 8, h: 4 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['bounceRate'],             config: { title: 'Bounce Rate',            aggregation: 'avg', comparison: 'previous_period' }, position: { x: 8, y: 2, w: 4, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['averageSessionDuration'], config: { title: 'Avg Session Duration',   aggregation: 'avg', comparison: 'previous_period' }, position: { x: 8, y: 4, w: 4, h: 2 } },
  ],

  // ─── Google Ads ───────────────────────────────────────────────────────────
  [IntegrationPlatform.GOOGLE_ADS]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['clicks'],                 config: { title: 'Clicks',                 aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['impressions'],            config: { title: 'Impressions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['cost'],                   config: { title: 'Ad Spend',               aggregation: 'sum', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['conversions'],            config: { title: 'Conversions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['clicks', 'impressions'],  config: { title: 'Clicks & Impressions Over Time' },                                           position: { x: 0, y: 2, w: 8, h: 4 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['ctr'],                    config: { title: 'CTR',                    aggregation: 'avg', comparison: 'previous_period' }, position: { x: 8, y: 2, w: 4, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['cpc'],                    config: { title: 'Avg CPC',                aggregation: 'avg', comparison: 'previous_period' }, position: { x: 8, y: 4, w: 4, h: 2 } },
  ],

  // ─── Meta Ads ─────────────────────────────────────────────────────────────
  [IntegrationPlatform.META_ADS]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['clicks'],                 config: { title: 'Clicks',                 aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['impressions'],            config: { title: 'Impressions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['spend'],                  config: { title: 'Ad Spend',               aggregation: 'sum', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['conversions'],            config: { title: 'Conversions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['clicks', 'spend'],        config: { title: 'Clicks & Spend Over Time' },                                                 position: { x: 0, y: 2, w: 8, h: 4 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['cpm'],                    config: { title: 'CPM',                    aggregation: 'avg', comparison: 'previous_period' }, position: { x: 8, y: 2, w: 4, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['cpc'],                    config: { title: 'CPC',                    aggregation: 'avg', comparison: 'previous_period' }, position: { x: 8, y: 4, w: 4, h: 2 } },
  ],

  // ─── Google Search Console ────────────────────────────────────────────────
  [IntegrationPlatform.GOOGLE_SEARCH_CONSOLE]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['clicks'],                 config: { title: 'Clicks',                 aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['impressions'],            config: { title: 'Impressions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['ctr'],                    config: { title: 'CTR',                    aggregation: 'avg', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['position'],               config: { title: 'Avg Position',           aggregation: 'avg', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['clicks', 'impressions'],  config: { title: 'Clicks & Impressions Over Time' },                                           position: { x: 0, y: 2, w: 12, h: 4 } },
  ],

  // ─── SE Ranking ───────────────────────────────────────────────────────────
  [IntegrationPlatform.SE_RANKING]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['keywords_top3'],          config: { title: 'Keywords Top 3',         aggregation: 'last', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['keywords_top10'],         config: { title: 'Keywords Top 10',        aggregation: 'last', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['keywords_top30'],         config: { title: 'Keywords Top 30',        aggregation: 'last', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['visibility'],             config: { title: 'Visibility',             aggregation: 'avg', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['keywords_top10'],         config: { title: 'Top 10 Keywords Trend' },                                                    position: { x: 0, y: 2, w: 12, h: 4 } },
  ],

  // ─── Mailchimp ────────────────────────────────────────────────────────────
  [IntegrationPlatform.MAILCHIMP]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['emails_sent'],            config: { title: 'Emails Sent',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['open_rate'],              config: { title: 'Open Rate',              aggregation: 'avg', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['click_rate'],             config: { title: 'Click Rate',             aggregation: 'avg', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['unsubscribe_rate'],       config: { title: 'Unsubscribe Rate',       aggregation: 'avg', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
  ],

  // ─── Shopify ──────────────────────────────────────────────────────────────
  [IntegrationPlatform.SHOPIFY]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['revenue'],                config: { title: 'Revenue',                aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['orders'],                 config: { title: 'Orders',                 aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['average_order_value'],    config: { title: 'Avg Order Value',        aggregation: 'avg', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['conversion_rate'],        config: { title: 'Conversion Rate',        aggregation: 'avg', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['revenue', 'orders'],      config: { title: 'Revenue & Orders Over Time' },                                               position: { x: 0, y: 2, w: 12, h: 4 } },
  ],

  // ─── YouTube Analytics ────────────────────────────────────────────────────
  [IntegrationPlatform.YOUTUBE_ANALYTICS]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['views'],                  config: { title: 'Views',                  aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['watch_time'],             config: { title: 'Watch Time (hrs)',        aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['subscribers_gained'],     config: { title: 'Subscribers Gained',     aggregation: 'sum', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['average_view_duration'],  config: { title: 'Avg View Duration',      aggregation: 'avg', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['views', 'watch_time'],    config: { title: 'Views & Watch Time Over Time' },                                             position: { x: 0, y: 2, w: 12, h: 4 } },
  ],

  // ─── LinkedIn Ads ─────────────────────────────────────────────────────────
  [IntegrationPlatform.LINKEDIN_ADS]: [
    { widgetType: WidgetType.KPI,        metricKeys: ['clicks'],                 config: { title: 'Clicks',                 aggregation: 'sum', comparison: 'previous_period' }, position: { x: 0, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['impressions'],            config: { title: 'Impressions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 3, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['cost'],                   config: { title: 'Ad Spend',               aggregation: 'sum', comparison: 'previous_period' }, position: { x: 6, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.KPI,        metricKeys: ['conversions'],            config: { title: 'Conversions',            aggregation: 'sum', comparison: 'previous_period' }, position: { x: 9, y: 0, w: 3, h: 2 } },
    { widgetType: WidgetType.LINE_CHART, metricKeys: ['clicks', 'cost'],         config: { title: 'Clicks & Spend Over Time' },                                                 position: { x: 0, y: 2, w: 12, h: 4 } },
  ],
};
