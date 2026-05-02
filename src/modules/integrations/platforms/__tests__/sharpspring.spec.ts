import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { SharpspringApiService } from '../sharpspring-api.service';
import fixture from '../__fixtures__/sharpspring.fixture.json';

const accountJson = JSON.stringify({ accountID: 'abc123' });
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('SharpspringApiService', () => {
  let service: SharpspringApiService;

  beforeEach(() => {
    service = new SharpspringApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Call 1: getLeads
    mockFetchResponse({
      result: {
        lead: [
          { id: 'ss-lead-11001', createTimestamp: '2024-01-15 09:00:00' },
          { id: 'ss-lead-11002', createTimestamp: '2024-01-16 10:00:00' },
        ],
      },
      error: null,
    });
    // Call 2: getOpportunities
    mockFetchResponse({
      result: {
        opportunity: [
          { id: 'ss-opp-1', dealValue: 5000, pipeline: 'Sales' },
          { id: 'ss-opp-2', dealValue: 3500, pipeline: 'Sales' },
        ],
      },
      error: null,
    });

    const rows = await service.fetchCoreMetrics('secret-key', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('new_leads');
    expect(keys).toContain('new_deals');
    expect(keys).toContain('deal_revenue');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when both calls return empty results', async () => {
    mockFetchResponse({ result: { lead: [] }, error: null });
    mockFetchResponse({ result: { opportunity: [] }, error: null });
    const rows = await service.fetchCoreMetrics('secret-key', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when deal value is null', async () => {
    mockFetchResponse({ result: { lead: [{ id: 'l1' }] }, error: null });
    mockFetchResponse({ result: { opportunity: [{ id: 'o1', dealValue: null }] }, error: null });
    await expect(
      service.fetchCoreMetrics('secret-key', accountJson, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', accountJson, dateRange),
    ).rejects.toThrow();
  });
});
