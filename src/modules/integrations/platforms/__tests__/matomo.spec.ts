import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { MatomoApiService } from '../matomo-api.service';
import fixture from '../__fixtures__/matomo.fixture.json';

const accountJson = JSON.stringify({ matomoUrl: 'https://analytics.test.com', siteId: '1' });
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('MatomoApiService', () => {
  let service: MatomoApiService;

  beforeEach(() => {
    service = new MatomoApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sessions');
    expect(keys).toContain('users');
    expect(keys).toContain('pageviews');
    expect(keys).toContain('bounce_rate');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns zero metrics', async () => {
    mockFetchResponse({ nb_visits: 0, nb_uniq_visitors: 0, nb_pageviews: 0 });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({ nb_visits: null, nb_uniq_visitors: null, nb_pageviews: null, bounce_rate: null });
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
