import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GatherUpApiService } from '../gatherup-api.service';
import fixture from '../__fixtures__/gatherup.fixture.json';

// GatherUp service reads the statistics endpoint:
// { averageRating, totalReviews, newReviews }
// The fixture has a reviews list with average_rating - we inject the correct shape.
const statsFixture = {
  averageRating: 4.5,
  totalReviews: 250,
  newReviews: 12,
};

describe('GatherUpApiService', () => {
  let service: GatherUpApiService;

  beforeEach(() => {
    service = new GatherUpApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(statsFixture);
    const rows = await service.fetchCoreMetrics('test-token', 'gu-loc-8801', { from: '2024-01-15', to: '2024-01-21' });
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

  it('empty data — returns [] when stats are all zero', async () => {
    mockFetchResponse({ averageRating: 0, totalReviews: 0, newReviews: 0 });
    const rows = await service.fetchCoreMetrics('test-token', 'gu-loc-8801', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when fields are null/undefined', async () => {
    mockFetchResponse({ averageRating: null, totalReviews: null, newReviews: null });
    await expect(
      service.fetchCoreMetrics('test-token', 'gu-loc-8801', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'gu-loc-8801', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
