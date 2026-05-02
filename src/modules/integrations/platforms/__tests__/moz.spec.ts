import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { MozApiService } from '../moz-api.service';
import fixture from '../__fixtures__/moz.fixture.json';

const accountJson = JSON.stringify({ accessId: 'mozscape-abc123', domain: 'example.com' });

describe('MozApiService', () => {
  let service: MozApiService;

  beforeEach(() => {
    service = new MozApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-secret', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('domain_authority');
    expect(keys).toContain('page_authority');
    expect(keys).toContain('spam_score');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when results array is empty', async () => {
    mockFetchResponse({ results: [] });
    const rows = await service.fetchCoreMetrics('test-secret', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      results: [
        {
          domain_authority: null,
          page_authority: null,
          spam_score: null,
          external_links_to_root_domain: null,
          root_domains_to_root_domain: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-secret', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-secret', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
