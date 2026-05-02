import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { UnbounceApiService } from '../unbounce-api.service';
import fixture from '../__fixtures__/unbounce.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('UnbounceApiService', () => {
  let service: UnbounceApiService;

  beforeEach(() => {
    service = new UnbounceApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Call 1: pages list
    mockFetchResponse(fixture);
    // Call 2+: leads per page (2 pages in fixture)
    mockFetchResponse({ leads: [{ id: 'lead-1' }, { id: 'lead-2' }, { id: 'lead-3' }] });
    mockFetchResponse({ leads: [{ id: 'lead-4' }] });

    const rows = await service.fetchCoreMetrics('test-token', 'acct-123', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('active_pages');
    expect(keys).toContain('total_leads');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when no pages exist', async () => {
    mockFetchResponse({ pages: [], metadata: { next: null } });
    const rows = await service.fetchCoreMetrics('test-token', 'acct-123', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when pages array contains null ids', async () => {
    mockFetchResponse({ pages: [{ id: null, name: 'Page 1' }], metadata: { next: null } });
    await expect(
      service.fetchCoreMetrics('test-token', 'acct-123', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'acct-123', dateRange),
    ).rejects.toThrow();
  });
});
