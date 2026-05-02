import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { InstagramOrganicApiService } from '../instagram-organic-api.service';
import fixture from '../__fixtures__/instagram-organic.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('InstagramOrganicApiService', () => {
  let service: InstagramOrganicApiService;

  beforeEach(() => {
    service = new InstagramOrganicApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'ig-user-17841412345678901', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('reach');
    expect(keys).toContain('profile_views');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'ig-user-17841412345678901', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric values are null/zero', async () => {
    mockFetchResponse({
      data: [
        { name: 'impressions', values: [{ value: null, end_time: '2024-01-15T07:00:00+0000' }] },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'ig-user-17841412345678901', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'ig-user-17841412345678901', dateRange),
    ).rejects.toThrow();
  });
});
