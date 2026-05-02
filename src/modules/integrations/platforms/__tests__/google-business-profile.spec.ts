import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GoogleBusinessProfileApiService } from '../google-business-profile-api.service';
import fixture from '../__fixtures__/google-business-profile.fixture.json';

// GBP service makes a single fetch for reviews page.
// Response: { reviews[], averageRating, totalReviewCount }
// The fixture already matches this shape.

const accountJson = JSON.stringify({
  accountId: 'accounts/12345',
  locationId: 'locations/67890',
});

describe('GoogleBusinessProfileApiService', () => {
  let service: GoogleBusinessProfileApiService;

  beforeEach(() => {
    service = new GoogleBusinessProfileApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('review_count');
    expect(keys).toContain('avg_rating');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('new_reviews counted from date range', async () => {
    const fixtureWithDateRange = {
      ...fixture,
      reviews: [
        {
          starRating: 'FIVE',
          createTime: '2024-01-16T10:00:00Z',
        },
      ],
      averageRating: 4.6,
      totalReviewCount: 248,
    };
    mockFetchResponse(fixtureWithDateRange);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('new_reviews');
  });

  it('empty data — returns [] when ratings are zero', async () => {
    mockFetchResponse({ reviews: [], averageRating: 0, totalReviewCount: 0 });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when fields are null/undefined', async () => {
    mockFetchResponse({ reviews: [], averageRating: null, totalReviewCount: null });
    await expect(
      service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('misconfigured — throws when accountJson is missing locationId', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', JSON.stringify({ accountId: 'accounts/123' }), { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
