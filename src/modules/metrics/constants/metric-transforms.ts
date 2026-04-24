/**
 * Platform-specific value transformers — normalize raw API values before storage.
 *
 * AI2 fix: all platforms must store consistent units.
 *   - costMicros → USD (÷ 1,000,000)
 *   - percentages → 0-100 (not 0-1)
 *   - durations → seconds
 *   - counts → as-is
 *
 * Key format: `PLATFORM:metric_key`
 * If a metric_key has no transform, the raw value is stored as-is.
 */
export const METRIC_TRANSFORMS: Record<string, (value: string) => number> = {
  // ─── Google Ads ─────────────────────────────────────────────────────────
  // Google Ads returns cost in micros (1,000,000 = $1.00)
  'GOOGLE_ADS:cost_micros': (v) => Number(v) / 1_000_000,

  // Google Ads CTR comes as a fraction (0.05 = 5%)
  'GOOGLE_ADS:ctr': (v) => Number(v) * 100,

  // Google Ads average CPC comes in micros
  'GOOGLE_ADS:average_cpc': (v) => Number(v) / 1_000_000,
};

/**
 * Maps raw API metric keys to our normalized storage keys.
 * If a key isn't in this map, it's stored as-is.
 *
 * Example: Google Ads `cost_micros` → `cost` (stored in USD)
 */
export const METRIC_KEY_REMAP: Record<string, string> = {
  'GOOGLE_ADS:cost_micros': 'cost',
  'GOOGLE_ADS:average_cpc': 'avg_cpc',
};

/**
 * Applies transform (if any) to a raw metric value.
 * Returns { metricKey, value } with normalized key and value.
 *
 * AI2 fix: ensures all platforms store consistent units.
 */
export function normalizeMetricValue(
  platform: string,
  rawKey: string,
  rawValue: string,
): { metricKey: string; value: number } {
  const lookupKey = `${platform}:${rawKey}`;

  const transform = METRIC_TRANSFORMS[lookupKey];
  const value = transform ? transform(rawValue) : Number(rawValue);

  const metricKey = METRIC_KEY_REMAP[lookupKey] ?? rawKey;

  return { metricKey, value };
}
