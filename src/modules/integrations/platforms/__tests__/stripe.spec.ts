import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { StripeApiService } from '../stripe-api.service';
import fixture from '../__fixtures__/stripe.fixture.json';
import page2Fixture from '../__fixtures__/stripe.page2.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('StripeApiService', () => {
  let service: StripeApiService;

  beforeEach(() => {
    service = new StripeApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // page 1 has has_more: true, so it will fetch page 2
    mockFetchResponse(fixture);
    mockFetchResponse(page2Fixture);
    const rows = await service.fetchCoreMetrics('sk_test_xxx', 'default', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_charges');
    expect(keys).toContain('total_revenue');
    expect(keys).toContain('avg_charge_value');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: [], has_more: false });
    const rows = await service.fetchCoreMetrics('sk_test_xxx', 'default', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when charge amount is null', async () => {
    mockFetchResponse({
      data: [{ id: 'ch_null', captured: true, refunded: false, amount: null, status: 'succeeded' }],
      has_more: false,
    });
    await expect(
      service.fetchCoreMetrics('sk_test_xxx', 'default', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', 'default', dateRange),
    ).rejects.toThrow();
  });

  it('pagination — fetches all pages and combines results', async () => {
    mockFetchResponse(fixture);       // has_more: true
    mockFetchResponse(page2Fixture);  // has_more: false
    const rows = await service.fetchCoreMetrics('sk_test_xxx', 'default', dateRange);
    const chargesRow = rows.find(r => r.metricKey === 'total_charges');
    expect(chargesRow).toBeDefined();
    // fixture has 3 valid charges + page2 has 1 = 4
    expect(parseInt(chargesRow!.value)).toBe(4);
  });
});
