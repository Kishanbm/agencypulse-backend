/**
 * Unit tests — MetricsService
 *
 * Covers:
 *   Area 1: Data ingestion — upsertMetrics builds correct SQL and params
 *   Area 2: Idempotency — ON CONFLICT DO UPDATE clause present in SQL
 *   Area 3: Normalization applied before INSERT (cost_micros, CTR)
 *   Area 4: Date correctness — recordedAt sliced to YYYY-MM-DD (no time component)
 *   Area 5: Dimension handling — '' → NULL, whitespace trimmed
 *   Area 7: Batch upsert — 500-row chunks, total count returned
 *   Area 9: Edge cases — empty input, partial rows, invalid numeric strings
 *
 * PrismaService and SystemPrismaService are fully mocked — no DB required.
 */

import { MetricsService } from '../metrics.service';
import { IntegrationPlatform } from '@prisma/client';
import { MetricRowInput } from '../dto/query-metrics.dto';

// ─── Mock factories ──────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    metricValue: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    metricDefinition: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function makeSystemPrismaMock() {
  return {
    metricDefinition: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeCacheMock() {
  return {
    // Pass-through: tests assert on prisma calls, not cache
    getOrSet: jest.fn().mockImplementation((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
    incrementVersion: jest.fn().mockResolvedValue(1),
    getVersion: jest.fn().mockResolvedValue('0'),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const CAMPAIGN_1 = '00000000-0000-4000-8000-000000000010';

function makeRow(overrides: Partial<MetricRowInput> = {}): MetricRowInput {
  return {
    metricKey: 'sessions',
    value: '100',
    recordedAt: '2024-01-15',
    ...overrides,
  };
}

function makeRows(count: number, base: Partial<MetricRowInput> = {}): MetricRowInput[] {
  return Array.from({ length: count }, (_, i) =>
    makeRow({ ...base, metricKey: `metric_${i}`, recordedAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}` }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MetricsService', () => {
  let service: MetricsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let systemPrisma: ReturnType<typeof makeSystemPrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    systemPrisma = makeSystemPrismaMock();
    service = new MetricsService(prisma as any, systemPrisma as any, makeCacheMock() as any);
    jest.clearAllMocks();
  });

  // ─── Area 1: Data Ingestion ─────────────────────────────────────────────

  describe('Area 1 — Data Ingestion', () => {
    it('calls $executeRawUnsafe once for a single-row batch', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(1);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [makeRow()]);

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('passes tenantId and campaignId as first two params', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(1);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [makeRow()]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      // params[0] is SQL, params[1] = tenantId, params[2] = campaignId
      expect(params[1]).toBe(TENANT_A);
      expect(params[2]).toBe(CAMPAIGN_1);
    });

    it('passes platform as third param', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(1);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GOOGLE_ADS, [
        makeRow({ metricKey: 'clicks', value: '500' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[3]).toBe('GOOGLE_ADS');
    });

    it('returns total number of upserted rows', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(3);

      const count = await service.upsertMetrics(
        TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4,
        [makeRow(), makeRow({ metricKey: 'totalUsers' }), makeRow({ metricKey: 'newUsers' })],
      );

      expect(count).toBe(3);
    });

    it('GA4 metric rows: all 6 platform metrics ingested in one call', async () => {
      const ga4Metrics: MetricRowInput[] = [
        'sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration',
      ].map((metricKey) => makeRow({ metricKey, value: '100', recordedAt: '2024-01-15' }));

      prisma.$executeRawUnsafe.mockResolvedValueOnce(6);
      const count = await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, ga4Metrics);

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      expect(count).toBe(6);
    });
  });

  // ─── Area 2: Idempotency ────────────────────────────────────────────────

  describe('Area 2 — Idempotency', () => {
    it('SQL contains ON CONFLICT DO UPDATE clause', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [makeRow()]);

      const sql: string = prisma.$executeRawUnsafe.mock.calls[0][0];
      expect(sql).toMatch(/ON CONFLICT/i);
      expect(sql).toMatch(/DO UPDATE/i);
    });

    it('SQL conflict target includes tenant_id (multi-tenant isolation in upsert)', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [makeRow()]);

      const sql: string = prisma.$executeRawUnsafe.mock.calls[0][0];
      expect(sql).toMatch(/tenant_id/);
    });

    it('SQL conflict target includes COALESCE for dimension_key and dimension_val', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [makeRow()]);

      const sql: string = prisma.$executeRawUnsafe.mock.calls[0][0];
      expect(sql).toMatch(/COALESCE\s*\(\s*dimension_key/i);
      expect(sql).toMatch(/COALESCE\s*\(\s*dimension_val/i);
    });

    it('SQL updates value and updated_at on conflict', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [makeRow()]);

      const sql: string = prisma.$executeRawUnsafe.mock.calls[0][0];
      expect(sql).toMatch(/value\s*=\s*EXCLUDED\.value/i);
      expect(sql).toMatch(/updated_at\s*=\s*now\(\)/i);
    });
  });

  // ─── Area 3: Normalization ──────────────────────────────────────────────
  //
  // $executeRawUnsafe is called as: fn(sql, ...params)
  // params array = [tenantId, campaignId, platform, metricKey, recordedAt, value, dimKey, dimVal]
  // So mock.calls[0] indices:
  //   [0]=sql, [1]=tenantId, [2]=campaignId, [3]=platform,
  //   [4]=metricKey, [5]=recordedAt, [6]=value, [7]=dimKey, [8]=dimVal

  describe('Area 3 — Normalization applied before INSERT', () => {
    it('Google Ads cost_micros is divided by 1M before storage', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GOOGLE_ADS, [
        makeRow({ metricKey: 'cost_micros', value: '3000000' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      // index 6 = value (after sql[0], tenantId[1], campaignId[2], platform[3], metricKey[4], recordedAt[5])
      const value = params[6];
      expect(value).toBe(3); // 3,000,000 micros → $3.00
    });

    it('Google Ads cost_micros key remapped to "cost" in storage', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GOOGLE_ADS, [
        makeRow({ metricKey: 'cost_micros', value: '1000000' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      const metricKey = params[4]; // index 4 = metricKey
      expect(metricKey).toBe('cost');
    });

    it('Google Ads CTR fraction multiplied by 100 before storage', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GOOGLE_ADS, [
        makeRow({ metricKey: 'ctr', value: '0.035' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      const value = params[6]; // index 6 = value
      expect(value).toBeCloseTo(3.5, 5); // 0.035 → 3.5%
    });

    it('Google Ads average_cpc divided by 1M and key remapped to avg_cpc', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GOOGLE_ADS, [
        makeRow({ metricKey: 'average_cpc', value: '1500000' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[4]).toBe('avg_cpc');     // key remapped
      expect(params[6]).toBeCloseTo(1.5, 6); // value normalized
    });

    it('GA4 sessions pass through without transformation', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ metricKey: 'sessions', value: '1234' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[4]).toBe('sessions');
      expect(params[6]).toBe(1234);
    });

    it('Meta Ads spend passes through (Meta returns USD directly)', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.META_ADS, [
        makeRow({ metricKey: 'spend', value: '245.75' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[4]).toBe('spend');
      expect(params[6]).toBeCloseTo(245.75, 2);
    });
  });

  // ─── Area 4: Date correctness ───────────────────────────────────────────

  describe('Area 4 — Date correctness', () => {
    it('passes recordedAt as YYYY-MM-DD to SQL params', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ recordedAt: '2024-03-15' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      const recordedAt = params[5]; // index 5 = recordedAt
      expect(recordedAt).toBe('2024-03-15');
    });

    it('strips time component from ISO timestamp (keeps YYYY-MM-DD only)', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ recordedAt: '2024-03-15T14:30:00.000Z' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      const recordedAt = params[5]; // index 5 = recordedAt
      expect(recordedAt).toBe('2024-03-15'); // time stripped
      expect(recordedAt).toHaveLength(10);
    });

    it('handles date already in YYYY-MM-DD format correctly', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ recordedAt: '2024-12-31' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[5]).toBe('2024-12-31');
    });

    it('multiple rows with different dates produce correct recorded_at per row', async () => {
      const rows: MetricRowInput[] = [
        makeRow({ metricKey: 'sessions', recordedAt: '2024-01-01' }),
        makeRow({ metricKey: 'sessions', recordedAt: '2024-01-02' }),
      ];

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, rows);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      // Row 1: [sql, t, c, p, mk, ra, v, dk, dv] — ra at index 5
      // Row 2: indices offset by 8 (8 params per row): index 5+8=13
      const date1 = params[5];
      const date2 = params[13]; // 8 params per row
      expect(date1).toBe('2024-01-01');
      expect(date2).toBe('2024-01-02');
    });
  });

  // ─── Area 5: Dimension handling ─────────────────────────────────────────
  // Per-row params: [tenantId, campaignId, platform, metricKey, recordedAt, value, dimKey, dimVal]
  // In mock.calls[0]: [sql=0, tenantId=1, campaignId=2, platform=3, metricKey=4,
  //                    recordedAt=5, value=6, dimKey=7, dimVal=8]

  describe('Area 5 — Dimension handling', () => {
    it('empty string dimensionKey normalized to null', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ dimensionKey: '', dimensionVal: 'US' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      const dimKey = params[7]; // index 7 = dimension_key
      expect(dimKey).toBeNull();
    });

    it('empty string dimensionVal normalized to null', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ dimensionKey: 'country', dimensionVal: '' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      const dimVal = params[8]; // index 8 = dimension_val
      expect(dimVal).toBeNull();
    });

    it('whitespace-only dimensionKey normalized to null', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ dimensionKey: '   ', dimensionVal: 'US' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[7]).toBeNull();
    });

    it('whitespace-only dimensionVal normalized to null', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ dimensionKey: 'country', dimensionVal: '   ' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[8]).toBeNull();
    });

    it('valid dimensionKey and dimensionVal are preserved', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ dimensionKey: 'country', dimensionVal: 'US' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[7]).toBe('country');
      expect(params[8]).toBe('US');
    });

    it('undefined dimensionKey stored as null (no dimension row)', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ dimensionKey: undefined, dimensionVal: undefined }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[7]).toBeNull();
      expect(params[8]).toBeNull();
    });
  });

  // ─── Area 7: Batch upsert behavior ──────────────────────────────────────

  describe('Area 7 — Batch upsert behavior (500-row chunks)', () => {
    it('exactly 500 rows → single $executeRawUnsafe call', async () => {
      prisma.$executeRawUnsafe.mockResolvedValue(500);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, makeRows(500));

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('501 rows → two $executeRawUnsafe calls (500 + 1)', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(500).mockResolvedValueOnce(1);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, makeRows(501));

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('1000 rows → two calls of 500 each', async () => {
      prisma.$executeRawUnsafe.mockResolvedValue(500);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, makeRows(1000));

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('1001 rows → three calls (500 + 500 + 1)', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(500).mockResolvedValueOnce(500).mockResolvedValueOnce(1);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, makeRows(1001));

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    });

    it('returns sum of all batch counts', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(500).mockResolvedValueOnce(2);

      const count = await service.upsertMetrics(
        TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, makeRows(502),
      );

      expect(count).toBe(502);
    });

    it('250 rows → single call (well under 500 limit)', async () => {
      prisma.$executeRawUnsafe.mockResolvedValue(250);

      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, makeRows(250));

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Area 9: Edge cases ──────────────────────────────────────────────────

  describe('Area 9 — Edge cases', () => {
    it('returns 0 and makes no DB call for empty rows array', async () => {
      const count = await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, []);

      expect(count).toBe(0);
      expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('handles partial data: only some metrics present for a date', async () => {
      // Only sessions and bounceRate provided (not all 6 GA4 metrics)
      const partialRows: MetricRowInput[] = [
        makeRow({ metricKey: 'sessions', value: '1000', recordedAt: '2024-01-15' }),
        makeRow({ metricKey: 'bounceRate', value: '45.2', recordedAt: '2024-01-15' }),
      ];

      prisma.$executeRawUnsafe.mockResolvedValueOnce(2);
      const count = await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, partialRows);

      expect(count).toBe(2);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('handles value "0" without crashing (zero-traffic day)', async () => {
      await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ value: '0' }),
      ]);

      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[6]).toBe(0); // Number('0') = 0
    });

    it('handles single row with all fields populated', async () => {
      prisma.$executeRawUnsafe.mockResolvedValueOnce(1);

      const count = await service.upsertMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, [
        makeRow({ metricKey: 'sessions', value: '500', recordedAt: '2024-06-01', dimensionKey: 'country', dimensionVal: 'GB' }),
      ]);

      expect(count).toBe(1);
      const params = prisma.$executeRawUnsafe.mock.calls[0];
      expect(params[7]).toBe('country');
      expect(params[8]).toBe('GB');
    });
  });

  // ─── getMetrics — Area 6, 8 ──────────────────────────────────────────────
  // Phase 4.2: getMetrics now uses $queryRawUnsafe (raw SQL with DATE_TRUNC + GROUP BY).
  // Full query-layer coverage lives in metrics.query.spec.ts.
  // These tests verify the basic SQL contract (tenantId as $1, campaignId as $2).

  describe('getMetrics', () => {
    const FROM = '2024-01-01';
    const TO = '2024-01-31';

    it('calls $queryRawUnsafe with tenantId as first param', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await service.getMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, FROM, TO);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const params = prisma.$queryRawUnsafe.mock.calls[0];
      // params[0] = sql string, params[1] = $1 (tenantId), params[2] = $2 (campaignId)
      expect(params[1]).toBe(TENANT_A);
      expect(params[2]).toBe(CAMPAIGN_1);
    });

    it('returns the raw rows from $queryRawUnsafe', async () => {
      const raw = [
        { period: new Date('2024-01-01'), metric_key: 'sessions', value: 100 },
      ];
      prisma.$queryRawUnsafe.mockResolvedValueOnce(raw);

      const result = await service.getMetrics(TENANT_A, CAMPAIGN_1, IntegrationPlatform.GA4, FROM, TO);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── getMetricDefinitions — Area 8 ──────────────────────────────────────

  describe('getMetricDefinitions', () => {
    it('filters by platform', async () => {
      const mockDefs = [{ platform: 'GA4', metricKey: 'sessions', label: 'Sessions', category: 'traffic', dataType: 'integer', unit: 'count' }];
      prisma.metricDefinition.findMany.mockResolvedValueOnce(mockDefs);

      const result = await service.getMetricDefinitions(IntegrationPlatform.GA4);

      const where = prisma.metricDefinition.findMany.mock.calls[0][0].where;
      expect(where.platform).toBe('GA4');
      expect(result).toEqual(mockDefs);
    });

    it('orders by category', async () => {
      prisma.metricDefinition.findMany.mockResolvedValueOnce([]);

      await service.getMetricDefinitions(IntegrationPlatform.GOOGLE_ADS);

      const orderBy = prisma.metricDefinition.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ category: 'asc' });
    });
  });

  // ─── seedMetricDefinitions ───────────────────────────────────────────────

  describe('seedMetricDefinitions', () => {
    it('calls upsert for every seed definition', async () => {
      await service.seedMetricDefinitions();

      // METRIC_SEEDS has 18 entries (6 GA4 + 6 Google Ads + 6 Meta Ads)
      expect(systemPrisma.metricDefinition.upsert).toHaveBeenCalledTimes(18);
    });

    it('uses platform + metricKey as unique where clause', async () => {
      await service.seedMetricDefinitions();

      const firstCall = systemPrisma.metricDefinition.upsert.mock.calls[0][0];
      expect(firstCall.where).toHaveProperty('platform_metricKey');
      expect(firstCall.where.platform_metricKey).toHaveProperty('platform');
      expect(firstCall.where.platform_metricKey).toHaveProperty('metricKey');
    });
  });
});
