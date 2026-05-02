import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { SimplifiApiService } from '../simplifi-api.service';
import fixture from '../__fixtures__/simplifi.fixture.json';

const accountJson = JSON.stringify({ orgId: '12345', appKey: 'app-key-xyz' });
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('SimplifiApiService', () => {
  let service: SimplifiApiService;

  beforeEach(() => {
    service = new SimplifiApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse({
      campaigns: [
        {
          stats: { impressions: 56300, clicks: 1241, spend: 692.40, conversions: 48 },
        },
        {
          stats: { impressions: 59700, clicks: 1318, spend: 731.80, conversions: 53 },
        },
      ],
    });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    expect(keys).toContain('spend');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ campaigns: [] });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      campaigns: [{ stats: { impressions: null, clicks: null, spend: null } }],
    });
    await expect(
      service.fetchCoreMetrics('test-token', accountJson, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, dateRange),
    ).rejects.toThrow();
  });
});
