import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { InstagramAdsApiService } from '../instagram-ads-api.service';
import fixture from '../__fixtures__/instagram-ads.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('InstagramAdsApiService', () => {
  let service: InstagramAdsApiService;

  beforeEach(() => {
    service = new InstagramAdsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'act_123456789', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    expect(keys).toContain('spend');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: [], paging: {} });
    const rows = await service.fetchCoreMetrics('test-token', 'act_123456789', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      data: [
        {
          date_start: '2024-01-15',
          impressions: null,
          clicks: null,
          spend: null,
          actions: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'act_123456789', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'act_123456789', dateRange),
    ).rejects.toThrow();
  });
});
