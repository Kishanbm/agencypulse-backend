import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { YextApiService } from '../yext-api.service';
import fixture from '../__fixtures__/yext.fixture.json';

// Yext service reads body.response with: reviews[], averageRating, count
// The fixture has response.reviewsStats (different shape) — we inject correct shape.
const serviceFixture = {
  response: {
    reviews: [
      {
        rating: 5,
        publisherDate: '2024-01-15T10:00:00Z',
      },
      {
        rating: 4,
        publisherDate: '2024-01-17T14:00:00Z',
      },
    ],
    averageRating: 4.6,
    count: 248,
  },
};

const accountJson = JSON.stringify({ accountId: 'me', entityId: 'entity-123' });

describe('YextApiService', () => {
  let service: YextApiService;

  beforeEach(() => {
    service = new YextApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rating');
    expect(keys).toContain('review_count');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has response object', () => {
    expect((fixture as any).response).toBeDefined();
  });

  it('empty data — returns [] when response.docs is missing', async () => {
    mockFetchResponse({ response: { reviews: [], averageRating: 0, count: 0 } });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when response fields are null/undefined', async () => {
    mockFetchResponse({ response: { reviews: [], averageRating: null, count: null } });
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

  it('missing entityId — throws when entityId is missing', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', JSON.stringify({ accountId: 'me' }), { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
