import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { BigcommerceApiService } from '../bigcommerce-api.service';
import fixture from '../__fixtures__/bigcommerce.fixture.json';

const accountJson = JSON.stringify({ storeHash: 'abc123' });
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('BigcommerceApiService', () => {
  let service: BigcommerceApiService;

  beforeEach(() => {
    service = new BigcommerceApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // First page has data, second page returns empty array to stop pagination
    mockFetchResponse(fixture);
    mockFetchResponse([]);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_orders');
    expect(keys).toContain('total_revenue');
    expect(keys).toContain('avg_order_value');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse([]);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when order total_inc_tax is null', async () => {
    mockFetchResponse([{ status_id: 10, total_inc_tax: null }]);
    mockFetchResponse([]);
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

  it('pagination — fetches multiple pages and combines results', async () => {
    // First page: 250 orders (triggers pagination)
    const page1 = Array.from({ length: 250 }, (_, i) => ({
      status_id: 10,
      total_inc_tax: '100.00',
    }));
    // Second page: fewer than 250, stops pagination
    const page2 = Array.from({ length: 3 }, () => ({ status_id: 10, total_inc_tax: '150.00' }));
    mockFetchResponse(page1);
    mockFetchResponse(page2);

    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    const totalOrdersRow = rows.find(r => r.metricKey === 'total_orders');
    expect(totalOrdersRow).toBeDefined();
    expect(parseInt(totalOrdersRow!.value)).toBe(253);
  });
});
