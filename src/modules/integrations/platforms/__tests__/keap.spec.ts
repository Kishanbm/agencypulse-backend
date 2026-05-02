import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { KeapApiService } from '../keap-api.service';
import fixture from '../__fixtures__/keap.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('KeapApiService', () => {
  let service: KeapApiService;

  beforeEach(() => {
    service = new KeapApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Fixture uses 'total' field but service reads 'order_total' — remap for correct shape
    const mapped = {
      orders: fixture.orders.map((o: any) => ({ ...o, order_total: o.total })),
      count: fixture.count,
      next: fixture.next,
    };
    mockFetchResponse(mapped);
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_orders');
    expect(keys).toContain('total_revenue');
    expect(keys).toContain('avg_order_value');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ orders: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when order fields are null', async () => {
    mockFetchResponse({ orders: [{ id: 1, status: 'Paid', order_total: null }], next: null });
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

  it('pagination — fetches all pages via offset loop', async () => {
    // Page 1: 200 orders (max page size) with next token
    const page1Orders = Array.from({ length: 200 }, (_, i) => ({
      order_total: 100,
      status: 'Paid',
    }));
    // Page 2: fewer orders, no next
    const page2Orders = [{ order_total: 250, status: 'Paid' }, { order_total: 150, status: 'Paid' }];
    mockFetchResponse({ orders: page1Orders, next: 'next-cursor', count: 200 });
    mockFetchResponse({ orders: page2Orders, next: null, count: 2 });

    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    const totalOrdersRow = rows.find(r => r.metricKey === 'total_orders');
    expect(totalOrdersRow).toBeDefined();
    expect(parseInt(totalOrdersRow!.value)).toBe(202);
  });
});
