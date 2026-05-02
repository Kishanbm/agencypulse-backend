import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { HubspotApiService } from '../hubspot-api.service';
import fixture from '../__fixtures__/hubspot.fixture.json';
import page2Fixture from '../__fixtures__/hubspot.page2.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('HubspotApiService', () => {
  let service: HubspotApiService;

  beforeEach(() => {
    service = new HubspotApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Call 1: contacts endpoint
    mockFetchResponse(fixture.contacts);
    // Call 2: deals page 1
    mockFetchResponse(fixture.deals);
    // Call 3: deals page 2 (pagination)
    mockFetchResponse(page2Fixture.deals);

    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('new_contacts');
    expect(keys).toContain('new_deals');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when contacts and deals both empty', async () => {
    mockFetchResponse({ paging: { total: 0 } });
    mockFetchResponse({ results: [], paging: {} });
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when deal amount is null', async () => {
    mockFetchResponse({ paging: { total: 5 } });
    mockFetchResponse({
      results: [{ id: 'd1', properties: { dealstage: 'closedwon', amount: null } }],
      paging: {},
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

  it('pagination — fetches all deal pages and combines results', async () => {
    mockFetchResponse({ paging: { total: 10 } });
    // Page 1 with next page link
    mockFetchResponse({
      results: [
        { id: 'd1', properties: { dealstage: 'closedwon', amount: '5000' } },
        { id: 'd2', properties: { dealstage: 'closedwon', amount: '3000' } },
      ],
      paging: { next: { link: 'https://api.hubapi.com/crm/v3/objects/deals?after=cursor2' } },
    });
    // Page 2 with no next
    mockFetchResponse({
      results: [{ id: 'd3', properties: { dealstage: 'closedwon', amount: '2500' } }],
      paging: {},
    });

    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    const newDealsRow = rows.find(r => r.metricKey === 'new_deals');
    expect(newDealsRow).toBeDefined();
    expect(parseInt(newDealsRow!.value)).toBe(3);
  });
});
