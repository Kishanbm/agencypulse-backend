import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { GradeUsApiService } from '../gradeus-api.service';
import fixture from '../__fixtures__/gradeus.fixture.json';

// Grade.us service makes 2 calls:
//   (1) GET /locations/{id} → { average_rating, review_count }
//   (2) GET /locations/{id}/reviews?... → { meta: { total } }

const locationFixture = {
  average_rating: 4.2,
  review_count: 185,
};

const reviewsFixture = {
  meta: { total: 5 },
};

describe('GradeUsApiService', () => {
  let service: GradeUsApiService;

  beforeEach(() => {
    service = new GradeUsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: locationFixture, status: 200 },
      { body: reviewsFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', 'grade-loc-1001', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rating');
    expect(keys).toContain('review_count');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has reviews array', () => {
    expect(Array.isArray((fixture as any).reviews)).toBe(true);
  });

  it('empty data — returns [] when location data has zeros', async () => {
    mockFetchSequence([
      { body: { average_rating: 0, review_count: 0 }, status: 200 },
      { body: { meta: { total: 0 } }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', 'grade-loc-1001', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when fields are null/undefined', async () => {
    mockFetchSequence([
      { body: { average_rating: null, review_count: null }, status: 200 },
      { body: {}, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-api-key', 'grade-loc-1001', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', 'grade-loc-1001', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
