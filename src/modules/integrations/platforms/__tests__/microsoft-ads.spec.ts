import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { MicrosoftAdsApiService } from '../microsoft-ads-api.service';

const accountJson = JSON.stringify({ customerId: '123', accountId: '456', developerToken: 'dev-token-xyz' });
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('MicrosoftAdsApiService', () => {
  let service: MicrosoftAdsApiService;

  beforeEach(() => {
    service = new MicrosoftAdsApiService();
    clearFetchMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Step 1: submit report → returns report ID
    mockFetchResponse({ ReportRequestId: 'report-id-123' });
    // Step 2: poll → COMPLETED with download URL
    mockFetchResponse({
      ReportRequestStatus: {
        Status: 'Success',
        ReportDownloadUrl: 'https://example.com/report.csv',
      },
    });
    // Step 3: download CSV
    const csv = `"Report Name:","AgencyPulse_Campaign_Performance"\n"Report Time Period:","2024-01-15 - 2024-01-21"\n"TimePeriod","Impressions","Clicks","Spend","Ctr","AverageCpc","Conversions"\n"2024-01-15","14820","1243","892.45","8.39%","0.718","87"\n"2024-01-16","15340","1298","921.10","8.46%","0.709","91"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    // Advance timers to skip sleep calls
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

  it('empty data — returns [] when poll returns Success but CSV has no data rows', async () => {
    mockFetchResponse({ ReportRequestId: 'report-id-empty' });
    mockFetchResponse({
      ReportRequestStatus: { Status: 'Success', ReportDownloadUrl: 'https://example.com/empty.csv' },
    });
    // CSV with header but no data rows
    const csv = `"TimePeriod","Impressions","Clicks","Spend","Ctr","AverageCpc","Conversions"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are zero', async () => {
    mockFetchResponse({ ReportRequestId: 'report-id-null' });
    mockFetchResponse({
      ReportRequestStatus: { Status: 'Success', ReportDownloadUrl: 'https://example.com/null.csv' },
    });
    const csv = `"TimePeriod","Impressions","Clicks","Spend","Ctr","AverageCpc","Conversions"\n"2024-01-15","0","0","0.00","0%","0.00","0"\n`;
    mockFetchResponse(csv);

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);

    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, dateRange),
    ).rejects.toThrow();
  });

  it('report poll — throws after timeout if never DONE', async () => {
    mockFetchResponse({ ReportRequestId: 'report-id-timeout' });
    // All polls return Pending
    for (let i = 0; i < 12; i++) {
      mockFetchResponse({ ReportRequestStatus: { Status: 'Pending' } });
    }

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    // Attach rejection handler BEFORE advancing timers to prevent unhandled rejection warning
    const assertion = expect(promise).rejects.toThrow();
    await jest.runAllTimersAsync();
    await assertion;
  });
});
