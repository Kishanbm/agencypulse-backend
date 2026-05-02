import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { WoocommerceApiService } from '../woocommerce-api.service';

const accountJson = JSON.stringify({ siteUrl: 'https://test.com', consumerSecret: 'cs_secret123' });
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('WoocommerceApiService', () => {
  let service: WoocommerceApiService;

  beforeEach(() => {
    service = new WoocommerceApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse([
      { total_orders: 20, total_sales: '5842.75', net_revenue: '5292.75', average_sales: '292.14' },
    ]);
    const rows = await service.fetchCoreMetrics('ck_test123', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_orders');
    expect(keys).toContain('total_revenue');
    expect(keys).toContain('net_revenue');
    expect(keys).toContain('avg_order_value');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns zero results', async () => {
    mockFetchResponse([{ total_orders: 0, total_sales: '0', net_revenue: '0', average_sales: '0' }]);
    const rows = await service.fetchCoreMetrics('ck_test123', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse([{ total_orders: null, total_sales: null, net_revenue: null, average_sales: null }]);
    await expect(
      service.fetchCoreMetrics('ck_test123', accountJson, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', accountJson, dateRange),
    ).rejects.toThrow();
  });
});
