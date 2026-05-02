import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { XOrganicApiService } from '../x-organic-api.service';
import fixture from '../__fixtures__/x-organic.fixture.json';
import page2Fixture from '../__fixtures__/x-organic.page2.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('XOrganicApiService', () => {
  let service: XOrganicApiService;

  beforeEach(() => {
    service = new XOrganicApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'user-123456', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('likes');
    expect(keys).toContain('retweets');
    expect(keys).toContain('replies');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: [], meta: {} });
    const rows = await service.fetchCoreMetrics('test-token', 'user-123456', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      data: [{ public_metrics: { impression_count: null, like_count: null, retweet_count: null, reply_count: null } }],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'user-123456', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'user-123456', dateRange),
    ).rejects.toThrow();
  });
});
