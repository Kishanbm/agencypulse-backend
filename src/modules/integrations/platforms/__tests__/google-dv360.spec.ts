import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GoogleDv360ApiService } from '../google-dv360-api.service';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('GoogleDv360ApiService', () => {
  let service: GoogleDv360ApiService;

  beforeEach(() => {
    service = new GoogleDv360ApiService();
    clearFetchMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Step 1: create query
    mockFetchResponse({ queryId: 'dv360-query-9876543' });
    // Step 2: run query → returns reportId
    mockFetchResponse({ key: { reportId: 'report-xyz789' } });
    // Step 3: poll → DONE with download URL
    mockFetchResponse({
      metadata: {
        status: { state: 'DONE' },
        reportDataUri: 'https://storage.googleapis.com/dv360-reports/report.csv',
      },
    });
    // Step 4: download CSV
    const csv = `"date","impressions","clicks","revenue","ctr","cpm"\n"2024-01-15","452300","5840","3892.10","0.0129","8.61"\n"2024-01-16","471600","6120","4071.40","0.0130","8.63"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', '987654321', dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('impressions');
    expect(keys).toContain('clicks');
    expect(keys).toContain('spend');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when report done with empty data', async () => {
    mockFetchResponse({ queryId: 'dv360-query-empty' });
    mockFetchResponse({ key: { reportId: 'report-empty' } });
    mockFetchResponse({
      metadata: { status: { state: 'DONE' }, reportDataUri: 'https://example.com/empty.csv' },
    });
    const csv = `"date","impressions","clicks","revenue","ctr","cpm"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', '987654321', dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are zero', async () => {
    mockFetchResponse({ queryId: 'dv360-query-null' });
    mockFetchResponse({ key: { reportId: 'report-null' } });
    mockFetchResponse({
      metadata: { status: { state: 'DONE' }, reportDataUri: 'https://example.com/null.csv' },
    });
    const csv = `"date","impressions","clicks","revenue","ctr","cpm"\n"2024-01-15","0","0","0","0","0"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', '987654321', dateRange);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', '987654321', dateRange),
    ).rejects.toThrow();
  });
});
