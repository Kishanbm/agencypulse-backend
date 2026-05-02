import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { YelpApiService } from '../yelp-api.service';
import fixture from '../__fixtures__/yelp.fixture.json';

describe('YelpApiService', () => {
  let service: YelpApiService;

  beforeEach(() => {
    service = new YelpApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-api-key', 'the-yellow-house-san-francisco', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rating');
    expect(keys).toContain('review_count');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when rating and count are 0', async () => {
    mockFetchResponse({ review_count: 0, rating: 0 });
    const rows = await service.fetchCoreMetrics('test-api-key', 'some-biz', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when rating/review_count are undefined', async () => {
    mockFetchResponse({ id: 'some-biz' });
    await expect(
      service.fetchCoreMetrics('test-api-key', 'some-biz', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', 'some-biz', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
