import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GravityFormsApiService } from '../gravity-forms-api.service';
import fixture from '../__fixtures__/gravity-forms.fixture.json';

const accountJson = JSON.stringify({
  siteUrl: 'https://test.com',
  consumerSecret: 'cs_test',
  formId: '1',
});
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('GravityFormsApiService', () => {
  let service: GravityFormsApiService;

  beforeEach(() => {
    service = new GravityFormsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('ck_test', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('form_submissions');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ entries: [], total_count: 0 });
    const rows = await service.fetchCoreMetrics('ck_test', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when entries array is empty', async () => {
    mockFetchResponse({ entries: null, total_count: 0 });
    await expect(
      service.fetchCoreMetrics('ck_test', accountJson, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', accountJson, dateRange),
    ).rejects.toThrow();
  });

  it('pagination — fetches all pages', async () => {
    // First page: exactly 200 entries (triggers next page)
    const page1Entries = Array.from({ length: 200 }, (_, i) => ({ id: `entry-${i}` }));
    // Second page: 3 entries (stops pagination)
    const page2Entries = [{ id: 'entry-200' }, { id: 'entry-201' }, { id: 'entry-202' }];
    mockFetchResponse({ entries: page1Entries, total_count: 203 });
    mockFetchResponse({ entries: page2Entries, total_count: 203 });

    const rows = await service.fetchCoreMetrics('ck_test', accountJson, dateRange);
    const submissionsRow = rows.find(r => r.metricKey === 'form_submissions');
    expect(submissionsRow).toBeDefined();
    expect(parseInt(submissionsRow!.value)).toBe(203);
  });
});
