import './helpers/mock-fetch';
import { mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { GooglePagespeedApiService } from '../google-pagespeed-api.service';
import fixture from '../__fixtures__/google-pagespeed.fixture.json';

describe('GooglePagespeedApiService', () => {
  let service: GooglePagespeedApiService;

  beforeEach(() => {
    service = new GooglePagespeedApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response (mobile + desktop)', async () => {
    // Two calls: mobile then desktop
    mockFetchSequence([
      { body: fixture, status: 200 },
      { body: fixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', 'https://example.com', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('performance_score_mobile');
    expect(keys).toContain('performance_score_desktop');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when lighthouseResult.categories is empty', async () => {
    const emptyBody = { lighthouseResult: { categories: {} } };
    mockFetchSequence([
      { body: emptyBody, status: 200 },
      { body: emptyBody, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', 'https://example.com', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when lighthouseResult is missing', async () => {
    mockFetchSequence([
      { body: {}, status: 200 },
      { body: {}, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-api-key', 'https://example.com', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('missing target URL — throws when targetUrl is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-api-key', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
