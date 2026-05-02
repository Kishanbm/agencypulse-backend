import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { SalesforceApiService } from '../salesforce-api.service';
import fixture from '../__fixtures__/salesforce.fixture.json';

const instanceUrl = 'https://mycompany.my.salesforce.com';
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('SalesforceApiService', () => {
  let service: SalesforceApiService;

  beforeEach(() => {
    service = new SalesforceApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Call 1: leads SOQL
    mockFetchResponse(fixture.leads);
    // Call 2: opportunities SOQL
    mockFetchResponse(fixture.opportunities);

    const rows = await service.fetchCoreMetrics('test-token', instanceUrl, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('new_leads');
    expect(keys).toContain('closed_deals');
    expect(keys).toContain('deal_revenue');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when both queries return 0 records', async () => {
    mockFetchResponse({ totalSize: 0, records: [{ cnt: 0 }] });
    mockFetchResponse({ totalSize: 0, records: [{ cnt: 0, total: 0 }] });
    const rows = await service.fetchCoreMetrics('test-token', instanceUrl, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when fields are null', async () => {
    mockFetchResponse({ records: [{ cnt: null }] });
    mockFetchResponse({ records: [{ cnt: null, total: null }] });
    await expect(
      service.fetchCoreMetrics('test-token', instanceUrl, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', instanceUrl, dateRange),
    ).rejects.toThrow();
  });
});
