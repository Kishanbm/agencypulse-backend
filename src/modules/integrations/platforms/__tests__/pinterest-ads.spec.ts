import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { PinterestAdsApiService } from '../pinterest-ads-api.service';
import fixture from '../__fixtures__/pinterest-ads.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('PinterestAdsApiService', () => {
  let service: PinterestAdsApiService;

  beforeEach(() => {
    service = new PinterestAdsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Fixture uses IMPRESSION_1, SPEND_IN_DOLLAR fields — supply CLICKTHROUGH_1 for clicks too
    const data = fixture.data.map((d: any) => ({ ...d, CLICKTHROUGH_1: d.CLICK_1 }));
    mockFetchResponse(data);
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
    mockFetchResponse([]);
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse([{ DATE: '2024-01-15', SPEND_IN_DOLLAR: null, IMPRESSION_1: null, CLICKTHROUGH_1: null }]);
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
