import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { XAdsApiService } from '../x-ads-api.service';
import fixture from '../__fixtures__/x-ads.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('XAdsApiService', () => {
  let service: XAdsApiService;

  beforeEach(() => {
    service = new XAdsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    expect(keys).toContain('spend');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      data: [
        {
          id: 'x-stat-null',
          id_data: [
            {
              metrics: {
                impressions: [null],
                clicks: [null],
                billed_charge_local_micro: [null],
              },
            },
          ],
          time_series: ['2024-01-15T00:00:00Z'],
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
