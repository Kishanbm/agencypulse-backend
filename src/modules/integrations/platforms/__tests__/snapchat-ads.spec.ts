import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { SnapchatAdsApiService } from '../snapchat-ads-api.service';
import fixture from '../__fixtures__/snapchat-ads.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('SnapchatAdsApiService', () => {
  let service: SnapchatAdsApiService;

  beforeEach(() => {
    service = new SnapchatAdsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    const body = {
      timeseries_stats: [
        {
          timeseries: fixture.lifetime_stats.map((s: any) => ({
            start_time: s.start_time,
            stats: {
              impressions: s.stats.impressions,
              swipes: s.stats.swipes,
              spend: s.stats.spend,
            },
          })),
        },
      ],
    };
    mockFetchResponse(body);
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ timeseries_stats: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      timeseries_stats: [
        {
          timeseries: [
            { start_time: '2024-01-15T00:00:00Z', stats: { impressions: null, swipes: null, spend: null } },
          ],
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'test-account', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'test-account', dateRange),
    ).rejects.toThrow();
  });
});
