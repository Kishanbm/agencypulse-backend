import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { PinterestOrganicApiService } from '../pinterest-organic-api.service';
import fixture from '../__fixtures__/pinterest-organic.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('PinterestOrganicApiService', () => {
  let service: PinterestOrganicApiService;

  beforeEach(() => {
    service = new PinterestOrganicApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('saves');
    expect(keys).toContain('pin_clicks');
    expect(keys).toContain('outbound_clicks');
    expect(keys).toContain('engagements');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ all: { daily_metrics: [] } });
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      all: {
        daily_metrics: [
          {
            date: '2024-01-15',
            metrics: { IMPRESSION: null, SAVE: null, PIN_CLICK: null, OUTBOUND_CLICK: null, ENGAGEMENT: null },
          },
        ],
      },
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'default', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'default', dateRange),
    ).rejects.toThrow();
  });
});
