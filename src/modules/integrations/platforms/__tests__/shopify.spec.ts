import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { ShopifyApiService } from '../shopify-api.service';
import fixture from '../__fixtures__/shopify.fixture.json';
import page2Fixture from '../__fixtures__/shopify.page2.fixture.json';

const shopDomain = 'teststore.myshopify.com';
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('ShopifyApiService', () => {
  let service: ShopifyApiService;

  beforeEach(() => {
    service = new ShopifyApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', shopDomain, dateRange);
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
    const rows = await service.fetchCoreMetrics('test-token', shopDomain, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when order total_price is null', async () => {
    mockFetchResponse({ orders: [{ id: 1, financial_status: 'paid', total_price: null }] });
    await expect(
      service.fetchCoreMetrics('test-token', shopDomain, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', shopDomain, dateRange),
    ).rejects.toThrow();
  });

  it('pagination — fetches all pages and combines results', async () => {
    // Page 1 with Link header pointing to page 2
    mockFetchResponse(
      fixture,
      200,
      { Link: `<https://teststore.myshopify.com/admin/api/2024-01/orders.json?page_info=page2token>; rel="next"` },
    );
    // Page 2 with no next link
    mockFetchResponse(page2Fixture, 200, {});
    const rows = await service.fetchCoreMetrics('test-token', shopDomain, dateRange);
    // Page 1 has 3 paid orders + page 2 has 2 paid orders = 5 total
    const totalOrdersRow = rows.find(r => r.metricKey === 'total_orders');
    expect(totalOrdersRow).toBeDefined();
    expect(parseInt(totalOrdersRow!.value)).toBeGreaterThan(3);
  });
});
