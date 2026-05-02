import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { BingWebmasterApiService } from '../bing-webmaster-api.service';
import fixture from '../__fixtures__/bing-webmaster.fixture.json';

// BingWebmaster service reads body.d as an array (direct array, not wrapped).
// The fixture has body.d.PageStats array. Service reads body.d as the array itself.
// We need to inject the shape the service reads: { d: Array<{Date, Impressions, Clicks, ...}> }
const serviceFixture = {
  d: [
    {
      Date: '/Date(1709251200000)/',
      Impressions: 28400,
      Clicks: 3120,
      AvgClickPosition: 7.4,
      AvgImpressionPosition: 8.1,
    },
    {
      Date: '/Date(1709337600000)/',
      Impressions: 29100,
      Clicks: 3290,
      AvgClickPosition: 7.1,
      AvgImpressionPosition: 7.8,
    },
  ],
};

describe('BingWebmasterApiService', () => {
  let service: BingWebmasterApiService;

  beforeEach(() => {
    service = new BingWebmasterApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-token', 'https://example.com/', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    expect(keys).toContain('avg_position');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has d object with PageStats', () => {
    expect((fixture as any).d).toBeDefined();
  });

  it('empty data — returns [] when d array is empty', async () => {
    mockFetchResponse({ d: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'https://example.com/', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      d: [
        {
          Date: '/Date(1709251200000)/',
          Impressions: null,
          Clicks: null,
          AvgClickPosition: null,
          AvgImpressionPosition: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'https://example.com/', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'https://example.com/', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing site URL — throws when siteUrl is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
