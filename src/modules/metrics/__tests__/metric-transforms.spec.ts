/**
 * Unit tests — metric-transforms.ts
 *
 * Covers:
 *   Area 3: Normalization (cost_micros → USD, CTR fraction → %, key remaps)
 *   Area 4: Consistent units across platforms (GA4/Google Ads/Meta Ads pass-through)
 *
 * These are pure functions — no DB, no DI, no mocks required.
 */

import { normalizeMetricValue } from '../constants/metric-transforms';

describe('normalizeMetricValue', () => {
  // ─── Google Ads ──────────────────────────────────────────────────────────

  describe('Google Ads — cost_micros', () => {
    it('divides cost_micros by 1,000,000 to get USD', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'cost_micros', '5000000');
      expect(result.value).toBe(5);
    });

    it('remaps key from cost_micros → cost', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'cost_micros', '1000000');
      expect(result.metricKey).toBe('cost');
    });

    it('handles fractional micros (e.g. $0.50 = 500000 micros)', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'cost_micros', '500000');
      expect(result.value).toBeCloseTo(0.5, 6);
      expect(result.metricKey).toBe('cost');
    });

    it('handles zero cost', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'cost_micros', '0');
      expect(result.value).toBe(0);
    });

    it('handles large spend (e.g. $50,000 = 50000000000 micros)', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'cost_micros', '50000000000');
      expect(result.value).toBe(50000);
    });
  });

  describe('Google Ads — ctr', () => {
    it('multiplies CTR fraction by 100 to get percentage', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'ctr', '0.05');
      expect(result.value).toBeCloseTo(5.0, 6);
    });

    it('preserves key name as ctr', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'ctr', '0.05');
      expect(result.metricKey).toBe('ctr');
    });

    it('0.0 CTR → 0.0%', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'ctr', '0');
      expect(result.value).toBe(0);
    });

    it('100% CTR edge case (1.0 fraction → 100)', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'ctr', '1.0');
      expect(result.value).toBeCloseTo(100, 6);
    });

    it('typical 2.5% CTR stored as 2.5, not 0.025', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'ctr', '0.025');
      expect(result.value).toBeCloseTo(2.5, 6);
    });
  });

  describe('Google Ads — average_cpc', () => {
    it('divides average_cpc by 1,000,000 to get USD', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'average_cpc', '2500000');
      expect(result.value).toBeCloseTo(2.5, 6);
    });

    it('remaps key from average_cpc → avg_cpc', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'average_cpc', '2500000');
      expect(result.metricKey).toBe('avg_cpc');
    });

    it('handles $0 CPC', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'average_cpc', '0');
      expect(result.value).toBe(0);
      expect(result.metricKey).toBe('avg_cpc');
    });
  });

  describe('Google Ads — pass-through metrics (clicks, impressions, conversions)', () => {
    it('clicks pass through unchanged', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'clicks', '1234');
      expect(result.value).toBe(1234);
      expect(result.metricKey).toBe('clicks');
    });

    it('impressions pass through unchanged', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'impressions', '99876');
      expect(result.value).toBe(99876);
      expect(result.metricKey).toBe('impressions');
    });

    it('conversions pass through unchanged', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'conversions', '42');
      expect(result.value).toBe(42);
      expect(result.metricKey).toBe('conversions');
    });
  });

  // ─── GA4 ─────────────────────────────────────────────────────────────────

  describe('GA4 — all metrics pass through unchanged', () => {
    const ga4Metrics = [
      { key: 'sessions', value: '1500' },
      { key: 'totalUsers', value: '820' },
      { key: 'newUsers', value: '400' },
      { key: 'screenPageViews', value: '3200' },
      { key: 'bounceRate', value: '42.5' },        // GA4 already returns as percentage
      { key: 'averageSessionDuration', value: '185.3' },
    ];

    for (const { key, value } of ga4Metrics) {
      it(`GA4.${key} passes through without transformation`, () => {
        const result = normalizeMetricValue('GA4', key, value);
        expect(result.value).toBeCloseTo(Number(value), 6);
        expect(result.metricKey).toBe(key);
      });
    }
  });

  // ─── Meta Ads ─────────────────────────────────────────────────────────────

  describe('Meta Ads — all metrics pass through unchanged', () => {
    const metaMetrics = [
      { key: 'impressions', value: '50000' },
      { key: 'clicks', value: '1200' },
      { key: 'spend', value: '350.50' },     // Meta returns spend in USD already
      { key: 'ctr', value: '2.4' },          // Meta returns CTR as percentage already
      { key: 'cpc', value: '0.29' },         // Meta returns CPC in USD already
      { key: 'conversions', value: '15' },
    ];

    for (const { key, value } of metaMetrics) {
      it(`META_ADS.${key} passes through without transformation`, () => {
        const result = normalizeMetricValue('META_ADS', key, value);
        expect(result.value).toBeCloseTo(Number(value), 6);
        expect(result.metricKey).toBe(key);
      });
    }
  });

  // ─── Unknown platforms / metrics ──────────────────────────────────────────

  describe('unknown / unregistered metrics', () => {
    it('unknown platform metric passes through without transformation', () => {
      const result = normalizeMetricValue('LINKEDIN_ADS', 'impressions', '8000');
      expect(result.value).toBe(8000);
      expect(result.metricKey).toBe('impressions');
    });

    it('unknown Google Ads metric key passes through unchanged', () => {
      const result = normalizeMetricValue('GOOGLE_ADS', 'video_views', '300');
      expect(result.value).toBe(300);
      expect(result.metricKey).toBe('video_views');
    });

    it('handles numeric string with decimal precision', () => {
      const result = normalizeMetricValue('META_ADS', 'spend', '1234.567890');
      expect(result.value).toBeCloseTo(1234.56789, 5);
    });
  });

  // ─── Consistency / unit contract ──────────────────────────────────────────

  describe('unit contract — Area 3 consistency guarantee', () => {
    it('Google Ads cost is always in USD (not micros)', () => {
      // $1.50 worth of spend = 1500000 micros
      const { value } = normalizeMetricValue('GOOGLE_ADS', 'cost_micros', '1500000');
      // Must be < 100 if in USD, would be > 1,000,000 if stored in micros
      expect(value).toBeLessThan(100);
      expect(value).toBeCloseTo(1.5, 6);
    });

    it('Google Ads CTR is always 0-100 (not 0-1 fraction)', () => {
      // 5% CTR from API = 0.05
      const { value } = normalizeMetricValue('GOOGLE_ADS', 'ctr', '0.05');
      expect(value).toBeGreaterThan(1);    // would be <1 if stored as fraction
      expect(value).toBeLessThanOrEqual(100);
    });

    it('Meta Ads CTR is stored as-is (Meta returns % directly)', () => {
      // Meta returns "2.4" meaning 2.4%
      const { value } = normalizeMetricValue('META_ADS', 'ctr', '2.4');
      expect(value).toBeCloseTo(2.4, 4);  // not multiplied again
    });
  });
});
