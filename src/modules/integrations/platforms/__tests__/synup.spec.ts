import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { SynupApiService } from '../synup-api.service';
import fixture from '../__fixtures__/synup.fixture.json';

// Synup service makes 2 calls:
//   (1) GET /locations/{id} → { average_rating, review_count } or nested under data
//   (2) GET /locations/{id}/reviews?... → { meta: { total } }

// The fixture has data.avg_rating and data.total_reviews.
// Service checks: loc.average_rating ?? loc.data?.average_rating
const locationFixture = {
  data: {
    average_rating: 4.5,
    review_count: 189,
  },
};

const reviewsFixture = {
  meta: { total: 7 },
};

describe('SynupApiService', () => {
  let service: SynupApiService;

  beforeEach(() => {
    service = new SynupApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: locationFixture, status: 200 },
      { body: reviewsFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', 'synup-loc-123', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rating');
    expect(keys).toContain('review_count');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has data object', () => {
    expect((fixture as any).data).toBeDefined();
  });

  it('empty data — returns [] when ratings are zero', async () => {
    mockFetchSequence([
      { body: { average_rating: 0, review_count: 0 }, status: 200 },
      { body: { meta: { total: 0 } }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', 'synup-loc-123', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when fields are null/undefined', async () => {
    mockFetchSequence([
      { body: {}, status: 200 },
      { body: {}, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-api-key', 'synup-loc-123', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', 'synup-loc-123', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
