/**
 * Structured RAG — lightweight intent detection for chat messages.
 *
 * We don't use vector embeddings — instead we parse the user's question for:
 *   - Time references ("last week", "this month", "yesterday")
 *   - Metric name mentions ("sessions", "CTR", "cost")
 *   - Comparison signals ("vs", "compared to", "why did")
 *   - Trend signals ("trend", "over time", "daily")
 *
 * The output is a set of hints that the context builder uses to decide what
 * metric data to fetch. For marketing timeseries, structured SQL retrieval
 * is more precise than semantic similarity.
 */

export interface ParsedIntent {
  range: { from: string; to: string; label: string };
  wantsTimeseries: boolean;
  wantsComparison: boolean;
  metricHints: string[];
  platformHints: Array<'GA4' | 'GOOGLE_ADS' | 'META_ADS'>;
}

const METRIC_KEYWORDS: Record<string, string[]> = {
  sessions: ['session', 'traffic', 'visits', 'visitors'],
  totalUsers: ['user', 'audience'],
  screenPageViews: ['pageview', 'page view', 'views'],
  clicks: ['click'],
  impressions: ['impression'],
  ctr: ['ctr', 'click through'],
  cost: ['spend', 'cost', 'budget'],
  conversions: ['conversion', 'lead', 'signup'],
  reach: ['reach'],
  cpm: ['cpm'],
  cpc: ['cpc'],
  cpa: ['cpa'],
};

const PLATFORM_KEYWORDS: Record<'GA4' | 'GOOGLE_ADS' | 'META_ADS', string[]> = {
  GA4: ['ga4', 'analytics', 'google analytics', 'website', 'site traffic'],
  GOOGLE_ADS: ['google ads', 'adwords', 'search ads', 'ppc'],
  META_ADS: ['meta', 'facebook', 'instagram', 'fb ads', 'meta ads'],
};

export function parseIntent(question: string, todayIso: string): ParsedIntent {
  const q = question.toLowerCase();

  // ─── Time range ─────────────────────────────────────────────────────────────
  const today = new Date(todayIso + 'T00:00:00Z');
  let from: Date;
  let to: Date = today;
  let label: string;

  if (/\byesterday\b/.test(q)) {
    from = new Date(today.getTime() - 86_400_000);
    to = from;
    label = 'yesterday';
  } else if (/\blast\s+week\b/.test(q)) {
    to = new Date(today.getTime() - 86_400_000);
    from = new Date(to.getTime() - 6 * 86_400_000);
    label = 'last 7 days';
  } else if (/\bthis\s+week\b/.test(q)) {
    from = new Date(today.getTime() - 6 * 86_400_000);
    label = 'past 7 days';
  } else if (/\blast\s+month\b/.test(q)) {
    from = new Date(today.getTime() - 30 * 86_400_000);
    label = 'last 30 days';
  } else if (/\bthis\s+month\b|\bmonthly\b/.test(q)) {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    label = 'this month';
  } else if (/\blast\s+quarter\b|\bq[1-4]\b/.test(q)) {
    from = new Date(today.getTime() - 90 * 86_400_000);
    label = 'last 90 days';
  } else if (/\byear\b|\bytd\b/.test(q)) {
    from = new Date(today.getFullYear(), 0, 1);
    label = 'year to date';
  } else {
    // Default: last 30 days
    from = new Date(today.getTime() - 30 * 86_400_000);
    label = 'last 30 days';
  }

  // ─── Timeseries + comparison detection ──────────────────────────────────────
  const wantsTimeseries = /\btrend\b|\bover time\b|\bdaily\b|\bweekly\b|\bchart\b|\bgraph\b/.test(q);
  const wantsComparison = /\bvs\b|\bcompared?\s+to\b|\bchange\b|\bgrowth\b|\bdrop\b|\bincrease\b|\bwhy\b/.test(q);

  // ─── Metric hints ───────────────────────────────────────────────────────────
  const metricHints: string[] = [];
  for (const [key, keywords] of Object.entries(METRIC_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) metricHints.push(key);
  }

  // ─── Platform hints ─────────────────────────────────────────────────────────
  const platformHints: Array<'GA4' | 'GOOGLE_ADS' | 'META_ADS'> = [];
  for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) {
      platformHints.push(platform as 'GA4' | 'GOOGLE_ADS' | 'META_ADS');
    }
  }

  return {
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      label,
    },
    wantsTimeseries,
    wantsComparison,
    metricHints,
    platformHints,
  };
}
