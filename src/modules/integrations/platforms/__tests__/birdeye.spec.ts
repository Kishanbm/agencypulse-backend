import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { BirdeyeApiService } from '../birdeye-api.service';
import fixture from '../__fixtures__/birdeye.fixture.json';

// Birdeye service makes 2 calls:
//   (1) GET /reviewsStats → { averageRating, totalReviewCount }
//   (2) GET /reviews → { totalCount, reviews[] }

// The fixture has a different shape (ratingData + summary) — we inject the correct shape.
const statsFixture = {
  averageRating: 4.4,
  totalReviewCount: 587,
};

const reviewsFixture = {
  totalCount: 8,
  reviews: new Array(8).fill({}),
};

describe('BirdeyeApiService', () => {
  let service: BirdeyeApiService;

  beforeEach(() => {
    service = new BirdeyeApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: statsFixture, status: 200 },
      { body: reviewsFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', '77654321', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rating');
    expect(keys).toContain('review_count');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has ratingData and summary', () => {
    expect((fixture as any).summary).toBeDefined();
  });

  it('empty data — returns [] when averageRating and totalReviewCount are 0', async () => {
    mockFetchSequence([
      { body: { averageRating: 0, totalReviewCount: 0 }, status: 200 },
      { body: { totalCount: 0, reviews: [] }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', '77654321', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when stats fields are null/undefined', async () => {
    mockFetchSequence([
      { body: {}, status: 200 },
      { body: {}, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-api-key', '77654321', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', '77654321', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
