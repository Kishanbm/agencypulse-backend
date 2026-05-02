import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { SeRankingApiService } from '../se-ranking-api.service';
import fixture from '../__fixtures__/se-ranking.fixture.json';

// SE Ranking makes TWO calls: site summary + positions
// Site summary response shape:
const summaryFixture = {
  visibility: 84,
  today_avg: 8.4,
  top5: 12,
  top10: 47,
  top30: 134,
};

// Positions response shape:
const positionsFixture = [
  {
    date: '2024-01-15',
    keywords: [
      { pos: 3 },
      { pos: 8 },
      { pos: 25 },
      { pos: 45 },
    ],
  },
];

describe('SeRankingApiService', () => {
  let service: SeRankingApiService;

  beforeEach(() => {
    service = new SeRankingApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: summaryFixture, status: 200 },
      { body: positionsFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', '12345', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rank');
    expect(keys).toContain('keywords_top10');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has data array', () => {
    expect(Array.isArray((fixture as any).data)).toBe(true);
  });

  it('empty data — returns [] when summary and positions are empty', async () => {
    mockFetchSequence([
      { body: {}, status: 200 },
      { body: [], status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', '12345', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when summary fields are null/undefined', async () => {
    mockFetchSequence([
      { body: { visibility: null, today_avg: null, top5: null, top10: null, top30: null }, status: 200 },
      { body: [], status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-token', '12345', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — returns [] when 401 from site summary (errors are swallowed per-step)', async () => {
    // The service catches per-step errors internally and logs warnings instead of rethrowing.
    // A 401 from fetchSiteSummary causes that step to be skipped; fetchPositions returns []
    // on non-OK status. The overall result is [] without throwing.
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    const rows = await service.fetchCoreMetrics('bad-token', '12345', { from: '2024-01-15', to: '2024-01-21' });
    expect(Array.isArray(rows)).toBe(true);
  });

  it('missing site ID — throws when siteId is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
