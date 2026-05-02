import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GoogleAdManagerApiService } from '../google-ad-manager-api.service';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('GoogleAdManagerApiService', () => {
  let service: GoogleAdManagerApiService;

  beforeEach(() => {
    service = new GoogleAdManagerApiService();
    clearFetchMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Step 1: submit report
    mockFetchResponse({ name: 'networks/12345/operations/op-abc123' });
    // Step 2: poll until done
    mockFetchResponse({ done: true, response: { reportDataUri: 'https://example.com/report.csv' } });
    // Step 3: download CSV
    const csv = `"date","impressions","clicks","revenue","ctr"\n"2024-01-15","287400","3210","2480.75","0.011173"\n"2024-01-16","302100","3394","2612.40","0.011234"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', '12345678', dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when report completes with no rows', async () => {
    mockFetchResponse({ name: 'networks/12345/operations/op-empty' });
    mockFetchResponse({ done: true, response: { reportDataUri: 'https://example.com/empty.csv' } });
    const csv = `"date","impressions","clicks","revenue","ctr"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', '12345678', dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are zero', async () => {
    mockFetchResponse({ name: 'networks/12345/operations/op-null' });
    mockFetchResponse({ done: true, response: { reportDataUri: 'https://example.com/null.csv' } });
    const csv = `"date","impressions","clicks","revenue","ctr"\n"2024-01-15","0","0","0","0"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', '12345678', dateRange);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', '12345678', dateRange),
    ).rejects.toThrow();
  });
});
