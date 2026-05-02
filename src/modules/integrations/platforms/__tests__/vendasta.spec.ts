import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { VendastaApiService } from '../vendasta-api.service';
import fixture from '../__fixtures__/vendasta.fixture.json';

// Vendasta service makes 2 calls:
//   (1) GET /reviews/summary?accountId={id} → { averageRating, totalReviews }
//   (2) GET /reviews?accountId={id}&... → { reviews[], total }

const summaryFixture = {
  averageRating: 4.3,
  totalReviews: 420,
};

const reviewsFixture = {
  reviews: [{ reviewId: 'vend-rev-001' }, { reviewId: 'vend-rev-002' }],
  total: 2,
};

describe('VendastaApiService', () => {
  let service: VendastaApiService;

  beforeEach(() => {
    service = new VendastaApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: summaryFixture, status: 200 },
      { body: reviewsFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', 'AG-XXXXXXXXXX', { from: '2024-01-15', to: '2024-01-21' });
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

  it('empty data — returns [] when summary is zeros', async () => {
    mockFetchSequence([
      { body: { averageRating: 0, totalReviews: 0 }, status: 200 },
      { body: { reviews: [], total: 0 }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', 'AG-XXXXXXXXXX', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when summary fields are null/undefined', async () => {
    mockFetchSequence([
      { body: { averageRating: null, totalReviews: null }, status: 200 },
      { body: { reviews: [], total: 0 }, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-token', 'AG-XXXXXXXXXX', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'AG-XXXXXXXXXX', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
