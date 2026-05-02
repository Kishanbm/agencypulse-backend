import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { TrustpilotApiService } from '../trustpilot-api.service';
import reviewsFixture from '../__fixtures__/trustpilot.fixture.json';
import page2Fixture from '../__fixtures__/trustpilot.page2.fixture.json';

// Trustpilot service makes 2 calls:
//   (1) GET /business-units/{id}/web → { score: { trustScore }, numberOfReviews: { total } }
//   (2) GET /business-units/{id}/reviews?... → { pagination: { total } }

const profileFixture = {
  score: { trustScore: 4.7 },
  numberOfReviews: { total: 1250 },
};

const reviewsCountFixture = {
  pagination: { total: 12 },
};

describe('TrustpilotApiService', () => {
  let service: TrustpilotApiService;

  beforeEach(() => {
    service = new TrustpilotApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: profileFixture, status: 200 },
      { body: reviewsCountFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', 'test-business-unit-id', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rating');
    expect(keys).toContain('review_count');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('reviews fixture shape — fixture has reviews array', () => {
    expect(Array.isArray((reviewsFixture as any).reviews)).toBe(true);
  });

  it('empty data — returns [] when score and count are 0', async () => {
    mockFetchSequence([
      { body: { score: { trustScore: 0 }, numberOfReviews: { total: 0 } }, status: 200 },
      { body: { pagination: { total: 0 } }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', 'test-business-unit-id', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when score/count fields are null/undefined', async () => {
    mockFetchSequence([
      { body: { score: {}, numberOfReviews: {} }, status: 200 },
      { body: { pagination: {} }, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-token', 'test-business-unit-id', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'test-business-unit-id', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('page2 fixture — is valid with reviews array', () => {
    expect(Array.isArray((page2Fixture as any).reviews)).toBe(true);
    expect(Array.isArray((page2Fixture as any).links)).toBe(true);
  });
});
